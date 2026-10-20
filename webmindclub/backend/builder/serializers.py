import re

from django.conf import settings
from rest_framework import serializers

from accounts.serializers import PublicUserSerializer
from projects.models import Project
from workspaces.access import accessible_projects

from .models import PageVersion, ProjectAsset, PublicationVersion, ThemeConfiguration, WebsitePage
from .registry import PRESETS_BY_KEY, validate_content, validate_theme

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
RESERVED_SLUGS = {"api", "admin", "media", "static"}


def published_site_payload(project):
    site = getattr(project, "published_site", None)
    if site is None:
        return {"is_live": False, "slug": None, "url": None, "version": None, "published_at": None}
    return {
        "is_live": site.is_live,
        "slug": site.slug,
        "url": f"{settings.FRONTEND_URL}/sites/{site.slug}" if site.is_live else None,
        "version": site.current_version.number if site.current_version else None,
        "published_at": site.current_version.created_at if site.current_version else None,
    }


class AccessibleProjectField(serializers.PrimaryKeyRelatedField):
    def get_queryset(self):
        return accessible_projects(self.context["request"].user)


class WebsitePageSerializer(serializers.ModelSerializer):
    project = AccessibleProjectField(queryset=Project.objects.none())
    content = serializers.JSONField(required=False)
    version_count = serializers.IntegerField(source="versions.count", read_only=True)

    class Meta:
        model = WebsitePage
        fields = ["id", "project", "title", "slug", "seo_title", "seo_description", "content", "position", "status",
                  "is_home", "version_count", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
        validators = []  # slug uniqueness validated explicitly in validate()

    def validate_slug(self, value):
        value = value.strip().lower()
        if not SLUG_RE.match(value):
            raise serializers.ValidationError("Use lowercase letters, numbers and single hyphens.")
        if value in RESERVED_SLUGS:
            raise serializers.ValidationError("This slug is reserved.")
        return value

    def validate_content(self, value):
        return validate_content(value)

    def validate(self, attrs):
        project = attrs.get("project") or self.instance.project
        if self.instance and "project" in attrs and attrs["project"].pk != self.instance.project_id:
            raise serializers.ValidationError({"project": "Pages cannot be moved between projects."})
        slug = attrs.get("slug")
        if slug:
            qs = WebsitePage.objects.filter(project=project, slug=slug)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"slug": "Another page in this project already uses this slug."})
        return attrs


class PageVersionSerializer(serializers.ModelSerializer):
    created_by = PublicUserSerializer(read_only=True)
    block_count = serializers.SerializerMethodField()

    class Meta:
        model = PageVersion
        fields = ["id", "page", "title", "note", "block_count", "created_by", "created_at"]

    def get_block_count(self, obj) -> int:
        return len((obj.content or {}).get("blocks", []))


class ThemeSerializer(serializers.ModelSerializer):
    tokens = serializers.JSONField()

    class Meta:
        model = ThemeConfiguration
        fields = ["preset", "tokens", "updated_at"]
        read_only_fields = ["updated_at"]

    def validate_preset(self, value):
        if value != "custom" and value not in PRESETS_BY_KEY:
            raise serializers.ValidationError("Unknown theme preset.")
        return value

    def validate_tokens(self, value):
        return validate_theme(value)


class ProjectAssetSerializer(serializers.ModelSerializer):
    project = AccessibleProjectField(queryset=Project.objects.none())
    url = serializers.SerializerMethodField()

    class Meta:
        model = ProjectAsset
        fields = ["id", "project", "file", "url", "original_name", "size", "width", "height", "created_at"]
        read_only_fields = ["id", "url", "original_name", "size", "width", "height", "created_at"]
        extra_kwargs = {"file": {"write_only": True}}

    def get_url(self, obj) -> str:
        # Relative URL keeps the asset compatible with the page content validator (/media/...).
        return obj.file.url

    def validate_file(self, value):
        from common.uploads import validate_image_upload

        return validate_image_upload(value)


class PublicationVersionSerializer(serializers.ModelSerializer):
    published_by = PublicUserSerializer(read_only=True)
    page_count = serializers.SerializerMethodField()

    class Meta:
        model = PublicationVersion
        fields = ["id", "number", "action", "note", "page_count", "published_by", "created_at"]

    def get_page_count(self, obj) -> int:
        return len((obj.snapshot or {}).get("pages", []))


class PublishSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=200, required=False, allow_blank=True)


class ReorderSerializer(serializers.Serializer):
    project = serializers.IntegerField()
    order = serializers.ListField(child=serializers.IntegerField(), allow_empty=False, max_length=200)


class RestoreVersionSerializer(serializers.Serializer):
    version = serializers.IntegerField()
