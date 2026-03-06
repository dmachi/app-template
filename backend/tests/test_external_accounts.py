from urllib.parse import unquote
import re

import pytest

from app.auth.external_accounts import get_linked_external_access_token
from app.auth.external_oauth import ExternalOAuthTokenResult
from app.auth.security import encrypt_external_account_token
from app.core.errors import ApiError
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


def test_external_account_providers_are_disabled_by_default(client):
    tokens = register_and_login(client, username="ext_default", email="ext_default@example.org")

    response = client.get("/api/v1/users/me/external-account-providers", headers=auth_headers(tokens["accessToken"]))
    assert response.status_code == 200
    assert response.json()["items"] == []


def test_external_account_provider_config_is_exposed(client):
    tokens = register_and_login(client, username="ext_cfg", email="ext_cfg@example.org")

    from app.extensions.auth import external_oauth_providers as extension_module

    previous = dict(extension_module.ENABLED_EXTERNAL_OAUTH_PROVIDER_CONFIGS)
    extension_module.ENABLED_EXTERNAL_OAUTH_PROVIDER_CONFIGS = {
        "github": {
            "client_id": "github-client",
            "client_secret": "github-secret",
            "required_scopes": ["repo"],
            "optional_scopes": ["read:user"],
        }
    }
    try:
        response = client.get("/api/v1/users/me/external-account-providers", headers=auth_headers(tokens["accessToken"]))
    finally:
        extension_module.ENABLED_EXTERNAL_OAUTH_PROVIDER_CONFIGS = previous

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"] == [
        {
            "provider": "github",
            "displayName": "GitHub",
            "requiredScopes": ["repo"],
            "optionalScopes": ["read:user"],
        }
    ]


def test_linked_external_accounts_list_and_unlink(client):
    tokens = register_and_login(client, username="ext_link", email="ext_link@example.org")
    me = client.get("/api/v1/users/me", headers=auth_headers(tokens["accessToken"]))
    assert me.status_code == 200
    user_id = me.json()["id"]

    auth_store = app.state.auth_store
    auth_store.upsert_external_account_linkage(
        user_id=user_id,
        provider="github",
        external_subject="gh_123",
        scopes=["repo", "read:user"],
        metadata={"login": "octocat"},
    )

    listed = client.get("/api/v1/users/me/linked-accounts", headers=auth_headers(tokens["accessToken"]))
    assert listed.status_code == 200
    items = listed.json()["items"]
    assert len(items) == 1
    assert items[0]["provider"] == "github"
    assert items[0]["externalSubject"] == "gh_123"
    assert items[0]["scopes"] == ["read:user", "repo"]

    deleted = client.delete("/api/v1/users/me/linked-accounts/github", headers=auth_headers(tokens["accessToken"]))
    assert deleted.status_code == 200
    assert deleted.json()["unlinked"] is True

    listed_after = client.get("/api/v1/users/me/linked-accounts", headers=auth_headers(tokens["accessToken"]))
    assert listed_after.status_code == 200
    assert listed_after.json()["items"] == []


def test_external_subject_cannot_be_linked_to_two_users(client):
    user1 = register_and_login(client, username="ext_conflict_1", email="ext_conflict_1@example.org")
    user2 = register_and_login(client, username="ext_conflict_2", email="ext_conflict_2@example.org")

    me1 = client.get("/api/v1/users/me", headers=auth_headers(user1["accessToken"]))
    me2 = client.get("/api/v1/users/me", headers=auth_headers(user2["accessToken"]))
    assert me1.status_code == 200
    assert me2.status_code == 200

    user1_id = me1.json()["id"]
    user2_id = me2.json()["id"]

    auth_store = app.state.auth_store
    auth_store.upsert_external_account_linkage(
        user_id=user1_id,
        provider="github",
        external_subject="same_subject",
        scopes=["repo"],
    )

    with pytest.raises(ValueError) as conflict_error:
        auth_store.upsert_external_account_linkage(
            user_id=user2_id,
            provider="github",
            external_subject="same_subject",
            scopes=["repo"],
        )

    assert str(conflict_error.value) == "EXTERNAL_ACCOUNT_ALREADY_LINKED"


def test_external_account_helper_returns_decrypted_token_and_checks_scope(client):
    tokens = register_and_login(client, username="ext_helper", email="ext_helper@example.org")
    me = client.get("/api/v1/users/me", headers=auth_headers(tokens["accessToken"]))
    assert me.status_code == 200
    user_id = me.json()["id"]

    settings = app.state.settings
    auth_store = app.state.auth_store
    encrypted_token = encrypt_external_account_token("gh_token_value", settings)
    auth_store.upsert_external_account_linkage(
        user_id=user_id,
        provider="github",
        external_subject="helper_subject",
        scopes=["repo", "read:user"],
        access_token_encrypted=encrypted_token,
    )

    decrypted = get_linked_external_access_token(
        auth_store=auth_store,
        settings=settings,
        user_id=user_id,
        provider="github",
        required_scopes={"repo"},
    )
    assert decrypted == "gh_token_value"

    with pytest.raises(ApiError) as missing_scope:
        get_linked_external_access_token(
            auth_store=auth_store,
            settings=settings,
            user_id=user_id,
            provider="github",
            required_scopes={"admin:org"},
        )
    assert missing_scope.value.code == "INSUFFICIENT_EXTERNAL_SCOPE"


def test_external_account_link_start_and_complete_flow(client, monkeypatch):
    tokens = register_and_login(client, username="ext_flow", email="ext_flow@example.org")

    from app.extensions.auth import external_oauth_providers as extension_module

    previous = dict(extension_module.ENABLED_EXTERNAL_OAUTH_PROVIDER_CONFIGS)
    extension_module.ENABLED_EXTERNAL_OAUTH_PROVIDER_CONFIGS = {
        "github": {
            "client_id": "github-client",
            "client_secret": "github-secret",
            "required_scopes": ["repo"],
            "optional_scopes": ["read:user"],
            "redirect_uri": "http://localhost:5173/settings/linked-accounts/callback",
        }
    }
    try:
        start = client.post(
            "/api/v1/users/me/linked-accounts/github/start",
            headers=auth_headers(tokens["accessToken"]),
            json={"scopes": ["read:user"]},
        )
        assert start.status_code == 200
        start_payload = start.json()
        assert start_payload["provider"] == "github"
        assert set(start_payload["scopes"]) == {"repo", "read:user"}
        assert "authorizationUrl" in start_payload
        assert start_payload["state"]

        def mock_exchange(*, provider_definition, provider_config, code, redirect_uri, requested_scopes):
            assert provider_definition.name == "github"
            assert provider_config.client_id == "github-client"
            assert code == "provider-code"
            assert set(requested_scopes) == {"repo", "read:user"}
            return ExternalOAuthTokenResult(
                access_token="ext_access",
                refresh_token="ext_refresh",
                scopes=("read:user", "repo"),
                expires_in_seconds=3600,
                raw_payload={"access_token": "ext_access"},
            )

        def mock_userinfo(*, provider_definition, access_token):
            assert provider_definition.name == "github"
            assert access_token == "ext_access"
            return "github-subject-123", {"login": "octocat"}

        monkeypatch.setattr("app.api.routes.users.exchange_external_oauth_code", mock_exchange)
        monkeypatch.setattr("app.api.routes.users.fetch_external_oauth_subject_and_metadata", mock_userinfo)

        completed = client.post(
            "/api/v1/users/me/linked-accounts/github/complete",
            headers=auth_headers(tokens["accessToken"]),
            json={"code": "provider-code", "state": start_payload["state"]},
        )
        assert completed.status_code == 200
        complete_payload = completed.json()
        assert complete_payload["linked"] is True
        assert complete_payload["provider"] == "github"
        assert complete_payload["externalSubject"] == "github-subject-123"

        listed = client.get("/api/v1/users/me/linked-accounts", headers=auth_headers(tokens["accessToken"]))
        assert listed.status_code == 200
        items = listed.json()["items"]
        assert len(items) == 1
        assert items[0]["provider"] == "github"
        assert items[0]["externalSubject"] == "github-subject-123"
    finally:
        extension_module.ENABLED_EXTERNAL_OAUTH_PROVIDER_CONFIGS = previous
