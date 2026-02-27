from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field

from app.auth.dependencies import require_admin_groups_role, require_admin_users_role, require_invite_users_role, require_superuser
from app.auth.roles import ROLE_SUPERUSER, has_any_role
from app.auth.store import GroupRecord, UserRecord
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.notifications.email import MailDeliveryError
from app.notifications.invitations import send_user_invitation
from app.notifications.verification import send_email_verification
from app.profile.catalog import sanitize_profile_properties, serialize_profile_property_catalog, validate_profile_properties

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminUserPatchRequest(BaseModel):
    displayName: str | None = Field(default=None, min_length=1)
    email: EmailStr | None = None
    status: str | None = Field(default=None, min_length=1)
    roles: list[str] | None = None
    preferences: dict[str, Any] | None = None
    profileProperties: dict[str, Any] | None = None


class RoleCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None


class RolePatchRequest(BaseModel):
    description: str | None = None


class AdminGroupPatchRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    description: str | None = None


class AdminGroupRoleAssignRequest(BaseModel):
    roles: list[str]


class AdminInviteUsersRequest(BaseModel):
    emails: list[EmailStr] = Field(min_length=1)
    groupIds: list[str] = Field(min_length=1)


def _serialize_user(user: UserRecord) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "displayName": user.display_name,
        "status": user.status,
        "emailVerified": user.email_verified,
        "roles": user.roles,
    }


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

    updated = auth_store.admin_update_user(
        user_id=user.id,
        preferences=preferences,
    )
    return updated or user


def _serialize_user_detail(user: UserRecord, profile_properties_config: str) -> dict:
    profile_properties = sanitize_profile_properties(
        _profile_properties_from_preferences(user.preferences),
        profile_properties_config,
    )
    profile_property_catalog = serialize_profile_property_catalog(profile_properties_config)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "emailNormalized": user.email_normalized,
        "displayName": user.display_name,
        "status": user.status,
        "emailVerified": user.email_verified,
        "roles": user.roles,
        "preferences": user.preferences,
        "profileProperties": profile_properties,
        "profilePropertyCatalog": profile_property_catalog,
        "createdAt": user.created_at.isoformat(),
        "updatedAt": user.updated_at.isoformat(),
    }


def _serialize_group(group: GroupRecord, request: Request) -> dict:
    auth_store = request.app.state.auth_store
    owner = auth_store.get_user(group.owner_user_id)
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "roles": group.roles,
        "ownerUserId": group.owner_user_id,
        "ownerDisplayName": owner.display_name if owner else None,
        "memberCount": auth_store.count_group_members(group.id),
        "createdAt": group.created_at.isoformat(),
        "updatedAt": group.updated_at.isoformat(),
    }


def _serialize_user_group_membership(group: GroupRecord, user_id: str, request: Request) -> dict:
    payload = _serialize_group(group, request)
    payload["isOwner"] = group.owner_user_id == user_id
    return payload


def _serialize_outstanding_invitation(invitation, request: Request) -> dict:
    auth_store = request.app.state.auth_store
    inviter = auth_store.get_user(invitation.invited_by_user_id)
    groups = [auth_store.get_group(group_id) for group_id in invitation.group_ids]
    return {
        "id": invitation.id,
        "invitedEmail": invitation.invited_email,
        "invitedByUserId": invitation.invited_by_user_id,
        "invitedByDisplayName": inviter.display_name if inviter else None,
        "groupIds": invitation.group_ids,
        "groupNames": [group.name for group in groups if group is not None],
        "createdAt": invitation.created_at.isoformat(),
        "expiresAt": invitation.expires_at.isoformat(),
    }


def _build_invitation_link(base_url: str, token: str) -> str:
    parsed = urlparse(base_url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query["token"] = token
    return urlunparse(parsed._replace(query=urlencode(query)))


@router.get("/users")
def admin_list_users(request: Request, _: UserRecord = Depends(require_admin_users_role)) -> dict:
    auth_store = request.app.state.auth_store
    users = auth_store.list_users()
    return {"items": [_serialize_user(user) for user in users]}


@router.patch("/users/{user_id}")
def admin_patch_user(
    user_id: str,
    payload: AdminUserPatchRequest,
    request: Request,
    current_user: UserRecord = Depends(require_admin_users_role),
) -> dict:
    auth_store = request.app.state.auth_store
    settings: Settings = request.app.state.settings
    target_user = auth_store.get_user(user_id)
    if target_user is None:
        raise ApiError(status_code=404, code="USER_NOT_FOUND", message="User not found")

    has_superuser = has_any_role(
        auth_store,
        user_id=current_user.id,
        direct_roles=current_user.roles,
        required_roles={ROLE_SUPERUSER},
    )

    if payload.roles is not None:
        unknown_roles = [role for role in payload.roles if not auth_store.role_exists(role)]
        if unknown_roles:
            raise ApiError(status_code=400, code="ROLE_NOT_FOUND", message=f"Unknown role(s): {', '.join(unknown_roles)}")
        if ROLE_SUPERUSER in payload.roles and not has_superuser:
            raise ApiError(status_code=403, code="INSUFFICIENT_ROLE", message="Only Superuser can assign Superuser role")

    target_is_superuser = has_any_role(
        auth_store,
        user_id=target_user.id,
        direct_roles=target_user.roles,
        required_roles={ROLE_SUPERUSER},
    )
    if not has_superuser and target_is_superuser:
        raise ApiError(status_code=403, code="INSUFFICIENT_ROLE", message="Only Superuser can modify Superuser users")

    resolved_preferences = payload.preferences
    if payload.profileProperties is not None:
        existing_preferences = target_user.preferences if isinstance(target_user.preferences, dict) else {}
        resolved_preferences = dict(existing_preferences) if resolved_preferences is None else dict(resolved_preferences)
        try:
            existing_profile_properties = _profile_properties_from_preferences(resolved_preferences)
            candidate_profile_properties = {
                **existing_profile_properties,
                **payload.profileProperties,
            }
            resolved_profile_properties = validate_profile_properties(
                candidate_profile_properties,
                settings.profile_properties_config,
            )
        except ValueError as exc:
            parts = str(exc).split(":", 2)
            code = parts[0] if parts and parts[0] else "PROFILE_PROPERTY_INVALID"
            message = parts[2] if len(parts) > 2 else "Invalid profile property payload"
            details = {"property": parts[1]} if len(parts) > 1 and parts[1] else None
            raise ApiError(status_code=400, code=code, message=message, details=details) from exc

        resolved_preferences["profileProperties"] = resolved_profile_properties

    try:
        updated = auth_store.admin_update_user(
            user_id=user_id,
            display_name=payload.displayName,
            email=payload.email,
            status=payload.status,
            roles=payload.roles,
            preferences=resolved_preferences,
        )
    except ValueError as exc:
        if str(exc) == "EMAIL_ALREADY_EXISTS":
            raise ApiError(status_code=409, code="EMAIL_ALREADY_EXISTS", message="Email already exists") from exc
        raise ApiError(status_code=400, code="ADMIN_USER_UPDATE_FAILED", message="Unable to update user") from exc
    if updated is None:
        raise ApiError(status_code=404, code="USER_NOT_FOUND", message="User not found")

    return _serialize_user(updated)


@router.get("/users/invitations")
def admin_list_outstanding_invitations(request: Request, _: UserRecord = Depends(require_invite_users_role)) -> dict:
    auth_store = request.app.state.auth_store
    invitations = auth_store.list_outstanding_invitations()
    return {
        "items": [_serialize_outstanding_invitation(invitation, request) for invitation in invitations],
    }


@router.get("/users/{user_id}")
def admin_get_user(user_id: str, request: Request, _: UserRecord = Depends(require_admin_users_role)) -> dict:
    auth_store = request.app.state.auth_store
    settings: Settings = request.app.state.settings
    user = auth_store.get_user(user_id)
    if user is None:
        raise ApiError(status_code=404, code="USER_NOT_FOUND", message="User not found")
    user = _migrate_legacy_organization_preferences(auth_store, user)
    return _serialize_user_detail(user, settings.profile_properties_config)


@router.get("/users/{user_id}/groups")
def admin_list_user_groups(user_id: str, request: Request, _: UserRecord = Depends(require_admin_users_role)) -> dict:
    auth_store = request.app.state.auth_store
    user = auth_store.get_user(user_id)
    if user is None:
        raise ApiError(status_code=404, code="USER_NOT_FOUND", message="User not found")

    groups = [
        group
        for group in auth_store.list_groups()
        if group.owner_user_id == user_id or auth_store.is_group_member(group.id, user_id)
    ]
    return {
        "items": [_serialize_user_group_membership(group, user_id, request) for group in groups],
    }


@router.post("/users/{user_id}/reset-password")
def admin_reset_user_password(user_id: str, request: Request, _: UserRecord = Depends(require_admin_users_role)) -> dict:
    auth_store = request.app.state.auth_store
    user = auth_store.get_user(user_id)
    if user is None:
        raise ApiError(status_code=404, code="USER_NOT_FOUND", message="User not found")

    return {
        "success": True,
        "delivery": "queued",
        "message": "Password reset email queued",
    }


@router.post("/users/{user_id}/resend-verification")
def admin_resend_user_verification(
    user_id: str,
    request: Request,
    _: UserRecord = Depends(require_admin_users_role),
    settings: Settings = Depends(get_settings),
) -> dict:
    auth_store = request.app.state.auth_store
    user = auth_store.get_user(user_id)
    if user is None:
        raise ApiError(status_code=404, code="USER_NOT_FOUND", message="User not found")

    if user.email_verified:
        return {
            "success": True,
            "sent": False,
            "message": "Email is already verified",
        }

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

    return {
        "success": True,
        "sent": True,
        "message": "Verification email sent",
    }


@router.post("/users/invitations")
def admin_invite_users(
    payload: AdminInviteUsersRequest,
    request: Request,
    current_user: UserRecord = Depends(require_invite_users_role),
    settings: Settings = Depends(get_settings),
) -> dict:
    auth_store = request.app.state.auth_store

    group_ids = list(dict.fromkeys(payload.groupIds))
    groups = [auth_store.get_group(group_id) for group_id in group_ids]
    if any(group is None for group in groups):
        raise ApiError(status_code=404, code="GROUP_NOT_FOUND", message="One or more groups were not found")

    invited = 0
    added_existing = 0
    failures: list[dict[str, str]] = []

    for email in list(dict.fromkeys([str(item) for item in payload.emails])):
        existing_user = auth_store.find_user_by_username_or_email(email)
        if existing_user is not None:
            for group_id in group_ids:
                auth_store.add_group_member(group_id=group_id, user_id=existing_user.id)
            added_existing += 1
            continue

        token, _ = auth_store.create_invitation(
            invited_email=email,
            invited_by_user_id=current_user.id,
            group_ids=group_ids,
            settings=settings,
        )

        try:
            send_user_invitation(
                mail_sender=request.app.state.mail_sender,
                settings=settings,
                invited_email=email,
                inviter_name=current_user.display_name,
                invitation_token=token,
            )
            invited += 1
        except MailDeliveryError:
            failures.append({"email": str(email), "error": "EMAIL_DELIVERY_FAILED"})

    return {
        "invited": invited,
        "addedExisting": added_existing,
        "failures": failures,
    }


@router.post("/users/invitations/{invitation_id}/resend")
def admin_resend_invitation(
    invitation_id: str,
    request: Request,
    current_user: UserRecord = Depends(require_invite_users_role),
    settings: Settings = Depends(get_settings),
) -> dict:
    auth_store = request.app.state.auth_store
    invitation = auth_store.get_outstanding_invitation_by_id(invitation_id)
    if invitation is None:
        raise ApiError(status_code=404, code="INVITATION_NOT_FOUND", message="Invitation not found")

    token, resent_invitation = auth_store.create_invitation(
        invited_email=invitation.invited_email,
        invited_by_user_id=current_user.id,
        group_ids=invitation.group_ids,
        settings=settings,
    )

    try:
        send_user_invitation(
            mail_sender=request.app.state.mail_sender,
            settings=settings,
            invited_email=resent_invitation.invited_email,
            inviter_name=current_user.display_name,
            invitation_token=token,
        )
    except MailDeliveryError as exc:
        auth_store.revoke_invitation(resent_invitation.id)
        raise ApiError(status_code=502, code="EMAIL_DELIVERY_FAILED", message="Unable to resend invitation email") from exc

    auth_store.revoke_invitation(invitation_id)
    return {
        "success": True,
        "invitation": _serialize_outstanding_invitation(resent_invitation, request),
    }


@router.post("/users/invitations/{invitation_id}/copy-link")
def admin_copy_invitation_link(
    invitation_id: str,
    request: Request,
    current_user: UserRecord = Depends(require_invite_users_role),
    settings: Settings = Depends(get_settings),
) -> dict:
    auth_store = request.app.state.auth_store
    invitation = auth_store.get_outstanding_invitation_by_id(invitation_id)
    if invitation is None:
        raise ApiError(status_code=404, code="INVITATION_NOT_FOUND", message="Invitation not found")

    token, copied_invitation = auth_store.create_invitation(
        invited_email=invitation.invited_email,
        invited_by_user_id=current_user.id,
        group_ids=invitation.group_ids,
        settings=settings,
    )
    auth_store.revoke_invitation(invitation_id)

    return {
        "success": True,
        "invitation": _serialize_outstanding_invitation(copied_invitation, request),
        "invitationLink": _build_invitation_link(settings.email_invitation_link_base_url, token),
    }


@router.delete("/users/invitations/{invitation_id}")
def admin_revoke_invitation(invitation_id: str, request: Request, _: UserRecord = Depends(require_invite_users_role)) -> dict:
    auth_store = request.app.state.auth_store
    revoked = auth_store.revoke_invitation(invitation_id)
    if not revoked:
        raise ApiError(status_code=404, code="INVITATION_NOT_FOUND", message="Invitation not found")
    return {"success": True}


@router.get("/roles")
def admin_list_roles(request: Request, _: UserRecord = Depends(require_superuser)) -> dict:
    auth_store = request.app.state.auth_store
    return {"items": auth_store.list_roles()}


@router.post("/roles")
def admin_create_role(payload: RoleCreateRequest, request: Request, _: UserRecord = Depends(require_superuser)) -> dict:
    auth_store = request.app.state.auth_store
    try:
        role = auth_store.create_role(payload.name, payload.description)
    except ValueError as exc:
        code = str(exc)
        if code == "ROLE_EXISTS":
            raise ApiError(status_code=409, code=code, message="Role already exists") from exc
        if code == "ROLE_NAME_INVALID":
            raise ApiError(status_code=400, code=code, message="Role name is invalid") from exc
        raise ApiError(status_code=400, code="ROLE_CREATE_FAILED", message="Unable to create role") from exc
    return role


@router.patch("/roles/{role_name}")
def admin_patch_role(
    role_name: str,
    payload: RolePatchRequest,
    request: Request,
    _: UserRecord = Depends(require_superuser),
) -> dict:
    auth_store = request.app.state.auth_store
    updated = auth_store.update_role(role_name, payload.description)
    if updated is None:
        raise ApiError(status_code=404, code="ROLE_NOT_FOUND", message="Role not found")
    return updated


@router.delete("/roles/{role_name}")
def admin_delete_role(role_name: str, request: Request, _: UserRecord = Depends(require_superuser)) -> dict:
    auth_store = request.app.state.auth_store
    try:
        deleted = auth_store.delete_role(role_name)
    except ValueError as exc:
        code = str(exc)
        if code == "ROLE_PROTECTED":
            raise ApiError(status_code=400, code=code, message="Role cannot be deleted") from exc
        raise ApiError(status_code=400, code="ROLE_DELETE_FAILED", message="Unable to delete role") from exc

    if not deleted:
        raise ApiError(status_code=404, code="ROLE_NOT_FOUND", message="Role not found")
    return {"success": True}


@router.get("/groups")
def admin_list_groups(request: Request, _: UserRecord = Depends(require_admin_groups_role)) -> dict:
    auth_store = request.app.state.auth_store
    groups = auth_store.list_groups()
    return {"items": [_serialize_group(group, request) for group in groups]}


@router.get("/groups/assignable-roles")
def admin_list_assignable_roles_for_groups(request: Request, _: UserRecord = Depends(require_admin_groups_role)) -> dict:
    auth_store = request.app.state.auth_store
    return {"items": [role for role in auth_store.list_roles() if role.get("name") != ROLE_SUPERUSER]}


@router.patch("/groups/{group_id}")
def admin_patch_group(
    group_id: str,
    payload: AdminGroupPatchRequest,
    request: Request,
    _: UserRecord = Depends(require_admin_groups_role),
) -> dict:
    auth_store = request.app.state.auth_store
    updated = auth_store.update_group(group_id=group_id, name=payload.name, description=payload.description)
    if updated is None:
        raise ApiError(status_code=404, code="GROUP_NOT_FOUND", message="Group not found")
    return _serialize_group(updated, request)


@router.put("/groups/{group_id}/roles")
def admin_assign_group_roles(
    group_id: str,
    payload: AdminGroupRoleAssignRequest,
    request: Request,
    _: UserRecord = Depends(require_admin_groups_role),
) -> dict:
    auth_store = request.app.state.auth_store
    if ROLE_SUPERUSER in payload.roles:
        raise ApiError(status_code=400, code="ROLE_NOT_ASSIGNABLE", message="Superuser cannot be assigned to groups")
    unknown_roles = [role for role in payload.roles if not auth_store.role_exists(role)]
    if unknown_roles:
        raise ApiError(status_code=400, code="ROLE_NOT_FOUND", message=f"Unknown role(s): {', '.join(unknown_roles)}")

    updated = auth_store.set_group_roles(group_id=group_id, roles=payload.roles)
    if updated is None:
        raise ApiError(status_code=404, code="GROUP_NOT_FOUND", message="Group not found")
    return _serialize_group(updated, request)


@router.delete("/groups/{group_id}")
def admin_delete_group(group_id: str, request: Request, _: UserRecord = Depends(require_admin_groups_role)) -> dict:
    auth_store = request.app.state.auth_store
    deleted = auth_store.delete_group(group_id)
    if not deleted:
        raise ApiError(status_code=404, code="GROUP_NOT_FOUND", message="Group not found")
    return {"success": True}
