import io
import json
import re
import uuid
from types import SimpleNamespace

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.http import Http404, HttpResponse, JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from PIL import Image, ImageOps

from .editorial import LANGUAGES, SURFACES, EditorialImage, EditorialPage
from .forms import CaseMessageForm, EmailAuthenticationForm, SignupForm, SupportCaseForm
from .platform_controls import FEATURES, PERSONAL_SEEDS

SITE_DETAIL = re.compile(r"(?:issue|guide|cooperate)(?:/[a-z0-9_-]{1,40}){1,2}")
ELEMENT_PATH = re.compile(r"(?:main|body|dialog|header|footer|aside|nav)(?:\.[0-9]{1,3}){0,24}")
SOURCE = re.compile(r"[0-9a-f]{8}")
MAX_IMAGE = 5 * 1024 * 1024
PERSONAL_TEMPLATES = {
    "entry": "portal/entry.html", "login": "registration/login.html", "signup": "registration/signup.html",
    "cases": "portal/dashboard.html", "case-new": "portal/case_form.html", "case": "portal/case_detail.html",
}


def require_owner(request):
    if not request.user.is_active or not request.user.is_superuser:
        raise PermissionDenied


def check_page(surface, page):
    if (
        page in SURFACES.get(surface, {})
        or (surface == "application" and page in PERSONAL_SEEDS)
        or (surface == "site" and SITE_DETAIL.fullmatch(page))
    ):
        return
    raise Http404


def links(surface):
    pages = dict(SURFACES[surface])
    if surface == "application":
        pages.update({name: FEATURES["personal." + name] for name in PERSONAL_SEEDS})
    result = []
    for key, title in pages.items():
        fragment = "#" + key
        if surface == "site":
            url = reverse("admin:editorial_site_preview")
        elif surface == "personal":
            url = reverse("admin:editorial_personal_preview", args=[key])
            fragment = ""
        elif surface == "organization":
            url = "/partners/preview/"
            if key == "request":
                fragment = "#request/editorial-sample"
        else:
            url = "/app/"
        result.append({"title": title, "url": f"{url}?editorial={surface}{fragment}"})
    return result


def normalize(raw):
    if not isinstance(raw, list) or len(raw) > 240:
        raise ValueError("Можно сохранить до 240 изменений на странице.")
    checked, images, identities = [], set(), set()
    for rule in raw:
        if not isinstance(rule, dict):
            raise ValueError("Неверный формат изменения.")
        lang, path, kind, field, source, value = (
            rule.get(key) for key in ("lang", "path", "kind", "field", "source", "value")
        )
        if not (
            all(isinstance(item, str) for item in (lang, path, kind, field, source))
            and lang in LANGUAGES and ELEMENT_PATH.fullmatch(path) and SOURCE.fullmatch(source)
        ):
            raise ValueError("Неверный адрес элемента.")
        if kind == "text" and (field in {"alt", "title", "aria-label", "placeholder"} or re.fullmatch(r"\d{1,3}", field)):
            if not isinstance(value, str) or len(value) > 5000 or "\x00" in value:
                raise ValueError("Текст должен содержать не более 5000 символов.")
        elif kind == "image" and field in {"src", "background"}:
            if not isinstance(value, str):
                raise ValueError("Выберите изображение.")
            value = str(uuid.UUID(value))
            images.add(value)
        elif kind != "block" or field != "hidden" or type(value) is not bool:
            raise ValueError("Неизвестный тип изменения.")
        identity = (lang, path, kind, field, source)
        if identity in identities:
            raise ValueError("Повторяющееся изменение.")
        identities.add(identity)
        checked.append({"lang": lang, "path": path, "kind": kind, "field": field, "source": source, "value": value})
    return checked, images


@require_GET
def publication(request, surface, page):
    check_page(surface, page)
    row = EditorialPage.objects.filter(surface=surface, page=page).values("published", "published_version").first()
    return JsonResponse({"rules": row["published"] if row else [], "version": row["published_version"] if row else 0})


@require_http_methods(["GET", "POST"])
def draft(request, surface, page):
    require_owner(request)
    check_page(surface, page)
    if request.method == "GET":
        row = EditorialPage.objects.filter(surface=surface, page=page).first()
        return JsonResponse({
            "rules": row.draft if row else [], "version": row.version if row else 0,
            "publishedVersion": row.published_version if row else 0, "csrf": get_token(request),
        })
    try:
        body = request.read(1024 * 1024 + 1)
        if len(body) > 1024 * 1024:
            raise ValueError("Объём черновика превышает 1 МБ.")
        data = json.loads(body)
        if not isinstance(data, dict) or type(data.get("version")) is not int or data.get("action") not in ("save", "publish"):
            raise ValueError("Неверная команда редактора.")
        rules, images = normalize(data.get("rules"))
        if EditorialImage.objects.filter(pk__in=images).count() != len(images):
            raise ValueError("Изображение больше недоступно.")
    except (ValueError, UnicodeError) as error:
        return JsonResponse({"error": str(error)}, status=400)
    with transaction.atomic():
        row, _ = EditorialPage.objects.select_for_update().get_or_create(surface=surface, page=page)
        if row.version != data["version"]:
            return JsonResponse({"error": "Страница уже изменена. Обновите её."}, status=409)
        row.version += 1
        row.draft = rules
        if data["action"] == "publish":
            row.published = rules
            row.published_version = row.version
            EditorialImage.objects.filter(pk__in=images).update(released=True)
        row.save()
    return JsonResponse({"version": row.version, "publishedVersion": row.published_version})


@require_POST
def upload(request):
    require_owner(request)
    item = request.FILES.get("image")
    output = io.BytesIO()
    try:
        if not item or item.size > MAX_IMAGE:
            raise ValueError
        with Image.open(item) as picture:
            if picture.format not in {"JPEG", "PNG", "WEBP"} or max(picture.size) > 5000 or getattr(picture, "n_frames", 1) != 1:
                raise ValueError
            # Re-encode pixels. The public image contains no uploaded metadata or executable content.
            rgba = ImageOps.exif_transpose(picture).convert("RGBA")
            rgba.info.clear()
            rgba.save(output, format="WEBP", quality=88, method=4)
        if output.tell() > MAX_IMAGE:
            raise ValueError
    except (OSError, ValueError, Image.DecompressionBombError):
        return JsonResponse({"error": "Выберите статическое JPG, PNG или WebP до 5 МБ и 5000 пикселей по стороне."}, status=400)
    key = uuid.uuid4()
    EditorialImage.objects.create(key=key, data=output.getvalue())
    return JsonResponse({"key": str(key)}, status=201)


@require_GET
def image(request, key, private=False):
    if private:
        require_owner(request)
    item = get_object_or_404(EditorialImage, key=key, **({} if private else {"released": True}))
    response = HttpResponse(bytes(item.data), content_type="image/webp")
    response["X-Content-Type-Options"] = "nosniff"
    return response


@require_GET
def site_preview(request):
    require_owner(request)
    try:
        markup = (settings.STATIC_ROOT / "editorial-site" / "index.html").read_text(encoding="utf-8")
    except FileNotFoundError:
        return HttpResponse("На сервере пока нет копии сайта для предпросмотра.", status=503)
    markup = re.sub(r"(?<![\w/])assets/", "/static/editorial-site/assets/", markup)
    markup = markup.replace('href="concept.pdf"', 'href="/static/editorial-site/concept.pdf"')
    return HttpResponse(markup)


@require_GET
def personal_preview(request, page):
    require_owner(request)
    if page not in PERSONAL_TEMPLATES:
        raise Http404
    context = {"editorial_page": page}
    if page in ("entry", "login", "signup"):
        context["user"] = AnonymousUser()
    if page == "login":
        context["form"] = EmailAuthenticationForm()
    if page == "signup":
        context["form"] = SignupForm()
    if page == "cases":
        context.update(cases=(), stats={"total": 0, "active": 0, "waiting": 0, "resolved": 0})
    if page == "case-new":
        context.update(form=SupportCaseForm(), intake_mode="test")
    if page == "case":
        case = SimpleNamespace(
            public_id=uuid.UUID(int=0), reference="DEMO-001", title="Пример обращения", is_test=True,
            status="new", description="Образец описания ситуации.", get_status_display="Новое",
            get_category_display="Другое", get_preferred_language_display="Русский",
        )
        context.update(case=case, form=CaseMessageForm(), case_messages=())
    return render(request, PERSONAL_TEMPLATES[page], context)
