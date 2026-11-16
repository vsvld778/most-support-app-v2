from django.contrib.admin.apps import AdminConfig


class PlatformAdminConfig(AdminConfig):
    default_site = "portal.admin_site.PlatformAdminSite"
