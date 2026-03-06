from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field

from app.auth.dependencies import get_current_user, require_auth_scopes
from app.auth.auth_scopes import get_auth_scope_registry, validate_auth_scopes
from app.auth.external_oauth import (
    build_external_oauth_authorize_url,
    create_external_oauth_link_state,
    decode_external_oauth_link_state,
    exchange_external_oauth_code,
    fetch_external_oauth_subject_and_metadata,
    get_enabled_external_oauth_provider_configs,
    get_external_oauth_provider_registry,
    resolve_external_oauth_provider_config,
    resolve_requested_external_scopes,
)
from app.auth.security import encrypt_external_account_token, encrypt_personal_access_token, generate_personal_access_token
from app.auth.store import UserRecord
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.notifications.email import MailDeliveryError
from app.notifications.verification import send_email_verification
from app.profile.catalog import sanitize_profile_properties, serialize_profile_property_catalog, validate_profile_properties

router = APIRouter(prefix="/users", tags=["users"])


class UserProfilePatchRequest(BaseModel):
    displayName: str | None = Field(default=None, min_length=1)
    email: EmailStr | None = None
    preferences: dict[str, Any] | None = None
    profileProperties: dict[str, Any] | None = None


class ConnectedAppItemResponse(BaseModel):
    clientId: str
    name: str
    scopes: list[str]
    connectedAt: datetime
    updatedAt: datetime


class ConnectedAppsListResponse(BaseModel):
    items: list[ConnectedAppItemResponse]


class AuthScopeItemResponse(BaseModel):
    name: str
    description: str


class AccessTokenItemResponse(BaseModel):
    id: str
    name: str
    scopes: list[str]
    createdAt: datetime
    expiresAt: datetime | None
    lastUsedAt: datetime | None


class AccessTokensListResponse(BaseModel):
    items: list[AccessTokenItemResponse]


class AccessTokenCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    scopes: list[str] = Field(default_factory=list)
    expiresAt: datetime | None = None


class AccessTokenCreateResponse(BaseModel):
    id: str
    name: str
    scopes: list[str]
    createdAt: datetime
    expiresAt: datetime | None
    token: str


class ExternalOAuthProviderItemResponse(BaseModel):
    provider: str
    displayName: str
    requiredScopes: list[str]
    optionalScopes: list[str]


class ExternalOAuthProviderListResponse(BaseModel):
    items: list[ExternalOAuthProviderItemResponse]


class LinkedExternalAccountItemResponse(BaseModel):
    provider: str
    externalSubject: str
    scopes: list[str]
    metadata: dict[str, Any]
    createdAt: datetime
    updatedAt: datetime
    lastUsedAt: datetime | None


class LinkedExternalAccountListResponse(BaseModel):
    items: list[LinkedExternalAccountItemResponse]


class LinkedExternalAccountStartRequest(BaseModel):
    scopes: list[str] = Field(default_factory=list)
    redirectUri: str | None = None


class LinkedExternalAccountStartResponse(BaseModel):
    provider: str
    authorizationUrl: str
    state: str
    scopes: list[str]
    redirectUri: str


class LinkedExternalAccountCompleteRequest(BaseModel):
    code: str = Field(min_length=1)
    state: str = Field(min_length=1)


class LinkedExternalAccountCompleteResponse(BaseModel):
    provider: str
    externalSubject: str
    scopes: list[str]
    linked: bool


def _profile_properties_from_preferences(preferences: Any) -> dict[str, Any]:
    if not isinstance(preferences, dict):
        return {}
    raw = preferences.get("profileProperties")
    return raw if isinstance(raw, dict) else {}


def _migrate_legacy_organization_preferences(auth_store, user: UserRecord) -> UserRecord:
    if not isinstance(user.preferences, dict):
        return user

    if "organization" not in user.preferences:
        return user

    preferences = dict(user.preferences)
    legacy_organization = preferences.pop("organization", None)
    profile_properties = _profile_properties_from_preferences(preferences)

    if isinstance(legacy_organization, str):
        normalized = legacy_organization.strip()
        existing = profile_properties.get("organization")
        existing_text = existing.strip() if isinstance(existing, str) else ""
        if normalized and not existing_text:
            profile_properties["organization"] = normalized

    preferences["profileProperties"] = profile_properties

    updated = auth_store.update_user_profile(
        user_id=user.id,
        preferences=preferences,
    )
    return updated or user


def _serialize_basic_user(user: UserRecord) -> dict:
    return {
        "id": user.id,
        "displayName": user.display_name,
    }


def _serialize_role_sources(request: Request, user: UserRecord) -> dict:
    auth_store = request.app.state.auth_store

    direct_roles = sorted(set(user.roles))
    inherited_role_groups: dict[str, set[str]] = {}

    for group in auth_store.list_groups():
        if not auth_store.is_group_member(group.id, user.id):
            continue
        for role_name in group.roles:
            inherited_role_groups.setdefault(role_name, set()).add(group.name)

    inherited_roles = [
        {
            "name": role_name,
            "groups": sorted(group_names),
        }
        for role_name, group_names in sorted(inherited_role_groups.items())
        if role_name not in direct_roles
    ]

    effective_roles = sorted(set(direct_roles).union(inherited_role_groups.keys()))

    return {
        "direct": direct_roles,
        "inherited": inherited_roles,
        "effective": effective_roles,
    }


@router.get("/search")
def search_users(
    query: str,
    request: Request,
    limit: int = 10,
    _: UserRecord = Depends(require_auth_scopes({"profile"})),
) -> dict:
    auth_store = request.app.state.auth_store
    users = auth_store.search_users(query=query, limit=max(1, min(limit, 25)))
    return {
        "items": [
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "displayName": user.display_name,
            }
            for user in users
        ]
    }


@router.get("/me")
def get_me(
    request: Request,
    current_user: UserRecord = Depends(require_auth_scopes({"profile"})),
    settings: Settings = Depends(get_settings),
) -> dict:
    auth_store = request.app.state.auth_store
    current_user = _migrate_legacy_organization_preferences(auth_store, current_user)
    profile_properties_config = settings.profile_properties_config
    role_sources = _serialize_role_sources(request, current_user)
    profile_properties = sanitize_profile_properties(
        _profile_properties_from_preferences(current_user.preferences),
        profile_properties_config,
    )
    profile_property_catalog = serialize_profile_property_catalog(profile_properties_config)
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "displayName": current_user.display_name,
        "status": current_user.status,
        "emailVerified": current_user.email_verified,
        "roles": role_sources["effective"],
        "roleSources": {
            "direct": role_sources["direct"],
            "inherited": role_sources["inherited"],
        },
        "preferences": current_user.preferences,
        "profileProperties": profile_properties,
        "profilePropertyCatalog": profile_property_catalog,
    }


@router.patch("/me")
def patch_me(
    payload: UserProfilePatchRequest,
    request: Request,
    current_user: UserRecord = Depends(require_auth_scopes({"profile"})),
    settings: Settings = Depends(get_settings),
) -> dict:
    auth_store = request.app.state.auth_store
    email_before = current_user.email
    profile_properties_config = settings.profile_properties_config

    resolved_preferences: dict[str, Any] | None = None
    if payload.preferences is not None or payload.profileProperties is not None:
        existing_preferences = current_user.preferences if isinstance(current_user.preferences, dict) else {}
        resolved_preferences = dict(existing_preferences)
        if payload.preferences is not None:
            resolved_preferences = dict(payload.preferences)

        if payload.profileProperties is not None:
            try:
                existing_profile_properties = _profile_properties_from_preferences(resolved_preferences)
                candidate_profile_properties = {
                    **existing_profile_properties,
                    **payload.profileProperties,
                }
                resolved_profile_properties = validate_profile_properties(
                    candidate_profile_properties,
                    profile_properties_config,
                )
            except ValueError as exc:
                parts = str(exc).split(":", 2)
                code = parts[0] if parts and parts[0] else "PROFILE_PROPERTY_INVALID"
                message = parts[2] if len(parts) > 2 else "Invalid profile property payload"
                details = {"property": parts[1]} if len(parts) > 1 and parts[1] else None
                raise ApiError(status_code=400, code=code, message=message, details=details) from exc

            resolved_preferences["profileProperties"] = resolved_profile_properties

    try:
        updated = auth_store.update_user_profile(
            user_id=current_user.id,
            display_name=payload.displayName,
            email=payload.email,
            preferences=resolved_preferences,
        )
    except ValueError as exc:
        if str(exc) == "EMAIL_ALREADY_EXISTS":
            raise ApiError(status_code=409, code="EMAIL_ALREADY_EXISTS", message="Email already exists") from exc
        raise ApiError(status_code=400, code="PROFILE_UPDATE_FAILED", message="Unable to update profile") from exc
    if updated is None:
        raise ApiError(status_code=404, code="USER_NOT_FOUND", message="Current user not found")
    if updated.email != email_before:
        try:
            send_email_verification(
                mail_sender=request.app.state.mail_sender,
                settings=settings,
                user_id=updated.id,
                email=updated.email,
                display_name=updated.display_name,
            )
        except MailDeliveryError as exc:
            raise ApiError(status_code=500, code="EMAIL_DELIVERY_FAILED", message="Unable to send verification email") from exc

    profile_properties = sanitize_profile_properties(
        _profile_properties_from_preferences(updated.preferences),
        profile_properties_config,
    )
    profile_property_catalog = serialize_profile_property_catalog(profile_properties_config)

    return {
        "id": updated.id,
        "username": updated.username,
        "email": updated.email,
        "displayName": updated.display_name,
        "status": updated.status,
        "emailVerified": updated.email_verified,
        "roles": updated.roles,
        "preferences": updated.preferences,
        "profileProperties": profile_properties,
        "profilePropertyCatalog": profile_property_catalog,
    }


@router.post("/me/resend-verification")
def resend_my_email_verification(
    request: Request,
    current_user: UserRecord = Depends(require_auth_scopes({"profile"})),
    settings: Settings = Depends(get_settings),
) -> dict:
    if current_user.email_verified:
        return {
            "success": True,
            "sent": False,
            "message": "Email is already verified",
        }

    try:
        send_email_verification(
            mail_sender=request.app.state.mail_sender,
            settings=settings,
            user_id=current_user.id,
            email=current_user.email,
            display_name=current_user.display_name,
        )
    except MailDeliveryError as exc:
        raise ApiError(status_code=500, code="EMAIL_DELIVERY_FAILED", message="Unable to send verification email") from exc

    return {
        "success": True,
        "sent": True,
        "message": "Verification email sent",
    }


@router.get("/me/connected-apps")
def list_my_connected_apps(
    request: Request,
    current_user: UserRecord = Depends(require_auth_scopes({"profile"})),
) -> ConnectedAppsListResponse:
    auth_store = request.app.state.auth_store
    connected = auth_store.list_oauth_connected_apps_for_user(current_user.id)
    return ConnectedAppsListResponse(
        items=[
            ConnectedAppItemResponse(
                clientId=client.client_id,
                name=client.name,
                scopes=consent.scopes,
                connectedAt=consent.created_at,
                updatedAt=consent.updated_at,
            )
            for consent, client in connected
        ]
    )


@router.get("/me/external-account-providers")
def list_external_account_providers(
    _: UserRecord = Depends(require_auth_scopes({"profile"})),
) -> ExternalOAuthProviderListResponse:
    provider_registry = get_external_oauth_provider_registry()
    enabled_configs = get_enabled_external_oauth_provider_configs()
    items: list[ExternalOAuthProviderItemResponse] = []
    for provider_id, config in sorted(enabled_configs.items(), key=lambda item: item[0]):
        definition = provider_registry.get(provider_id)
        if definition is None:
            continue
        items.append(
            ExternalOAuthProviderItemResponse(
                provider=provider_id,
                displayName=definition.display_name,
                requiredScopes=list(config.required_scopes),
                optionalScopes=list(config.optional_scopes),
            )
        )
    return ExternalOAuthProviderListResponse(items=items)


@router.get("/me/linked-accounts")
def list_my_linked_external_accounts(
    request: Request,
    current_user: UserRecord = Depends(require_auth_scopes({"profile"})),
) -> LinkedExternalAccountListResponse:
    auth_store = request.app.state.auth_store
    linkages = auth_store.list_external_account_linkages(current_user.id)
    active_items = [item for item in linkages if item.revoked_at is None]
    return LinkedExternalAccountListResponse(
        items=[
            LinkedExternalAccountItemResponse(
                provider=item.provider,
                externalSubject=item.external_subject,
                scopes=item.scopes,
                metadata=item.metadata,
                createdAt=item.created_at,
                updatedAt=item.updated_at,
                lastUsedAt=item.last_used_at,
            )
            for item in active_items
        ]
    )


@router.post("/me/linked-accounts/{provider}/start")
def start_link_my_external_account(
    provider: str,
    payload: LinkedExternalAccountStartRequest,
    current_user: UserRecord = Depends(require_auth_scopes({"profile"})),
    settings: Settings = Depends(get_settings),
) -> LinkedExternalAccountStartResponse:
    provider_definition, provider_config = resolve_external_oauth_provider_config(provider)
    requested_scopes = resolve_requested_external_scopes(
        provider_config=provider_config,
        user_requested_scopes=payload.scopes,
    )

    redirect_uri = payload.redirectUri or provider_config.redirect_uri
    if not redirect_uri:
        raise ApiError(status_code=400, code="EXTERNAL_REDIRECT_URI_REQUIRED", message="redirectUri is required for external account linking")

    state = create_external_oauth_link_state(
        settings=settings,
        user_id=current_user.id,
        provider=provider_definition.name,
        scopes=requested_scopes,
        redirect_uri=redirect_uri,
    )
    authorization_url = build_external_oauth_authorize_url(
        provider_definition=provider_definition,
        provider_config=provider_config,
        redirect_uri=redirect_uri,
        scopes=requested_scopes,
        state_token=state,
    )
    return LinkedExternalAccountStartResponse(
        provider=provider_definition.name,
        authorizationUrl=authorization_url,
        state=state,
        scopes=requested_scopes,
        redirectUri=redirect_uri,
    )


@router.post("/me/linked-accounts/{provider}/complete")
def complete_link_my_external_account(
    provider: str,
    payload: LinkedExternalAccountCompleteRequest,
    request: Request,
    current_user: UserRecord = Depends(require_auth_scopes({"profile"})),
    settings: Settings = Depends(get_settings),
) -> LinkedExternalAccountCompleteResponse:
    provider_definition, provider_config = resolve_external_oauth_provider_config(provider)
    state_payload = decode_external_oauth_link_state(payload.state, settings)

    state_user_id = str(state_payload.get("sub") or "").strip()
    state_provider = str(state_payload.get("provider") or "").strip().lower()
    state_scopes_raw = state_payload.get("scopes")
    state_redirect_uri = str(state_payload.get("redirect_uri") or "").strip()

    if state_user_id != current_user.id or state_provider != provider_definition.name:
        raise ApiError(status_code=400, code="EXTERNAL_OAUTH_STATE_INVALID", message="External OAuth state does not match current user/provider")
    if not state_redirect_uri:
        raise ApiError(status_code=400, code="EXTERNAL_OAUTH_STATE_INVALID", message="External OAuth state is missing redirect_uri")
    if not isinstance(state_scopes_raw, list):
        raise ApiError(status_code=400, code="EXTERNAL_OAUTH_STATE_INVALID", message="External OAuth state is missing scopes")

    requested_scopes = [str(item).strip() for item in state_scopes_raw if str(item).strip()]
    requested_scopes = resolve_requested_external_scopes(
        provider_config=provider_config,
        user_requested_scopes=requested_scopes,
    )

    token_result = exchange_external_oauth_code(
        provider_definition=provider_definition,
        provider_config=provider_config,
        code=payload.code,
        redirect_uri=state_redirect_uri,
        requested_scopes=requested_scopes,
    )

    external_subject, metadata = fetch_external_oauth_subject_and_metadata(
        provider_definition=provider_definition,
        access_token=token_result.access_token,
    )

    auth_store = request.app.state.auth_store
    access_token_expires_at = None
    if token_result.expires_in_seconds is not None and token_result.expires_in_seconds > 0:
        access_token_expires_at = datetime.now(UTC) + timedelta(seconds=token_result.expires_in_seconds)

    encrypted_access_token = encrypt_external_account_token(token_result.access_token, settings)
    encrypted_refresh_token = (
        encrypt_external_account_token(token_result.refresh_token, settings)
        if token_result.refresh_token
        else None
    )

    merged_metadata = {
        "provider": provider_definition.name,
        "profile": metadata,
    }
    try:
        auth_store.upsert_external_account_linkage(
            user_id=current_user.id,
            provider=provider_definition.name,
            external_subject=external_subject,
            scopes=list(token_result.scopes),
            access_token_encrypted=encrypted_access_token,
            refresh_token_encrypted=encrypted_refresh_token,
            access_token_expires_at=access_token_expires_at,
            metadata=merged_metadata,
        )
    except ValueError as exc:
        if str(exc) == "EXTERNAL_ACCOUNT_ALREADY_LINKED":
            raise ApiError(status_code=409, code="EXTERNAL_ACCOUNT_ALREADY_LINKED", message="External account is already linked to another user") from exc
        raise ApiError(status_code=400, code="EXTERNAL_ACCOUNT_LINK_FAILED", message="Unable to link external account") from exc

    return LinkedExternalAccountCompleteResponse(
        provider=provider_definition.name,
        externalSubject=external_subject,
        scopes=list(token_result.scopes),
        linked=True,
    )


@router.delete("/me/linked-accounts/{provider}")
def unlink_my_external_account(
    provider: str,
    request: Request,
    current_user: UserRecord = Depends(require_auth_scopes({"profile"})),
) -> dict[str, bool]:
    auth_store = request.app.state.auth_store
    removed = auth_store.remove_external_account_linkage(current_user.id, provider)
    return {
        "success": True,
        "unlinked": removed,
    }


@router.get("/me/access-token-scopes")
def list_access_token_scopes(
    settings: Settings = Depends(get_settings),
    _: UserRecord = Depends(require_auth_scopes({"profile"})),
) -> dict[str, list[AuthScopeItemResponse]]:
    if not settings.personal_access_tokens_enabled:
        raise ApiError(status_code=404, code="ACCESS_TOKENS_DISABLED", message="Access tokens are disabled")

    registry = get_auth_scope_registry()
    items = [AuthScopeItemResponse(name=scope.name, description=scope.description) for scope in sorted(registry.values(), key=lambda item: item.name)]
    return {"items": items}


@router.get("/me/access-tokens")
def list_my_access_tokens(
    request: Request,
    current_user: UserRecord = Depends(require_auth_scopes({"profile"})),
    settings: Settings = Depends(get_settings),
) -> AccessTokensListResponse:
    if not settings.personal_access_tokens_enabled:
        raise ApiError(status_code=404, code="ACCESS_TOKENS_DISABLED", message="Access tokens are disabled")

    auth_store = request.app.state.auth_store
    records = auth_store.list_active_personal_access_tokens_for_user(current_user.id)
    return AccessTokensListResponse(
        items=[
            AccessTokenItemResponse(
                id=record.id,
                name=record.name,
                scopes=record.scopes,
                createdAt=record.created_at,
                expiresAt=record.expires_at,
                lastUsedAt=record.last_used_at,
            )
            for record in records
        ]
    )


@router.post("/me/access-tokens")
def create_my_access_token(
    payload: AccessTokenCreateRequest,
    request: Request,
    current_user: UserRecord = Depends(require_auth_scopes({"profile"})),
    settings: Settings = Depends(get_settings),
) -> AccessTokenCreateResponse:
    if not settings.personal_access_tokens_enabled:
        raise ApiError(status_code=404, code="ACCESS_TOKENS_DISABLED", message="Access tokens are disabled")

    now = datetime.now(UTC)
    if payload.expiresAt is not None and payload.expiresAt <= now:
        raise ApiError(status_code=400, code="INVALID_EXPIRATION", message="expiresAt must be in the future")

    scopes_input = payload.scopes or settings.oauth_scope_list
    try:
        scopes = validate_auth_scopes(scopes_input)
    except ValueError as exc:
        raise ApiError(status_code=400, code="INVALID_SCOPE", message=str(exc)) from exc

    token = generate_personal_access_token()
    token_encrypted = encrypt_personal_access_token(token, settings)

    auth_store = request.app.state.auth_store
    record = auth_store.create_personal_access_token(
        user_id=current_user.id,
        name=payload.name,
        token=token,
        token_encrypted=token_encrypted,
        scopes=scopes,
        expires_at=payload.expiresAt,
    )
    return AccessTokenCreateResponse(
        id=record.id,
        name=record.name,
        scopes=record.scopes,
        createdAt=record.created_at,
        expiresAt=record.expires_at,
        token=token,
    )


@router.delete("/me/access-tokens/{token_id}")
def revoke_my_access_token(
    token_id: str,
    request: Request,
    current_user: UserRecord = Depends(require_auth_scopes({"profile"})),
    settings: Settings = Depends(get_settings),
) -> dict[str, bool]:
    if not settings.personal_access_tokens_enabled:
        raise ApiError(status_code=404, code="ACCESS_TOKENS_DISABLED", message="Access tokens are disabled")

    auth_store = request.app.state.auth_store
    revoked = auth_store.revoke_personal_access_token(user_id=current_user.id, token_id=token_id)
    return {
        "success": True,
        "revoked": revoked,
    }


@router.delete("/me/connected-apps/{client_id}")
def revoke_my_connected_app(
    client_id: str,
    request: Request,
    current_user: UserRecord = Depends(require_auth_scopes({"profile"})),
) -> dict:
    auth_store = request.app.state.auth_store
    revoked = auth_store.revoke_oauth_connected_app_for_user(user_id=current_user.id, client_id=client_id)
    return {
        "success": True,
        "revoked": revoked,
    }


@router.get("/{user_id}")
def get_user_basic(user_id: str, request: Request, _: UserRecord = Depends(require_auth_scopes({"profile"}))) -> dict:
    auth_store = request.app.state.auth_store
    user = auth_store.get_user(user_id)
    if user is None:
        raise ApiError(status_code=404, code="USER_NOT_FOUND", message="User not found")
    return _serialize_basic_user(user)
