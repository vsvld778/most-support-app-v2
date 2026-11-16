import io

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase
from PIL import Image


class EditorialTests(TestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_superuser("editor@example.test", "test-password")
        self.staff = get_user_model().objects.create_user("staff@example.test", "test-password", is_staff=True)
        self.draft = "/admin/editorial/draft/application/home/"
        self.public = "/api/public/editorial/application/home/"
        self.rule = {"lang": "uz", "path": "main.0", "kind": "text", "field": "0", "source": "123abcd0",
                     "value": "Murojaatlar"}

    def submit(self, rules, version, action):
        return self.client.post(self.draft, {"rules": rules, "version": version, "action": action},
                                content_type="application/json")

    def test_draft_and_publication_are_independent(self):
        self.client.force_login(self.owner)
        self.assertEqual(self.submit([self.rule], 0, "save").status_code, 200)
        self.assertEqual(Client().get(self.public).json()["rules"], [])
        self.assertEqual(self.submit([], 0, "publish").status_code, 409)
        self.assertEqual(self.submit([self.rule], 1, "publish").status_code, 200)
        self.assertEqual(Client().get(self.public).json()["rules"], [self.rule])
        self.assertEqual(Client().get("/api/public/editorial/personal/entry/").json()["rules"], [])

    def test_owner_only_and_real_page_names(self):
        self.client.force_login(self.staff)
        self.assertEqual(self.client.get(self.draft).status_code, 403)
        self.assertEqual(self.submit([self.rule], 0, "publish").status_code, 403)
        self.client.force_login(self.owner)
        self.assertEqual(self.submit([{**self.rule, "path": "body > div"}], 0, "save").status_code, 400)
        self.assertEqual(self.client.get("/api/public/editorial/site/guide/read_contract/").status_code, 200)
        self.assertEqual(self.client.get("/api/public/editorial/site/unknown/").status_code, 404)
        for page in ("entry", "login", "signup", "cases", "case-new", "case"):
            self.assertContains(self.client.get(f"/admin/editorial/preview/personal/{page}/"), f'data-page="{page}"')

    def test_asset_is_released_only_with_publication(self):
        self.client.force_login(self.owner)
        data = io.BytesIO()
        Image.new("RGB", (16, 16), "blue").save(data, "PNG")
        response = self.client.post("/admin/editorial/upload/", {"image": SimpleUploadedFile("test.png", data.getvalue())})
        self.assertEqual(response.status_code, 201)
        key = response.json()["key"]
        url = f"/editorial-images/{key}/"
        self.assertEqual(Client().get(url).status_code, 404)
        rule = {**self.rule, "kind": "image", "field": "src", "value": key}
        self.assertEqual(self.submit([rule], 0, "publish").status_code, 200)
        with Image.open(io.BytesIO(Client().get(url).content)) as rendered:
            self.assertEqual(rendered.format, "WEBP")
