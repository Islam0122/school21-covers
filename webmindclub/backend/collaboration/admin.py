from django.contrib import admin

from .models import ActivityLog, Task

admin.site.register(Task, list_display=["title", "project", "status", "priority", "assignee", "due_date"])
admin.site.register(ActivityLog, list_display=["message", "workspace", "actor", "created_at"])
