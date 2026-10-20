import pytest

pytestmark = pytest.mark.django_db


def test_create_project_applies_template_and_branding(api, workspace):
    res = api.post("/api/projects/", {
        "workspace": workspace.pk, "name": "Shop Front", "description": "Store", "project_type": "ecommerce",
        "template": "ecommerce", "branding": {"primary": "#FF0000", "secondary": "#00FF00", "font": "Poppins"},
    }, format="json")
    assert res.status_code == 201, res.data
    assert res.data["slug"] == "shop-front" and res.data["permissions"] == {"edit": True, "manage": True}
    pages = api.get(f"/api/pages/?project={res.data['id']}").data
    assert [p["slug"] for p in pages] == ["home", "products", "contact"]
    theme = api.get(f"/api/projects/{res.data['id']}/theme/").data
    assert theme["tokens"]["primary"] == "#FF0000" and theme["tokens"]["headingFont"] == "Poppins"


def test_project_validation(api, workspace, project):
    res = api.post("/api/projects/", {"workspace": workspace.pk, "name": "Other", "slug": "Bad Slug!"}, format="json")
    assert res.status_code == 400 and "slug" in res.data["errors"]
    res = api.post("/api/projects/", {"workspace": workspace.pk, "name": "Other", "slug": project.slug}, format="json")
    assert res.status_code == 400 and "slug" in res.data["errors"]
    res = api.post("/api/projects/", {"workspace": workspace.pk, "name": ""}, format="json")
    assert res.status_code == 400 and "name" in res.data["errors"]


def test_edit_duplicate_archive_restore_delete(api, project):
    res = api.patch(f"/api/projects/{project.pk}/", {"status": "in_progress", "description": "Updated"}, format="json")
    assert res.status_code == 200 and res.data["status"] == "in_progress"
    dup = api.post(f"/api/projects/{project.pk}/duplicate/")
    assert dup.status_code == 201 and dup.data["slug"] == f"{project.slug}-copy" and dup.data["counts"]["pages"] == 3
    arch = api.post(f"/api/projects/{project.pk}/archive/")
    assert arch.data["status"] == "archived"
    ids = [p["id"] for p in api.get("/api/projects/").data["results"]]
    assert project.pk not in ids
    assert project.pk in [p["id"] for p in api.get("/api/projects/?status=archived").data["results"]]
    assert api.post(f"/api/projects/{project.pk}/restore/").data["status"] == "in_progress"
    activity = api.get(f"/api/projects/{project.pk}/activity/").data
    assert any("archived" in a["message"] for a in activity)
    assert api.delete(f"/api/projects/{project.pk}/").status_code == 204


def test_search_filter_sort(api, workspace):
    for name, t in [("Alpha", "saas"), ("Beta", "website"), ("Gamma", "saas")]:
        api.post("/api/projects/", {"workspace": workspace.pk, "name": name, "project_type": t}, format="json")
    assert [p["name"] for p in api.get("/api/projects/?search=bet").data["results"]] == ["Beta"]
    assert {p["name"] for p in api.get("/api/projects/?project_type=saas").data["results"]} == {"Alpha", "Gamma"}
    assert [p["name"] for p in api.get("/api/projects/?ordering=-name").data["results"]] == ["Gamma", "Beta", "Alpha"]


def test_dashboard_stats_are_dynamic(api, workspace, project):
    stats = api.get(f"/api/workspaces/{workspace.pk}/stats/").data
    assert stats["total_projects"] == 1 and stats["team_members"] == 1 and stats["published_projects"] == 0
    assert stats["recent_projects"][0]["id"] == project.pk
