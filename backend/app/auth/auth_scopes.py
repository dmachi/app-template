from __future__ import annotations

from dataclasses import dataclass
from importlib import import_module
from typing import Any, Mapping

from app.auth.oauth_security import normalize_scope


@dataclass(frozen=True)
class AuthScopeDefinition:
    name: str
    description: str
    userinfo_claims: tuple[str, ...] = ()


BASE_AUTH_SCOPES: dict[str, AuthScopeDefinition] = {
    "openid": AuthScopeDefinition(name="openid", description="Authenticate the user via OpenID Connect"),
    "profile": AuthScopeDefinition(
        name="profile",
        description="Access profile claims",
        userinfo_claims=("name", "preferred_username"),
    ),
    "email": AuthScopeDefinition(
        name="email",
        description="Access email claims",
        userinfo_claims=("email", "email_verified"),
    ),
    "offline_access": AuthScopeDefinition(name="offline_access", description="Request refresh token issuance"),
}


def _to_definition(name: str, value: Any) -> AuthScopeDefinition:
    if isinstance(value, AuthScopeDefinition):
        if value.name != name:
            raise RuntimeError(f"Auth scope definition name mismatch for '{name}'")
        return value

    if not isinstance(value, Mapping):
        raise RuntimeError(f"Auth scope definition for '{name}' must be an AuthScopeDefinition or mapping")

    description = str(value.get("description", "")).strip()
    userinfo_claims_raw = value.get("userinfo_claims", ())
    if not isinstance(userinfo_claims_raw, (list, tuple, set)):
        raise RuntimeError(f"userinfo_claims for '{name}' must be a list/tuple/set")
    userinfo_claims = tuple(str(item).strip() for item in userinfo_claims_raw if str(item).strip())
    return AuthScopeDefinition(name=name, description=description, userinfo_claims=userinfo_claims)


def _merge_additive(
    base_scopes: Mapping[str, AuthScopeDefinition],
    extension_scopes: Mapping[str, Any] | None,
) -> dict[str, AuthScopeDefinition]:
    merged = dict(base_scopes)
    if not extension_scopes:
        return merged

    for name, value in extension_scopes.items():
        normalized_name = str(name).strip()
        if not normalized_name:
            raise RuntimeError("Auth scope names must be non-empty")
        if normalized_name in merged:
            raise RuntimeError(f"Auth scope '{normalized_name}' is already defined and cannot be overridden")
        merged[normalized_name] = _to_definition(normalized_name, value)
    return merged


def get_auth_scope_registry() -> dict[str, AuthScopeDefinition]:
    merged = dict(BASE_AUTH_SCOPES)

    try:
        module = import_module("app.extensions.auth.auth_scopes")
    except ModuleNotFoundError:
        return merged

    extension_scopes = getattr(module, "AUTH_SCOPE_DEFINITIONS", None)
    merged = _merge_additive(merged, extension_scopes)

    extender = getattr(module, "extend_auth_scopes", None)
    if extender is not None:
        if not callable(extender):
            raise RuntimeError("extend_auth_scopes must be callable")
        extension_result = extender(dict(merged))
        merged = _merge_additive(merged, extension_result)

    return merged


def get_supported_auth_scopes() -> list[str]:
    return sorted(get_auth_scope_registry().keys())


def validate_auth_scopes(scopes: list[str]) -> list[str]:
    supported = set(get_supported_auth_scopes())
    unknown = sorted(set(scopes) - supported)
    if unknown:
        raise ValueError(f"Unsupported auth scope(s): {', '.join(unknown)}")
    return sorted(set(scopes))


def resolve_default_auth_scopes(default_scopes: list[str]) -> list[str]:
    return validate_auth_scopes(default_scopes)


def get_token_scopes(payload: Mapping[str, Any]) -> set[str]:
    if payload.get("token_use") != "access":
        return set()
    raw_scope = payload.get("scope")
    if not isinstance(raw_scope, str) or not raw_scope.strip():
        return set()
    return set(normalize_scope(raw_scope))


def get_userinfo_claims_for_scopes(scopes: set[str]) -> set[str]:
    registry = get_auth_scope_registry()
    claims: set[str] = set()
    for scope in scopes:
        definition = registry.get(scope)
        if definition is None:
            continue
        claims.update(definition.userinfo_claims)
    return claims