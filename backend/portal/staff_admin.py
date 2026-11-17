from django.contrib import admin

from .platform_admin import OwnerAdmin
from .staff_models import StaffMembership, StaffTeam


@admin.register(StaffTeam)
class StaffTeamAdmin(OwnerAdmin):
    list_display = ("name", "slug")
    search_fields = ("name", "slug")

    def get_readonly_fields(self, request, obj=None):
        return ("slug",) if obj else ()


@admin.register(StaffMembership)
class StaffMembershipAdmin(OwnerAdmin):
    list_display = ("user", "team", "role", "active")
    list_filter = ("team", "role", "active")
    autocomplete_fields = ("user", "team")
