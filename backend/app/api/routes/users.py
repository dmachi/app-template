from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field

from app.auth.dependencies import get_current_user
from app.auth.store import UserRecord
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.notifications.email import MailDeliveryError
from app.notifications.verification import send_email_verification

router = APIRouter(prefix="/users", tags=["users"])


class UserProfilePatchRequest(BaseModel):
    displayName: str | None = Field(default=None, min_length=1)
    email: EmailStr | None = None
    preferences: dict[str, Any] | None = None


def _serialize_basic_user(user: UserRecord) -> dict:
    organization = user.preferences.get("organization") if isinstance(user.preferences, dict) else None
    if not isinstance(organization, str):
        organization = None

    return {
        "id": user.id,
        "displayName": user.display_name,
        "organization": organization,
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
def get_me(current_user: UserRecord = Depends(get_current_user)) -> dict:
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "displayName": current_user.display_name,
        "status": current_user.status,
        "emailVerified": current_user.email_verified,
        "roles": current_user.roles,
        "preferences": current_user.preferences,
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
    try:
        updated = auth_store.update_user_profile(
            user_id=current_user.id,
            display_name=payload.displayName,
            email=payload.email,
            preferences=payload.preferences,
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

    return {
        "id": updated.id,
        "username": updated.username,
        "email": updated.email,
        "displayName": updated.display_name,
        "status": updated.status,
        "emailVerified": updated.email_verified,
        "roles": updated.roles,
        "preferences": updated.preferences,
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
