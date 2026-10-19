from django.contrib import admin

from .models import Project, ProjectMembership

admin.site.register(Project, list_display=["name", "workspace", "project_type", "status", "updated_at"],
                    list_filter=["status", "project_type"], search_fields=["name"])
admin.site.register(ProjectMembership, list_display=["project", "user", "role"])
