from base64 import urlsafe_b64encode
from hashlib import sha256
from urllib.parse import parse_qs, unquote, urlparse
import re

import jwt

from app.main import app


def _pkce_pair(verifier: str = "oauth-test-verifier-123456789") -> tuple[str, str]:
    challenge = urlsafe_b64encode(sha256(verifier.encode("utf-8")).digest()).decode("ascii").rstrip("=")
    return verifier, challenge


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


def auth_headers(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}"}


def test_oauth_metadata_and_jwks(client):
    metadata = client.get("/api/v1/.well-known/oauth-authorization-server")
    assert metadata.status_code == 200
    payload = metadata.json()
    assert payload["response_types_supported"] == ["code"]
    assert payload["grant_types_supported"] == ["authorization_code", "refresh_token"]
    assert payload["jwks_uri"].endswith("/api/v1/oauth/jwks")
    assert payload["introspection_endpoint"].endswith("/api/v1/oauth/introspect")
    assert payload["end_session_endpoint"].endswith("/api/v1/oauth/end-session")

    jwks = client.get("/api/v1/oauth/jwks")
    assert jwks.status_code == 200
    keys = jwks.json().get("keys", [])
    assert len(keys) == 1
    assert keys[0]["kty"] == "RSA"
    assert keys[0]["alg"] == "RS256"

    openid = client.get("/api/v1/.well-known/openid-configuration")
    assert openid.status_code == 200
    openid_payload = openid.json()
    assert openid_payload["userinfo_endpoint"].endswith("/api/v1/oauth/userinfo")
    assert "RS256" in openid_payload["id_token_signing_alg_values_supported"]
    assert openid_payload["introspection_endpoint"].endswith("/api/v1/oauth/introspect")
    assert openid_payload["end_session_endpoint"].endswith("/api/v1/oauth/end-session")


def test_oauth_authorization_code_pkce_flow_with_consent_and_revoke(client):
    user_tokens = register_and_login(client, username="oauth_user", email="oauth_user@example.org")
    admin_tokens = register_and_login(client, username="oauth_admin", email="oauth_admin@example.org")

    auth_store = app.state.auth_store
    admin_user = auth_store.authenticate_local_user("oauth_admin", "Password123")
    assert admin_user is not None
    admin_user.roles = ["Superuser"]

    elevated_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "oauth_admin", "password": "Password123"},
    )
    assert elevated_login.status_code == 200
    admin_access_token = elevated_login.json()["accessToken"]

    create_client = client.post(
        "/api/v1/admin/oauth/clients",
        headers=auth_headers(admin_access_token),
        json={
            "name": "OAuth Test App",
            "redirectUris": ["https://example.com/callback"],
            "allowedScopes": ["openid", "profile", "offline_access"],
            "trusted": False,
            "tokenEndpointAuthMethod": "none",
        },
    )
    assert create_client.status_code == 200
    client_payload = create_client.json()
    oauth_client_id = client_payload["clientId"]

    verifier, challenge = _pkce_pair()

    consent_required = client.get(
        "/api/v1/oauth/authorize",
        headers=auth_headers(user_tokens["accessToken"]),
        params={
            "response_type": "code",
            "client_id": oauth_client_id,
            "redirect_uri": "https://example.com/callback",
            "scope": "openid profile offline_access",
            "state": "xyz",
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        },
        follow_redirects=False,
    )
    assert consent_required.status_code == 302
    consent_location = consent_required.headers["location"]
    consent_parsed = urlparse(consent_location)
    assert consent_parsed.path == "/api/v1/oauth/consent"
    consent_query = parse_qs(consent_parsed.query)
    assert "return_to" in consent_query
    return_to = consent_query["return_to"][0]

    consent_submit = client.post(
        "/api/v1/oauth/consent",
        headers=auth_headers(user_tokens["accessToken"]),
        data={"return_to": return_to, "decision": "approve"},
        follow_redirects=False,
    )
    assert consent_submit.status_code == 302
    assert consent_submit.headers["location"] == return_to

    authorize = client.get(
        return_to,
        headers=auth_headers(user_tokens["accessToken"]),
        follow_redirects=False,
    )
    assert authorize.status_code == 302
    location = authorize.headers["location"]
    parsed = urlparse(location)
    query = parse_qs(parsed.query)
    assert parsed.scheme == "https"
    assert parsed.netloc == "example.com"
    assert query["state"] == ["xyz"]
    code = query["code"][0]

    token_response = client.post(
        "/api/v1/oauth/token",
        content=(
            f"grant_type=authorization_code&code={code}&client_id={oauth_client_id}&"
            "redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&"
            f"code_verifier={verifier}"
        ),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert token_response.status_code == 200
    token_payload = token_response.json()
    assert token_payload["token_type"] == "Bearer"
    assert token_payload["scope"] == "offline_access openid profile"
    assert "id_token" in token_payload
    assert "refresh_token" in token_payload

    access_token = token_payload["access_token"]
    header = jwt.get_unverified_header(access_token)
    assert header["alg"] == "RS256"
    unverified = jwt.decode(access_token, options={"verify_signature": False})
    assert unverified["azp"] == oauth_client_id
    assert unverified["token_use"] == "access"

    id_header = jwt.get_unverified_header(token_payload["id_token"])
    assert id_header["alg"] == "RS256"
    id_payload = jwt.decode(token_payload["id_token"], options={"verify_signature": False})
    assert id_payload["aud"] == oauth_client_id
    assert id_payload["email"] == "oauth_user@example.org"

    end_session = client.get(
        "/api/v1/oauth/end-session",
        params={
            "id_token_hint": token_payload["id_token"],
            "post_logout_redirect_uri": "https://example.com/callback",
            "state": "bye",
        },
        follow_redirects=False,
    )
    assert end_session.status_code == 302
    end_location = end_session.headers["location"]
    end_parsed = urlparse(end_location)
    end_query = parse_qs(end_parsed.query)
    assert end_parsed.scheme == "https"
    assert end_parsed.netloc == "example.com"
    assert end_query["state"] == ["bye"]

    end_session_no_redirect = client.get("/api/v1/oauth/end-session")
    assert end_session_no_redirect.status_code == 200
    assert end_session_no_redirect.json()["success"] is True

    userinfo = client.get(
        "/api/v1/oauth/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert userinfo.status_code == 200
    userinfo_payload = userinfo.json()
    assert userinfo_payload["preferred_username"] == "oauth_user"
    assert "email" not in userinfo_payload

    introspect_active = client.post(
        "/api/v1/oauth/introspect",
        content=f"token={access_token}&client_id={oauth_client_id}",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert introspect_active.status_code == 200
    introspect_active_payload = introspect_active.json()
    assert introspect_active_payload["active"] is True
    assert introspect_active_payload["client_id"] == oauth_client_id
    assert introspect_active_payload["sub"]

    refreshed = client.post(
        "/api/v1/oauth/token",
        content=f"grant_type=refresh_token&refresh_token={token_payload['refresh_token']}&client_id={oauth_client_id}",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert refreshed.status_code == 200
    refreshed_payload = refreshed.json()
    assert refreshed_payload["token_type"] == "Bearer"
    assert refreshed_payload["access_token"] != access_token
    assert refreshed_payload["refresh_token"] != token_payload["refresh_token"]

    revoke = client.post(
        "/api/v1/oauth/revoke",
        content=f"token={access_token}&client_id={oauth_client_id}",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert revoke.status_code == 200
    assert revoke.json()["success"] is True

    introspect_revoked = client.post(
        "/api/v1/oauth/introspect",
        content=f"token={access_token}&client_id={oauth_client_id}",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert introspect_revoked.status_code == 200
    assert introspect_revoked.json()["active"] is False


def test_oauth_trusted_client_skips_consent(client):
    user_tokens = register_and_login(client, username="oauth_user2", email="oauth_user2@example.org")
    admin_tokens = register_and_login(client, username="oauth_admin2", email="oauth_admin2@example.org")

    auth_store = app.state.auth_store
    admin_user = auth_store.authenticate_local_user("oauth_admin2", "Password123")
    assert admin_user is not None
    admin_user.roles = ["Superuser"]

    elevated_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "oauth_admin2", "password": "Password123"},
    )
    admin_access_token = elevated_login.json()["accessToken"]

    create_client = client.post(
        "/api/v1/admin/oauth/clients",
        headers=auth_headers(admin_access_token),
        json={
            "name": "Trusted OAuth App",
            "redirectUris": ["https://trusted.example.com/callback"],
            "allowedScopes": ["openid"],
            "trusted": True,
            "tokenEndpointAuthMethod": "none",
        },
    )
    assert create_client.status_code == 200
    oauth_client_id = create_client.json()["clientId"]

    _, challenge = _pkce_pair("oauth-trusted-verifier-123")
    authorize = client.get(
        "/api/v1/oauth/authorize",
        headers=auth_headers(user_tokens["accessToken"]),
        params={
            "response_type": "code",
            "client_id": oauth_client_id,
            "redirect_uri": "https://trusted.example.com/callback",
            "scope": "openid",
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        },
        follow_redirects=False,
    )
    assert authorize.status_code == 302
    assert "code=" in authorize.headers["location"]


def test_oauth_prompt_consent_forces_consent_even_for_trusted_client(client):
    user_tokens = register_and_login(client, username="oauth_user_prompt", email="oauth_user_prompt@example.org")
    register_and_login(client, username="oauth_admin_prompt", email="oauth_admin_prompt@example.org")

    auth_store = app.state.auth_store
    admin_user = auth_store.authenticate_local_user("oauth_admin_prompt", "Password123")
    assert admin_user is not None
    admin_user.roles = ["Superuser"]

    elevated_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "oauth_admin_prompt", "password": "Password123"},
    )
    admin_access_token = elevated_login.json()["accessToken"]

    create_client = client.post(
        "/api/v1/admin/oauth/clients",
        headers=auth_headers(admin_access_token),
        json={
            "name": "Trusted Prompt OAuth App",
            "redirectUris": ["https://trusted-prompt.example.com/callback"],
            "allowedScopes": ["openid", "profile"],
            "trusted": True,
            "tokenEndpointAuthMethod": "none",
        },
    )
    assert create_client.status_code == 200
    oauth_client_id = create_client.json()["clientId"]

    _, challenge = _pkce_pair("oauth-trusted-prompt-verifier")
    authorize = client.get(
        "/api/v1/oauth/authorize",
        headers=auth_headers(user_tokens["accessToken"]),
        params={
            "response_type": "code",
            "client_id": oauth_client_id,
            "redirect_uri": "https://trusted-prompt.example.com/callback",
            "scope": "openid profile",
            "prompt": "consent",
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        },
        follow_redirects=False,
    )
    assert authorize.status_code == 302
    consent_location = authorize.headers["location"]
    consent_parsed = urlparse(consent_location)
    assert consent_parsed.path == "/api/v1/oauth/consent"


def test_oauth_non_trusted_client_always_shows_consent(client):
    user_tokens = register_and_login(client, username="oauth_user_non_trusted", email="oauth_user_non_trusted@example.org")
    register_and_login(client, username="oauth_admin_non_trusted", email="oauth_admin_non_trusted@example.org")

    auth_store = app.state.auth_store
    admin_user = auth_store.authenticate_local_user("oauth_admin_non_trusted", "Password123")
    assert admin_user is not None
    admin_user.roles = ["Superuser"]

    elevated_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "oauth_admin_non_trusted", "password": "Password123"},
    )
    admin_access_token = elevated_login.json()["accessToken"]

    create_client = client.post(
        "/api/v1/admin/oauth/clients",
        headers=auth_headers(admin_access_token),
        json={
            "name": "Non Trusted Consent App",
            "redirectUris": ["https://non-trusted.example.com/callback"],
            "allowedScopes": ["openid", "profile"],
            "trusted": False,
            "tokenEndpointAuthMethod": "none",
        },
    )
    assert create_client.status_code == 200
    oauth_client_id = create_client.json()["clientId"]

    _, challenge = _pkce_pair("oauth-non-trusted-consent-verifier")
    authorize_first = client.get(
        "/api/v1/oauth/authorize",
        headers=auth_headers(user_tokens["accessToken"]),
        params={
            "response_type": "code",
            "client_id": oauth_client_id,
            "redirect_uri": "https://non-trusted.example.com/callback",
            "scope": "openid profile",
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        },
        follow_redirects=False,
    )
    assert authorize_first.status_code == 302
    consent_first = urlparse(authorize_first.headers["location"])
    assert consent_first.path == "/api/v1/oauth/consent"

    return_to = parse_qs(consent_first.query)["return_to"][0]
    consent_submit = client.post(
        "/api/v1/oauth/consent",
        headers=auth_headers(user_tokens["accessToken"]),
        data={"return_to": return_to, "decision": "approve"},
        follow_redirects=False,
    )
    assert consent_submit.status_code == 302

    authorize_second = client.get(
        return_to,
        headers=auth_headers(user_tokens["accessToken"]),
        follow_redirects=False,
    )
    assert authorize_second.status_code == 302
    callback_second = urlparse(authorize_second.headers["location"])
    assert callback_second.path == "/callback"

    authorize_third = client.get(
        "/api/v1/oauth/authorize",
        headers=auth_headers(user_tokens["accessToken"]),
        params={
            "response_type": "code",
            "client_id": oauth_client_id,
            "redirect_uri": "https://non-trusted.example.com/callback",
            "scope": "openid profile",
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        },
        follow_redirects=False,
    )
    assert authorize_third.status_code == 302
    consent_third = urlparse(authorize_third.headers["location"])
    assert consent_third.path == "/api/v1/oauth/consent"


def test_oauth_client_grant_type_restrictions(client):
    user_tokens = register_and_login(client, username="oauth_user3", email="oauth_user3@example.org")
    register_and_login(client, username="oauth_admin3", email="oauth_admin3@example.org")

    auth_store = app.state.auth_store
    admin_user = auth_store.authenticate_local_user("oauth_admin3", "Password123")
    assert admin_user is not None
    admin_user.roles = ["Superuser"]

    elevated_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "oauth_admin3", "password": "Password123"},
    )
    admin_access_token = elevated_login.json()["accessToken"]

    create_client = client.post(
        "/api/v1/admin/oauth/clients",
        headers=auth_headers(admin_access_token),
        json={
            "name": "AuthCode Only App",
            "redirectUris": ["https://authcode-only.example.com/callback"],
            "allowedScopes": ["openid", "profile", "offline_access"],
            "grantTypes": ["authorization_code"],
            "trusted": False,
            "tokenEndpointAuthMethod": "none",
        },
    )
    assert create_client.status_code == 200
    oauth_client_id = create_client.json()["clientId"]

    verifier, challenge = _pkce_pair("oauth-client3-verifier")
    authorize = client.get(
        "/api/v1/oauth/authorize",
        headers=auth_headers(user_tokens["accessToken"]),
        params={
            "response_type": "code",
            "client_id": oauth_client_id,
            "redirect_uri": "https://authcode-only.example.com/callback",
            "scope": "openid profile offline_access",
            "state": "abc",
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "consent": "approve",
        },
        follow_redirects=False,
    )
    assert authorize.status_code == 302
    parsed = urlparse(authorize.headers["location"])
    query = parse_qs(parsed.query)
    assert query["error"] == ["invalid_scope"]

    refresh_attempt = client.post(
        "/api/v1/oauth/token",
        content=f"grant_type=refresh_token&refresh_token=dummy-token&client_id={oauth_client_id}",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert refresh_attempt.status_code == 400
    assert refresh_attempt.json()["error"]["code"] == "UNAUTHORIZED_CLIENT"


def test_oauth_admin_client_rejects_unknown_scope(client):
    register_and_login(client, username="oauth_scope_admin", email="oauth_scope_admin@example.org")

    auth_store = app.state.auth_store
    admin_user = auth_store.authenticate_local_user("oauth_scope_admin", "Password123")
    assert admin_user is not None
    admin_user.roles = ["Superuser"]

    elevated_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "oauth_scope_admin", "password": "Password123"},
    )
    admin_access_token = elevated_login.json()["accessToken"]

    create_client = client.post(
        "/api/v1/admin/oauth/clients",
        headers=auth_headers(admin_access_token),
        json={
            "name": "Invalid Scope App",
            "redirectUris": ["https://invalid-scope.example.com/callback"],
            "allowedScopes": ["openid", "custom:missing"],
            "trusted": True,
            "tokenEndpointAuthMethod": "none",
        },
    )
    assert create_client.status_code == 400
    assert create_client.json()["error"]["code"] == "INVALID_SCOPE"


def test_oauth_userinfo_returns_claims_allowed_by_scope(client):
    user_tokens = register_and_login(client, username="oauth_scope_user", email="oauth_scope_user@example.org")
    register_and_login(client, username="oauth_scope_admin2", email="oauth_scope_admin2@example.org")

    auth_store = app.state.auth_store
    admin_user = auth_store.authenticate_local_user("oauth_scope_admin2", "Password123")
    assert admin_user is not None
    admin_user.roles = ["Superuser"]

    elevated_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "oauth_scope_admin2", "password": "Password123"},
    )
    admin_access_token = elevated_login.json()["accessToken"]

    create_client = client.post(
        "/api/v1/admin/oauth/clients",
        headers=auth_headers(admin_access_token),
        json={
            "name": "Scope Claims App",
            "redirectUris": ["https://scope-claims.example.com/callback"],
            "allowedScopes": ["openid", "profile", "email"],
            "trusted": True,
            "tokenEndpointAuthMethod": "none",
        },
    )
    assert create_client.status_code == 200
    oauth_client_id = create_client.json()["clientId"]

    verifier, challenge = _pkce_pair("userinfo-scope-verifier")
    authorize = client.get(
        "/api/v1/oauth/authorize",
        headers=auth_headers(user_tokens["accessToken"]),
        params={
            "response_type": "code",
            "client_id": oauth_client_id,
            "redirect_uri": "https://scope-claims.example.com/callback",
            "scope": "openid",
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        },
        follow_redirects=False,
    )
    assert authorize.status_code == 302
    parsed = urlparse(authorize.headers["location"])
    code = parse_qs(parsed.query)["code"][0]

    token_response = client.post(
        "/api/v1/oauth/token",
        content=(
            f"grant_type=authorization_code&code={code}&client_id={oauth_client_id}&"
            "redirect_uri=https%3A%2F%2Fscope-claims.example.com%2Fcallback&"
            f"code_verifier={verifier}"
        ),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert token_response.status_code == 200
    access_token = token_response.json()["access_token"]

    userinfo = client.get(
        "/api/v1/oauth/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert userinfo.status_code == 200
    userinfo_payload = userinfo.json()
    assert set(userinfo_payload.keys()) == {"sub"}


def test_oauth_authorize_redirects_to_login_and_resumes_flow(client):
    register_and_login(client, username="oauth_browser_user", email="oauth_browser_user@example.org")
    register_and_login(client, username="oauth_browser_admin", email="oauth_browser_admin@example.org")

    auth_store = app.state.auth_store
    admin_user = auth_store.authenticate_local_user("oauth_browser_admin", "Password123")
    assert admin_user is not None
    admin_user.roles = ["Superuser"]

    elevated_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "oauth_browser_admin", "password": "Password123"},
    )
    assert elevated_login.status_code == 200
    admin_access_token = elevated_login.json()["accessToken"]

    create_client = client.post(
        "/api/v1/admin/oauth/clients",
        headers=auth_headers(admin_access_token),
        json={
            "name": "OAuth Browser App",
            "redirectUris": ["http://localhost:5174/callback.html"],
            "allowedScopes": ["openid", "profile", "email"],
            "trusted": True,
            "tokenEndpointAuthMethod": "none",
        },
    )
    assert create_client.status_code == 200
    oauth_client_id = create_client.json()["clientId"]

    _, challenge = _pkce_pair("oauth-browser-flow-verifier")
    authorize = client.get(
        "/api/v1/oauth/authorize",
        params={
            "response_type": "code",
            "client_id": oauth_client_id,
            "redirect_uri": "http://localhost:5174/callback.html",
            "scope": "openid profile email",
            "state": "browser-state",
            "consent": "approve",
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        },
        follow_redirects=False,
    )
    assert authorize.status_code == 302
    login_location = authorize.headers["location"]
    login_parsed = urlparse(login_location)
    assert login_parsed.netloc == "localhost:5173"
    assert login_parsed.path == "/login"
    login_query = parse_qs(login_parsed.query)
    assert "oauth_return_to" in login_query
    return_to = login_query["oauth_return_to"][0]

    user_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "oauth_browser_user", "password": "Password123"},
    )
    assert user_login.status_code == 200
    user_access_token = user_login.json()["accessToken"]

    establish_session = client.post(
        "/api/v1/oauth/session",
        headers=auth_headers(user_access_token),
        json={"returnTo": return_to},
    )
    assert establish_session.status_code == 200
    resume_url = establish_session.json()["redirectUrl"]
    assert resume_url.endswith(return_to)

    resumed_authorize = client.get(return_to, follow_redirects=False)
    assert resumed_authorize.status_code == 302
    callback_parsed = urlparse(resumed_authorize.headers["location"])
    callback_query = parse_qs(callback_parsed.query)
    assert callback_parsed.path == "/callback.html"
    assert callback_query["state"] == ["browser-state"]
    assert callback_query.get("code")


def test_oauth_login_rejects_invalid_return_to(client):
    invalid_get = client.get(
        "/api/v1/oauth/login",
        params={"return_to": "https://evil.example.com/redirect"},
    )
    assert invalid_get.status_code == 400
    assert invalid_get.json()["error"]["code"] == "INVALID_REQUEST"

    invalid_post = client.post(
        "/api/v1/oauth/login",
        data={
            "username": "irrelevant",
            "password": "irrelevant",
            "return_to": "https://evil.example.com/redirect",
        },
    )
    assert invalid_post.status_code == 400
    assert invalid_post.json()["error"]["code"] == "INVALID_REQUEST"


def test_oauth_session_rejects_invalid_return_to(client):
    user_tokens = register_and_login(client, username="oauth_session_user", email="oauth_session_user@example.org")

    invalid_session = client.post(
        "/api/v1/oauth/session",
        headers=auth_headers(user_tokens["accessToken"]),
        json={"returnTo": "https://evil.example.com/callback"},
    )
    assert invalid_session.status_code == 400
    assert invalid_session.json()["error"]["code"] == "INVALID_REQUEST"


def test_user_connected_apps_list_and_revoke(client):
    user_tokens = register_and_login(client, username="oauth_connected_user", email="oauth_connected_user@example.org")
    register_and_login(client, username="oauth_connected_admin", email="oauth_connected_admin@example.org")

    auth_store = app.state.auth_store
    admin_user = auth_store.authenticate_local_user("oauth_connected_admin", "Password123")
    assert admin_user is not None
    admin_user.roles = ["Superuser"]

    elevated_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "oauth_connected_admin", "password": "Password123"},
    )
    assert elevated_login.status_code == 200
    admin_access_token = elevated_login.json()["accessToken"]

    create_client = client.post(
        "/api/v1/admin/oauth/clients",
        headers=auth_headers(admin_access_token),
        json={
            "name": "Connected App",
            "redirectUris": ["https://connected.example.com/callback"],
            "allowedScopes": ["openid", "profile", "offline_access"],
            "trusted": False,
            "tokenEndpointAuthMethod": "none",
        },
    )
    assert create_client.status_code == 200
    oauth_client_id = create_client.json()["clientId"]

    verifier, challenge = _pkce_pair("oauth-connected-verifier")
    consent_required = client.get(
        "/api/v1/oauth/authorize",
        headers=auth_headers(user_tokens["accessToken"]),
        params={
            "response_type": "code",
            "client_id": oauth_client_id,
            "redirect_uri": "https://connected.example.com/callback",
            "scope": "openid profile offline_access",
            "state": "connected-state",
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        },
        follow_redirects=False,
    )
    assert consent_required.status_code == 302
    consent_parsed = urlparse(consent_required.headers["location"])
    consent_query = parse_qs(consent_parsed.query)
    return_to = consent_query["return_to"][0]

    consent_submit = client.post(
        "/api/v1/oauth/consent",
        headers=auth_headers(user_tokens["accessToken"]),
        data={"return_to": return_to, "decision": "approve"},
        follow_redirects=False,
    )
    assert consent_submit.status_code == 302

    authorize = client.get(return_to, headers=auth_headers(user_tokens["accessToken"]), follow_redirects=False)
    assert authorize.status_code == 302
    auth_query = parse_qs(urlparse(authorize.headers["location"]).query)
    code = auth_query["code"][0]

    token_response = client.post(
        "/api/v1/oauth/token",
        content=(
            f"grant_type=authorization_code&code={code}&client_id={oauth_client_id}&"
            "redirect_uri=https%3A%2F%2Fconnected.example.com%2Fcallback&"
            f"code_verifier={verifier}"
        ),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert token_response.status_code == 200
    access_token = token_response.json()["access_token"]

    connected_apps = client.get(
        "/api/v1/users/me/connected-apps",
        headers=auth_headers(user_tokens["accessToken"]),
    )
    assert connected_apps.status_code == 200
    items = connected_apps.json()["items"]
    assert len(items) == 1
    assert items[0]["clientId"] == oauth_client_id
    assert items[0]["name"] == "Connected App"

    revoke_connection = client.delete(
        f"/api/v1/users/me/connected-apps/{oauth_client_id}",
        headers=auth_headers(user_tokens["accessToken"]),
    )
    assert revoke_connection.status_code == 200
    assert revoke_connection.json()["revoked"] is True

    connected_apps_after_revoke = client.get(
        "/api/v1/users/me/connected-apps",
        headers=auth_headers(user_tokens["accessToken"]),
    )
    assert connected_apps_after_revoke.status_code == 200
    assert connected_apps_after_revoke.json()["items"] == []

    introspect_revoked = client.post(
        "/api/v1/oauth/introspect",
        content=f"token={access_token}&client_id={oauth_client_id}",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert introspect_revoked.status_code == 200
    assert introspect_revoked.json()["active"] is False
