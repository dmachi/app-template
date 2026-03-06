from urllib.parse import unquote
import re

from app.main import app


def register_and_login(client, username: str, email: str, password: str = "Password123") -> dict:
    register = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "displayName": username.title(),
        },
    )
    assert register.status_code == 200

    mail_sender = app.state.mail_sender
    assert hasattr(mail_sender, "outbox")
    assert mail_sender.outbox
    body = mail_sender.outbox[-1].text_body
    match = re.search(r"token=([^\s]+)", body)
    assert match is not None

    verify = client.get("/api/v1/auth/verify-email", params={"token": unquote(match.group(1))})
    assert verify.status_code == 200

    login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": username, "password": password},
    )
    assert login.status_code == 200
    return login.json()


def auth_headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


def test_access_tokens_create_list_revoke(client):
    tokens = register_and_login(client, username="pat_user", email="pat_user@example.org")

    scopes = client.get("/api/v1/users/me/access-token-scopes", headers=auth_headers(tokens["accessToken"]))
    assert scopes.status_code == 200
    scope_items = scopes.json()["items"]
    assert any(item["name"] == "openid" for item in scope_items)

    created = client.post(
        "/api/v1/users/me/access-tokens",
        headers=auth_headers(tokens["accessToken"]),
        json={
            "name": "CLI Token",
            "scopes": ["openid", "profile"],
        },
    )
    assert created.status_code == 200
    payload = created.json()
    assert payload["name"] == "CLI Token"
    assert payload["token"].startswith("pat_")
    token_id = payload["id"]

    listed = client.get(
        "/api/v1/users/me/access-tokens",
        headers=auth_headers(tokens["accessToken"]),
    )
    assert listed.status_code == 200
    items = listed.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == token_id
    assert "token" not in items[0]

    revoked = client.delete(
        f"/api/v1/users/me/access-tokens/{token_id}",
        headers=auth_headers(tokens["accessToken"]),
    )
    assert revoked.status_code == 200
    assert revoked.json()["revoked"] is True

    listed_after = client.get(
        "/api/v1/users/me/access-tokens",
        headers=auth_headers(tokens["accessToken"]),
    )
    assert listed_after.status_code == 200
    assert listed_after.json()["items"] == []


def test_access_tokens_can_authenticate_bearer_requests(client):
    tokens = register_and_login(client, username="pat_auth_user", email="pat_auth_user@example.org")

    created = client.post(
        "/api/v1/users/me/access-tokens",
        headers=auth_headers(tokens["accessToken"]),
        json={
            "name": "API Token",
            "scopes": ["openid", "profile"],
        },
    )
    assert created.status_code == 200
    pat_token = created.json()["token"]

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {pat_token}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == "pat_auth_user@example.org"


def test_access_tokens_reject_invalid_scope(client):
    tokens = register_and_login(client, username="pat_scope_user", email="pat_scope_user@example.org")

    created = client.post(
        "/api/v1/users/me/access-tokens",
        headers=auth_headers(tokens["accessToken"]),
        json={
            "name": "Invalid Scope PAT",
            "scopes": ["scope:missing"],
        },
    )
    assert created.status_code == 400
    assert created.json()["error"]["code"] == "INVALID_SCOPE"


def test_access_tokens_reject_past_expiration(client):
    tokens = register_and_login(client, username="pat_exp_user", email="pat_exp_user@example.org")

    created = client.post(
        "/api/v1/users/me/access-tokens",
        headers=auth_headers(tokens["accessToken"]),
        json={
            "name": "Expired PAT",
            "scopes": ["openid"],
            "expiresAt": "2001-01-01T00:00:00Z",
        },
    )
    assert created.status_code == 400
    assert created.json()["error"]["code"] == "INVALID_EXPIRATION"


def test_access_tokens_revoked_token_cannot_authenticate(client):
    tokens = register_and_login(client, username="pat_revoke_user", email="pat_revoke_user@example.org")

    created = client.post(
        "/api/v1/users/me/access-tokens",
        headers=auth_headers(tokens["accessToken"]),
        json={
            "name": "Revoked PAT",
            "scopes": ["openid", "profile"],
        },
    )
    assert created.status_code == 200
    payload = created.json()
    token_id = payload["id"]
    pat_token = payload["token"]

    revoked = client.delete(
        f"/api/v1/users/me/access-tokens/{token_id}",
        headers=auth_headers(tokens["accessToken"]),
    )
    assert revoked.status_code == 200
    assert revoked.json()["revoked"] is True

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {pat_token}"},
    )
    assert me.status_code == 401
    assert me.json()["error"]["code"] == "TOKEN_INVALID"


def test_access_tokens_requires_profile_scope_for_scoped_tokens(client):
    tokens = register_and_login(client, username="pat_scope_guard", email="pat_scope_guard@example.org")

    created = client.post(
        "/api/v1/users/me/access-tokens",
        headers=auth_headers(tokens["accessToken"]),
        json={
            "name": "Openid Only",
            "scopes": ["openid"],
        },
    )
    assert created.status_code == 200
    pat_token = created.json()["token"]

    listed = client.get(
        "/api/v1/users/me/access-tokens",
        headers={"Authorization": f"Bearer {pat_token}"},
    )
    assert listed.status_code == 403
    assert listed.json()["error"]["code"] == "INSUFFICIENT_SCOPE"
