from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from builder import views as builder
from collaboration import views as collaboration
from projects.views import ProjectViewSet
from smartstock import views as smartstock
from workspaces import views as workspaces

router = DefaultRouter()
router.register("workspaces", workspaces.WorkspaceViewSet, basename="workspace")
router.register("workspace-members", workspaces.WorkspaceMemberViewSet, basename="workspace-member")
router.register("invitations", workspaces.InvitationViewSet, basename="invitation")
router.register("projects", ProjectViewSet, basename="project")
router.register("pages", builder.WebsitePageViewSet, basename="page")
router.register("assets", builder.ProjectAssetViewSet, basename="asset")
router.register("tasks", collaboration.TaskViewSet, basename="task")
router.register("activity", collaboration.ActivityLogViewSet, basename="activity")
router.register("smartstock/stores", smartstock.StoreViewSet, basename="store")
router.register("smartstock/products", smartstock.ProductViewSet, basename="product")
router.register("smartstock/movements", smartstock.MovementViewSet, basename="movement")
router.register("smartstock/suppliers", smartstock.SupplierViewSet, basename="supplier")
router.register("smartstock/orders", smartstock.PurchaseOrderViewSet, basename="order")
router.register("smartstock/recommendations", smartstock.RecommendationViewSet, basename="recommendation")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/builder/components/", builder.ComponentRegistryView.as_view()),
    path("api/projects/<int:project_id>/theme/", builder.ThemeView.as_view()),
    path("api/projects/<int:project_id>/preview/", builder.SitePreviewView.as_view()),
    path("api/projects/<int:project_id>/publish/", builder.PublishView.as_view()),
    path("api/projects/<int:project_id>/publications/", builder.PublicationHistoryView.as_view()),
    path("api/public/sites/<slug:slug>/", builder.PublicSiteView.as_view()),
    path("api/", include(router.urls)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema")),
    # Uploaded images (validated raster formats only). Use a CDN/object storage in production.
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]
