"""Organization workspace shell for authenticated accounts."""
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.urls import reverse
from django.views.decorators.http import require_GET

from .access import approved_organizations


@login_required
@require_GET
def app(request):
    if not approved_organizations(request.user).exists():
        return render(request, "organization/access_required.html", {
            "organization_login_url": reverse("login", query={"next": reverse("partner_dashboard")}),
        })
    return render(request, "organization/app.html", {"organization_demo": False})
