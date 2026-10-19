import django_filters
from rest_framework import mixins, viewsets
from rest_framework.exceptions import PermissionDenied

from workspaces.access import accessible_projects, can_edit_project

from .activity import log_activity
from .models import ActivityLog, Task
from .serializers import ActivityLogSerializer, TaskSerializer


class TaskFilter(django_filters.FilterSet):
    workspace = django_filters.NumberFilter(field_name="project__workspace")

    class Meta:
        model = Task
        fields = ["project", "status", "priority", "assignee", "workspace"]


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.none()
    serializer_class = TaskSerializer
    filterset_class = TaskFilter
    search_fields = ["title", "description"]
    ordering_fields = ["due_date", "priority", "created_at", "position", "title"]
    pagination_class = None

    def get_queryset(self):
        return (Task.objects.filter(project__in=accessible_projects(self.request.user))
                .select_related("assignee", "project", "project__workspace"))

    def _check(self, project):
        if not can_edit_project(self.request.user, project):
            raise PermissionDenied("You do not have permission to change tasks in this project.")

    def perform_create(self, serializer):
        project = serializer.validated_data["project"]
        self._check(project)
        task = serializer.save(created_by=self.request.user)
        log_activity(actor=self.request.user, workspace=project.workspace, project=project, verb="created",
                     target=task, message=f"created task “{task.title}”")

    def perform_update(self, serializer):
        task = serializer.instance
        self._check(task.project)
        before = task.status
        task = serializer.save()
        if before != task.status:
            log_activity(actor=self.request.user, workspace=task.project.workspace, project=task.project,
                         verb="moved", target=task, message=f"moved “{task.title}” to {task.get_status_display()}")

    def perform_destroy(self, instance):
        self._check(instance.project)
        log_activity(actor=self.request.user, workspace=instance.project.workspace, project=instance.project,
                     verb="deleted", target=instance, message=f"deleted task “{instance.title}”")
        instance.delete()


class ActivityFilter(django_filters.FilterSet):
    class Meta:
        model = ActivityLog
        fields = ["workspace", "project", "verb"]


class ActivityLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = ActivityLog.objects.none()
    serializer_class = ActivityLogSerializer
    filterset_class = ActivityFilter
    search_fields = ["message"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        projects = accessible_projects(user)
        workspace_level = ActivityLog.objects.filter(project__isnull=True, workspace__memberships__user=user)
        return (workspace_level | ActivityLog.objects.filter(project__in=projects)).select_related("actor", "project").distinct()
