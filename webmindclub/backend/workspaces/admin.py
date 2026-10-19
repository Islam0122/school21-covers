from django.contrib import admin

from .models import Invitation, Workspace, WorkspaceMembership

admin.site.register(Workspace, list_display=["name", "slug", "owner", "created_at"], search_fields=["name"])
admin.site.register(WorkspaceMembership, list_display=["workspace", "user", "role"], list_filter=["role"])
admin.site.register(Invitation, list_display=["workspace", "email", "role", "status", "expires_at"])
