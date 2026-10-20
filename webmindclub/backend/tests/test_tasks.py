import pytest

pytestmark = pytest.mark.django_db


def test_task_crud_and_assignment(api, project, owner, make_user):
    res = api.post("/api/tasks/", {"project": project.pk, "title": "Design hero", "priority": "high",
                                   "due_date": "2026-12-01", "assignee_id": owner.pk}, format="json")
    assert res.status_code == 201, res.data
    tid = res.data["id"]
    assert res.data["assignee"]["id"] == owner.pk and res.data["status"] == "todo"
    moved = api.patch(f"/api/tasks/{tid}/", {"status": "review"}, format="json")
    assert moved.data["status"] == "review"
    stranger = make_user(email="stranger@example.com")
    bad = api.patch(f"/api/tasks/{tid}/", {"assignee_id": stranger.pk}, format="json")
    assert bad.status_code == 400 and "assignee_id" in bad.data["errors"]
    assert api.post("/api/tasks/", {"project": project.pk, "title": "  "}, format="json").status_code == 400
    assert [t["id"] for t in api.get(f"/api/tasks/?project={project.pk}&status=review").data] == [tid]
    assert api.delete(f"/api/tasks/{tid}/").status_code == 204
    messages = [a["message"] for a in api.get(f"/api/projects/{project.pk}/activity/").data]
    assert any("moved" in m for m in messages) and any("deleted task" in m for m in messages)
