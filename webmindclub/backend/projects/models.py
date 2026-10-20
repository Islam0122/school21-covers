from django.conf import settings
from django.db import models
from django.utils.text import slugify

from common.models import TimeStampedModel


class Project(TimeStampedModel):
    class Type(models.TextChoices):
        WEBSITE = "website", "Website"
        SAAS = "saas", "SaaS"
        ECOMMERCE = "ecommerce", "E-commerce"
        DASHBOARD = "dashboard", "Dashboard"
        LANDING = "landing", "Landing Page"
        INTERNAL_TOOL = "internal_tool", "Internal Tool"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        IN_PROGRESS = "in_progress", "In Progress"
        REVIEW = "review", "Ready for Review"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"

    class Visibility(models.TextChoices):
        PRIVATE = "private", "Private (assigned members only)"
        WORKSPACE = "workspace", "Workspace (all members can view)"

    workspace = models.ForeignKey("workspaces.Workspace", on_delete=models.CASCADE, related_name="projects")
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=80)
    description = models.TextField(blank=True, max_length=2000)
    project_type = models.CharField(max_length=20, choices=Type.choices, default=Type.WEBSITE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    visibility = models.CharField(max_length=10, choices=Visibility.choices, default=Visibility.PRIVATE)
    template = models.CharField(max_length=40, default="blank")
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="owned_projects")
    logo = models.ImageField(upload_to="project-logos/", blank=True)
    status_before_archive = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [models.UniqueConstraint(fields=["workspace", "slug"], name="unique_project_slug_per_workspace")]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_project_slug(self.workspace_id, self.name, exclude_pk=self.pk)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


def unique_project_slug(workspace_id, value, exclude_pk=None) -> str:
    base = slugify(value)[:70] or "project"
    slug, n = base, 2
    qs = Project.objects.filter(workspace_id=workspace_id)
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    while qs.filter(slug=slug).exists():
        slug, n = f"{base}-{n}", n + 1
    return slug


class ProjectMembership(TimeStampedModel):
    class Role(models.TextChoices):
        LEAD = "lead", "Lead"
        EDITOR = "editor", "Editor"
        VIEWER = "viewer", "Viewer"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="project_memberships")
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.EDITOR)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["project", "user"], name="unique_project_member")]
        ordering = ["created_at"]
