import re

import pytest
from django.core import mail
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def csrf_client():
    c = APIClient(enforce_csrf_checks=True)
    c.get("/api/auth/csrf/")
    return c, c.cookies["csrftoken"].value


def test_register_login_logout_flow():
    c, token = csrf_client()
    res = c.post("/api/auth/register/", {"full_name": "Ada Lovelace", "email": "Ada@Example.com",
                                         "password": "Analytical-Engine-1843"}, format="json", HTTP_X_CSRFTOKEN=token)
    assert res.status_code == 201, res.data
    assert res.data["email"] == "ada@example.com"
    assert c.get("/api/auth/me/").status_code == 200
    ws = c.get("/api/workspaces/").data
    assert len(ws) == 1 and ws[0]["role"] == "owner"
    token = c.cookies["csrftoken"].value
    assert c.post("/api/auth/logout/", HTTP_X_CSRFTOKEN=token).status_code == 204
    assert c.get("/api/auth/me/").status_code == 403
    c, token = csrf_client()
    bad = c.post("/api/auth/login/", {"email": "ada@example.com", "password": "wrong"}, format="json", HTTP_X_CSRFTOKEN=token)
    assert bad.status_code == 400 and bad.data["detail"] == "Invalid email or password."
    ok = c.post("/api/auth/login/", {"email": "ada@example.com", "password": "Analytical-Engine-1843"}, format="json",
                HTTP_X_CSRFTOKEN=token)
    assert ok.status_code == 200


def test_csrf_is_enforced_for_session_requests(make_user):
    make_user(email="x@example.com")
    c = APIClient(enforce_csrf_checks=True)
    res = c.post("/api/auth/login/", {"email": "x@example.com", "password": "Sup3r-secret-pass"}, format="json")
    assert res.status_code == 403


def test_register_validation_errors(make_user):
    make_user(email="taken@example.com")
    c = APIClient()
    res = c.post("/api/auth/register/", {"full_name": "X", "email": "taken@example.com", "password": "123"}, format="json")
    assert res.status_code == 400
    assert "email" in res.data["errors"] and "password" in res.data["errors"]
    res = c.post("/api/auth/register/", {"full_name": "X", "email": "new@example.com", "password": "password123"}, format="json")
    assert res.status_code == 400 and "password" in res.data["errors"]


def test_password_reset_workflow(make_user):
    make_user(email="reset@example.com")
    c = APIClient()
    res = c.post("/api/auth/password/reset/", {"email": "reset@example.com"}, format="json")
    assert res.status_code == 200 and res.data["email_delivery_configured"] is False
    unknown = c.post("/api/auth/password/reset/", {"email": "nobody@example.com"}, format="json")
    assert unknown.data["detail"] == res.data["detail"]  # no account enumeration
    assert len(mail.outbox) == 1
    uid, token = re.search(r"uid=([\w-]+)&token=([\w-]+)", mail.outbox[0].body).groups()
    bad = c.post("/api/auth/password/reset/confirm/", {"uid": uid, "token": "bad-token", "new_password": "N3w-strong-pass!"}, format="json")
    assert bad.status_code == 400
    ok = c.post("/api/auth/password/reset/confirm/", {"uid": uid, "token": token, "new_password": "N3w-strong-pass!"}, format="json")
    assert ok.status_code == 204
    login = c.post("/api/auth/login/", {"email": "reset@example.com", "password": "N3w-strong-pass!"}, format="json")
    assert login.status_code == 200


def test_profile_update_and_password_change(api, owner):
    res = api.patch("/api/auth/me/", {"full_name": "Renamed", "appearance": "light"}, format="json")
    assert res.status_code == 200 and res.data["full_name"] == "Renamed"
    bad = api.post("/api/auth/password/change/", {"current_password": "nope", "new_password": "An0ther-pass!"}, format="json")
    assert bad.status_code == 400 and "current_password" in bad.data["errors"]
    ok = api.post("/api/auth/password/change/", {"current_password": "Sup3r-secret-pass", "new_password": "An0ther-pass!"}, format="json")
    assert ok.status_code == 204
    owner.refresh_from_db()
    assert owner.check_password("An0ther-pass!")


def test_demo_users_cannot_log_in(db):
    from accounts.models import User

    u = User.objects.create_user(email="demo@demo.local", password="whatever-Pass1", is_demo=True)
    res = APIClient().post("/api/auth/login/", {"email": u.email, "password": "whatever-Pass1"}, format="json")
    assert res.status_code == 400
