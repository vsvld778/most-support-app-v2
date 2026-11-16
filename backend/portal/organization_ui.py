"""Organization workspace shell for authenticated accounts."""
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.views.decorators.http import require_GET


@login_required
@require_GET
def app(request):
    return render(request, "organization/app.html", {"organization_demo": False})
