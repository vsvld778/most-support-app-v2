from django.conf import settings
from django.http import JsonResponse
from django.urls import reverse
from django.views.decorators.http import require_GET

from .models import CaseMessage, SupportCase
from .platform_controls import feature_modes
from .workspace_api import authenticated


def card(item):
    return {
        "id": str(item.public_id), "reference": item.reference, "title": item.title,
        "status": item.get_status_display(), "nextStep": item.next_step, "url": item.get_absolute_url(),
    }


@require_GET
@authenticated
def inbox(request):
    items = SupportCase.objects.filter(owner=request.user).order_by("-updated_at", "-pk")[:60]
    creating = settings.PORTAL_INTAKE_MODE in {"test", "live"} and feature_modes(request.user)["intake.personal"] == "on"
    return JsonResponse({"cases": [card(item) for item in items], "newUrl": reverse("case_create") if creating else ""})


@require_GET
@authenticated
def detail(request, public_id):
    item = SupportCase.objects.filter(owner=request.user, public_id=public_id).first()
    if item is None:
        return JsonResponse({"error": "not_found"}, status=404)
    items = item.messages.exclude(audience=CaseMessage.Audience.INTERNAL).select_related(
        "author", "case",
    ).order_by("-created_at", "-pk")[:60]
    return JsonResponse({**card(item), "messages": [
        {"author": msg.author_display, "body": msg.body, "createdAt": msg.created_at.isoformat()} for msg in items
    ]})
