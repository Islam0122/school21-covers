import os

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

os.environ.setdefault("DJANGO_TESTING", "1")


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()  # resets auth throttling between tests


@pytest.fixture
def make_user(db):
    from accounts.models import User
    from workspaces.models import Workspace, WorkspaceMembership

    def _make(email="owner@example.com", password="Sup3r-secret-pass", with_workspace=True, name="Test User"):
        user = User.objects.create_user(email=email, password=password, full_name=name)
        if with_workspace:
            ws = Workspace.objects.create(name=f"{name} WS", owner=user)
            WorkspaceMembership.objects.create(workspace=ws, user=user, role="owner")
        return user

    return _make


@pytest.fixture
def client_for():
    def _client(user):
        c = APIClient()
        c.force_authenticate(user)
        return c

    return _client


@pytest.fixture
def owner(make_user):
    return make_user()


@pytest.fixture
def workspace(owner):
    return owner.workspaces.first()


@pytest.fixture
def api(owner, client_for):
    return client_for(owner)


@pytest.fixture
def project(api, workspace):
    res = api.post("/api/projects/", {"workspace": workspace.pk, "name": "My Site", "project_type": "website",
                                      "template": "saas_dashboard"}, format="json")
    assert res.status_code == 201, res.data
    from projects.models import Project

    return Project.objects.get(pk=res.data["id"])
