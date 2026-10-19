from rest_framework import serializers

from accounts.serializers import PublicUserSerializer
from common.uploads import validate_image_upload

from .models import Invitation, Workspace, WorkspaceMembership, WorkspaceRole


class WorkspaceSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    member_count = serializers.IntegerField(read_only=True, source="memberships.count")

    class Meta:
        model = Workspace
        fields = ["id", "name", "slug", "logo", "theme", "role", "member_count", "created_at"]
        read_only_fields = ["id", "slug", "created_at"]

    def get_role(self, obj) -> str | None:
        user = self.context["request"].user
        m = next((m for m in obj.memberships.all() if m.user_id == user.id), None)
        return m.role if m else None

    def validate_logo(self, value):
        return validate_image_upload(value)

    def validate_theme(self, value):
        if value not in {"dark", "light"}:
            raise serializers.ValidationError("Theme must be 'dark' or 'light'.")
        return value


class MembershipSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(read_only=True)
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    project_ids = serializers.SerializerMethodField()

    class Meta:
        model = WorkspaceMembership
        fields = ["id", "workspace", "user", "role", "role_label", "project_ids", "created_at"]
        read_only_fields = ["id", "workspace", "user", "created_at"]

    def get_project_ids(self, obj) -> list[int]:
        return [pm.project_id for pm in obj.user.project_memberships.all() if pm.project.workspace_id == obj.workspace_id]

    def validate_role(self, value):
        if value == WorkspaceRole.OWNER:
            raise serializers.ValidationError("Ownership cannot be assigned through role changes.")
        return value


class InvitationSerializer(serializers.ModelSerializer):
    invite_url = serializers.SerializerMethodField()
    is_expired = serializers.BooleanField(read_only=True)
    invited_by = PublicUserSerializer(read_only=True)

    class Meta:
        model = Invitation
        fields = ["id", "workspace", "email", "role", "status", "invited_by", "expires_at", "is_expired",
                  "projects", "invite_url", "created_at"]
        read_only_fields = ["id", "status", "invited_by", "expires_at", "created_at"]

    def get_invite_url(self, obj) -> str | None:
        from django.conf import settings

        if obj.status != Invitation.Status.PENDING:
            return None
        return f"{settings.FRONTEND_URL}/invite/{obj.token}"

    def validate_role(self, value):
        if value == WorkspaceRole.OWNER:
            raise serializers.ValidationError("Invitations cannot grant ownership.")
        return value

    def validate(self, attrs):
        ws = attrs.get("workspace")
        email = attrs.get("email", "").lower()
        attrs["email"] = email
        if ws.memberships.filter(user__email=email).exists():
            raise serializers.ValidationError({"email": "This person is already a workspace member."})
        if ws.invitations.filter(email=email, status=Invitation.Status.PENDING).exists():
            raise serializers.ValidationError({"email": "A pending invitation already exists for this email."})
        for project in attrs.get("projects", []):
            if project.workspace_id != ws.id:
                raise serializers.ValidationError({"projects": "Projects must belong to this workspace."})
        return attrs


class AcceptInvitationSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=64)
