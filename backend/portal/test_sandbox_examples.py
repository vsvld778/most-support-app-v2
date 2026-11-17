from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.urls import reverse

from .models import CaseMessage, SupportCase, User, UserWorkspace
from .organization_models import OrganizationRequest
from .platform_controls import PERSONAL_SEEDS, feature_modes
from .sandbox_examples import example_id


class SandboxExamplesTests(TestCase):
    def test_command_requires_sandbox(self):
        with self.assertRaises(CommandError):
            call_command("populate_staff_sandbox", stdout=StringIO())

    @override_settings(STAFF_SANDBOX=True, PORTAL_INTAKE_MODE="test",
                       PUBLIC_SITE_URL="https://app.example.test/staff-test/cabinet/")
    def test_populate_preserves_existing_records_and_scopes_shared_example(self):
        call_command("seed_staff_sandbox", stdout=StringIO())
        migrate = User.objects.get(email="migrant@most.example")
        workspace = UserWorkspace.objects.create(owner=migrate, data={"version": 2, "profile": {"name": "Своя запись"}, "modules": {}})
        call_command("populate_staff_sandbox", stdout=StringIO())
        workspace.refresh_from_db()
        self.assertEqual(workspace.data["profile"]["name"], "Своя запись")
        self.assertEqual(set(workspace.data["modules"]), set(PERSONAL_SEEDS))
        self.assertTrue(all(feature_modes(migrate)["personal." + key] == "on" for key in PERSONAL_SEEDS))
        self.assertEqual(len(workspace.data["modules"]["work"]["records"]), 4)
        case = SupportCase.objects.get(public_id=example_id("consultation-case"))
        self.assertEqual(case.messages.count(), 4)
        self.assertTrue(case.is_test and case.partner_sharing_approved)

        self.client.force_login(migrate)
        applicant = self.client.get(reverse("mobile_case", args=[case.public_id])).json()
        internal = case.messages.get(audience=CaseMessage.Audience.INTERNAL).body
        self.assertNotIn(internal, [message["body"] for message in applicant["messages"]])
        partner = User.objects.get(email="partner@most.example")
        self.client.force_login(partner)
        organization_session = self.client.get(reverse("organization_session")).json()
        self.assertEqual(organization_session["cases"][0]["summary"], case.partner_summary)
        response = self.client.get(organization_session["cases"][0]["url"])
        self.assertContains(response, case.partner_summary)
        self.assertNotContains(response, internal)
        self.assertNotContains(response, case.description)

        revision = workspace.revision
        case_count = SupportCase.objects.count()
        request_count = OrganizationRequest.objects.count()
        call_command("populate_staff_sandbox", stdout=StringIO())
        workspace.refresh_from_db()
        self.assertEqual(workspace.revision, revision)
        self.assertEqual(SupportCase.objects.count(), case_count)
        self.assertEqual(OrganizationRequest.objects.count(), request_count)
