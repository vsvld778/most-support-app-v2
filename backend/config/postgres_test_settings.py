"""The CI PostgreSQL service uses generated test data on loopback."""
from .test_settings import *

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "most_platform_ci",
        "USER": "postgres",
        "PASSWORD": "most-platform-ci-only",
        "HOST": "127.0.0.1",
        "PORT": 5432,
    },
}
