import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from common.models import TimeStampedModel


class WorkspaceRole(models.TextChoices):
    OWNER = "owner", "Workspace Owner"
    ADMIN = "admin", "Admin"
    DEVELOPER = "developer", "Developer"
    DESIGNER = "designer", "Designer"
    PROJECT_MANAGER = "project_manager", "Project Manager"
    VIEWER = "viewer", "Viewer"


MANAGER_ROLES = {WorkspaceRole.OWNER, WorkspaceRole.ADMIN}
CONTRIBUTOR_ROLES = MANAGER_ROLES | {WorkspaceRole.DEVELOPER, WorkspaceRole.DESIGNER, WorkspaceRole.PROJECT_MANAGER}


class Workspace(TimeStampedModel):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    logo = models.ImageField(upload_to="workspace-logos/", blank=True)
    theme = models.CharField(max_length=20, default="dark")
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="owned_workspaces")
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, through="WorkspaceMembership", related_name="workspaces")

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name)[:120] or "workspace"
            slug, n = base, 2
            while Workspace.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug, n = f"{base}-{n}", n + 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class WorkspaceMembership(TimeStampedModel):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="workspace_memberships")
    role = models.CharField(max_length=20, choices=WorkspaceRole.choices, default=WorkspaceRole.VIEWER)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "user"], name="unique_workspace_member")]
        ordering = ["created_at"]

    @property
    def is_manager(self) -> bool:
        return self.role in MANAGER_ROLES

    @property
    def can_contribute(self) -> bool:
        return self.role in CONTRIBUTOR_ROLES

    def __str__(self) -> str:
        return f"{self.user} @ {self.workspace} ({self.role})"


def _invite_token() -> str:
    return secrets.token_urlsafe(32)


def _invite_expiry():
    return timezone.now() + timedelta(days=7)


class Invitation(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REVOKED = "revoked", "Revoked"

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="invitations")
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=WorkspaceRole.choices, default=WorkspaceRole.VIEWER)
    token = models.CharField(max_length=64, unique=True, default=_invite_token, editable=False)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    expires_at = models.DateTimeField(default=_invite_expiry)
    projects = models.ManyToManyField("projects.Project", blank=True, related_name="+")

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at
