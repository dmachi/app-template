from __future__ import annotations

from datetime import UTC, datetime, timedelta
from html import escape
from hashlib import sha256
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import jwt
from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user, require_superuser
from app.auth.oauth_security import (
    build_jwks,
    decode_oidc_id_token,
    decode_oauth_access_token,
    hash_oauth_secret,
    issue_oidc_id_token,
    issue_oauth_access_token,
    normalize_scope,
    verify_pkce_s256,
)
from app.auth.oauth_scopes import (
    get_oauth_token_scopes,
    get_supported_oauth_scopes,
    get_userinfo_claims_for_scopes,
    resolve_default_oauth_scopes,
    validate_oauth_scopes,
)
from app.auth.security import generate_access_token, generate_refresh_token
from app.auth.store import OAuthClientRecord, UserRecord
from app.core.config import Settings, get_settings
from app.core.errors import ApiError

router = APIRouter(prefix="/oauth", tags=["oauth-provider"])
well_known_router = APIRouter(tags=["oauth-provider"])
admin_router = APIRouter(prefix="/admin/oauth", tags=["oauth-provider-admin"])


class OAuthClientCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    redirectUris: list[str] = Field(min_length=1)
    allowedScopes: list[str] = Field(default_factory=list)
    grantTypes: list[str] = Field(default_factory=lambda: ["authorization_code", "refresh_token"])
    trusted: bool = False
    tokenEndpointAuthMethod: str = "none"


class OAuthClientPatchRequest(BaseModel):
    name: str | None = None
    redirectUris: list[str] | None = None
    allowedScopes: list[str] | None = None
    grantTypes: list[str] | None = None
    trusted: bool | None = None
    tokenEndpointAuthMethod: str | None = None
    rotateSecret: bool = False


class OAuthSessionRequest(BaseModel):
    returnTo: str = Field(min_length=1)


class OAuthConsentDecisionRequest(BaseModel):
    returnTo: str = Field(min_length=1)
    decision: str = Field(pattern="^(approve|deny)$")


def _serialize_client(client: OAuthClientRecord) -> dict[str, Any]:
    return {
        "id": client.id,
        "clientId": client.client_id,
        "name": client.name,
        "redirectUris": client.redirect_uris,
        "allowedScopes": client.allowed_scopes,
        "grantTypes": client.grant_types,
        "trusted": client.trusted,
        "tokenEndpointAuthMethod": client.token_endpoint_auth_method,
        "createdAt": client.created_at.isoformat(),
        "updatedAt": client.updated_at.isoformat(),
    }


def _add_query_params(url: str, params: dict[str, str]) -> str:
    parsed = urlparse(url)
    existing = dict(parse_qs(parsed.query, keep_blank_values=True))
    for key, value in params.items():
        existing[key] = [value]
    query = urlencode({k: v[-1] for k, v in existing.items()}, doseq=False)
    return urlunparse(parsed._replace(query=query))


def _oauth_redirect_error(redirect_uri: str, error: str, description: str, state: str | None) -> RedirectResponse:
    payload: dict[str, str] = {"error": error, "error_description": description}
    if state:
        payload["state"] = state
    return RedirectResponse(url=_add_query_params(redirect_uri, payload), status_code=302)


def _parse_form_encoded(body: bytes) -> dict[str, str]:
    parsed = parse_qs(body.decode("utf-8"), keep_blank_values=True)
    return {key: values[-1] for key, values in parsed.items() if values}


def _consent_return_to_hash(return_to: str) -> str:
    return sha256(return_to.encode("utf-8")).hexdigest()


def _resolve_requested_scopes(scope: str | None, settings: Settings) -> list[str]:
    if not scope or not scope.strip():
        try:
            return resolve_default_oauth_scopes(settings.oauth_scope_list)
        except ValueError as exc:
            raise ApiError(status_code=500, code="OAUTH_SCOPE_CONFIG_INVALID", message=str(exc)) from exc

    requested = normalize_scope(scope)
    try:
        return validate_oauth_scopes(requested)
    except ValueError as exc:
        raise ApiError(status_code=400, code="INVALID_SCOPE", message=str(exc)) from exc


def _resolve_oauth_ui_origin(settings: Settings) -> str:
    parsed = urlparse(settings.oauth_login_ui_url)
    if not parsed.scheme or not parsed.netloc:
        raise ApiError(status_code=500, code="OAUTH_UI_URL_INVALID", message="OAuth login UI URL is invalid")
    return f"{parsed.scheme}://{parsed.netloc}"


def _resolve_oauth_consent_context(*, request: Request, validated_return_to: str, settings: Settings) -> tuple[OAuthClientRecord, str, list[str], str | None]:
    parsed = urlparse(validated_return_to)
    query = parse_qs(parsed.query, keep_blank_values=True)

    client_id = (query.get("client_id") or [""])[-1]
    redirect_uri = (query.get("redirect_uri") or [""])[-1]
    scope = (query.get("scope") or [""])[-1]
    state = (query.get("state") or [None])[-1]

    if not client_id:
        raise ApiError(status_code=400, code="INVALID_REQUEST", message="client_id is required")

    auth_store = request.app.state.auth_store
    client = auth_store.get_oauth_client_by_client_id(client_id)
    if client is None:
        raise ApiError(status_code=400, code="INVALID_CLIENT", message="OAuth client is invalid")
    if redirect_uri not in client.redirect_uris:
        raise ApiError(status_code=400, code="INVALID_REDIRECT_URI", message="Redirect URI is not allowed")

    requested_scopes = _resolve_requested_scopes(scope, settings)
    return client, redirect_uri, requested_scopes, state


def _validate_oauth_return_to(return_to: str, settings: Settings) -> str:
        parsed = urlparse(return_to)
        if parsed.scheme or parsed.netloc:
                raise ApiError(status_code=400, code="INVALID_REQUEST", message="Invalid return_to")

        expected_prefix = f"{settings.api_prefix}/oauth/authorize"
        if not parsed.path.startswith(expected_prefix):
                raise ApiError(status_code=400, code="INVALID_REQUEST", message="Invalid return_to")

        return return_to


def _oauth_login_page_html(return_to: str, error: str | None = None) -> str:
        safe_return_to = escape(return_to, quote=True)
        error_html = f'<p style="color:#b91c1c;">{escape(error)}</p>' if error else ""
        return f"""<!doctype html>
<html lang=\"en\">
    <head>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
        <title>OAuth Sign in</title>
    </head>
    <body style=\"font-family: system-ui, sans-serif; max-width: 28rem; margin: 3rem auto; padding: 0 1rem;\">
        <h1 style=\"margin-bottom: 0.5rem;\">Sign in</h1>
        <p style=\"margin-top: 0; color: #374151;\">Sign in to continue OAuth authorization.</p>
        {error_html}
        <form method=\"post\" action=\"\" style=\"display: grid; gap: 0.75rem;\">
            <input type=\"hidden\" name=\"return_to\" value=\"{safe_return_to}\" />
            <label>
                Username or Email<br />
                <input name=\"username\" type=\"text\" required style=\"width: 100%; padding: 0.5rem;\" />
            </label>
            <label>
                Password<br />
                <input name=\"password\" type=\"password\" required style=\"width: 100%; padding: 0.5rem;\" />
            </label>
            <button type=\"submit\" style=\"padding: 0.6rem 0.8rem;\">Continue</button>
        </form>
    </body>
</html>"""


def _oauth_consent_page_html(*, return_to: str, client_name: str, scopes: list[str]) -> str:
        safe_return_to = escape(return_to, quote=True)
        scope_items = "".join(f"<li>{escape(scope)}</li>" for scope in scopes)
        return f"""<!doctype html>
<html lang=\"en\">
    <head>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
        <title>Authorize {escape(client_name)}</title>
    </head>
    <body style=\"font-family: system-ui, sans-serif; max-width: 34rem; margin: 3rem auto; padding: 0 1rem;\">
        <h1 style=\"margin-bottom: 0.4rem;\">Authorize {escape(client_name)}</h1>
        <p style=\"margin-top: 0; color: #374151;\">This app is requesting access to your account.</p>
        <p style=\"font-weight: 600; margin-bottom: 0.25rem;\">Requested permissions</p>
        <ul style=\"margin-top: 0;\">{scope_items}</ul>

        <form method=\"post\" action=\"\" style=\"display: flex; gap: 0.6rem;\">
            <input type=\"hidden\" name=\"return_to\" value=\"{safe_return_to}\" />
            <button type=\"submit\" name=\"decision\" value=\"approve\" style=\"padding: 0.55rem 0.9rem;\">Grant</button>
            <button type=\"submit\" name=\"decision\" value=\"deny\" style=\"padding: 0.55rem 0.9rem;\">Deny</button>
        </form>
    </body>
</html>"""


@router.get("/login")
def oauth_login_page(return_to: str, settings: Settings = Depends(get_settings)) -> HTMLResponse:
        validated_return_to = _validate_oauth_return_to(return_to, settings)
        return HTMLResponse(content=_oauth_login_page_html(validated_return_to), status_code=200)


@router.post("/login")
async def oauth_login_submit(request: Request, settings: Settings = Depends(get_settings)):
        form = _parse_form_encoded(await request.body())
        username = form.get("username", "").strip()
        password = form.get("password", "")
        return_to = form.get("return_to", "")

        validated_return_to = _validate_oauth_return_to(return_to, settings)
        if not username or not password:
                return HTMLResponse(content=_oauth_login_page_html(validated_return_to, "Username and password are required"), status_code=400)

        auth_store = request.app.state.auth_store
        user = auth_store.authenticate_local_user(username, password)
        if user is None or user.status != "active":
                return HTMLResponse(content=_oauth_login_page_html(validated_return_to, "Invalid username/email or password"), status_code=401)

        access_token, _ = generate_access_token(user.id, user.roles, settings)

        response = RedirectResponse(url=validated_return_to, status_code=302)
        response.set_cookie(
                key=settings.oauth_session_cookie_name,
                value=access_token,
                max_age=settings.oauth_session_cookie_ttl_seconds,
                httponly=True,
                secure=settings.oauth_session_cookie_secure,
                samesite=settings.oauth_session_cookie_same_site,
                path="/",
        )
        return response


@router.post("/session")
def oauth_establish_session(
    payload: OAuthSessionRequest,
    settings: Settings = Depends(get_settings),
    current_user: UserRecord = Depends(get_current_user),
):
    validated_return_to = _validate_oauth_return_to(payload.returnTo, settings)
    access_token, _ = generate_access_token(current_user.id, current_user.roles, settings)

    redirect_url = f"{settings.oauth_issuer.rstrip('/')}{validated_return_to}"
    response = JSONResponse({"success": True, "redirectUrl": redirect_url})
    response.set_cookie(
        key=settings.oauth_session_cookie_name,
        value=access_token,
        max_age=settings.oauth_session_cookie_ttl_seconds,
        httponly=True,
        secure=settings.oauth_session_cookie_secure,
        samesite=settings.oauth_session_cookie_same_site,
        path="/",
    )
    return response


@router.get("/consent")
def oauth_consent_page(
    request: Request,
    return_to: str,
    settings: Settings = Depends(get_settings),
    current_user: UserRecord = Depends(get_current_user),
) -> RedirectResponse:
    _ = current_user
    validated_return_to = _validate_oauth_return_to(return_to, settings)
    _resolve_oauth_consent_context(request=request, validated_return_to=validated_return_to, settings=settings)
    consent_ui_url = _add_query_params(
        f"{_resolve_oauth_ui_origin(settings)}/oauth/consent",
        {"return_to": validated_return_to},
    )
    return RedirectResponse(url=consent_ui_url, status_code=302)


@router.get("/consent/details")
def oauth_consent_details(
    request: Request,
    return_to: str,
    settings: Settings = Depends(get_settings),
    _: UserRecord = Depends(get_current_user),
) -> dict[str, Any]:
    validated_return_to = _validate_oauth_return_to(return_to, settings)
    client, _redirect_uri, requested_scopes, _state = _resolve_oauth_consent_context(
        request=request,
        validated_return_to=validated_return_to,
        settings=settings,
    )
    return {
        "returnTo": validated_return_to,
        "clientId": client.client_id,
        "clientName": client.name,
        "scopes": requested_scopes,
    }


@router.post("/consent/decision")
def oauth_consent_decision(
    payload: OAuthConsentDecisionRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
    _: UserRecord = Depends(get_current_user),
) -> dict[str, Any]:
    validated_return_to = _validate_oauth_return_to(payload.returnTo, settings)
    client, redirect_uri, requested_scopes, state = _resolve_oauth_consent_context(
        request=request,
        validated_return_to=validated_return_to,
        settings=settings,
    )

    if payload.decision != "approve":
        redirect_response = _oauth_redirect_error(redirect_uri, "access_denied", "User denied consent", state)
        return {
            "success": True,
            "decision": "deny",
            "redirectUrl": redirect_response.headers.get("location") or redirect_uri,
        }

    auth_store = request.app.state.auth_store
    current_user = auth_store.get_user(request.state.auth_context.user_id) if request.state.auth_context.user_id else None
    if current_user is None:
        raise ApiError(status_code=401, code="AUTH_REQUIRED", message="Authentication is required")

    auth_store.upsert_oauth_consent_grant(user_id=current_user.id, client_id=client.client_id, scopes=requested_scopes)
    response_payload: dict[str, Any] = {
        "success": True,
        "decision": "approve",
        "redirectUrl": f"{settings.oauth_issuer.rstrip('/')}{validated_return_to}",
    }
    response = JSONResponse(response_payload)
    response.set_cookie(
        key="oauth_consent_once",
        value=_consent_return_to_hash(validated_return_to),
        max_age=120,
        httponly=True,
        secure=settings.oauth_session_cookie_secure,
        samesite=settings.oauth_session_cookie_same_site,
        path="/",
    )
    return response


@router.post("/consent")
async def oauth_consent_submit(request: Request, settings: Settings = Depends(get_settings), _: UserRecord = Depends(get_current_user)) -> RedirectResponse:
    form = _parse_form_encoded(await request.body())
    return_to = form.get("return_to", "")
    decision = form.get("decision", "deny")
    validated_return_to = _validate_oauth_return_to(return_to, settings)

    parsed = urlparse(validated_return_to)
    query = parse_qs(parsed.query, keep_blank_values=True)
    client_id = (query.get("client_id") or [""])[-1]
    redirect_uri = (query.get("redirect_uri") or [""])[-1]
    scope = (query.get("scope") or [""])[-1]
    state = (query.get("state") or [None])[-1]

    auth_store = request.app.state.auth_store
    client = auth_store.get_oauth_client_by_client_id(client_id)
    if client is None:
        raise ApiError(status_code=400, code="INVALID_CLIENT", message="OAuth client is invalid")
    if redirect_uri not in client.redirect_uris:
        raise ApiError(status_code=400, code="INVALID_REDIRECT_URI", message="Redirect URI is not allowed")

    requested_scopes = _resolve_requested_scopes(scope, settings)

    if decision != "approve":
        return _oauth_redirect_error(redirect_uri, "access_denied", "User denied consent", state)

    current_user = auth_store.get_user(request.state.auth_context.user_id) if request.state.auth_context.user_id else None
    if current_user is None:
        raise ApiError(status_code=401, code="AUTH_REQUIRED", message="Authentication is required")

    auth_store.upsert_oauth_consent_grant(user_id=current_user.id, client_id=client.client_id, scopes=requested_scopes)
    response = RedirectResponse(url=validated_return_to, status_code=302)
    response.set_cookie(
        key="oauth_consent_once",
        value=_consent_return_to_hash(validated_return_to),
        max_age=120,
        httponly=True,
        secure=settings.oauth_session_cookie_secure,
        samesite=settings.oauth_session_cookie_same_site,
        path="/",
    )
    return response


@well_known_router.get("/.well-known/oauth-authorization-server")
def oauth_authorization_server_metadata(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    base = settings.oauth_issuer.rstrip("/")
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}{settings.api_prefix}/oauth/authorize",
        "token_endpoint": f"{base}{settings.api_prefix}/oauth/token",
        "jwks_uri": f"{base}{settings.api_prefix}/oauth/jwks",
        "revocation_endpoint": f"{base}{settings.api_prefix}/oauth/revoke",
        "introspection_endpoint": f"{base}{settings.api_prefix}/oauth/introspect",
        "end_session_endpoint": f"{base}{settings.api_prefix}/oauth/end-session",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "token_endpoint_auth_methods_supported": ["none", "client_secret_post"],
        "introspection_endpoint_auth_methods_supported": ["none", "client_secret_post"],
        "scopes_supported": get_supported_oauth_scopes(),
        "code_challenge_methods_supported": ["S256"],
    }


@well_known_router.get("/.well-known/openid-configuration")
def openid_configuration(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    base = settings.oauth_issuer.rstrip("/")
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}{settings.api_prefix}/oauth/authorize",
        "token_endpoint": f"{base}{settings.api_prefix}/oauth/token",
        "userinfo_endpoint": f"{base}{settings.api_prefix}/oauth/userinfo",
        "jwks_uri": f"{base}{settings.api_prefix}/oauth/jwks",
        "revocation_endpoint": f"{base}{settings.api_prefix}/oauth/revoke",
        "introspection_endpoint": f"{base}{settings.api_prefix}/oauth/introspect",
        "end_session_endpoint": f"{base}{settings.api_prefix}/oauth/end-session",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["RS256"],
        "token_endpoint_auth_methods_supported": ["none", "client_secret_post"],
        "introspection_endpoint_auth_methods_supported": ["none", "client_secret_post"],
        "scopes_supported": get_supported_oauth_scopes(),
        "claims_supported": ["sub", "name", "preferred_username", "email", "email_verified"],
        "code_challenge_methods_supported": ["S256"],
    }


@router.get("/jwks")
def oauth_jwks(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    return build_jwks(settings)


@router.get("/authorize")
def oauth_authorize(
    request: Request,
    response_type: str,
    client_id: str,
    redirect_uri: str,
    scope: str | None = None,
    state: str | None = None,
    prompt: str | None = None,
    nonce: str | None = None,
    code_challenge: str | None = None,
    code_challenge_method: str | None = None,
    settings: Settings = Depends(get_settings),
):
    if not settings.oauth_enabled:
        raise ApiError(status_code=404, code="OAUTH_DISABLED", message="OAuth provider is disabled")

    auth_store = request.app.state.auth_store
    auth_context = request.state.auth_context

    if not auth_context.is_authenticated or not auth_context.user_id:
        return_to = str(request.url.path)
        if request.url.query:
            return_to = f"{return_to}?{request.url.query}"
        login_url = _add_query_params(
            settings.oauth_login_ui_url,
            {"oauth_return_to": return_to},
        )
        return RedirectResponse(url=login_url, status_code=302)

    current_user = auth_store.get_user(auth_context.user_id)
    if current_user is None or current_user.status != "active":
        raise ApiError(status_code=401, code="AUTH_REQUIRED", message="Authentication is required")

    if response_type != "code":
        raise ApiError(status_code=400, code="UNSUPPORTED_RESPONSE_TYPE", message="Only response_type=code is supported")

    client = auth_store.get_oauth_client_by_client_id(client_id)
    if client is None:
        raise ApiError(status_code=400, code="INVALID_CLIENT", message="OAuth client is invalid")

    if redirect_uri not in client.redirect_uris:
        raise ApiError(status_code=400, code="INVALID_REDIRECT_URI", message="Redirect URI is not allowed")

    requested_scopes = _resolve_requested_scopes(scope, settings)
    if not requested_scopes:
        return _oauth_redirect_error(redirect_uri, "invalid_scope", "No scopes were requested", state)

    if not set(requested_scopes).issubset(set(client.allowed_scopes)):
        return _oauth_redirect_error(redirect_uri, "invalid_scope", "Requested scope is not permitted", state)

    if "offline_access" in requested_scopes and "refresh_token" not in client.grant_types:
        return _oauth_redirect_error(redirect_uri, "invalid_scope", "offline_access requires refresh_token grant", state)

    if settings.oauth_require_pkce:
        if not code_challenge:
            return _oauth_redirect_error(redirect_uri, "invalid_request", "code_challenge is required", state)
        if code_challenge_method != "S256":
            return _oauth_redirect_error(redirect_uri, "invalid_request", "code_challenge_method must be S256", state)

    trusted = client.trusted or client.client_id in settings.oauth_trusted_client_id_list
    requested_prompts = {item.strip() for item in (prompt or "").split() if item.strip()}
    force_consent = "consent" in requested_prompts
    return_to = str(request.url.path)
    if request.url.query:
        return_to = f"{return_to}?{request.url.query}"
    consent_once_cookie = request.cookies.get("oauth_consent_once")
    consent_just_approved = consent_once_cookie == _consent_return_to_hash(return_to)

    if force_consent or (not trusted and not consent_just_approved):
        consent_url = _add_query_params(
            f"{settings.api_prefix}/oauth/consent",
            {"return_to": return_to},
        )
        return RedirectResponse(url=consent_url, status_code=302)

    code = generate_refresh_token()
    auth_store.create_oauth_authorization_code(
        code=code,
        client_id=client.client_id,
        user_id=current_user.id,
        redirect_uri=redirect_uri,
        scopes=requested_scopes,
        code_challenge=code_challenge or "",
        code_challenge_method=code_challenge_method or "S256",
        nonce=nonce,
        expires_at=datetime.now(UTC) + timedelta(seconds=settings.oauth_authorization_code_ttl_seconds),
    )

    redirect_url = _add_query_params(
        redirect_uri,
        {
            "code": code,
            **({"state": state} if state else {}),
        },
    )
    response = RedirectResponse(url=redirect_url, status_code=302)
    if consent_once_cookie:
        response.delete_cookie("oauth_consent_once", path="/")
    return response


@router.post("/token")
async def oauth_token(request: Request, settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    if not settings.oauth_enabled:
        raise ApiError(status_code=404, code="OAUTH_DISABLED", message="OAuth provider is disabled")

    form = _parse_form_encoded(await request.body())
    grant_type = form.get("grant_type")
    client_id = form.get("client_id")
    if not client_id:
        raise ApiError(status_code=400, code="INVALID_REQUEST", message="client_id is required")

    auth_store = request.app.state.auth_store
    client = auth_store.get_oauth_client_by_client_id(client_id)
    if client is None:
        raise ApiError(status_code=401, code="INVALID_CLIENT", message="OAuth client is invalid")

    if grant_type not in client.grant_types:
        raise ApiError(status_code=400, code="UNAUTHORIZED_CLIENT", message="Client is not authorized for this grant type")

    if client.token_endpoint_auth_method == "client_secret_post":
        posted_secret = form.get("client_secret")
        if not posted_secret:
            raise ApiError(status_code=401, code="INVALID_CLIENT", message="client_secret is required for this client")
        if not client.client_secret_hash or hash_oauth_secret(posted_secret) != client.client_secret_hash:
            raise ApiError(status_code=401, code="INVALID_CLIENT", message="OAuth client is invalid")

    if grant_type == "authorization_code":
        code = form.get("code")
        redirect_uri = form.get("redirect_uri")
        code_verifier = form.get("code_verifier")

        if not code or not redirect_uri:
            raise ApiError(status_code=400, code="INVALID_REQUEST", message="code and redirect_uri are required")

        authorization_code = auth_store.consume_oauth_authorization_code(code)
        if authorization_code is None:
            raise ApiError(status_code=400, code="INVALID_GRANT", message="Authorization code is invalid or expired")

        if authorization_code.client_id != client.client_id:
            raise ApiError(status_code=400, code="INVALID_GRANT", message="Authorization code does not match client")
        if authorization_code.redirect_uri != redirect_uri:
            raise ApiError(status_code=400, code="INVALID_GRANT", message="Redirect URI mismatch")

        if settings.oauth_require_pkce:
            if not code_verifier:
                raise ApiError(status_code=400, code="INVALID_GRANT", message="code_verifier is required")
            if authorization_code.code_challenge_method != "S256":
                raise ApiError(status_code=400, code="INVALID_GRANT", message="Unsupported PKCE method")
            if not verify_pkce_s256(code_verifier, authorization_code.code_challenge):
                raise ApiError(status_code=400, code="INVALID_GRANT", message="PKCE verification failed")

        token, jti, expires_in, expires_at = issue_oauth_access_token(
            settings=settings,
            subject=authorization_code.user_id,
            client_id=client.client_id,
            scopes=authorization_code.scopes,
            audience=client.client_id,
        )

        auth_store.store_oauth_access_token(
            token=token,
            jti=jti,
            user_id=authorization_code.user_id,
            client_id=client.client_id,
            scopes=authorization_code.scopes,
            expires_at=expires_at,
        )

        response_payload: dict[str, Any] = {
            "access_token": token,
            "token_type": "Bearer",
            "expires_in": expires_in,
            "scope": " ".join(authorization_code.scopes),
        }

        if "offline_access" in authorization_code.scopes and "refresh_token" in client.grant_types:
            refresh_token, refresh_record = auth_store.create_oauth_refresh_token(
                user_id=authorization_code.user_id,
                client_id=client.client_id,
                scopes=authorization_code.scopes,
                expires_at=datetime.now(UTC) + timedelta(seconds=settings.oauth_refresh_token_ttl_seconds),
            )
            response_payload["refresh_token"] = refresh_token
            response_payload["refresh_token_expires_in"] = int((refresh_record.expires_at - datetime.now(UTC)).total_seconds())

        if "openid" in authorization_code.scopes:
            user = auth_store.get_user(authorization_code.user_id)
            if user is None:
                raise ApiError(status_code=400, code="INVALID_GRANT", message="Authorization subject is invalid")
            id_token, _ = issue_oidc_id_token(
                settings=settings,
                subject=user.id,
                audience=client.client_id,
                user_claims={
                    "name": user.display_name,
                    "preferred_username": user.username,
                    "email": user.email,
                    "email_verified": user.email_verified,
                },
                nonce=authorization_code.nonce,
            )
            response_payload["id_token"] = id_token

        return response_payload

    if grant_type == "refresh_token":
        refresh_token = form.get("refresh_token")
        if not refresh_token:
            raise ApiError(status_code=400, code="INVALID_REQUEST", message="refresh_token is required")

        refresh_record = auth_store.get_active_oauth_refresh_token(refresh_token)
        if refresh_record is None:
            raise ApiError(status_code=400, code="INVALID_GRANT", message="Refresh token is invalid or expired")
        if refresh_record.client_id != client.client_id:
            raise ApiError(status_code=400, code="INVALID_GRANT", message="Refresh token does not match client")

        user = auth_store.get_user(refresh_record.user_id)
        if user is None or user.status != "active":
            raise ApiError(status_code=400, code="INVALID_GRANT", message="Refresh token subject is invalid")

        token, jti, expires_in, expires_at = issue_oauth_access_token(
            settings=settings,
            subject=refresh_record.user_id,
            client_id=client.client_id,
            scopes=refresh_record.scopes,
            audience=client.client_id,
        )
        auth_store.store_oauth_access_token(
            token=token,
            jti=jti,
            user_id=refresh_record.user_id,
            client_id=client.client_id,
            scopes=refresh_record.scopes,
            expires_at=expires_at,
        )

        response_payload: dict[str, Any] = {
            "access_token": token,
            "token_type": "Bearer",
            "expires_in": expires_in,
            "scope": " ".join(refresh_record.scopes),
        }

        if settings.oauth_refresh_token_rotation_enabled:
            auth_store.revoke_oauth_refresh_token(refresh_token)
            new_refresh_token, new_refresh_record = auth_store.create_oauth_refresh_token(
                user_id=refresh_record.user_id,
                client_id=refresh_record.client_id,
                scopes=refresh_record.scopes,
                expires_at=datetime.now(UTC) + timedelta(seconds=settings.oauth_refresh_token_ttl_seconds),
                family_id=refresh_record.family_id,
            )
            response_payload["refresh_token"] = new_refresh_token
            response_payload["refresh_token_expires_in"] = int((new_refresh_record.expires_at - datetime.now(UTC)).total_seconds())
        else:
            response_payload["refresh_token"] = refresh_token
            response_payload["refresh_token_expires_in"] = int((refresh_record.expires_at - datetime.now(UTC)).total_seconds())

        return response_payload

    raise ApiError(status_code=400, code="UNSUPPORTED_GRANT_TYPE", message="Unsupported grant_type")


def _resolve_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise ApiError(status_code=401, code="AUTH_REQUIRED", message="Missing bearer token")
    return authorization.split(" ", 1)[1].strip()


@router.get("/userinfo")
def oauth_userinfo(
    request: Request,
    authorization: str | None = Header(alias="Authorization", default=None),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    token = _resolve_bearer_token(authorization)

    try:
        payload = decode_oauth_access_token(token, settings)
    except jwt.ExpiredSignatureError as exc:
        raise ApiError(status_code=401, code="TOKEN_EXPIRED", message="Access token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise ApiError(status_code=401, code="TOKEN_INVALID", message="Access token is invalid") from exc

    if payload.get("token_use") != "access":
        raise ApiError(status_code=401, code="TOKEN_INVALID", message="Access token is invalid")

    token_scopes = get_oauth_token_scopes(payload)

    auth_store = request.app.state.auth_store
    if not auth_store.is_oauth_access_token_active(token):
        raise ApiError(status_code=401, code="TOKEN_INVALID", message="Access token is invalid")

    user_id = payload.get("sub")
    user = auth_store.get_user(user_id) if user_id else None
    if user is None:
        raise ApiError(status_code=401, code="TOKEN_INVALID", message="Access token subject is invalid")

    response: dict[str, Any] = {
        "sub": user.id,
    }
    allowed_claims = get_userinfo_claims_for_scopes(token_scopes)
    if "name" in allowed_claims:
        response["name"] = user.display_name
    if "preferred_username" in allowed_claims:
        response["preferred_username"] = user.username
    if "email" in allowed_claims:
        response["email"] = user.email
    if "email_verified" in allowed_claims:
        response["email_verified"] = user.email_verified
    return response


@router.post("/revoke")
async def oauth_revoke(request: Request, settings: Settings = Depends(get_settings)) -> dict[str, bool]:
    if not settings.oauth_enabled:
        raise ApiError(status_code=404, code="OAUTH_DISABLED", message="OAuth provider is disabled")

    form = _parse_form_encoded(await request.body())
    token = form.get("token")
    client_id = form.get("client_id")
    if not token or not client_id:
        raise ApiError(status_code=400, code="INVALID_REQUEST", message="token and client_id are required")

    auth_store = request.app.state.auth_store
    client = auth_store.get_oauth_client_by_client_id(client_id)
    if client is None:
        raise ApiError(status_code=401, code="INVALID_CLIENT", message="OAuth client is invalid")

    if client.token_endpoint_auth_method == "client_secret_post":
        posted_secret = form.get("client_secret")
        if not posted_secret:
            raise ApiError(status_code=401, code="INVALID_CLIENT", message="client_secret is required for this client")
        if not client.client_secret_hash or hash_oauth_secret(posted_secret) != client.client_secret_hash:
            raise ApiError(status_code=401, code="INVALID_CLIENT", message="OAuth client is invalid")

    auth_store.revoke_oauth_access_token(token)
    return {"success": True}


@router.post("/introspect")
async def oauth_introspect(request: Request, settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    if not settings.oauth_enabled:
        raise ApiError(status_code=404, code="OAUTH_DISABLED", message="OAuth provider is disabled")

    form = _parse_form_encoded(await request.body())
    token = form.get("token")
    client_id = form.get("client_id")
    if not token or not client_id:
        raise ApiError(status_code=400, code="INVALID_REQUEST", message="token and client_id are required")

    auth_store = request.app.state.auth_store
    client = auth_store.get_oauth_client_by_client_id(client_id)
    if client is None:
        raise ApiError(status_code=401, code="INVALID_CLIENT", message="OAuth client is invalid")

    if client.token_endpoint_auth_method == "client_secret_post":
        posted_secret = form.get("client_secret")
        if not posted_secret:
            raise ApiError(status_code=401, code="INVALID_CLIENT", message="client_secret is required for this client")
        if not client.client_secret_hash or hash_oauth_secret(posted_secret) != client.client_secret_hash:
            raise ApiError(status_code=401, code="INVALID_CLIENT", message="OAuth client is invalid")

    try:
        payload = decode_oauth_access_token(token, settings)
    except jwt.InvalidTokenError:
        return {"active": False}

    if payload.get("token_use") != "access":
        return {"active": False}

    if not auth_store.is_oauth_access_token_active(token):
        return {"active": False}

    return {
        "active": True,
        "scope": payload.get("scope", ""),
        "client_id": payload.get("azp"),
        "sub": payload.get("sub"),
        "token_type": "Bearer",
        "exp": payload.get("exp"),
        "iat": payload.get("iat"),
        "iss": payload.get("iss"),
        "aud": payload.get("aud"),
    }


@router.get("/end-session")
def oauth_end_session(
    request: Request,
    settings: Settings = Depends(get_settings),
    id_token_hint: str | None = None,
    post_logout_redirect_uri: str | None = None,
    state: str | None = None,
    client_id: str | None = None,
):
    def _with_cookie_clear(response: RedirectResponse) -> RedirectResponse:
        response.delete_cookie(settings.oauth_session_cookie_name, path="/")
        return response

    resolved_client_id = client_id
    if id_token_hint:
        try:
            id_payload = decode_oidc_id_token(id_token_hint, settings)
        except jwt.InvalidTokenError as exc:
            raise ApiError(status_code=400, code="INVALID_REQUEST", message="id_token_hint is invalid") from exc

        aud = id_payload.get("aud")
        if isinstance(aud, str) and aud.strip():
            resolved_client_id = resolved_client_id or aud
        elif isinstance(aud, list) and aud:
            candidate = next((item for item in aud if isinstance(item, str) and item.strip()), None)
            if candidate:
                resolved_client_id = resolved_client_id or candidate

    if post_logout_redirect_uri:
        if not resolved_client_id:
            raise ApiError(
                status_code=400,
                code="INVALID_REQUEST",
                message="client_id or id_token_hint is required when post_logout_redirect_uri is provided",
            )

        auth_store = request.app.state.auth_store
        client = auth_store.get_oauth_client_by_client_id(resolved_client_id)
        if client is None:
            raise ApiError(status_code=400, code="INVALID_REQUEST", message="Unknown client_id")
        if post_logout_redirect_uri not in client.redirect_uris:
            raise ApiError(status_code=400, code="INVALID_REQUEST", message="post_logout_redirect_uri is not allowed")

        redirect_url = post_logout_redirect_uri
        if state:
            redirect_url = _add_query_params(redirect_url, {"state": state})
        return _with_cookie_clear(RedirectResponse(url=redirect_url, status_code=302))

    response = JSONResponse({"success": True})
    response.delete_cookie(settings.oauth_session_cookie_name, path="/")
    return response


@admin_router.get("/clients")
def admin_list_oauth_clients(request: Request, _: UserRecord = Depends(require_superuser)) -> dict[str, Any]:
    auth_store = request.app.state.auth_store
    return {"items": [_serialize_client(item) for item in auth_store.list_oauth_clients()]}


@admin_router.post("/clients")
def admin_create_oauth_client(
    payload: OAuthClientCreateRequest,
    request: Request,
    _: UserRecord = Depends(require_superuser),
) -> dict[str, Any]:
    auth_store = request.app.state.auth_store
    auth_method = payload.tokenEndpointAuthMethod
    if auth_method not in {"none", "client_secret_post"}:
        raise ApiError(status_code=400, code="INVALID_CLIENT_AUTH_METHOD", message="Unsupported token endpoint auth method")
    allowed_grant_types = {"authorization_code", "refresh_token"}
    if not set(payload.grantTypes).issubset(allowed_grant_types) or "authorization_code" not in payload.grantTypes:
        raise ApiError(status_code=400, code="INVALID_GRANT_TYPE", message="Invalid grantTypes configuration")

    generated_secret: str | None = None
    if auth_method == "client_secret_post":
        generated_secret = generate_refresh_token()

    scopes = payload.allowedScopes or request.app.state.settings.oauth_scope_list
    try:
        scopes = validate_oauth_scopes(scopes)
    except ValueError as exc:
        raise ApiError(status_code=400, code="INVALID_SCOPE", message=str(exc)) from exc
    client = auth_store.create_oauth_client(
        name=payload.name,
        redirect_uris=payload.redirectUris,
        allowed_scopes=scopes,
        grant_types=payload.grantTypes,
        trusted=payload.trusted,
        token_endpoint_auth_method=auth_method,
        client_secret=generated_secret,
    )

    response: dict[str, Any] = _serialize_client(client)
    if generated_secret is not None:
        response["clientSecret"] = generated_secret
    return response


@admin_router.patch("/clients/{client_id}")
def admin_patch_oauth_client(
    client_id: str,
    payload: OAuthClientPatchRequest,
    request: Request,
    _: UserRecord = Depends(require_superuser),
) -> dict[str, Any]:
    auth_store = request.app.state.auth_store
    allowed_grant_types = {"authorization_code", "refresh_token"}
    if payload.grantTypes is not None:
        if not set(payload.grantTypes).issubset(allowed_grant_types) or "authorization_code" not in payload.grantTypes:
            raise ApiError(status_code=400, code="INVALID_GRANT_TYPE", message="Invalid grantTypes configuration")
    if payload.allowedScopes is not None:
        try:
            payload.allowedScopes = validate_oauth_scopes(payload.allowedScopes)
        except ValueError as exc:
            raise ApiError(status_code=400, code="INVALID_SCOPE", message=str(exc)) from exc

    generated_secret: str | None = generate_refresh_token() if payload.rotateSecret else None
    client = auth_store.update_oauth_client(
        client_id=client_id,
        name=payload.name,
        redirect_uris=payload.redirectUris,
        allowed_scopes=payload.allowedScopes,
        grant_types=payload.grantTypes,
        trusted=payload.trusted,
        token_endpoint_auth_method=payload.tokenEndpointAuthMethod,
        client_secret=generated_secret,
    )
    if client is None:
        raise ApiError(status_code=404, code="OAUTH_CLIENT_NOT_FOUND", message="OAuth client not found")

    response: dict[str, Any] = _serialize_client(client)
    if generated_secret is not None:
        response["clientSecret"] = generated_secret
    return response


@admin_router.delete("/clients/{client_id}")
def admin_delete_oauth_client(client_id: str, request: Request, _: UserRecord = Depends(require_superuser)) -> dict[str, bool]:
    auth_store = request.app.state.auth_store
    if not auth_store.delete_oauth_client(client_id):
        raise ApiError(status_code=404, code="OAUTH_CLIENT_NOT_FOUND", message="OAuth client not found")
    return {"success": True}
