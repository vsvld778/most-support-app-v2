from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET

from .platform_controls import published_content


@require_GET
def entry(request):
    return render(request, "portal/entry.html")


@require_GET
def website_publication(request):
    return JsonResponse(published_content("site"))
