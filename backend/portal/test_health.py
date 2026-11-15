from unittest.mock import patch
from django.db import DatabaseError
from django.test import TestCase


class HealthTests(TestCase):
    def test_ready_without_authentication_and_not_cached(self):
        response = self.client.get("/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ready"})
        self.assertIn("no-store", response.headers["Cache-Control"])
        self.assertEqual(self.client.head("/health/").status_code, 200)
        self.assertEqual(self.client.post("/health/").status_code, 405)

    def test_database_failure_returns_no_connection_details(self):
        with patch("config.health.connection.cursor", side_effect=DatabaseError("PRIVATE database details")):
            response = self.client.get("/health/")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"status": "unavailable"})
        self.assertNotContains(response, "PRIVATE", status_code=503)
