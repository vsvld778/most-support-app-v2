"""Same-origin, session-authenticated V2 workspace snapshots.

This API never changes case status, staff permissions or partner access. A workspace
is private user-owned preparation data; submitting a case is a separate portal flow.
"""
import json
import math
from functools import wraps
from django.db import transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods
from .models import UserWorkspace, WorkspaceEvent
from .ratelimit import allow_request

MAX_BYTES = 48 * 1024
MAX_NODES = 8000
MAX_DEPTH = 24


def authenticated(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"error": "authentication_required"}, status=401)
        return view(request, *args, **kwargs)
    return wrapped


@require_GET
def session(request):
    """A CSRF token is deliberately returned to same-origin JS, not exposed via CORS."""
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False, "login_url": "/login/"})
    return JsonResponse({
        "authenticated": True,
        "display_name": request.user.display_name,
        "csrf_token": get_token(request),
        "workspace_max_bytes": MAX_BYTES,
    })


def validate_data(value):
    if not isinstance(value, dict):
        return False
    stack = [(value, 0)]
    nodes = 0
    while stack:
        item, depth = stack.pop()
        nodes += 1
        if nodes > MAX_NODES or depth > MAX_DEPTH:
            return False
        if isinstance(item, dict):
            if any(len(key) > 150 or key in {"__proto__", "constructor", "prototype"} for key in item):
                return False
            stack.extend((child, depth + 1) for child in item.values())
        elif isinstance(item, list):
            stack.extend((child, depth + 1) for child in item)
        elif isinstance(item, str):
            if len(item) > 16000:
                return False
        elif isinstance(item, float) and not math.isfinite(item):
            return False
        elif item is not None and not isinstance(item, (int, float, bool)):
            return False
    return True


def reject_constant(value):
    raise ValueError("Non-finite JSON number")


@authenticated
@require_http_methods(["GET", "PUT"])
def workspace(request):
    if request.method == "GET":
        record = UserWorkspace.objects.filter(owner=request.user).first()
        return JsonResponse({
            "revision": record.revision if record else 0,
            "data": record.data if record else {},
            "updated_at": record.updated_at.isoformat() if record else None,
        })

    if request.content_type != "application/json":
        return JsonResponse({"error": "json_required"}, status=415)
    if not allow_request("workspace-save", str(request.user.pk), 60, 600):
        return JsonResponse({"error": "rate_limited"}, status=429)
    if len(request.body) > MAX_BYTES:
        return JsonResponse({"error": "workspace_too_large", "max_bytes": MAX_BYTES}, status=413)
    try:
        payload = json.loads(request.body, parse_constant=reject_constant)
    except (ValueError, UnicodeDecodeError, RecursionError):
        return JsonResponse({"error": "invalid_json"}, status=400)
    if not isinstance(payload, dict) or set(payload) != {"revision", "data"}:
        return JsonResponse({"error": "invalid_payload"}, status=400)
    revision = payload["revision"]
    if type(revision) is not int or revision < 0 or revision > 2147483646 or not validate_data(payload["data"]):
        return JsonResponse({"error": "invalid_workspace"}, status=400)

    with transaction.atomic():
        record, _ = UserWorkspace.objects.get_or_create(owner=request.user)
        now = timezone.now()
        updated = UserWorkspace.objects.filter(pk=record.pk, revision=revision).update(
            data=payload["data"], revision=revision + 1, updated_at=now)
        if not updated:
            return JsonResponse({"error": "revision_conflict", "action": "reload_before_saving"}, status=409)
        WorkspaceEvent.objects.create(owner=request.user, revision=revision + 1)
    return JsonResponse({"revision": revision + 1, "updated_at": now.isoformat()})
