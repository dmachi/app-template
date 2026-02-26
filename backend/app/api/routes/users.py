from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.auth.store import UserRecord
from app.core.errors import ApiError

router = APIRouter(prefix="/users", tags=["users"])


class UserProfilePatchRequest(BaseModel):
    displayName: str | None = Field(default=None, min_length=1)
    preferences: dict[str, Any] | None = None


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
def get_me(current_user: UserRecord = Depends(get_current_user)) -> dict:
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "displayName": current_user.display_name,
        "status": current_user.status,
        "roles": current_user.roles,
        "preferences": current_user.preferences,
    }


@router.patch("/me")
def patch_me(payload: UserProfilePatchRequest, request: Request, current_user: UserRecord = Depends(get_current_user)) -> dict:
    auth_store = request.app.state.auth_store
    updated = auth_store.update_user_profile(
        user_id=current_user.id,
        display_name=payload.displayName,
        preferences=payload.preferences,
    )
    if updated is None:
        raise ApiError(status_code=404, code="USER_NOT_FOUND", message="Current user not found")

    return {
        "id": updated.id,
        "username": updated.username,
        "email": updated.email,
        "displayName": updated.display_name,
        "status": updated.status,
        "roles": updated.roles,
        "preferences": updated.preferences,
    }
