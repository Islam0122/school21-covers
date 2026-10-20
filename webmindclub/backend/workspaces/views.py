from django.conf import settings
from django.db import transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from collaboration.activity import log_activity
from projects.models import Project, ProjectMembership

from .access import accessible_projects, membership
from .models import Invitation, Workspace, WorkspaceMembership, WorkspaceRole
from .serializers import AcceptInvitationSerializer, InvitationSerializer, MembershipSerializer, WorkspaceSerializer


def require_member(user, workspace_id, manager=False) -> WorkspaceMembership:
    m = membership(user, workspace_id)
    if m is None:
        raise PermissionDenied("You are not a member of this workspace.")
    if manager and not m.is_manager:
        raise PermissionDenied("Only workspace owners and admins can do this.")
    return m


class WorkspaceViewSet(viewsets.ModelViewSet):
    queryset = Workspace.objects.none()
    serializer_class = WorkspaceSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filter_backends = []
    pagination_class = None

    def get_queryset(self):
        return (Workspace.objects.filter(memberships__user=self.request.user)
                .prefetch_related("memberships").distinct())

    @transaction.atomic
    def perform_create(self, serializer):
        ws = serializer.save(owner=self.request.user)
        WorkspaceMembership.objects.create(workspace=ws, user=self.request.user, role=WorkspaceRole.OWNER)
        log_activity(actor=self.request.user, workspace=ws, verb="created", target=ws, message=f"created workspace {ws.name}")

    def perform_update(self, serializer):
        require_member(self.request.user, serializer.instance.pk, manager=True)
        ws = serializer.save()
        log_activity(actor=self.request.user, workspace=ws, verb="updated", target=ws, message="updated workspace settings")

    def perform_destroy(self, instance):
        if instance.owner_id != self.request.user.id:
            raise PermissionDenied("Only the workspace owner can delete it.")
        if Workspace.objects.filter(memberships__user=self.request.user).count() <= 1:
            raise ValidationError({"detail": "You cannot delete your only workspace."})
        instance.delete()

    @extend_schema(responses={200: dict})
    @action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        ws = self.get_object()
        from collaboration.models import ActivityLog, Task
        from collaboration.serializers import ActivityLogSerializer, TaskSerializer
        from projects.serializers import ProjectListSerializer

        projects = accessible_projects(request.user).filter(workspace=ws)
        today = timezone.localdate()
        tasks = (Task.objects.filter(project__in=projects).exclude(status=Task.Status.DONE)
                 .select_related("assignee", "project").order_by("due_date", "-priority")[:6])
        activity = (ActivityLog.objects.filter(workspace=ws)
                    .filter(project__isnull=True) | ActivityLog.objects.filter(project__in=projects))
        ctx = {"request": request}
        return Response({
            "total_projects": projects.count(),
            "active_projects": projects.filter(status__in=[Project.Status.IN_PROGRESS, Project.Status.REVIEW]).count(),
            "published_projects": projects.filter(status=Project.Status.PUBLISHED).count(),
            "team_members": ws.memberships.count(),
            "open_tasks": Task.objects.filter(project__in=projects).exclude(status=Task.Status.DONE).count(),
            "overdue_tasks": Task.objects.filter(project__in=projects, due_date__lt=today).exclude(status=Task.Status.DONE).count(),
            "recent_projects": ProjectListSerializer(
                projects.exclude(status=Project.Status.ARCHIVED).select_related("owner", "workspace")
                .prefetch_related("memberships__user")[:5], many=True, context=ctx).data,
            "upcoming_tasks": TaskSerializer(tasks, many=True, context=ctx).data,
            "recent_activity": ActivityLogSerializer(
                activity.select_related("actor", "project").order_by("-created_at")[:10], many=True, context=ctx).data,
            "projects_by_status": [
                {"status": s, "label": label, "count": projects.filter(status=s).count()} for s, label in Project.Status.choices
            ],
        })

    @extend_schema(request=None, responses={201: dict})
    @action(detail=True, methods=["post"], url_path="load-demo")
    def load_demo(self, request, pk=None):
        ws = self.get_object()
        require_member(request.user, ws.pk, manager=True)
        from smartstock.demo import create_smartstock_demo

        if ws.projects.filter(store__isnull=False, slug__startswith="smartstock-ai").exists():
            raise ValidationError({"detail": "The SmartStock AI demo project already exists in this workspace."})
        project = create_smartstock_demo(ws, request.user)
        return Response({"project_id": project.pk, "slug": project.slug}, status=status.HTTP_201_CREATED)


class WorkspaceMemberViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin,
                             viewsets.GenericViewSet):
    queryset = WorkspaceMembership.objects.none()
    serializer_class = MembershipSerializer
    filterset_fields = ["workspace", "role"]
    search_fields = ["user__email", "user__full_name"]
    pagination_class = None

    def get_queryset(self):
        return (WorkspaceMembership.objects
                .filter(workspace__memberships__user=self.request.user)
                .select_related("user")
                .prefetch_related(Prefetch("user__project_memberships",
                                           queryset=ProjectMembership.objects.select_related("project")))
                .distinct())

    def perform_update(self, serializer):
        m = serializer.instance
        require_member(self.request.user, m.workspace_id, manager=True)
        if m.role == WorkspaceRole.OWNER:
            raise PermissionDenied("The workspace owner's role cannot be changed.")
        serializer.save()
        log_activity(actor=self.request.user, workspace=m.workspace, verb="role_changed", target=m,
                     message=f"changed {m.user.display_name}'s role to {m.get_role_display()}")

    def perform_destroy(self, instance):
        is_self = instance.user_id == self.request.user.id
        if not is_self:
            require_member(self.request.user, instance.workspace_id, manager=True)
        if instance.role == WorkspaceRole.OWNER:
            raise PermissionDenied("The workspace owner cannot be removed.")
        with transaction.atomic():
            ProjectMembership.objects.filter(user=instance.user, project__workspace=instance.workspace).delete()
            instance.delete()
            log_activity(actor=self.request.user, workspace=instance.workspace, verb="removed", target=instance,
                         message=f"{'left' if is_self else 'removed ' + instance.user.display_name + ' from'} the workspace")


class InvitationViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin,
                        viewsets.GenericViewSet):
    queryset = Invitation.objects.none()
    serializer_class = InvitationSerializer
    filterset_fields = ["workspace", "status"]
    pagination_class = None

    def get_queryset(self):
        return (Invitation.objects.filter(workspace__memberships__user=self.request.user,
                                          workspace__memberships__role__in=[WorkspaceRole.OWNER, WorkspaceRole.ADMIN])
                .select_related("invited_by").prefetch_related("projects").distinct())

    def perform_create(self, serializer):
        ws = serializer.validated_data["workspace"]
        require_member(self.request.user, ws.pk, manager=True)
        inv = serializer.save(invited_by=self.request.user)
        log_activity(actor=self.request.user, workspace=ws, verb="invited", target=inv,
                     message=f"invited {inv.email} as {inv.get_role_display()}")

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        response.data["email_delivery_configured"] = settings.EMAIL_DELIVERY_CONFIGURED
        if settings.EMAIL_DELIVERY_CONFIGURED:
            from django.core.mail import send_mail

            send_mail("You're invited to WebMindClub", f"Accept your invitation: {response.data['invite_url']}",
                      settings.DEFAULT_FROM_EMAIL, [response.data["email"]])
        return response

    def perform_destroy(self, instance):
        instance.status = Invitation.Status.REVOKED
        instance.save(update_fields=["status", "updated_at"])

    @extend_schema(request=AcceptInvitationSerializer, responses={200: WorkspaceSerializer})
    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def accept(self, request):
        s = AcceptInvitationSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        inv = get_object_or_404(Invitation, token=s.validated_data["token"])
        if inv.status != Invitation.Status.PENDING or inv.is_expired:
            raise ValidationError({"detail": "This invitation is no longer valid."})
        if inv.email.lower() != request.user.email.lower():
            raise PermissionDenied("This invitation was issued for a different email address.")
        with transaction.atomic():
            WorkspaceMembership.objects.get_or_create(workspace=inv.workspace, user=request.user, defaults={"role": inv.role})
            for project in inv.projects.all():
                ProjectMembership.objects.get_or_create(
                    project=project, user=request.user,
                    defaults={"role": "viewer" if inv.role == WorkspaceRole.VIEWER else "editor"})
            inv.status = Invitation.Status.ACCEPTED
            inv.save(update_fields=["status", "updated_at"])
            log_activity(actor=request.user, workspace=inv.workspace, verb="joined", target=inv, message="joined the workspace")
        ws = Workspace.objects.prefetch_related("memberships").get(pk=inv.workspace_id)
        return Response(WorkspaceSerializer(ws, context={"request": request}).data)

    @extend_schema(responses={200: dict})
    @action(detail=False, methods=["get"], url_path=r"preview/(?P<token>[\w\-]+)", permission_classes=[permissions.AllowAny])
    def preview(self, request, token=None):
        inv = get_object_or_404(Invitation, token=token, status=Invitation.Status.PENDING)
        if inv.is_expired:
            raise ValidationError({"detail": "This invitation has expired."})
        return Response({"workspace": inv.workspace.name, "email": inv.email, "role": inv.get_role_display()})
