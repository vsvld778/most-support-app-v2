from html.parser import HTMLParser
from http.cookiejar import CookieJar
import json
from pathlib import Path
import sys
from urllib.parse import urlencode, urlparse
from urllib.request import HTTPCookieProcessor, Request, build_opener
from urllib.error import HTTPError

HOST = sys.argv[1]
ORIGIN = f"https://{HOST}"
BASE = ORIGIN + "/staff-test"
AUTH = dict(line.split() for line in Path("/etc/most-support-staff-sandbox/test-accounts").read_text().splitlines())


class Page(HTMLParser):
    def __init__(self, markup):
        super().__init__(convert_charrefs=True)
        self.inputs = {}
        self.links = []
        self.feed(markup)

    def handle_starttag(self, tag, attrs):
        at = dict(attrs)
        if tag == "input" and "name" in at:
            self.inputs.setdefault(at["name"], at.get("value", ""))
        if tag == "a" and "href" in at:
            self.links.append(at["href"])


def web(client, path, fields=None):
    url = BASE + path
    req = Request(url, data=urlencode(fields).encode() if fields is not None else None,
                  headers={"Referer": url, "Origin": ORIGIN} if fields is not None else {})
    with client.open(req, timeout=12) as response:
        assert urlparse(response.url).path.startswith("/staff-test/"), response.url
        return response.read().decode("utf-8")


def account(role, destination):
    client = build_opener(HTTPCookieProcessor(CookieJar()))
    route = "/login/?" + urlencode({"next": "/staff-test" + destination})
    form = Page(web(client, route))
    address = role + "@most.example"
    entered = web(client, route, {"username": address, "password": AUTH[address],
                                  "csrfmiddlewaretoken": form.inputs["csrfmiddlewaretoken"],
                                  "next": "/staff-test" + destination})
    assert "id_password" not in entered, "Role login failed"
    return client, entered


def action(client, path, kind, **fields):
    page = Page(web(client, path))
    hidden = {key: page.inputs[key] for key in ("csrfmiddlewaretoken", "version")}
    return web(client, path, {"action": kind, **hidden, **fields})


coordinator, queue = account("coordinator", "/staff/")
assert "Уточнить расчёт оплаты за смены" in queue and "Согласовать встречу по адаптации" in queue
paths = Page(queue).links
mp = next(x.removeprefix("/staff-test") for x in paths if x.startswith("/staff-test/staff/mp/"))
org = next(x.removeprefix("/staff-test") for x in paths if x.startswith("/staff-test/staff/org/"))
case_id = mp.rstrip("/").split("/")[-1]
request_id = org.rstrip("/").split("/")[-1]
mp_marker = "Проверочный ответ центра для мигранта"
org_marker = "Проверочный ответ центра для организации"
note = "Служебная запись для проверки видимости"
action(coordinator, mp, "reply", body=mp_marker)
action(coordinator, mp, "note", body=note)
action(coordinator, mp, "step", status="waiting", next_step="Уточните дату смены.", due="")
action(coordinator, org, "reply", body=org_marker)
action(coordinator, org, "step", status="waiting", next_step="Предложите время.", due="")

migrant, cases = account("migrant", "/cases/")
assert "Уточнить расчёт оплаты за смены" in cases
data = json.loads(web(migrant, "/api/v2/cases/" + case_id + "/"))
assert data["nextStep"] == "Уточните дату смены."
assert mp_marker in [item["body"] for item in data["messages"]]
assert note not in [item["body"] for item in data["messages"]]
try:
    web(migrant, mp)
except HTTPError as error:
    assert error.code == 403
else:
    raise AssertionError("User reached the staff workspace")

specialist, view = account("specialist", "/staff/")
assert "Проверить условия в образце договора" in view
assert "Уточнить расчёт оплаты за смены" not in view
partner, workspace = account("partner", "/partners/")
assert 'data-mode="server"' in workspace
data = json.loads(web(partner, "/partners/api/requests/" + request_id + "/"))
assert data["request"]["nextStep"] == "Предложите время."
assert org_marker in [item["body"] for item in data["messages"]]
print("Four sandbox logins and both cross-cabinet workflows passed.")
