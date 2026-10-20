from django.conf import settings
from django.db import models

from common.models import TimeStampedModel


class ThemeConfiguration(TimeStampedModel):
    project = models.OneToOneField("projects.Project", on_delete=models.CASCADE, related_name="theme")
    preset = models.CharField(max_length=40, default="modern-dark")
    tokens = models.JSONField(default=dict)


class WebsitePage(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="pages")
    title = models.CharField(max_length=120)
    slug = models.SlugField(max_length=80, allow_unicode=False)
    seo_title = models.CharField(max_length=70, blank=True)
    seo_description = models.CharField(max_length=180, blank=True)
    content = models.JSONField(default=dict)
    position = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PUBLISHED)
    is_home = models.BooleanField(default=False)

    class Meta:
        ordering = ["position", "id"]
        constraints = [models.UniqueConstraint(fields=["project", "slug"], name="unique_page_slug_per_project")]

    def __str__(self) -> str:
        return f"{self.project} / {self.title}"


class PageVersion(models.Model):
    page = models.ForeignKey(WebsitePage, on_delete=models.CASCADE, related_name="versions")
    title = models.CharField(max_length=120)
    content = models.JSONField(default=dict)
    note = models.CharField(max_length=120, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


def asset_upload_path(instance, filename):
    import uuid
    from pathlib import Path

    return f"assets/project-{instance.project_id}/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"


class ProjectAsset(models.Model):
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="assets")
    file = models.ImageField(upload_to=asset_upload_path)
    original_name = models.CharField(max_length=200)
    size = models.PositiveIntegerField()
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class PublishedSite(TimeStampedModel):
    project = models.OneToOneField("projects.Project", on_delete=models.CASCADE, related_name="published_site")
    slug = models.SlugField(max_length=160, unique=True)
    is_live = models.BooleanField(default=False)
    current_version = models.ForeignKey(
        "PublicationVersion", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )


class PublicationVersion(models.Model):
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="publications")
    number = models.PositiveIntegerField()
    snapshot = models.JSONField()
    note = models.CharField(max_length=200, blank=True)
    action = models.CharField(max_length=20, default="publish")
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-number"]
        constraints = [models.UniqueConstraint(fields=["project", "number"], name="unique_publication_number")]
