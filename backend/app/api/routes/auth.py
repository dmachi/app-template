from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field
import jwt

from app.auth.dependencies import get_current_user, require_user_management_role
from app.auth.roles import (
    ADMIN_GROUP_ROLES,
    ADMIN_USER_ROLES,
    INVITE_USER_ROLES,
    ROLE_CONTENT_ADMIN,
    ROLE_CONTENT_EDITOR_LEGACY,
    ROLE_SUPERUSER,
    has_any_role,
    resolve_effective_roles,
)
from app.auth.external_providers import get_external_provider_adapter
from app.auth.providers import get_enabled_providers
from app.auth.security import decode_email_verification_token, generate_access_token
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.notifications.email import MailDeliveryError
from app.notifications.verification import send_email_verification
from app.profile.catalog import serialize_profile_property_catalog, validate_profile_properties, validate_required_profile_properties

router = APIRouter(prefix="/auth", tags=["auth"])
meta_router = APIRouter(prefix="/meta", tags=["meta"])


class LoginRequest(BaseModel):
    usernameOrEmail: str = Field(min_length=1)
    password: str = Field(min_length=1)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3)
    email: EmailStr
    password: str = Field(min_length=8)
    displayName: str | None = None
    profileProperties: dict[str, object] | None = None


class RefreshRequest(BaseModel):
    refreshToken: str = Field(min_length=1)


class LogoutRequest(BaseModel):
    refreshToken: str = Field(min_length=1)


class InvitationAcceptRequest(BaseModel):
    token: str = Field(min_length=1)


def _issue_auth_tokens(user, settings: Settings, auth_store):
    access_token, access_ttl = generate_access_token(user.id, user.roles, settings)
    refresh_token, refresh_ttl = auth_store.create_refresh_session(user.id, settings)
    return {
        "accessToken": access_token,
        "accessTokenExpiresIn": access_ttl,
        "refreshToken": refresh_token,
        "refreshTokenExpiresIn": refresh_ttl,
    }


@meta_router.get("/auth-providers")
def auth_providers(settings: Settings = Depends(get_settings)) -> dict:
    providers = get_enabled_providers(settings)
    profile_property_catalog = serialize_profile_property_catalog(settings.profile_properties_config)
    return {
        "appName": settings.app_name,
        "appIcon": settings.app_icon,
        "localRegistrationEnabled": settings.local_registration_enabled,
        "profilePropertyCatalog": profile_property_catalog,
        "providers": [
            {"id": provider.provider_id, "displayName": provider.display_name, "type": provider.provider_type}
            for provider in providers
        ]
    }


@router.post("/register")
def register(payload: RegisterRequest, request: Request, settings: Settings = Depends(get_settings)):
    if not settings.local_registration_enabled:
        raise ApiError(status_code=403, code="REGISTRATION_DISABLED", message="Local registration is disabled")

    auth_store = request.app.state.auth_store
    profile_properties_config = settings.profile_properties_config

    try:
        profile_properties = validate_profile_properties(payload.profileProperties or {}, profile_properties_config)
        validate_required_profile_properties(profile_properties, profile_properties_config)
    except ValueError as exc:
        parts = str(exc).split(":", 2)
        code = parts[0] if parts and parts[0] else "PROFILE_PROPERTY_INVALID"
        message = parts[2] if len(parts) > 2 else "Invalid profile property payload"
        details = {"property": parts[1]} if len(parts) > 1 and parts[1] else None
        raise ApiError(status_code=400, code=code, message=message, details=details) from exc

    preferences: dict[str, object] | None = None
    if profile_properties:
        preferences = {"profileProperties": profile_properties}

    try:
        user = auth_store.register_local_user(
            username=payload.username,
            email=payload.email,
            password=payload.password,
            display_name=payload.displayName,
            preferences=preferences,
        )
    except ValueError as exc:
        code = str(exc)
        if code == "EMAIL_ALREADY_EXISTS":
            raise ApiError(status_code=409, code=code, message="Email already exists") from exc
        if code == "USERNAME_ALREADY_EXISTS":
            raise ApiError(status_code=409, code=code, message="Username already exists") from exc
        raise ApiError(status_code=400, code="REGISTRATION_FAILED", message="Registration failed") from exc

    if not settings.email_verification_required_for_login:
        activated = auth_store.admin_update_user(user_id=user.id, status="active")
        if activated is not None:
            user = activated

    try:
        send_email_verification(
            mail_sender=request.app.state.mail_sender,
            settings=settings,
            user_id=user.id,
            email=user.email,
            display_name=user.display_name,
        )
    except MailDeliveryError as exc:
        raise ApiError(status_code=500, code="EMAIL_DELIVERY_FAILED", message="Unable to send verification email") from exc

    response = {
        "id": user.id,
        "email": user.email,
        "status": user.status,
        "emailVerified": user.email_verified,
    }
    if not settings.email_verification_required_for_login:
        response.update(_issue_auth_tokens(user=user, settings=settings, auth_store=auth_store))
    return response


@router.get("/verify-email")
def verify_email(token: str, request: Request, settings: Settings = Depends(get_settings)) -> dict:
    try:
        payload = decode_email_verification_token(token, settings)
    except jwt.ExpiredSignatureError as exc:
        raise ApiError(status_code=400, code="VERIFICATION_TOKEN_EXPIRED", message="Verification token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise ApiError(status_code=400, code="VERIFICATION_TOKEN_INVALID", message="Verification token is invalid") from exc

    if payload.get("type") != "email_verification":
        raise ApiError(status_code=400, code="VERIFICATION_TOKEN_INVALID", message="Verification token is invalid")

    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id or not email:
        raise ApiError(status_code=400, code="VERIFICATION_TOKEN_INVALID", message="Verification token is invalid")

    auth_store = request.app.state.auth_store
    user = auth_store.get_user(user_id)
    if user is None:
        raise ApiError(status_code=404, code="USER_NOT_FOUND", message="User not found")
    if auth_store.normalize_email(email) != user.email_normalized:
        raise ApiError(status_code=400, code="VERIFICATION_TOKEN_INVALID", message="Verification token is invalid")

    updated = auth_store.mark_email_verified(user_id)
    if updated is None:
        raise ApiError(status_code=404, code="USER_NOT_FOUND", message="User not found")

    return {
        "success": True,
        "status": updated.status,
        "emailVerified": updated.email_verified,
    }


@router.get("/invitations/{token}")
def get_invitation(token: str, request: Request) -> dict:
    auth_store = request.app.state.auth_store
    invitation = auth_store.get_invitation_by_token(token)
    if invitation is None:
        raise ApiError(status_code=404, code="INVITATION_NOT_FOUND", message="Invitation not found or expired")

    return {
        "valid": True,
        "invitedEmail": invitation.invited_email,
        "groupIds": invitation.group_ids,
        "expiresAt": invitation.expires_at.isoformat(),
    }


@router.post("/invitations/accept")
def accept_invitation(payload: InvitationAcceptRequest, request: Request, current_user=Depends(get_current_user)) -> dict:
    auth_store = request.app.state.auth_store
    accepted = auth_store.accept_invitation(payload.token, current_user.id)
    if accepted is None:
        raise ApiError(status_code=404, code="INVITATION_NOT_FOUND", message="Invitation not found or expired")

    return {
        "success": True,
        "groupIds": accepted.group_ids,
        "acceptedByUserId": current_user.id,
    }


@router.post("/login")
def login(payload: LoginRequest, request: Request, settings: Settings = Depends(get_settings)) -> dict:
    auth_store = request.app.state.auth_store
    user = auth_store.authenticate_local_user(payload.usernameOrEmail, payload.password)
    if user is None:
        raise ApiError(status_code=401, code="INVALID_CREDENTIALS", message="Invalid username/email or password")

    return _issue_auth_tokens(user=user, settings=settings, auth_store=auth_store)


@router.post("/refresh")
def refresh(payload: RefreshRequest, request: Request, settings: Settings = Depends(get_settings)) -> dict:
    auth_store = request.app.state.auth_store
    user, refresh_token, refresh_ttl = auth_store.rotate_refresh_session(payload.refreshToken, settings)
    if user is None or refresh_token is None or refresh_ttl is None:
        raise ApiError(status_code=401, code="TOKEN_INVALID", message="Refresh token is invalid or expired")

    access_token, access_ttl = generate_access_token(user.id, user.roles, settings)
    return {
        "accessToken": access_token,
        "accessTokenExpiresIn": access_ttl,
        "refreshToken": refresh_token,
        "refreshTokenExpiresIn": refresh_ttl,
    }


@router.post("/logout")
def logout(payload: LogoutRequest, request: Request) -> dict:
    auth_store = request.app.state.auth_store
    revoked = auth_store.revoke_refresh_session(payload.refreshToken)
    if not revoked:
        raise ApiError(status_code=401, code="TOKEN_INVALID", message="Refresh token is invalid")
    return {"success": True}


@router.get("/{provider}/start")
def auth_provider_start(provider: str, request: Request, settings: Settings = Depends(get_settings)) -> dict:
    adapter = get_external_provider_adapter(provider, settings)
    result = adapter.initiate_auth(request, settings)
    return {
        "provider": result.provider,
        "mode": result.mode,
        "redirectUrl": result.redirect_url,
    }


@router.get("/{provider}/callback")
def auth_provider_callback(provider: str, request: Request, settings: Settings = Depends(get_settings)) -> dict:
    adapter = get_external_provider_adapter(provider, settings)
    result = adapter.handle_callback(request, settings)
    return {
        "provider": result.provider,
        "status": result.status,
    }


@router.get("/me")
def me(current_user=Depends(get_current_user)) -> dict:
    return {
        "id": current_user.id,
        "email": current_user.email,
        "displayName": current_user.display_name,
        "roles": current_user.roles,
        "status": current_user.status,
        "emailVerified": current_user.email_verified,
    }


@router.get("/user-management-check")
def user_management_check(_: object = Depends(require_user_management_role)) -> dict:
    return {"ok": True}


@router.get("/admin-capabilities")
def admin_capabilities(request: Request, current_user=Depends(get_current_user)) -> dict:
    auth_store = request.app.state.auth_store
    user_id = current_user.id
    direct_roles = current_user.roles

    can_manage_users = has_any_role(auth_store, user_id=user_id, direct_roles=direct_roles, required_roles=ADMIN_USER_ROLES)
    can_manage_groups = has_any_role(auth_store, user_id=user_id, direct_roles=direct_roles, required_roles=ADMIN_GROUP_ROLES)
    can_invite_users = has_any_role(auth_store, user_id=user_id, direct_roles=direct_roles, required_roles=INVITE_USER_ROLES)
    is_superuser = has_any_role(auth_store, user_id=user_id, direct_roles=direct_roles, required_roles={ROLE_SUPERUSER})
    can_manage_content = has_any_role(
        auth_store,
        user_id=user_id,
        direct_roles=direct_roles,
        required_roles={ROLE_CONTENT_ADMIN, ROLE_CONTENT_EDITOR_LEGACY, ROLE_SUPERUSER},
    )
    can_manage_content_types = is_superuser

    return {
        "anyAdmin": can_manage_users or can_manage_groups or can_invite_users or can_manage_content or can_manage_content_types,
        "users": can_manage_users,
        "groups": can_manage_groups,
        "invitations": can_invite_users,
        "roles": is_superuser,
        "content": can_manage_content,
        "contentTypes": can_manage_content_types,
        "effectiveRoles": sorted(resolve_effective_roles(auth_store, user_id=user_id, direct_roles=direct_roles)),
    }
