from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from importlib import import_module
from typing import Any, Mapping
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import jwt

from app.auth.security import DEV_ACCESS_SECRET
from app.core.config import Settings
from app.core.errors import ApiError


@dataclass(frozen=True)
class ExternalOAuthProviderDefinition:
    name: str
    display_name: str
    authorize_url: str
    token_url: str
    userinfo_url: str
    default_scopes: tuple[str, ...] = ()


@dataclass(frozen=True)
class ExternalOAuthProviderAppConfig:
    provider: str
    client_id: str
    client_secret: str
    required_scopes: tuple[str, ...]
    optional_scopes: tuple[str, ...] = ()
    redirect_uri: str | None = None
    extra: dict[str, Any] | None = None


@dataclass(frozen=True)
class ExternalOAuthTokenResult:
    access_token: str
    refresh_token: str | None
    scopes: tuple[str, ...]
    expires_in_seconds: int | None
    raw_payload: dict[str, Any]


EXTERNAL_OAUTH_LINK_STATE_TTL_SECONDS = 600


BASE_EXTERNAL_OAUTH_PROVIDERS: dict[str, ExternalOAuthProviderDefinition] = {
    "github": ExternalOAuthProviderDefinition(
        name="github",
        display_name="GitHub",
        authorize_url="https://github.com/login/oauth/authorize",
        token_url="https://github.com/login/oauth/access_token",
        userinfo_url="https://api.github.com/user",
        default_scopes=("read:user",),
    ),
    "orcid": ExternalOAuthProviderDefinition(
        name="orcid",
        display_name="ORCID",
        authorize_url="https://orcid.org/oauth/authorize",
        token_url="https://orcid.org/oauth/token",
        userinfo_url="https://orcid.org/oauth/userinfo",
        default_scopes=("/authenticate",),
    ),
}


def _to_provider_definition(name: str, value: Any) -> ExternalOAuthProviderDefinition:
    if isinstance(value, ExternalOAuthProviderDefinition):
        if value.name != name:
            raise RuntimeError(f"External OAuth provider definition name mismatch for '{name}'")
        return value

    if not isinstance(value, Mapping):
        raise RuntimeError(f"External OAuth provider definition for '{name}' must be a mapping")

    display_name = str(value.get("display_name", "")).strip()
    authorize_url = str(value.get("authorize_url", "")).strip()
    token_url = str(value.get("token_url", "")).strip()
    userinfo_url = str(value.get("userinfo_url", "")).strip()
    default_scopes_raw = value.get("default_scopes", ())
    if not isinstance(default_scopes_raw, (list, tuple, set)):
        raise RuntimeError(f"default_scopes for '{name}' must be a list/tuple/set")

    default_scopes = tuple(str(item).strip() for item in default_scopes_raw if str(item).strip())
    if not display_name or not authorize_url or not token_url or not userinfo_url:
        raise RuntimeError(f"External OAuth provider '{name}' is missing required metadata")

    return ExternalOAuthProviderDefinition(
        name=name,
        display_name=display_name,
        authorize_url=authorize_url,
        token_url=token_url,
        userinfo_url=userinfo_url,
        default_scopes=default_scopes,
    )


def _merge_provider_definitions(
    base: Mapping[str, ExternalOAuthProviderDefinition],
    extension: Mapping[str, Any] | None,
) -> dict[str, ExternalOAuthProviderDefinition]:
    merged = dict(base)
    if not extension:
        return merged

    for name, value in extension.items():
        normalized = str(name).strip().lower()
        if not normalized:
            raise RuntimeError("External OAuth provider names must be non-empty")
        if normalized in merged:
            raise RuntimeError(f"External OAuth provider '{normalized}' is already defined and cannot be overridden")
        merged[normalized] = _to_provider_definition(normalized, value)

    return merged


def get_external_oauth_provider_registry() -> dict[str, ExternalOAuthProviderDefinition]:
    merged = dict(BASE_EXTERNAL_OAUTH_PROVIDERS)

    try:
        module = import_module("app.extensions.auth.external_oauth_providers")
    except ModuleNotFoundError:
        return merged

    extension_defs = getattr(module, "EXTERNAL_OAUTH_PROVIDER_DEFINITIONS", None)
    merged = _merge_provider_definitions(merged, extension_defs)

    extender = getattr(module, "extend_external_oauth_provider_definitions", None)
    if extender is not None:
        if not callable(extender):
            raise RuntimeError("extend_external_oauth_provider_definitions must be callable")
        extension_result = extender(dict(merged))
        merged = _merge_provider_definitions(merged, extension_result)

    return merged


def _to_provider_app_config(
    provider_name: str,
    value: Any,
    provider_registry: Mapping[str, ExternalOAuthProviderDefinition],
) -> ExternalOAuthProviderAppConfig:
    if provider_name not in provider_registry:
        raise RuntimeError(f"External OAuth provider '{provider_name}' is not registered")

    if isinstance(value, ExternalOAuthProviderAppConfig):
        if value.provider != provider_name:
            raise RuntimeError(f"External OAuth app config provider mismatch for '{provider_name}'")
        if not value.required_scopes:
            raise RuntimeError(f"External OAuth provider '{provider_name}' must declare at least one required scope")
        return value

    if not isinstance(value, Mapping):
        raise RuntimeError(f"External OAuth app config for '{provider_name}' must be a mapping")

    client_id = str(value.get("client_id", "")).strip()
    client_secret = str(value.get("client_secret", "")).strip()
    redirect_uri = str(value.get("redirect_uri", "")).strip() or None

    required_scopes_raw = value.get("required_scopes", ())
    optional_scopes_raw = value.get("optional_scopes", ())
    if not isinstance(required_scopes_raw, (list, tuple, set)):
        raise RuntimeError(f"required_scopes for '{provider_name}' must be a list/tuple/set")
    if not isinstance(optional_scopes_raw, (list, tuple, set)):
        raise RuntimeError(f"optional_scopes for '{provider_name}' must be a list/tuple/set")

    required_scopes = tuple(str(item).strip() for item in required_scopes_raw if str(item).strip())
    optional_scopes = tuple(str(item).strip() for item in optional_scopes_raw if str(item).strip())
    if not required_scopes:
        raise RuntimeError(f"External OAuth provider '{provider_name}' must declare at least one required scope")
    if not client_id or not client_secret:
        raise RuntimeError(f"External OAuth provider '{provider_name}' must set client_id and client_secret")

    extra_value = value.get("extra")
    extra = dict(extra_value) if isinstance(extra_value, Mapping) else None

    return ExternalOAuthProviderAppConfig(
        provider=provider_name,
        client_id=client_id,
        client_secret=client_secret,
        required_scopes=required_scopes,
        optional_scopes=optional_scopes,
        redirect_uri=redirect_uri,
        extra=extra,
    )


def get_enabled_external_oauth_provider_configs() -> dict[str, ExternalOAuthProviderAppConfig]:
    provider_registry = get_external_oauth_provider_registry()

    try:
        module = import_module("app.extensions.auth.external_oauth_providers")
    except ModuleNotFoundError:
        return {}

    configured_raw = getattr(module, "ENABLED_EXTERNAL_OAUTH_PROVIDER_CONFIGS", None) or {}
    if not isinstance(configured_raw, Mapping):
        raise RuntimeError("ENABLED_EXTERNAL_OAUTH_PROVIDER_CONFIGS must be a mapping")

    configured: dict[str, ExternalOAuthProviderAppConfig] = {}
    for provider_name, value in configured_raw.items():
        normalized = str(provider_name).strip().lower()
        if not normalized:
            raise RuntimeError("Enabled external OAuth provider names must be non-empty")
        configured[normalized] = _to_provider_app_config(normalized, value, provider_registry)

    extender = getattr(module, "extend_enabled_external_oauth_provider_configs", None)
    if extender is not None:
        if not callable(extender):
            raise RuntimeError("extend_enabled_external_oauth_provider_configs must be callable")
        extension_value = extender(dict(configured), dict(provider_registry))
        if extension_value:
            if not isinstance(extension_value, Mapping):
                raise RuntimeError("extend_enabled_external_oauth_provider_configs must return a mapping")
            for provider_name, value in extension_value.items():
                normalized = str(provider_name).strip().lower()
                if not normalized:
                    raise RuntimeError("Enabled external OAuth provider names must be non-empty")
                configured[normalized] = _to_provider_app_config(normalized, value, provider_registry)

    return configured


def get_enabled_external_oauth_provider_ids() -> list[str]:
    return sorted(get_enabled_external_oauth_provider_configs().keys())


def _resolve_link_state_secret(settings: Settings) -> str:
    return settings.jwt_access_token_secret or DEV_ACCESS_SECRET


def create_external_oauth_link_state(*, settings: Settings, user_id: str, provider: str, scopes: list[str], redirect_uri: str) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "type": "external_oauth_link_state",
        "sub": user_id,
        "provider": provider,
        "scopes": sorted(set(scopes)),
        "redirect_uri": redirect_uri,
        "iat": now,
        "exp": now + timedelta(seconds=EXTERNAL_OAUTH_LINK_STATE_TTL_SECONDS),
    }
    return jwt.encode(payload, _resolve_link_state_secret(settings), algorithm="HS256")


def decode_external_oauth_link_state(state_token: str, settings: Settings) -> dict[str, Any]:
    try:
        payload = jwt.decode(state_token, _resolve_link_state_secret(settings), algorithms=["HS256"])
    except jwt.ExpiredSignatureError as exc:
        raise ApiError(status_code=400, code="EXTERNAL_OAUTH_STATE_EXPIRED", message="External OAuth state has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise ApiError(status_code=400, code="EXTERNAL_OAUTH_STATE_INVALID", message="External OAuth state is invalid") from exc

    if payload.get("type") != "external_oauth_link_state":
        raise ApiError(status_code=400, code="EXTERNAL_OAUTH_STATE_INVALID", message="External OAuth state is invalid")

    return payload


def resolve_external_oauth_provider_config(provider: str) -> tuple[ExternalOAuthProviderDefinition, ExternalOAuthProviderAppConfig]:
    normalized = provider.strip().lower()
    provider_registry = get_external_oauth_provider_registry()
    enabled_configs = get_enabled_external_oauth_provider_configs()
    definition = provider_registry.get(normalized)
    config = enabled_configs.get(normalized)
    if definition is None or config is None:
        raise ApiError(status_code=404, code="EXTERNAL_PROVIDER_DISABLED", message=f"External provider '{normalized}' is not enabled")
    return definition, config


def resolve_requested_external_scopes(
    *,
    provider_config: ExternalOAuthProviderAppConfig,
    user_requested_scopes: list[str] | None,
) -> list[str]:
    required = {scope.strip() for scope in provider_config.required_scopes if scope and scope.strip()}
    optional = {scope.strip() for scope in provider_config.optional_scopes if scope and scope.strip()}
    requested = {scope.strip() for scope in (user_requested_scopes or []) if scope and scope.strip()}

    if not requested:
        return sorted(required)

    allowed = required.union(optional)
    disallowed = sorted(scope for scope in requested if scope not in allowed)
    if disallowed:
        raise ApiError(
            status_code=400,
            code="EXTERNAL_SCOPE_INVALID",
            message=f"Requested scope(s) are not allowed for provider: {', '.join(disallowed)}",
        )

    return sorted(required.union(requested))


def build_external_oauth_authorize_url(
    *,
    provider_definition: ExternalOAuthProviderDefinition,
    provider_config: ExternalOAuthProviderAppConfig,
    redirect_uri: str,
    scopes: list[str],
    state_token: str,
) -> str:
    params = {
        "response_type": "code",
        "client_id": provider_config.client_id,
        "redirect_uri": redirect_uri,
        "scope": " ".join(scopes),
        "state": state_token,
    }
    return f"{provider_definition.authorize_url}?{urlencode(params)}"


def _parse_token_response(payload: dict[str, Any], fallback_scopes: list[str]) -> ExternalOAuthTokenResult:
    access_token = str(payload.get("access_token") or "").strip()
    if not access_token:
        raise ApiError(status_code=502, code="EXTERNAL_TOKEN_EXCHANGE_FAILED", message="External token exchange did not return access_token")

    refresh_token = str(payload.get("refresh_token") or "").strip() or None

    scopes_value = payload.get("scope")
    scopes: set[str] = set()
    if isinstance(scopes_value, str):
        scopes = {item.strip() for item in scopes_value.replace(",", " ").split(" ") if item.strip()}
    elif isinstance(scopes_value, (list, tuple, set)):
        scopes = {str(item).strip() for item in scopes_value if str(item).strip()}

    if not scopes:
        scopes = {scope.strip() for scope in fallback_scopes if scope and scope.strip()}

    expires_in_raw = payload.get("expires_in")
    expires_in: int | None = None
    if isinstance(expires_in_raw, (int, float)):
        expires_in = int(expires_in_raw)
    elif isinstance(expires_in_raw, str) and expires_in_raw.strip().isdigit():
        expires_in = int(expires_in_raw.strip())

    return ExternalOAuthTokenResult(
        access_token=access_token,
        refresh_token=refresh_token,
        scopes=tuple(sorted(scopes)),
        expires_in_seconds=expires_in,
        raw_payload=payload,
    )


def exchange_external_oauth_code(
    *,
    provider_definition: ExternalOAuthProviderDefinition,
    provider_config: ExternalOAuthProviderAppConfig,
    code: str,
    redirect_uri: str,
    requested_scopes: list[str],
) -> ExternalOAuthTokenResult:
    body = urlencode(
        {
            "grant_type": "authorization_code",
            "client_id": provider_config.client_id,
            "client_secret": provider_config.client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
        }
    ).encode("utf-8")
    request = Request(
        provider_definition.token_url,
        data=body,
        headers={"Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=15) as response:
            response_payload = response.read().decode("utf-8")
    except Exception as exc:
        raise ApiError(status_code=502, code="EXTERNAL_TOKEN_EXCHANGE_FAILED", message="External token exchange failed") from exc

    try:
        import json

        payload = json.loads(response_payload)
    except Exception as exc:
        raise ApiError(status_code=502, code="EXTERNAL_TOKEN_EXCHANGE_FAILED", message="External token response is invalid") from exc

    if not isinstance(payload, dict):
        raise ApiError(status_code=502, code="EXTERNAL_TOKEN_EXCHANGE_FAILED", message="External token response is invalid")

    return _parse_token_response(payload, fallback_scopes=requested_scopes)


def fetch_external_oauth_subject_and_metadata(
    *,
    provider_definition: ExternalOAuthProviderDefinition,
    access_token: str,
) -> tuple[str, dict[str, Any]]:
    request = Request(
        provider_definition.userinfo_url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        },
        method="GET",
    )

    try:
        with urlopen(request, timeout=15) as response:
            response_payload = response.read().decode("utf-8")
    except Exception as exc:
        raise ApiError(status_code=502, code="EXTERNAL_USERINFO_FETCH_FAILED", message="Unable to fetch external account profile") from exc

    try:
        import json

        payload = json.loads(response_payload)
    except Exception as exc:
        raise ApiError(status_code=502, code="EXTERNAL_USERINFO_FETCH_FAILED", message="External account profile response is invalid") from exc

    if not isinstance(payload, dict):
        raise ApiError(status_code=502, code="EXTERNAL_USERINFO_FETCH_FAILED", message="External account profile response is invalid")

    subject = payload.get("id") or payload.get("sub") or payload.get("orcid") or payload.get("login")
    subject_text = str(subject).strip() if subject is not None else ""
    if not subject_text:
        raise ApiError(status_code=502, code="EXTERNAL_USERINFO_FETCH_FAILED", message="External account subject is missing")

    metadata: dict[str, Any] = {}
    for key in ("login", "name", "email", "avatar_url", "profile", "orcid"):
        value = payload.get(key)
        if value is not None:
            metadata[key] = value

    return subject_text, metadata
