from datetime import UTC, datetime, timedelta

import jwt

from app.auth.security import DEV_ACCESS_SECRET
from app.core.config import get_settings
from app.main import app


def register_user(client, username="user1", email="user1@example.org", password="Password123"):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "displayName": "User One",
        },
    )
    assert response.status_code == 200
    return response.json()


def login_user(client, username_or_email="user1", password="Password123"):
    response = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": username_or_email, "password": password},
    )
    return response


def test_auth_providers_metadata(client):
    response = client.get("/api/v1/meta/auth-providers")
    assert response.status_code == 200
    payload = response.json()
    assert {provider["id"] for provider in payload["providers"]} == {"local", "uva-netbadge"}


def test_register_login_me_refresh_logout_flow(client):
    register_user(client)

    login_response = login_user(client)
    assert login_response.status_code == 200
    tokens = login_response.json()

    me_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['accessToken']}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "user1@example.org"

    refresh_response = client.post("/api/v1/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    assert refresh_response.status_code == 200
    refreshed_tokens = refresh_response.json()
    assert refreshed_tokens["refreshToken"] != tokens["refreshToken"]

    logout_response = client.post("/api/v1/auth/logout", json={"refreshToken": refreshed_tokens["refreshToken"]})
    assert logout_response.status_code == 200
    assert logout_response.json()["success"] is True

    refresh_after_logout = client.post("/api/v1/auth/refresh", json={"refreshToken": refreshed_tokens["refreshToken"]})
    assert refresh_after_logout.status_code == 401


def test_login_invalid_credentials(client):
    register_user(client, username="user2", email="user2@example.org")

    response = login_user(client, username_or_email="user2", password="wrong-password")
    assert response.status_code == 401
    payload = response.json()
    assert payload["error"]["code"] == "INVALID_CREDENTIALS"


def test_register_duplicate_email_case_insensitive_conflict(client):
    register_user(client, username="dup1", email="dup@example.org")
    conflict = client.post(
        "/api/v1/auth/register",
        json={
            "username": "dup2",
            "email": "Dup@Example.org",
            "password": "Password123",
            "displayName": "Dup Two",
        },
    )
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "EMAIL_ALREADY_EXISTS"


def test_register_validation_failure_short_password(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "shortpass",
            "email": "short@example.org",
            "password": "short",
            "displayName": "Short Password",
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_login_validation_failure_missing_password(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "user@example.org"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_auth_me_requires_bearer_token(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    payload = response.json()
    assert payload["error"]["code"] == "AUTH_REQUIRED"


def test_auth_me_invalid_token_returns_401(client):
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-valid-token"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "TOKEN_INVALID"


def test_auth_me_expired_token_returns_401(client):
    register_user(client, username="expired1", email="expired1@example.org")
    auth_store = app.state.auth_store
    user = auth_store.authenticate_local_user("expired1", "Password123")
    assert user is not None

    expired_token = jwt.encode(
        {
            "sub": user.id,
            "roles": [],
            "type": "access",
            "iat": datetime.now(UTC) - timedelta(minutes=10),
            "exp": datetime.now(UTC) - timedelta(minutes=5),
        },
        DEV_ACCESS_SECRET,
        algorithm="HS256",
    )
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "TOKEN_EXPIRED"


def test_user_management_check_403_and_200(client):
    register_user(client, username="user3", email="user3@example.org")
    login_response = login_user(client, username_or_email="user3")
    tokens = login_response.json()

    forbidden = client.get(
        "/api/v1/auth/user-management-check",
        headers={"Authorization": f"Bearer {tokens['accessToken']}"},
    )
    assert forbidden.status_code == 403
    assert forbidden.json()["error"]["code"] == "INSUFFICIENT_ROLE"

    auth_store = app.state.auth_store
    user = auth_store.authenticate_local_user("user3", "Password123")
    assert user is not None
    user.roles = ["superuser"]

    elevated_login = login_user(client, username_or_email="user3")
    elevated_token = elevated_login.json()["accessToken"]
    allowed = client.get(
        "/api/v1/auth/user-management-check",
        headers={"Authorization": f"Bearer {elevated_token}"},
    )
    assert allowed.status_code == 200
    assert allowed.json()["ok"] is True


def test_refresh_rotation_invalidates_previous_refresh_token(client):
    register_user(client, username="rotate1", email="rotate1@example.org")
    login_response = login_user(client, username_or_email="rotate1")
    tokens = login_response.json()

    rotated = client.post("/api/v1/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    assert rotated.status_code == 200

    replay = client.post("/api/v1/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    assert replay.status_code == 401
    assert replay.json()["error"]["code"] == "TOKEN_INVALID"


def test_external_provider_start_unknown_or_disabled_returns_404(client):
    response = client.get("/api/v1/auth/unknown-provider/start")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "PROVIDER_DISABLED"


def test_external_provider_start_local_returns_not_redirect(client):
    response = client.get("/api/v1/auth/local/start")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "PROVIDER_NOT_REDIRECT"


def test_external_provider_netbadge_scaffold_not_implemented_start_and_callback(client):
    start = client.get("/api/v1/auth/uva-netbadge/start")
    assert start.status_code == 501
    start_payload = start.json()
    assert start_payload["error"]["code"] == "PROVIDER_NOT_IMPLEMENTED"

    callback = client.get("/api/v1/auth/uva-netbadge/callback?state=abc&code=123")
    assert callback.status_code == 501
    callback_payload = callback.json()
    assert callback_payload["error"]["code"] == "PROVIDER_NOT_IMPLEMENTED"


def test_external_provider_respects_enabled_config(client):
    app.dependency_overrides[get_settings] = lambda: get_settings().model_copy(update={"auth_providers_enabled": "local"})
    try:
        response = client.get("/api/v1/auth/uva-netbadge/start")
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "PROVIDER_DISABLED"
    finally:
        app.dependency_overrides.pop(get_settings, None)
