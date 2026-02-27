from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field

from app.auth.dependencies import get_current_user
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


def _profile_properties_from_preferences(preferences: Any) -> dict[str, Any]:
    if not isinstance(preferences, dict):
        return {}
    raw = preferences.get("profileProperties")
    return raw if isinstance(raw, dict) else {}


def _serialize_basic_user(user: UserRecord) -> dict:
    organization = user.preferences.get("organization") if isinstance(user.preferences, dict) else None
    if not isinstance(organization, str):
        organization = None

    return {
        "id": user.id,
        "displayName": user.display_name,
        "organization": organization,
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
    _: UserRecord = Depends(get_current_user),
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
    current_user: UserRecord = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict:
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
    current_user: UserRecord = Depends(get_current_user),
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
    current_user: UserRecord = Depends(get_current_user),
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


@router.get("/{user_id}")
def get_user_basic(user_id: str, request: Request, _: UserRecord = Depends(get_current_user)) -> dict:
    auth_store = request.app.state.auth_store
    user = auth_store.get_user(user_id)
    if user is None:
        raise ApiError(status_code=404, code="USER_NOT_FOUND", message="User not found")
    return _serialize_basic_user(user)
