from django.contrib.admin import AdminSite
from django.core.exceptions import PermissionDenied
from django.shortcuts import render
from django.urls import path

from . import editorial_views
from .platform_controls import FEATURES, ContentBlock, FeatureSetting
from .staff_models import StaffMembership


class PlatformAdminSite(AdminSite):
    index_template = "admin/platform/index.html"

    def has_permission(self, request):
        return super().has_permission(request) and (
            request.user.is_superuser or not StaffMembership.objects.filter(user=request.user).exists()
        )

    def get_urls(self):
        sections = [
            path(f"{section}/", self.admin_view(self.section), {"section": section}, name=f"platform_{section}")
            for section in ("site", "cabinets", "application")
        ]
        editor = [
            path("editorial/preview/organization/", self.admin_view(editorial_views.organization_preview), name="editorial_organization_preview"),
            path("editorial/preview/site/", self.admin_view(editorial_views.site_preview), name="editorial_site_preview"),
            path("editorial/preview/personal/<str:page>/", self.admin_view(editorial_views.personal_preview), name="editorial_personal_preview"),
            path("editorial/draft/<str:surface>/<path:page>/", self.admin_view(editorial_views.draft), name="editorial_draft"),
            path("editorial/upload/", self.admin_view(editorial_views.upload), name="editorial_upload"),
            path("editorial/images/<uuid:key>/", self.admin_view(editorial_views.image), {"private": True}, name="editorial_image"),
        ]
        return editor + sections + super().get_urls()

    def each_context(self, request):
        context = super().each_context(request)
        name = request.resolver_match.url_name if request.resolver_match else ""
        section = "records"
        if name == "index":
            section = "overview"
        elif name in {"platform_site", "platform_cabinets", "platform_application"}:
            section = name.removeprefix("platform_")
        elif name == "portal_featuresetting_change":
            key = request.resolver_match.kwargs["object_id"]
            section = "application" if key.startswith("personal.") or key == "intake.personal" else "cabinets"
        context["platform_section"] = section
        return context

    def section(self, request, section):
        if not request.user.is_superuser:
            raise PermissionDenied

        context = {**self.each_context(request), "section": section}
        if section == "application":
            context.update(title="Приложение", modules=self.modules("personal"),
                           page_editors=[("Приложение", editorial_views.links("application"))])
        else:
            targets = ("site",) if section == "site" else ("personal", "organization")
            blocks = {block.target: block for block in ContentBlock.objects.filter(target__in=targets)}
            context.update(
                title="Сайт" if section == "site" else "Личные кабинеты",
                blocks=[blocks[target] for target in targets if target in blocks],
                page_editors=[(dict(ContentBlock.TARGETS)[target], editorial_views.links(target)) for target in targets],
            )
            if section == "cabinets":
                context["modules"] = self.modules("organization")
        request.current_app = self.name
        return render(request, "admin/platform/section.html", context)

    @staticmethod
    def modules(audience):
        keys = [key for key in FEATURES if key.startswith(f"{audience}.")] + [f"intake.{audience}"]
        rows = FeatureSetting.objects.in_bulk(keys)
        return [rows[key] for key in keys if key in rows]
