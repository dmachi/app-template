from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field

from app.auth.dependencies import require_superuser, require_user_management_role
from app.auth.store import GroupRecord, UserRecord
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.notifications.email import MailDeliveryError
from app.notifications.invitations import send_user_invitation

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminUserPatchRequest(BaseModel):
    displayName: str | None = Field(default=None, min_length=1)
    status: str | None = Field(default=None, min_length=1)
    roles: list[str] | None = None
    preferences: dict[str, Any] | None = None


class RoleCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None


class RolePatchRequest(BaseModel):
    description: str | None = None


class AdminGroupPatchRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    description: str | None = None


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


def _serialize_user_detail(user: UserRecord) -> dict:
    organization = user.preferences.get("organization") if isinstance(user.preferences, dict) else None
    if not isinstance(organization, str):
        organization = None
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "emailNormalized": user.email_normalized,
        "displayName": user.display_name,
        "status": user.status,
        "emailVerified": user.email_verified,
        "roles": user.roles,
        "organization": organization,
        "preferences": user.preferences,
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
        "ownerUserId": group.owner_user_id,
        "ownerDisplayName": owner.display_name if owner else None,
        "memberCount": auth_store.count_group_members(group.id),
        "createdAt": group.created_at.isoformat(),
        "updatedAt": group.updated_at.isoformat(),
    }


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


@router.get("/users")
def admin_list_users(request: Request, _: UserRecord = Depends(require_user_management_role)) -> dict:
    auth_store = request.app.state.auth_store
    users = auth_store.list_users()
    return {"items": [_serialize_user(user) for user in users]}


@router.patch("/users/{user_id}")
def admin_patch_user(
    user_id: str,
    payload: AdminUserPatchRequest,
    request: Request,
    _: UserRecord = Depends(require_user_management_role),
) -> dict:
    auth_store = request.app.state.auth_store

    if payload.roles is not None:
        unknown_roles = [role for role in payload.roles if not auth_store.role_exists(role)]
        if unknown_roles:
            raise ApiError(status_code=400, code="ROLE_NOT_FOUND", message=f"Unknown role(s): {', '.join(unknown_roles)}")

    updated = auth_store.admin_update_user(
        user_id=user_id,
        display_name=payload.displayName,
        status=payload.status,
        roles=payload.roles,
        preferences=payload.preferences,
    )
    if updated is None:
        raise ApiError(status_code=404, code="USER_NOT_FOUND", message="User not found")

    return _serialize_user(updated)


@router.get("/users/invitations")
def admin_list_outstanding_invitations(request: Request, _: UserRecord = Depends(require_user_management_role)) -> dict:
    auth_store = request.app.state.auth_store
    invitations = auth_store.list_outstanding_invitations()
    return {
        "items": [_serialize_outstanding_invitation(invitation, request) for invitation in invitations],
    }


@router.get("/users/{user_id}")
def admin_get_user(user_id: str, request: Request, _: UserRecord = Depends(require_user_management_role)) -> dict:
    auth_store = request.app.state.auth_store
    user = auth_store.get_user(user_id)
    if user is None:
        raise ApiError(status_code=404, code="USER_NOT_FOUND", message="User not found")
    return _serialize_user_detail(user)


@router.post("/users/{user_id}/reset-password")
def admin_reset_user_password(user_id: str, request: Request, _: UserRecord = Depends(require_user_management_role)) -> dict:
    auth_store = request.app.state.auth_store
    user = auth_store.get_user(user_id)
    if user is None:
        raise ApiError(status_code=404, code="USER_NOT_FOUND", message="User not found")

    return {
        "success": True,
        "delivery": "queued",
        "message": "Password reset email queued",
    }


@router.post("/users/invitations")
def admin_invite_users(
    payload: AdminInviteUsersRequest,
    request: Request,
    current_user: UserRecord = Depends(require_user_management_role),
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
    current_user: UserRecord = Depends(require_user_management_role),
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


@router.delete("/users/invitations/{invitation_id}")
def admin_revoke_invitation(invitation_id: str, request: Request, _: UserRecord = Depends(require_user_management_role)) -> dict:
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
def admin_list_groups(request: Request, _: UserRecord = Depends(require_superuser)) -> dict:
    auth_store = request.app.state.auth_store
    groups = auth_store.list_groups()
    return {"items": [_serialize_group(group, request) for group in groups]}


@router.patch("/groups/{group_id}")
def admin_patch_group(
    group_id: str,
    payload: AdminGroupPatchRequest,
    request: Request,
    _: UserRecord = Depends(require_superuser),
) -> dict:
    auth_store = request.app.state.auth_store
    updated = auth_store.update_group(group_id=group_id, name=payload.name, description=payload.description)
    if updated is None:
        raise ApiError(status_code=404, code="GROUP_NOT_FOUND", message="Group not found")
    return _serialize_group(updated, request)


@router.delete("/groups/{group_id}")
def admin_delete_group(group_id: str, request: Request, _: UserRecord = Depends(require_superuser)) -> dict:
    auth_store = request.app.state.auth_store
    deleted = auth_store.delete_group(group_id)
    if not deleted:
        raise ApiError(status_code=404, code="GROUP_NOT_FOUND", message="Group not found")
    return {"success": True}
