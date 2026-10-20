from django.db import transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from collaboration.activity import log_activity
from workspaces.access import accessible_projects, can_edit_project

from . import services
from .models import ProjectAsset, PublishedSite, ThemeConfiguration, WebsitePage
from .registry import registry_payload, validate_theme
from .serializers import (
    PageVersionSerializer, ProjectAssetSerializer, PublicationVersionSerializer, PublishSerializer, ReorderSerializer,
    RestoreVersionSerializer, ThemeSerializer, WebsitePageSerializer, published_site_payload,
)


def get_project(request, project_id, edit=False):
    project = get_object_or_404(accessible_projects(request.user).select_related("workspace"), pk=project_id)
    if edit and not can_edit_project(request.user, project):
        raise PermissionDenied("You do not have permission to edit this project.")
    return project


class ComponentRegistryView(APIView):
    """Allow-listed builder components, style fields, theme tokens and presets."""

    @extend_schema(responses={200: dict})
    def get(self, request):
        return Response(registry_payload())


class WebsitePageViewSet(viewsets.ModelViewSet):
    queryset = WebsitePage.objects.none()
    serializer_class = WebsitePageSerializer
    filterset_fields = ["project", "status"]
    pagination_class = None
    ordering = ["position", "id"]

    def get_queryset(self):
        return WebsitePage.objects.filter(project__in=accessible_projects(self.request.user)).select_related("project")

    def list(self, request, *args, **kwargs):
        if not request.query_params.get("project"):
            raise ValidationError({"project": "The project query parameter is required."})
        return super().list(request, *args, **kwargs)

    def _check(self, project):
        if not can_edit_project(self.request.user, project):
            raise PermissionDenied("You do not have permission to edit this project.")

    @transaction.atomic
    def perform_create(self, serializer):
        project = serializer.validated_data["project"]
        self._check(project)
        if "position" not in self.request.data:
            serializer.validated_data["position"] = project.pages.count()
        page = serializer.save()
        if page.is_home:
            project.pages.exclude(pk=page.pk).update(is_home=False)
        services.record_page_version(page, self.request.user, "Created")
        log_activity(actor=self.request.user, workspace=project.workspace, project=project, verb="created",
                     target=page, message=f"added page {page.title}")

    @transaction.atomic
    def perform_update(self, serializer):
        page = serializer.instance
        self._check(page.project)
        content_changed = "content" in serializer.validated_data and serializer.validated_data["content"] != page.content
        page = serializer.save()
        if page.is_home:
            page.project.pages.exclude(pk=page.pk).update(is_home=False)
        if content_changed:
            services.record_page_version(page, self.request.user, self.request.data.get("note", "Saved"))
            log_activity(actor=self.request.user, workspace=page.project.workspace, project=page.project,
                         verb="edited", target=page, message=f"saved design of page {page.title}")

    def perform_destroy(self, instance):
        self._check(instance.project)
        if instance.project.pages.count() <= 1:
            raise ValidationError({"detail": "A project must keep at least one page."})
        was_home = instance.is_home
        project = instance.project
        log_activity(actor=self.request.user, workspace=project.workspace, project=project, verb="deleted",
                     target=instance, message=f"deleted page {instance.title}")
        instance.delete()
        if was_home:
            first = project.pages.first()
            first.is_home = True
            first.save(update_fields=["is_home"])

    @extend_schema(responses=PageVersionSerializer(many=True))
    @action(detail=True, methods=["get"])
    def versions(self, request, pk=None):
        page = self.get_object()
        return Response(PageVersionSerializer(page.versions.select_related("created_by")[:30], many=True,
                                              context={"request": request}).data)

    @extend_schema(request=RestoreVersionSerializer, responses=WebsitePageSerializer)
    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        page = self.get_object()
        self._check(page.project)
        s = RestoreVersionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        version = get_object_or_404(page.versions, pk=s.validated_data["version"])
        with transaction.atomic():
            page.content = version.content
            page.save(update_fields=["content", "updated_at"])
            services.record_page_version(page, request.user, f"Restored version from {version.created_at:%Y-%m-%d %H:%M}")
        return Response(WebsitePageSerializer(page, context={"request": request}).data)

    @extend_schema(request=ReorderSerializer, responses=WebsitePageSerializer(many=True))
    @action(detail=False, methods=["post"])
    def reorder(self, request):
        s = ReorderSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        project = get_project(request, s.validated_data["project"], edit=True)
        ids = s.validated_data["order"]
        pages = {p.pk: p for p in project.pages.all()}
        if set(ids) != set(pages):
            raise ValidationError({"order": "Order must list every page of the project exactly once."})
        with transaction.atomic():
            for i, pid in enumerate(ids):
                WebsitePage.objects.filter(pk=pid).update(position=i)
        return Response(WebsitePageSerializer(project.pages.all(), many=True, context={"request": request}).data)


class ThemeView(APIView):
    @extend_schema(responses=ThemeSerializer)
    def get(self, request, project_id):
        project = get_project(request, project_id)
        theme, _ = ThemeConfiguration.objects.get_or_create(project=project, defaults={"tokens": validate_theme({})})
        return Response(ThemeSerializer(theme).data)

    @extend_schema(request=ThemeSerializer, responses=ThemeSerializer)
    def put(self, request, project_id):
        project = get_project(request, project_id, edit=True)
        theme, _ = ThemeConfiguration.objects.get_or_create(project=project, defaults={"tokens": validate_theme({})})
        s = ThemeSerializer(theme, data=request.data)
        s.is_valid(raise_exception=True)
        s.save()
        log_activity(actor=request.user, workspace=project.workspace, project=project, verb="themed", target=theme,
                     message=f"updated the theme of {project.name}")
        return Response(s.data)


class SitePreviewView(APIView):
    """Draft render data (all pages, including drafts) for authenticated project members."""

    @extend_schema(responses={200: dict})
    def get(self, request, project_id):
        project = get_project(request, project_id)
        return Response({**services.site_snapshot(project, include_drafts=True), "mode": "preview"})


class PublishView(APIView):
    @extend_schema(request=PublishSerializer, responses={200: dict})
    def post(self, request, project_id):
        project = get_project(request, project_id, edit=True)
        s = PublishSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        version = services.publish(project, request.user, s.validated_data.get("note", ""))
        project.refresh_from_db()
        log_activity(actor=request.user, workspace=project.workspace, project=project, verb="published",
                     target=project, message=f"published {project.name} (v{version.number})")
        return Response(published_site_payload(project))

    @extend_schema(request=None, responses={200: dict})
    def delete(self, request, project_id):
        project = get_project(request, project_id, edit=True)
        services.unpublish(project, request.user)
        project.refresh_from_db()
        log_activity(actor=request.user, workspace=project.workspace, project=project, verb="unpublished",
                     target=project, message=f"unpublished {project.name}")
        return Response(published_site_payload(project))


class PublicationHistoryView(APIView):
    @extend_schema(responses=PublicationVersionSerializer(many=True))
    def get(self, request, project_id):
        project = get_project(request, project_id)
        qs = project.publications.select_related("published_by")[:50]
        return Response({"site": published_site_payload(project),
                         "versions": PublicationVersionSerializer(qs, many=True).data})


class PublicSiteView(APIView):
    """Public, unauthenticated read of the live published snapshot."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @extend_schema(responses={200: dict})
    def get(self, request, slug):
        site = get_object_or_404(PublishedSite.objects.select_related("current_version"), slug=slug, is_live=True)
        if site.current_version is None:
            return Response({"detail": "Not found.", "errors": {}}, status=status.HTTP_404_NOT_FOUND)
        return Response({**site.current_version.snapshot, "mode": "published",
                         "version": site.current_version.number, "published_at": site.current_version.created_at})


class ProjectAssetViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin,
                          viewsets.GenericViewSet):
    queryset = ProjectAsset.objects.none()
    serializer_class = ProjectAssetSerializer
    parser_classes = [MultiPartParser, FormParser]
    filterset_fields = ["project"]
    pagination_class = None

    def get_queryset(self):
        return ProjectAsset.objects.filter(project__in=accessible_projects(self.request.user))

    @extend_schema(parameters=[OpenApiParameter("project", int, required=True)])
    def list(self, request, *args, **kwargs):
        if not request.query_params.get("project"):
            raise ValidationError({"project": "The project query parameter is required."})
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        project = serializer.validated_data["project"]
        if not can_edit_project(self.request.user, project):
            raise PermissionDenied("You do not have permission to upload assets to this project.")
        upload = serializer.validated_data["file"]
        width, height = getattr(upload, "image_size", (0, 0))
        asset = serializer.save(uploaded_by=self.request.user, original_name=upload.name[:200], size=upload.size,
                                width=width, height=height)
        log_activity(actor=self.request.user, workspace=project.workspace, project=project, verb="uploaded",
                     target=asset, message=f"uploaded asset {asset.original_name}")

    def perform_destroy(self, instance):
        if not can_edit_project(self.request.user, instance.project):
            raise PermissionDenied("You do not have permission to delete assets in this project.")
        instance.file.delete(save=False)
        instance.delete()
