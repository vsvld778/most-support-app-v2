from django.test import Client, TestCase, override_settings
from django.urls import reverse

from .models import CaseEvent, CaseMessage, Organization, OrganizationMembership, SupportCase, User
from .organization_models import OrganizationRequest
from .staff_models import StaffMembership, StaffTeam


@override_settings(PORTAL_INTAKE_MODE="test")
class StaffDeskTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        def person(name, **fields):
            return User.objects.create_user(email=f"{name}@example.test", display_name=name, **fields)

        cls.migrant = person("migrant")
        cls.outsider = person("other")
        cls.coordinator = person("coordinator", is_staff=True)
        cls.specialist = person("specialist")
        cls.partner = person("partner")
        cls.fund, _ = StaffTeam.objects.get_or_create(slug="fund", defaults={"name": "Приём фонда"})
        cls.institute, _ = StaffTeam.objects.get_or_create(slug="institute", defaults={"name": "Институт"})
        StaffMembership.objects.create(team=cls.fund, user=cls.coordinator, role="lead")
        StaffMembership.objects.create(team=cls.institute, user=cls.specialist, role="specialist")
        cls.org = Organization.objects.create(name="Учебная НКО", kind="ngo", is_approved=True)
        OrganizationMembership.objects.create(organization=cls.org, user=cls.partner, role="manager")
        cls.case = SupportCase.objects.create(owner=cls.migrant, title="Оплата смены", category="employment",
                                              description="Вымышленная ситуация", is_test=True)
        cls.request_item = OrganizationRequest.objects.create(organization=cls.org, created_by=cls.partner,
            title="Встреча", category="adaptation", body="Вымышленный пример.", is_test=True)

    def setUp(self):
        self.url = reverse("staff_case", args=["mp", self.case.public_id])
        self.org_url = reverse("staff_case", args=["org", self.request_item.public_id])
        self.mobile_url = reverse("mobile_case", args=[self.case.public_id])
        self.client.force_login(self.coordinator)

    def post(self, action, **values):
        case = SupportCase.objects.get(pk=self.case.pk)
        return self.client.post(self.url, {"version": case.updated_at.isoformat(), "action": action, **values})

    def test_assigned_scope_and_legacy_admin_isolation(self):
        self.assertContains(self.client.get(reverse("staff_queue")), self.case.title)
        self.assertEqual(self.client.get("/admin/").status_code, 302)
        self.assertEqual(self.post("assign", team=self.institute.pk, assignee=self.specialist.pk).status_code, 302)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.client.force_login(self.specialist)
        self.assertContains(self.client.get(self.url), self.case.title)
        self.assertEqual(self.post("reply", body="Недоступный ответ").status_code, 403)
        self.assertEqual(self.post("note", body="Вывод специалиста").status_code, 302)
        StaffMembership.objects.filter(user=self.specialist).update(active=False)
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_reply_step_and_note_reach_only_owner(self):
        self.assertEqual(self.post("reply", body="Проверим расчёт.").status_code, 302)
        self.assertEqual(self.post("note", body="Внутренняя запись").status_code, 302)
        self.assertEqual(self.post("step", status="waiting", next_step="Уточните дату.", due="").status_code, 302)
        self.assertEqual(CaseEvent.objects.filter(case=self.case, event_type__startswith="staff_").count(), 3)
        self.client.force_login(self.migrant)
        payload = self.client.get(self.mobile_url).json()
        self.assertEqual(payload["nextStep"], "Уточните дату.")
        self.assertEqual([item["body"] for item in payload["messages"]], ["Проверим расчёт."])
        response = self.client.get(self.case.get_absolute_url())
        self.assertContains(response, "Проверим расчёт.")
        self.assertNotContains(response, "Внутренняя запись")
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.client.force_login(self.outsider)
        self.assertEqual(self.client.get(self.mobile_url).status_code, 404)
        self.assertEqual(Client().get(self.mobile_url).status_code, 401)

    def test_org_reply_and_step_use_org_thread(self):
        actions = [("reply", {"body": "Согласуем дату."}), ("note", {"body": "Служебная запись"}),
                   ("step", {"status": "in_progress", "next_step": "Предложите время.", "due": ""})]
        for action, fields in actions:
            self.request_item.refresh_from_db()
            payload = {"version": self.request_item.updated_at.isoformat(), "action": action, **fields}
            self.assertEqual(self.client.post(self.org_url, payload).status_code, 302)
        self.client.force_login(self.partner)
        url = reverse("organization_request_detail", args=[self.request_item.public_id])
        result = self.client.get(url).json()
        self.assertEqual(result["request"]["nextStep"], "Предложите время.")
        self.assertEqual([row["body"] for row in result["messages"]], ["Согласуем дату."])

    def test_stale_reply_does_not_duplicate_and_partner_needs_consent(self):
        version = self.case.updated_at.isoformat()
        self.assertEqual(self.post("partner", body="Не отправляется").status_code, 403)
        self.assertEqual(self.post("reply", body="Один ответ").status_code, 302)
        self.assertEqual(self.client.post(self.url, {"action": "reply", "body": "Дубль", "version": version}).status_code, 409)
        self.assertEqual(CaseMessage.objects.filter(case=self.case).count(), 1)
