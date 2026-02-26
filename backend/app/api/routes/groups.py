from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user, require_group_manager_role
from app.auth.roles import ROLE_ADMIN_GROUPS, ROLE_GROUP_MANAGER, ROLE_SUPERUSER, has_any_role
from app.auth.store import GroupRecord, UserRecord
from app.core.errors import ApiError

router = APIRouter(prefix="/groups", tags=["groups"])


class GroupCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None


class GroupPatchRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    description: str | None = None


class GroupMemberAddRequest(BaseModel):
    usernameOrEmail: str = Field(min_length=1)


def _serialize_group(group: GroupRecord) -> dict:
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "roles": group.roles,
        "ownerUserId": group.owner_user_id,
        "createdAt": group.created_at.isoformat(),
        "updatedAt": group.updated_at.isoformat(),
    }


def _serialize_group_summary(group: GroupRecord, request: Request) -> dict:
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


def _serialize_group_detail(group: GroupRecord, request: Request, current_user: UserRecord) -> dict:
    summary = _serialize_group_summary(group, request)
    summary["canManage"] = _can_manage_group(current_user, group, request)
    return summary


def _can_manage_group(current_user: UserRecord, group: GroupRecord, request: Request) -> bool:
    auth_store = request.app.state.auth_store
    return has_any_role(auth_store, user_id=current_user.id, direct_roles=current_user.roles, required_roles={ROLE_SUPERUSER, ROLE_ADMIN_GROUPS}) or (
        current_user.id == group.owner_user_id
        and has_any_role(auth_store, user_id=current_user.id, direct_roles=current_user.roles, required_roles={ROLE_GROUP_MANAGER})
    )


def _can_view_group(current_user: UserRecord, group: GroupRecord, request: Request) -> bool:
    if _can_manage_group(current_user, group, request):
        return True
    auth_store = request.app.state.auth_store
    return auth_store.is_group_member(group.id, current_user.id)


@router.get("")
def list_groups(request: Request, current_user: UserRecord = Depends(get_current_user)) -> dict:
    auth_store = request.app.state.auth_store
    groups = auth_store.list_groups_owned_by_user(current_user.id)
    return {"items": [_serialize_group_summary(group, request) for group in groups]}


@router.get("/mine")
def list_my_group_collections(request: Request, current_user: UserRecord = Depends(get_current_user)) -> dict:
    auth_store = request.app.state.auth_store
    owned_groups = auth_store.list_groups_owned_by_user(current_user.id)
    member_groups = auth_store.list_groups_member_of_user(current_user.id)
    return {
        "owned": [_serialize_group_summary(group, request) for group in owned_groups],
        "memberOf": [_serialize_group_summary(group, request) for group in member_groups],
    }


@router.post("")
def create_group(payload: GroupCreateRequest, request: Request, current_user: UserRecord = Depends(require_group_manager_role)) -> dict:
    auth_store = request.app.state.auth_store
    group = auth_store.create_group(owner_user_id=current_user.id, name=payload.name, description=payload.description)
    return _serialize_group(group)


@router.get("/{group_id}")
def get_group(group_id: str, request: Request, current_user: UserRecord = Depends(get_current_user)) -> dict:
    auth_store = request.app.state.auth_store
    group = auth_store.get_group(group_id)
    if group is None:
        raise ApiError(status_code=404, code="GROUP_NOT_FOUND", message="Group not found")
    if not _can_view_group(current_user, group, request):
        raise ApiError(status_code=403, code="INSUFFICIENT_ROLE", message="Not allowed to access this group")
    return _serialize_group_detail(group, request, current_user)


@router.patch("/{group_id}")
def patch_group(
    group_id: str,
    payload: GroupPatchRequest,
    request: Request,
    current_user: UserRecord = Depends(get_current_user),
) -> dict:
    auth_store = request.app.state.auth_store
    group = auth_store.get_group(group_id)
    if group is None:
        raise ApiError(status_code=404, code="GROUP_NOT_FOUND", message="Group not found")
    if not _can_manage_group(current_user, group, request):
        raise ApiError(status_code=403, code="INSUFFICIENT_ROLE", message="Not allowed to update this group")

    updated = auth_store.update_group(group_id=group_id, name=payload.name, description=payload.description)
    if updated is None:
        raise ApiError(status_code=404, code="GROUP_NOT_FOUND", message="Group not found")
    return _serialize_group_detail(updated, request, current_user)


@router.delete("/{group_id}")
def delete_group(group_id: str, request: Request, current_user: UserRecord = Depends(get_current_user)) -> dict:
    auth_store = request.app.state.auth_store
    group = auth_store.get_group(group_id)
    if group is None:
        raise ApiError(status_code=404, code="GROUP_NOT_FOUND", message="Group not found")
    if not _can_manage_group(current_user, group, request):
        raise ApiError(status_code=403, code="INSUFFICIENT_ROLE", message="Not allowed to delete this group")

    auth_store.delete_group(group_id)
    return {"success": True}


@router.get("/{group_id}/members")
def list_group_members(group_id: str, request: Request, current_user: UserRecord = Depends(get_current_user)) -> dict:
    auth_store = request.app.state.auth_store
    group = auth_store.get_group(group_id)
    if group is None:
        raise ApiError(status_code=404, code="GROUP_NOT_FOUND", message="Group not found")
    if not _can_view_group(current_user, group, request):
        raise ApiError(status_code=403, code="INSUFFICIENT_ROLE", message="Not allowed to access this group")

    members = auth_store.list_group_members(group_id)
    return {
        "items": [
            {
                "userId": user.id,
                "username": user.username,
                "email": user.email,
                "displayName": user.display_name,
                "membershipRole": membership_role,
            }
            for user, membership_role in members
        ]
    }


@router.post("/{group_id}/members")
def add_group_member(
    group_id: str,
    payload: GroupMemberAddRequest,
    request: Request,
    current_user: UserRecord = Depends(get_current_user),
) -> dict:
    auth_store = request.app.state.auth_store
    group = auth_store.get_group(group_id)
    if group is None:
        raise ApiError(status_code=404, code="GROUP_NOT_FOUND", message="Group not found")
    if not _can_manage_group(current_user, group, request):
        raise ApiError(status_code=403, code="INSUFFICIENT_ROLE", message="Not allowed to manage members")

    user = auth_store.find_user_by_username_or_email(payload.usernameOrEmail)
    if user is None:
        raise ApiError(status_code=404, code="USER_NOT_FOUND", message="User not found")

    auth_store.add_group_member(group_id=group_id, user_id=user.id)
    return {"success": True}


@router.delete("/{group_id}/members/{user_id}")
def remove_group_member(
    group_id: str,
    user_id: str,
    request: Request,
    current_user: UserRecord = Depends(get_current_user),
) -> dict:
    auth_store = request.app.state.auth_store
    group = auth_store.get_group(group_id)
    if group is None:
        raise ApiError(status_code=404, code="GROUP_NOT_FOUND", message="Group not found")
    if not _can_manage_group(current_user, group, request):
        raise ApiError(status_code=403, code="INSUFFICIENT_ROLE", message="Not allowed to manage members")

    removed = auth_store.remove_group_member(group_id=group_id, user_id=user_id)
    if not removed:
        raise ApiError(status_code=400, code="MEMBER_REMOVE_FAILED", message="Unable to remove member")
    return {"success": True}
