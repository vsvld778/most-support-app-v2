from django.contrib import admin
from django.urls import include, path
from .health import health

urlpatterns = [path("health/", health, name="health"), path("admin/", admin.site.urls), path("", include("portal.urls"))]
admin.site.site_header = "Мост поддержки · Управление"
admin.site.site_title = "Мост поддержки"
admin.site.index_title = "Сайт, кабинеты и обращения"
