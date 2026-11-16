import json

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase, override_settings
from django.urls import reverse

from .models import Organization, OrganizationMembership, UserWorkspace
from .organization_models import OrganizationRequest, OrganizationRequestMessage
from .platform_controls import ContentBlock, ContentRevision, FeatureSetting


@override_settings(PORTAL_INTAKE_MODE="test", REGISTRATION_MODE="closed")
class PlatformIntegrationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        users = get_user_model()
        cls.member = users.objects.create_user("pilot@example.test", "test-password")
        cls.other = users.objects.create_user("other@example.test", "test-password")
        cls.org = Organization.objects.create(name="Учебный партнёр", kind="ngo", is_approved=True)
        OrganizationMembership.objects.create(organization=cls.org, user=cls.member, role="manager")

    def test_one_login_opens_both_cabinets_with_independent_records(self):
        self.assertContains(self.client.get(reverse("cabinet_entry")), "/login/?next=/app/")
        self.assertTrue(self.client.login(email=self.member.email, password="test-password"))
        session = self.client.get(reverse("v2_session")).json()
        self.assertEqual(session["user_id"], str(self.member.pk))
        self.assertEqual(self.client.get(reverse("partner_dashboard")).status_code, 200)
        self.assertEqual(self.client.get(reverse("organization_session")).json()["organization"]["id"], self.org.pk)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(reverse("organization_session")).status_code, 403)

    def test_disabled_personal_module_retains_data_and_requires_pilot_membership_for_writes(self):
        UserWorkspace.objects.create(owner=self.member, revision=1, data={"modules": {"family": {"members": ["old"]}}})
        feature = FeatureSetting.objects.get(pk="personal.family")
        feature.mode = "pilot"
        feature.save()
        self.client.force_login(self.member)
        url = reverse("v2_workspace")
        payload = json.dumps({"revision": 1, "data": {"modules": {"family": {"members": ["new"]}}}})
        headers = {"content_type": "application/json", "HTTP_X_MOST_WORKSPACE_OWNER": str(self.member.pk)}
        self.assertEqual(self.client.put(url, payload, **headers).json()["error"], "module_unavailable")
        self.assertEqual(self.client.get(url).json()["data"]["modules"]["family"]["members"], ["old"])
        feature.pilot_users.add(self.member)
        self.assertEqual(self.client.put(url, payload, **headers).status_code, 200)
        self.assertEqual(self.client.get(reverse("v2_session")).json()["platform"]["modules"]["family"], "on")
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(reverse("v2_session")).json()["platform"]["modules"]["family"], "off")

    def test_org_pause_blocks_new_requests_and_keeps_existing_conversation(self):
        FeatureSetting.objects.filter(pk="intake.organization").update(mode="pause")
        item = OrganizationRequest.objects.create(organization=self.org, created_by=self.member, title="Тест",
            category="consultation", body="Начатое обращение", is_test=True)
        self.client.force_login(self.member)
        fresh = {"title": "Новая", "category": "consultation", "body": "Тест", "testDataOnly": True}
        self.assertEqual(self.client.post(reverse("organization_requests"), fresh,
                                        content_type="application/json").status_code, 409)
        reply = {"body": "Продолжение", "testDataOnly": True}
        url = reverse("organization_request_detail", args=[item.public_id])
        self.assertEqual(self.client.post(url, reply, content_type="application/json").status_code, 201)
        FeatureSetting.objects.filter(pk="intake.organization").update(mode="read")
        self.assertEqual(self.client.post(url, reply, content_type="application/json").status_code, 409)
        self.assertEqual(OrganizationRequestMessage.objects.filter(request=item).count(), 1)
        self.assertEqual(self.client.get(url).status_code, 200)

    def test_site_publication_reads_only_published_revision(self):
        block = ContentBlock.objects.get(target="site")
        block.title = "Новый черновик"
        block.save()
        url = reverse("site_publication")
        self.assertFalse(self.client.get(url).json()["visible"])
        ContentRevision.objects.create(block=block, title="Опубликовано", text="Объявление", visible=True)
        payload = self.client.get(url).json()
        self.assertEqual(payload["title"], "Опубликовано")
        self.assertNotIn("Новый черновик", payload.values())

    def test_staff_cannot_manage_platform_controls(self):
        self.other.is_staff = True
        request = RequestFactory().get("/admin/")
        request.user = self.other
        for model in (FeatureSetting, ContentBlock, ContentRevision):
            controller = admin.site._registry[model]
            self.assertFalse(controller.has_view_permission(request))
            self.assertFalse(controller.has_change_permission(request))
