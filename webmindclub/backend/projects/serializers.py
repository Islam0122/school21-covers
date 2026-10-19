import re

from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.serializers import PublicUserSerializer
from builder.templates_library import TEMPLATES
from common.uploads import validate_image_upload
from workspaces.access import can_edit_project, can_manage_project, membership

from .models import Project, ProjectMembership

User = get_user_model()
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
FONT_CHOICES = ["Inter", "Manrope", "Poppins", "Space Grotesk", "DM Sans", "Playfair Display", "Lora", "Roboto"]
HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


class ProjectMemberSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source="user", write_only=True)

    class Meta:
        model = ProjectMembership
        fields = ["id", "user", "user_id", "role", "created_at"]
        read_only_fields = ["id", "created_at"]


class ProjectListSerializer(serializers.ModelSerializer):
    owner = PublicUserSerializer(read_only=True)
    members = serializers.SerializerMethodField()
    type_label = serializers.CharField(source="get_project_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    has_store = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ["id", "workspace", "name", "slug", "description", "project_type", "type_label", "status",
                  "status_label", "visibility", "template", "logo", "owner", "members", "has_store", "permissions",
                  "created_at", "updated_at"]

    def get_members(self, obj) -> list[dict]:
        return [PublicUserSerializer(m.user, context=self.context).data for m in obj.memberships.all()][:8]

    def get_has_store(self, obj) -> bool:
        return hasattr(obj, "store")

    def get_permissions(self, obj) -> dict:
        user = self.context["request"].user
        return {"edit": can_edit_project(user, obj), "manage": can_manage_project(user, obj)}


class ProjectSerializer(ProjectListSerializer):
    slug = serializers.CharField(max_length=80, required=False, allow_blank=True)
    publication = serializers.SerializerMethodField()
    counts = serializers.SerializerMethodField()

    class Meta(ProjectListSerializer.Meta):
        fields = ProjectListSerializer.Meta.fields + ["publication", "counts"]
        validators = []  # slug uniqueness is validated (and auto-generated) explicitly
        read_only_fields = ["owner", "template", "created_at", "updated_at"]

    def get_publication(self, obj) -> dict:
        from builder.serializers import published_site_payload

        return published_site_payload(obj)

    def get_counts(self, obj) -> dict:
        return {"pages": obj.pages.count(), "tasks": obj.tasks.count(),
                "open_tasks": obj.tasks.exclude(status="done").count(), "members": obj.memberships.count()}

    def validate_slug(self, value):
        value = value.strip().lower()
        if value and not SLUG_RE.match(value):
            raise serializers.ValidationError("Use lowercase letters, numbers and single hyphens.")
        return value

    def validate_logo(self, value):
        return validate_image_upload(value)

    def validate(self, attrs):
        ws = attrs.get("workspace") or getattr(self.instance, "workspace", None)
        if self.instance and "workspace" in attrs and attrs["workspace"] != self.instance.workspace:
            raise serializers.ValidationError({"workspace": "Projects cannot be moved between workspaces."})
        slug = attrs.get("slug")
        if slug:
            qs = Project.objects.filter(workspace=ws, slug=slug)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"slug": "This slug is already used in the workspace."})
        return attrs


class BrandingSerializer(serializers.Serializer):
    primary = serializers.RegexField(HEX_RE, required=False)
    secondary = serializers.RegexField(HEX_RE, required=False)
    font = serializers.ChoiceField(FONT_CHOICES, required=False)


class ProjectCreateSerializer(ProjectSerializer):
    """Used by the Create Project wizard: also applies a starter template and branding."""

    template = serializers.ChoiceField(choices=list(TEMPLATES), default="blank")
    branding = BrandingSerializer(required=False, write_only=True)

    class Meta(ProjectSerializer.Meta):
        fields = ProjectSerializer.Meta.fields + ["branding"]

    def validate_workspace(self, ws):
        m = membership(self.context["request"].user, ws.pk)
        if m is None:
            raise serializers.ValidationError("You are not a member of this workspace.")
        if not m.can_contribute:
            raise serializers.ValidationError("Viewers cannot create projects.")
        return ws
