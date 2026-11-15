import json
from django.test import Client, TestCase
from .models import User, UserWorkspace, WorkspaceEvent


class WorkspaceAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("one@example.test", "test-password", display_name="One")
        self.other = User.objects.create_user("two@example.test", "test-password", display_name="Two")
        self.client.force_login(self.user)

    def put(self, revision, data, owner=None):
        return self.client.put(
            "/api/v2/workspace/", json.dumps({"revision": revision, "data": data}),
            content_type="application/json", HTTP_X_MOST_WORKSPACE_OWNER=str((owner or self.user).pk),
        )

    def test_authentication_required(self):
        anonymous = Client()
        self.assertEqual(anonymous.get("/api/v2/workspace/").status_code, 401)
        self.assertEqual(anonymous.put("/api/v2/workspace/", "{}", content_type="application/json").status_code, 401)
        self.assertEqual(anonymous.get("/api/v2/session/").json()["authenticated"], False)

    def test_user_isolation_and_atomic_revision(self):
        first = self.put(0, {"modules": {"plan": {"tasks": [{"title": "Private"}]}}})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["revision"], 1)
        self.assertEqual(first.json()["user_id"], str(self.user.pk))
        self.assertEqual(self.client.get("/api/v2/session/").json()["user_id"], str(self.user.pk))
        self.assertEqual(self.client.get("/api/v2/workspace/").json()["user_id"], str(self.user.pk))
        self.assertEqual(self.put(0, {"overwritten": True}).status_code, 409)
        self.assertIn("modules", self.client.get("/api/v2/workspace/").json()["data"])
        self.client.force_login(self.other)
        self.assertEqual(self.client.get("/api/v2/workspace/").json()["data"], {})
        self.assertEqual(self.put(0, {"other": True}, owner=self.other).status_code, 200)
        self.assertEqual(UserWorkspace.objects.count(), 2)
        self.assertEqual(WorkspaceEvent.objects.count(), 2)
        self.assertFalse(hasattr(WorkspaceEvent.objects.first(), "data"))

    def test_csrf_and_no_cross_origin_access(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.user)
        payload = json.dumps({"revision": 0, "data": {"test": True}})
        self.assertEqual(client.put("/api/v2/workspace/", payload, content_type="application/json").status_code, 403)
        response = client.get("/api/v2/session/")
        self.assertNotIn("Access-Control-Allow-Origin", response.headers)
        token = response.json()["csrf_token"]
        response = client.put("/api/v2/workspace/", payload, content_type="application/json", HTTP_X_CSRFTOKEN=token, HTTP_X_MOST_WORKSPACE_OWNER=str(self.user.pk))
        self.assertEqual(response.status_code, 200)
        response = client.put("/api/v2/workspace/", payload, content_type="application/json", HTTP_X_CSRFTOKEN=token, HTTP_X_MOST_WORKSPACE_OWNER=str(self.user.pk), HTTP_ORIGIN="https://unrelated.example")
        self.assertEqual(response.status_code, 403)

    def test_invalid_values_and_size_bound(self):
        for data in [[], {"__proto__": {}}, {"value": "x" * 16001}, {"bad": float("inf")}]:
            self.assertEqual(self.put(0, data).status_code, 400)
        deep = current = {}
        for _ in range(26):
            current["nested"] = {}
            current = current["nested"]
        self.assertEqual(self.put(0, deep).status_code, 400)
        self.assertEqual(self.put(True, {}).status_code, 400)
        too_large = {str(n): "x" * 10000 for n in range(5)}
        self.assertEqual(self.put(0, too_large).status_code, 413)
        self.assertEqual(UserWorkspace.objects.count(), 0)

    def test_does_not_accept_account_or_case_identifiers(self):
        payload = {"revision": 0, "data": {}, "owner": self.other.pk}
        self.assertEqual(self.client.put("/api/v2/workspace/", json.dumps(payload), content_type="application/json", HTTP_X_MOST_WORKSPACE_OWNER=str(self.user.pk)).status_code, 400)
        response = self.client.get("/api/v2/workspace/")
        self.assertIn("no-store", response.headers["Cache-Control"])
        self.assertNotIn("Access-Control-Allow-Origin", response.headers)

    def test_missing_owner_binding_does_not_create_workspace(self):
        response = self.client.put(
            "/api/v2/workspace/", json.dumps({"revision": 0, "data": {"private": True}}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"], "account_changed")
        self.assertEqual(UserWorkspace.objects.count(), 0)
        self.assertEqual(WorkspaceEvent.objects.count(), 0)

    def test_stale_tab_cannot_save_into_a_different_signed_in_account(self):
        self.assertEqual(self.put(0, {"private": "account one"}).status_code, 200)
        self.client.logout()
        self.client.force_login(self.other)
        self.assertEqual(self.put(0, {"private": "account two"}, owner=self.other).status_code, 200)
        # Both revisions are 1: revision checks alone would accept the stale
        # first account's snapshot and overwrite the second account's data.
        response = self.put(1, {"private": "stale first account"}, owner=self.user)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"], "account_changed")
        current = self.client.get("/api/v2/workspace/").json()
        self.assertEqual(current["user_id"], str(self.other.pk))
        self.assertEqual(current["data"], {"private": "account two"})
        self.assertEqual(current["revision"], 1)
        self.assertEqual(UserWorkspace.objects.get(owner=self.user).data, {"private": "account one"})
        self.assertEqual(WorkspaceEvent.objects.count(), 2)
