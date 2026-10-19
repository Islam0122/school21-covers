from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.serializers import PublicUserSerializer
from projects.models import Project
from workspaces.access import accessible_projects, membership

from .models import ActivityLog, Task

User = get_user_model()


class ActivityLogSerializer(serializers.ModelSerializer):
    actor = PublicUserSerializer(read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True, default=None)

    class Meta:
        model = ActivityLog
        fields = ["id", "workspace", "project", "project_name", "actor", "verb", "target_type", "target_id",
                  "message", "metadata", "created_at"]


class TaskSerializer(serializers.ModelSerializer):
    assignee = PublicUserSerializer(read_only=True)
    assignee_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="assignee", write_only=True, allow_null=True, required=False)
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all())
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = Task
        fields = ["id", "project", "project_name", "title", "description", "status", "priority", "assignee",
                  "assignee_id", "due_date", "position", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_project(self, project):
        if not accessible_projects(self.context["request"].user).filter(pk=project.pk).exists():
            raise serializers.ValidationError("Project not found.")
        if self.instance and project.pk != self.instance.project_id:
            raise serializers.ValidationError("Tasks cannot be moved between projects.")
        return project

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Title is required.")
        return value

    def validate(self, attrs):
        project = attrs.get("project") or self.instance.project
        assignee = attrs.get("assignee")
        if assignee is not None and membership(assignee, project.workspace_id) is None:
            raise serializers.ValidationError({"assignee_id": "Assignee must be a member of the project's workspace."})
        return attrs
