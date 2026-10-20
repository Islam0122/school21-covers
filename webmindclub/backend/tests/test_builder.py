import io

import pytest
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from builder.registry import default_block, validate_content

pytestmark = pytest.mark.django_db


def test_registry_rejects_unsafe_content():
    from rest_framework.exceptions import ValidationError

    with pytest.raises(ValidationError):
        validate_content({"blocks": [{"type": "script", "props": {}}]})
    with pytest.raises(ValidationError):
        validate_content({"blocks": [default_block("button", props={"href": "javascript:alert(1)"})]})
    with pytest.raises(ValidationError):
        validate_content({"blocks": [default_block("image", props={"src": "data:text/html;base64,xx"})]})
    with pytest.raises(ValidationError):
        validate_content({"blocks": [{**default_block("hero"), "onClick": "alert(1)"}]})
    with pytest.raises(ValidationError):
        validate_content({"blocks": [default_block("hero", style={"background": "red;}</style>"})]})
    clean = validate_content({"blocks": [{"type": "heading", "props": {"text": "<b>hi</b>"}}]})
    assert clean["blocks"][0]["props"]["text"] == "<b>hi</b>"  # stored as plain text, rendered escaped
    assert clean["blocks"][0]["style"]["paddingTop"] == 32  # defaults filled in


def test_components_registry_endpoint(api):
    data = api.get("/api/builder/components/").data
    types = {c["type"] for c in data["components"]}
    assert {"navbar", "hero", "heading", "paragraph", "image", "button", "features", "products", "stats",
            "testimonials", "pricing", "faq", "contact", "footer", "spacer", "divider"} <= types
    assert {p["name"] for p in data["presets"]} >= {"Modern Dark", "Minimal Light", "Tech Blue", "Indigo SaaS",
                                                     "Retail Fresh", "Summer", "Winter"}


def test_page_crud_save_and_versions(api, project):
    res = api.post("/api/pages/", {"project": project.pk, "title": "About", "slug": "about"}, format="json")
    assert res.status_code == 201
    page_id = res.data["id"]
    blocks = [default_block("heading", props={"text": "About us"}), default_block("paragraph")]
    saved = api.patch(f"/api/pages/{page_id}/", {"content": {"blocks": blocks}}, format="json")
    assert saved.status_code == 200 and len(saved.data["content"]["blocks"]) == 2
    blocks[0]["props"]["text"] = "Changed"
    blocks[1]["style"]["fontScale"] = 120
    api.patch(f"/api/pages/{page_id}/", {"content": {"blocks": blocks}}, format="json")
    loaded = api.get(f"/api/pages/{page_id}/").data
    assert loaded["content"]["blocks"][0]["props"]["text"] == "Changed"
    assert loaded["content"]["blocks"][1]["style"]["fontScale"] == 120
    versions = api.get(f"/api/pages/{page_id}/versions/").data
    assert len(versions) == 3  # created + 2 saves
    first_save = versions[1]
    restored = api.post(f"/api/pages/{page_id}/restore/", {"version": first_save["id"]}, format="json")
    assert restored.data["content"]["blocks"][0]["props"]["text"] == "About us"
    dup = api.post("/api/pages/", {"project": project.pk, "title": "X", "slug": "about"}, format="json")
    assert dup.status_code == 400 and "slug" in dup.data["errors"]
    bad = api.patch(f"/api/pages/{page_id}/", {"content": {"blocks": [{"type": "iframe"}]}}, format="json")
    assert bad.status_code == 400


def test_theme_save(api, project):
    res = api.put(f"/api/projects/{project.pk}/theme/", {"preset": "summer", "tokens": {"primary": "#123456", "radius": 4}}, format="json")
    assert res.status_code == 200 and res.data["tokens"]["primary"] == "#123456"
    assert api.get(f"/api/projects/{project.pk}/theme/").data["preset"] == "summer"
    bad = api.put(f"/api/projects/{project.pk}/theme/", {"preset": "summer", "tokens": {"primary": "blue"}}, format="json")
    assert bad.status_code == 400


def test_preview_publish_unpublish(api, project):
    preview = api.get(f"/api/projects/{project.pk}/preview/").data
    assert preview["mode"] == "preview" and len(preview["pages"]) == 3
    res = api.post(f"/api/projects/{project.pk}/publish/", {"note": "First launch"}, format="json")
    assert res.status_code == 200 and res.data["is_live"] and res.data["version"] == 1
    slug = res.data["slug"]
    public = APIClient().get(f"/api/public/sites/{slug}/")
    assert public.status_code == 200 and public.data["mode"] == "published"
    # Draft edits after publish do not leak into the live site until republished.
    home = project.pages.get(is_home=True)
    api.patch(f"/api/pages/{home.pk}/", {"content": {"blocks": [default_block("heading", props={"text": "Draft"})]}}, format="json")
    live_home = next(p for p in APIClient().get(f"/api/public/sites/{slug}/").data["pages"] if p["is_home"])
    assert live_home["content"]["blocks"][0]["type"] == "navbar"
    project.refresh_from_db()
    assert project.status == "published"
    assert api.delete(f"/api/projects/{project.pk}/publish/").data["is_live"] is False
    assert APIClient().get(f"/api/public/sites/{slug}/").status_code == 404
    history = api.get(f"/api/projects/{project.pk}/publications/").data["versions"]
    assert [v["action"] for v in history] == ["unpublish", "publish"]


def _png():
    buf = io.BytesIO()
    Image.new("RGB", (4, 4), "red").save(buf, "PNG")
    return SimpleUploadedFile("pic.png", buf.getvalue(), content_type="image/png")


def test_asset_upload_validation(api, project, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    ok = api.post("/api/assets/", {"project": project.pk, "file": _png()}, format="multipart")
    assert ok.status_code == 201, ok.data
    assert ok.data["url"].startswith("/media/assets/") and ok.data["width"] == 4
    fake = SimpleUploadedFile("evil.png", b"<script>alert(1)</script>", content_type="image/png")
    assert api.post("/api/assets/", {"project": project.pk, "file": fake}, format="multipart").status_code == 400
    svg = SimpleUploadedFile("x.svg", b"<svg onload=alert(1)>", content_type="image/svg+xml")
    assert api.post("/api/assets/", {"project": project.pk, "file": svg}, format="multipart").status_code == 400
