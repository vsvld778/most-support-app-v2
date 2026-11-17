"""The isolated role-testing deploy has its own database and session cookies."""
import os
from pathlib import Path

from .settings import *

STAFF_SANDBOX = True
STAFF_BASE = "/staff-test"
FORCE_SCRIPT_NAME = STAFF_BASE
SESSION_COOKIE_NAME = "most_staff_sandbox_session"
CSRF_COOKIE_NAME = "most_staff_sandbox_csrf"
CSRF_FAILURE_VIEW = "portal.views.sandbox_csrf_failure"
SESSION_COOKIE_PATH = STAFF_BASE + "/"
CSRF_COOKIE_PATH = SESSION_COOKIE_PATH
STATIC_URL = STAFF_BASE + "/static/"
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": Path(os.environ["STAFF_SANDBOX_DB"])}}
REGISTRATION_MODE = "closed"
PORTAL_INTAKE_MODE = "test"
EMAIL_BACKEND = "django.core.mail.backends.dummy.EmailBackend"
