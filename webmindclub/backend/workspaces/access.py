"""Central access-control helpers. Every API view resolves objects through these
querysets so that changing an ID in a request can never expose foreign data."""
from django.db.models import Q, QuerySet

from .models import WorkspaceMembership, WorkspaceRole, MANAGER_ROLES, CONTRIBUTOR_ROLES


def membership(user, workspace_id) -> WorkspaceMembership | None:
    if not user.is_authenticated:
        return None
    return WorkspaceMembership.objects.filter(user=user, workspace_id=workspace_id).first()


def accessible_projects(user) -> QuerySet:
    """Projects the user may view: managers see every workspace project; other members
    see projects they are assigned to plus projects shared with the whole workspace."""
    from projects.models import Project

    if not user.is_authenticated:
        return Project.objects.none()
    return Project.objects.filter(
        Q(workspace__memberships__user=user, workspace__memberships__role__in=list(MANAGER_ROLES))
        | Q(memberships__user=user)
        | Q(visibility=Project.Visibility.WORKSPACE, workspace__memberships__user=user)
    ).distinct()


def can_edit_project(user, project) -> bool:
    m = membership(user, project.workspace_id)
    if m is None:
        return False
    if m.role in MANAGER_ROLES:
        return True
    if m.role not in CONTRIBUTOR_ROLES:
        return False
    return project.memberships.filter(user=user).exclude(role="viewer").exists()


def can_manage_project(user, project) -> bool:
    """Delete / archive / membership changes: workspace managers or the project lead."""
    m = membership(user, project.workspace_id)
    if m is None:
        return False
    if m.role in MANAGER_ROLES:
        return True
    return m.role in CONTRIBUTOR_ROLES and project.memberships.filter(user=user, role="lead").exists()


__all__ = ["membership", "accessible_projects", "can_edit_project", "can_manage_project", "WorkspaceRole"]
