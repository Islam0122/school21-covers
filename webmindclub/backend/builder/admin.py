from django.contrib import admin

from .models import PageVersion, ProjectAsset, PublicationVersion, PublishedSite, ThemeConfiguration, WebsitePage

admin.site.register(WebsitePage, list_display=["title", "project", "slug", "status", "is_home"])
admin.site.register(PageVersion, list_display=["page", "note", "created_at"])
admin.site.register(ThemeConfiguration, list_display=["project", "preset", "updated_at"])
admin.site.register(ProjectAsset, list_display=["original_name", "project", "size", "created_at"])
admin.site.register(PublishedSite, list_display=["slug", "project", "is_live"])
admin.site.register(PublicationVersion, list_display=["project", "number", "action", "created_at"])
