from copy import deepcopy

from django.db import transaction
from django.db.models import Max
from django.utils.text import slugify

from .models import PageVersion, PublicationVersion, PublishedSite, ThemeConfiguration, WebsitePage
from .registry import PRESETS_BY_KEY, validate_content, validate_theme
from .templates_library import TEMPLATES, template_pages

MAX_PAGE_VERSIONS = 30


def setup_project_site(project, template="blank", branding=None):
    tpl = TEMPLATES.get(template, TEMPLATES["blank"])
    tokens = deepcopy(PRESETS_BY_KEY[tpl["preset"]]["tokens"])
    branding = branding or {}
    if branding.get("primary"):
        tokens["primary"] = branding["primary"]
    if branding.get("secondary"):
        tokens["secondary"] = branding["secondary"]
    if branding.get("font"):
        tokens["headingFont"] = tokens["bodyFont"] = branding["font"]
    ThemeConfiguration.objects.update_or_create(
        project=project, defaults={"preset": tpl["preset"] if not branding else "custom", "tokens": validate_theme(tokens)})
    for i, page in enumerate(template_pages(template, project.name)):
        WebsitePage.objects.create(project=project, title=page["title"], slug=page["slug"], is_home=page["is_home"],
                                   position=i, seo_title=f"{page['title']} · {project.name}"[:70],
                                   content=validate_content({"blocks": page["blocks"]}))


def record_page_version(page, user, note=""):
    PageVersion.objects.create(page=page, title=page.title, content=page.content, created_by=user, note=note[:120])
    stale = page.versions.values_list("pk", flat=True)[MAX_PAGE_VERSIONS:]
    PageVersion.objects.filter(pk__in=list(stale)).delete()


def site_snapshot(project, include_drafts=False) -> dict:
    theme = getattr(project, "theme", None)
    pages = project.pages.all()
    if not include_drafts:
        pages = pages.filter(status=WebsitePage.Status.PUBLISHED)
    return {
        "project": {"id": project.pk, "name": project.name, "slug": project.slug},
        "theme": theme.tokens if theme else validate_theme({}),
        "pages": [{"id": p.pk, "title": p.title, "slug": p.slug, "is_home": p.is_home, "seo_title": p.seo_title,
                   "seo_description": p.seo_description, "content": p.content} for p in pages],
    }


def default_site_slug(project) -> str:
    base = slugify(f"{project.workspace.slug}-{project.slug}")[:150]
    slug, n = base, 2
    while PublishedSite.objects.filter(slug=slug).exclude(project=project).exists():
        slug, n = f"{base}-{n}", n + 1
    return slug


@transaction.atomic
def publish(project, user, note="") -> PublicationVersion:
    from projects.models import Project

    snapshot = site_snapshot(project)
    if not snapshot["pages"]:
        from rest_framework.exceptions import ValidationError

        raise ValidationError({"detail": "Mark at least one page as published before publishing the site."})
    site, _ = PublishedSite.objects.select_for_update().get_or_create(project=project, defaults={"slug": default_site_slug(project)})
    number = (project.publications.aggregate(n=Max("number"))["n"] or 0) + 1
    version = PublicationVersion.objects.create(project=project, number=number, snapshot=snapshot, note=note[:200],
                                                action="publish", published_by=user)
    site.is_live = True
    site.current_version = version
    site.save()
    Project.objects.filter(pk=project.pk).update(status=Project.Status.PUBLISHED)
    return version


@transaction.atomic
def unpublish(project, user):
    from projects.models import Project

    site = PublishedSite.objects.select_for_update().filter(project=project, is_live=True).first()
    if not site:
        from rest_framework.exceptions import ValidationError

        raise ValidationError({"detail": "This project is not published."})
    site.is_live = False
    site.save(update_fields=["is_live", "updated_at"])
    number = (project.publications.aggregate(n=Max("number"))["n"] or 0) + 1
    PublicationVersion.objects.create(project=project, number=number, snapshot={}, action="unpublish", published_by=user)
    if project.status == Project.Status.PUBLISHED:
        Project.objects.filter(pk=project.pk).update(status=Project.Status.REVIEW)


def copy_site(source, target):
    theme = getattr(source, "theme", None)
    if theme:
        ThemeConfiguration.objects.create(project=target, preset=theme.preset, tokens=deepcopy(theme.tokens))
    for page in source.pages.all():
        WebsitePage.objects.create(project=target, title=page.title, slug=page.slug, seo_title=page.seo_title,
                                   seo_description=page.seo_description, content=deepcopy(page.content),
                                   position=page.position, status=page.status, is_home=page.is_home)
