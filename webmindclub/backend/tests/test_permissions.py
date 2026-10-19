import pytest

from workspaces.models import WorkspaceMembership

pytestmark = pytest.mark.django_db


def test_outsider_cannot_access_foreign_workspace_or_project(make_user, client_for, workspace, project):
    outsider = make_user(email="outsider@example.com", name="Out")
    c = client_for(outsider)
    assert c.get(f"/api/workspaces/{workspace.pk}/").status_code == 404
    assert c.get(f"/api/projects/{project.pk}/").status_code == 404
    assert c.get(f"/api/pages/?project={project.pk}").data == []
    assert c.get(f"/api/projects/{project.pk}/theme/").status_code == 404
    assert c.patch(f"/api/projects/{project.pk}/", {"name": "pwn"}, format="json").status_code == 404
    page = project.pages.first()
    assert c.patch(f"/api/pages/{page.pk}/", {"title": "pwn"}, format="json").status_code == 404
    res = c.post("/api/projects/", {"workspace": workspace.pk, "name": "Intrude"}, format="json")
    assert res.status_code == 400 and "workspace" in res.data["errors"]
    res = c.post("/api/tasks/", {"project": project.pk, "title": "x"}, format="json")
    assert res.status_code == 400
    assert c.get(f"/api/activity/?workspace={workspace.pk}").data["results"] == []


def test_member_sees_only_assigned_projects(make_user, client_for, api, workspace, project):
    dev = make_user(email="dev@example.com", with_workspace=False)
    WorkspaceMembership.objects.create(workspace=workspace, user=dev, role="developer")
    c = client_for(dev)
    assert c.get("/api/projects/").data["results"] == []
    assert c.get(f"/api/projects/{project.pk}/").status_code == 404
    api.post(f"/api/projects/{project.pk}/members/", {"user_id": dev.pk, "role": "editor"}, format="json")
    assert [p["id"] for p in c.get("/api/projects/").data["results"]] == [project.pk]
    assert c.patch(f"/api/projects/{project.pk}/", {"description": "ok"}, format="json").status_code == 200
    # Editors cannot delete or archive (manage) the project.
    assert c.delete(f"/api/projects/{project.pk}/").status_code == 403
    assert c.post(f"/api/projects/{project.pk}/archive/").status_code == 403


def test_viewer_is_read_only(make_user, client_for, api, workspace, project):
    viewer = make_user(email="viewer@example.com", with_workspace=False)
    WorkspaceMembership.objects.create(workspace=workspace, user=viewer, role="viewer")
    api.post(f"/api/projects/{project.pk}/members/", {"user_id": viewer.pk, "role": "viewer"}, format="json")
    c = client_for(viewer)
    assert c.get(f"/api/projects/{project.pk}/").data["permissions"] == {"edit": False, "manage": False}
    assert c.patch(f"/api/projects/{project.pk}/", {"name": "x"}, format="json").status_code == 403
    page = project.pages.first()
    assert c.patch(f"/api/pages/{page.pk}/", {"title": "x"}, format="json").status_code == 403
    assert c.post(f"/api/projects/{project.pk}/publish/").status_code == 403
    assert c.post("/api/projects/", {"workspace": workspace.pk, "name": "V"}, format="json").status_code == 400


def test_workspace_visibility_shares_read_access(make_user, client_for, api, workspace, project):
    designer = make_user(email="designer@example.com", with_workspace=False)
    WorkspaceMembership.objects.create(workspace=workspace, user=designer, role="designer")
    api.patch(f"/api/projects/{project.pk}/", {"visibility": "workspace"}, format="json")
    c = client_for(designer)
    assert c.get(f"/api/projects/{project.pk}/").status_code == 200
    assert c.patch(f"/api/projects/{project.pk}/", {"name": "x"}, format="json").status_code == 403


def test_invitation_workflow(make_user, client_for, api, workspace, project):
    res = api.post("/api/invitations/", {"workspace": workspace.pk, "email": "New@Example.com", "role": "designer",
                                         "projects": [project.pk]}, format="json")
    assert res.status_code == 201 and res.data["email_delivery_configured"] is False
    token = res.data["invite_url"].rsplit("/", 1)[1]
    wrong = make_user(email="wrong@example.com")
    assert client_for(wrong).post("/api/invitations/accept/", {"token": token}, format="json").status_code == 403
    invitee = make_user(email="new@example.com")
    ok = client_for(invitee).post("/api/invitations/accept/", {"token": token}, format="json")
    assert ok.status_code == 200 and ok.data["role"] == "designer"
    assert [p["id"] for p in client_for(invitee).get(f"/api/projects/?workspace={workspace.pk}").data["results"]] == [project.pk]
    owner_invite = api.post("/api/invitations/", {"workspace": workspace.pk, "email": "o@example.com", "role": "owner"}, format="json")
    assert owner_invite.status_code == 400


def test_member_role_management(make_user, client_for, api, workspace, owner):
    dev = make_user(email="dev2@example.com", with_workspace=False)
    m = WorkspaceMembership.objects.create(workspace=workspace, user=dev, role="developer")
    owner_m = WorkspaceMembership.objects.get(workspace=workspace, user=owner)
    assert client_for(dev).patch(f"/api/workspace-members/{m.pk}/", {"role": "admin"}, format="json").status_code == 403
    assert api.patch(f"/api/workspace-members/{m.pk}/", {"role": "admin"}, format="json").data["role"] == "admin"
    assert api.patch(f"/api/workspace-members/{owner_m.pk}/", {"role": "viewer"}, format="json").status_code == 403
    assert api.patch(f"/api/workspace-members/{m.pk}/", {"role": "owner"}, format="json").status_code == 400
    assert api.delete(f"/api/workspace-members/{m.pk}/").status_code == 204
