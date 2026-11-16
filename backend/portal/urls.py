from django.urls import path
from . import editorial_views, views, organization_api, organization_ui, platform_views, workspace_api

urlpatterns = [
    path("api/public/editorial/<str:surface>/<path:page>/", editorial_views.publication, name="editorial_publication"),
    path("editorial-images/<uuid:key>/", editorial_views.image, name="editorial_image"),
    path("cabinet/", platform_views.entry, name="cabinet_entry"),
    path("api/public/site-publication/", platform_views.website_publication, name="site_publication"),
    path("api/v2/session/", workspace_api.session, name="v2_session"),
    path("api/v2/workspace/", workspace_api.workspace, name="v2_workspace"),
    path("", views.home, name="home"),
    path("login/", views.PortalLoginView.as_view(), name="login"),
    path("logout/", views.PortalLogoutView.as_view(), name="logout"),
    path("signup/", views.signup, name="signup"),
    path("cases/", views.dashboard, name="dashboard"),
    path("cases/new/", views.case_create, name="case_create"),
    path("cases/<uuid:public_id>/", views.case_detail, name="case_detail"),
    path("partners/", organization_ui.app, name="partner_dashboard"),
    path("partners/preview/", organization_ui.preview, name="organization_preview"),
    path("partners/api/session/", organization_api.session, name="organization_session"),
    path("partners/api/workspace/", organization_api.workspace, name="organization_workspace"),
    path("partners/api/requests/", organization_api.requests, name="organization_requests"),
    path("partners/api/requests/<uuid:public_id>/", organization_api.request_item, name="organization_request_detail"),
    path("partners/cases/<uuid:public_id>/", views.partner_case_detail, name="partner_case_detail"),
    path("healthz/", views.healthz, name="healthz"),
]
