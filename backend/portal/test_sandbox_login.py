from django.contrib.auth import get_user_model
from django.middleware.csrf import get_token
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from .models import Organization, OrganizationMembership
from .staff_models import StaffMembership, StaffTeam


@override_settings(
    STAFF_SANDBOX=True, STAFF_BASE="", CSRF_FAILURE_VIEW="portal.views.sandbox_csrf_failure",
)
class SandboxLoginTests(TestCase):
    password = "Synthetic-only-password-718!"

    @classmethod
    def setUpTestData(cls):
        user_model = get_user_model()
        cls.staff = user_model.objects.create_user("staff@example.test", cls.password)
        cls.partner = user_model.objects.create_user("partner@example.test", cls.password)
        cls.migrant = user_model.objects.create_user("migrant@example.test", cls.password)
        team = StaffTeam.objects.get(slug="fund")
        StaffMembership.objects.create(user=cls.staff, team=team, role=StaffMembership.Role.LEAD)
        organization = Organization.objects.create(name="Synthetic organization", is_approved=True)
        OrganizationMembership.objects.create(user=cls.partner, organization=organization)

    def login(self, client, user, token, **fields):
        return client.post(reverse("login"), {
            "username": user.email, "password": self.password, "csrfmiddlewaretoken": token, **fields,
        })

    def test_common_login_opens_the_users_cabinet(self):
        for user, destination in (
            (self.staff, "staff_queue"), (self.partner, "partner_dashboard"), (self.migrant, "dashboard"),
        ):
            with self.subTest(destination=destination):
                client = Client(enforce_csrf_checks=True)
                token = get_token(client.get(reverse("login")).wsgi_request)
                result = self.login(client, user, token)
                self.assertRedirects(result, reverse(destination), fetch_redirect_response=False)

    def test_stale_form_reloads_and_requires_fresh_credentials(self):
        client = Client(enforce_csrf_checks=True)
        token = get_token(client.get(reverse("login")).wsgi_request)
        staff_url = reverse("staff_queue")
        logged_in = self.login(client, self.staff, token)
        self.assertRedirects(logged_in, staff_url, fetch_redirect_response=False)
        rotated_token = get_token(client.get(staff_url).wsgi_request)
        self.assertEqual(client.post(reverse("logout"), {"csrfmiddlewaretoken": rotated_token}).status_code, 302)

        result = self.login(client, self.staff, token, next=staff_url)
        self.assertEqual(result.status_code, 303)
        self.assertNotIn("_auth_user_id", client.session)
        refreshed = client.get(result["Location"])
        self.assertContains(refreshed, "Форма входа обновлена")
        self.assertContains(refreshed, f'name="next" value="{staff_url}"')
        fresh_token = get_token(refreshed.wsgi_request)
        result = self.login(client, self.staff, fresh_token, next=staff_url)
        self.assertRedirects(result, staff_url, fetch_redirect_response=False)

    def test_recovery_ignores_foreign_destinations_and_other_posts_remain_protected(self):
        client = Client(enforce_csrf_checks=True)
        result = self.login(client, self.staff, "", next="https://example.test/")
        self.assertEqual(result.status_code, 303)
        self.assertEqual(result["Location"], reverse("login", query={"retry": "1"}))
        self.assertNotIn("_auth_user_id", client.session)
        self.assertEqual(client.post(reverse("logout")).status_code, 403)
