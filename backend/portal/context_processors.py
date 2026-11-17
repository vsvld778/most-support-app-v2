from django.conf import settings
from .access import approved_organizations
from .staff_access import has_desk

def portal_context(request):
    return {
        "staff_base": getattr(settings, "STAFF_BASE", ""),
        "staff_sandbox": getattr(settings, "STAFF_SANDBOX", False),
        "staff_has_desk": has_desk(request.user),
        "staging_mode": settings.PORTAL_INTAKE_MODE != "live",
        "intake_mode": settings.PORTAL_INTAKE_MODE,
        "registration_mode": settings.REGISTRATION_MODE,
        "operator_name": settings.PORTAL_OPERATOR_NAME,
        "policy_version": settings.PORTAL_POLICY_VERSION,
        "policy_url": settings.PORTAL_POLICY_URL,
        "public_site_url": settings.PUBLIC_SITE_URL,
        "has_partner_access": approved_organizations(request.user).exists(),
    }
