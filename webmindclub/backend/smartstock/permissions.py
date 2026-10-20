"""SmartStock access: a user needs access to the parent WebMindClub project AND an
explicit SmartStock store role. Workspace roles never grant store data access."""
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from workspaces.access import accessible_projects, can_manage_project

from .models import Store, StoreRole, StoreStaff

WRITE_ROLES = {StoreRole.MANAGER, StoreRole.CLERK}


def accessible_stores(user):
    return Store.objects.filter(project__in=accessible_projects(user), staff__user=user).distinct()


def store_role(user, store) -> str | None:
    staff = StoreStaff.objects.filter(store=store, user=user).only("role").first()
    return staff.role if staff else None


def get_store(user, store_id) -> Store:
    return get_object_or_404(accessible_stores(user).select_related("project"), pk=store_id)


def require_write(user, store):
    if store_role(user, store) not in WRITE_ROLES:
        raise PermissionDenied("Your SmartStock role is read-only.")


def require_manager(user, store):
    if store_role(user, store) != StoreRole.MANAGER:
        raise PermissionDenied("Only store managers can do this.")


def can_admin_staff(user, store) -> bool:
    return store_role(user, store) == StoreRole.MANAGER or can_manage_project(user, store.project)
