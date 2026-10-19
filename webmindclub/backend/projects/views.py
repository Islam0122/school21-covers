from django.db import transaction
from django.db.models import Prefetch
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from builder.services import copy_site, setup_project_site
from collaboration.activity import log_activity
from collaboration.models import ActivityLog
from collaboration.serializers import ActivityLogSerializer
from workspaces.access import accessible_projects, can_edit_project, can_manage_project, membership

from .models import Project, ProjectMembership, unique_project_slug
from .serializers import ProjectCreateSerializer, ProjectListSerializer, ProjectMemberSerializer, ProjectSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.none()
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filterset_fields = ["workspace", "status", "project_type", "visibility"]
    search_fields = ["name", "description", "slug"]
    ordering_fields = ["name", "created_at", "updated_at", "status"]
    ordering = ["-updated_at"]

    def get_queryset(self):
        qs = (accessible_projects(self.request.user).select_related("owner", "workspace", "store", "published_site")
              .prefetch_related(Prefetch("memberships", queryset=ProjectMembership.objects.select_related("user"))))
        if self.action == "list" and self.request.query_params.get("include_archived") != "true" \
                and self.request.query_params.get("status") != Project.Status.ARCHIVED:
            qs = qs.exclude(status=Project.Status.ARCHIVED)
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return ProjectListSerializer
        if self.action == "create":
            return ProjectCreateSerializer
        return ProjectSerializer

    def _check_edit(self, project):
        if not can_edit_project(self.request.user, project):
            raise PermissionDenied("You do not have permission to edit this project.")

    def _check_manage(self, project):
        if not can_manage_project(self.request.user, project):
            raise PermissionDenied("Only workspace admins or the project lead can do this.")

    @transaction.atomic
    def perform_create(self, serializer):
        branding = serializer.validated_data.pop("branding", None)
        template = serializer.validated_data.get("template", "blank")
        ws = serializer.validated_data["workspace"]
        if not serializer.validated_data.get("slug"):
            serializer.validated_data["slug"] = unique_project_slug(ws.pk, serializer.validated_data["name"])
        project = serializer.save(owner=self.request.user)
        ProjectMembership.objects.create(project=project, user=self.request.user, role=ProjectMembership.Role.LEAD)
        setup_project_site(project, template, branding)
        log_activity(actor=self.request.user, workspace=ws, project=project, verb="created", target=project,
                     message=f"created project {project.name}")

    def perform_update(self, serializer):
        self._check_edit(serializer.instance)
        before = serializer.instance.status
        if serializer.validated_data.get("visibility", serializer.instance.visibility) != serializer.instance.visibility:
            self._check_manage(serializer.instance)
        project = serializer.save()
        msg = f"changed status of {project.name} to {project.get_status_display()}" if before != project.status \
            else f"updated project {project.name}"
        log_activity(actor=self.request.user, workspace=project.workspace, project=project, verb="updated",
                     target=project, message=msg)

    def perform_destroy(self, instance):
        self._check_manage(instance)
        log_activity(actor=self.request.user, workspace=instance.workspace, verb="deleted", target=instance,
                     message=f"deleted project {instance.name}")
        instance.delete()

    @extend_schema(request=None, responses={201: ProjectSerializer})
    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        source = self.get_object()
        m = membership(request.user, source.workspace_id)
        if not m or not m.can_contribute:
            raise PermissionDenied("You cannot create projects in this workspace.")
        with transaction.atomic():
            copy = Project.objects.create(
                workspace=source.workspace, name=f"{source.name} (copy)"[:120], description=source.description,
                project_type=source.project_type, status=Project.Status.DRAFT, visibility=source.visibility,
                template=source.template, owner=request.user,
                slug=unique_project_slug(source.workspace_id, f"{source.slug}-copy"))
            ProjectMembership.objects.create(project=copy, user=request.user, role=ProjectMembership.Role.LEAD)
            copy_site(source, copy)
            log_activity(actor=request.user, workspace=copy.workspace, project=copy, verb="duplicated", target=copy,
                         message=f"duplicated {source.name}")
        return Response(ProjectSerializer(self.get_queryset().get(pk=copy.pk), context={"request": request}).data,
                        status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses=ProjectSerializer)
    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        project = self.get_object()
        self._check_manage(project)
        if project.status == Project.Status.ARCHIVED:
            raise ValidationError({"detail": "Project is already archived."})
        project.status_before_archive = project.status
        project.status = Project.Status.ARCHIVED
        project.save(update_fields=["status", "status_before_archive", "updated_at"])
        log_activity(actor=request.user, workspace=project.workspace, project=project, verb="archived", target=project,
                     message=f"archived {project.name}")
        return Response(ProjectSerializer(project, context={"request": request}).data)

    @extend_schema(request=None, responses=ProjectSerializer)
    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        project = self.get_object()
        self._check_manage(project)
        if project.status != Project.Status.ARCHIVED:
            raise ValidationError({"detail": "Only archived projects can be restored."})
        project.status = project.status_before_archive or Project.Status.DRAFT
        if project.status == Project.Status.ARCHIVED:
            project.status = Project.Status.DRAFT
        project.save(update_fields=["status", "updated_at"])
        log_activity(actor=request.user, workspace=project.workspace, project=project, verb="restored", target=project,
                     message=f"restored {project.name}")
        return Response(ProjectSerializer(project, context={"request": request}).data)

    @extend_schema(responses=ActivityLogSerializer(many=True))
    @action(detail=True, methods=["get"])
    def activity(self, request, pk=None):
        project = self.get_object()
        logs = ActivityLog.objects.filter(project=project).select_related("actor", "project")[:100]
        return Response(ActivityLogSerializer(logs, many=True, context={"request": request}).data)

    @extend_schema(request=ProjectMemberSerializer, responses=ProjectMemberSerializer(many=True))
    @action(detail=True, methods=["get", "post"])
    def members(self, request, pk=None):
        project = self.get_object()
        if request.method == "POST":
            self._check_manage(project)
            s = ProjectMemberSerializer(data=request.data, context={"request": request})
            s.is_valid(raise_exception=True)
            user = s.validated_data["user"]
            if membership(user, project.workspace_id) is None:
                raise ValidationError({"user_id": "User must be a member of the workspace first."})
            pm, created = ProjectMembership.objects.update_or_create(
                project=project, user=user, defaults={"role": s.validated_data.get("role", "editor")})
            log_activity(actor=request.user, workspace=project.workspace, project=project, verb="assigned", target=pm,
                         message=f"{'added' if created else 'updated'} {user.display_name} on {project.name}")
        qs = project.memberships.select_related("user")
        return Response(ProjectMemberSerializer(qs, many=True, context={"request": request}).data)

    @extend_schema(request=None, responses={204: None})
    @action(detail=True, methods=["delete"], url_path=r"members/(?P<member_id>\d+)")
    def remove_member(self, request, pk=None, member_id=None):
        project = self.get_object()
        self._check_manage(project)
        pm = project.memberships.filter(pk=member_id).select_related("user").first()
        if pm is None:
            raise ValidationError({"detail": "Member not found on this project."})
        if pm.user_id == project.owner_id:
            raise ValidationError({"detail": "The project owner cannot be removed."})
        pm.delete()
        log_activity(actor=request.user, workspace=project.workspace, project=project, verb="unassigned", target=project,
                     message=f"removed {pm.user.display_name} from {project.name}")
        return Response(status=status.HTTP_204_NO_CONTENT)
