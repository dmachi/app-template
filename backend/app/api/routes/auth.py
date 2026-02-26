from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field

from app.auth.dependencies import get_current_user, require_user_management_role
from app.auth.providers import get_enabled_providers
from app.auth.security import generate_access_token
from app.core.config import Settings, get_settings
from app.core.errors import ApiError

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


class RefreshRequest(BaseModel):
    refreshToken: str = Field(min_length=1)


class LogoutRequest(BaseModel):
    refreshToken: str = Field(min_length=1)


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
    return {
        "providers": [
            {"id": provider.provider_id, "displayName": provider.display_name, "type": provider.provider_type}
            for provider in providers
        ]
    }


@router.post("/register")
def register(payload: RegisterRequest, request: Request):
    auth_store = request.app.state.auth_store

    try:
        user = auth_store.register_local_user(
            username=payload.username,
            email=payload.email,
            password=payload.password,
            display_name=payload.displayName,
        )
    except ValueError as exc:
        code = str(exc)
        if code == "EMAIL_ALREADY_EXISTS":
            raise ApiError(status_code=409, code=code, message="Email already exists") from exc
        if code == "USERNAME_ALREADY_EXISTS":
            raise ApiError(status_code=409, code=code, message="Username already exists") from exc
        raise ApiError(status_code=400, code="REGISTRATION_FAILED", message="Registration failed") from exc

    return {
        "id": user.id,
        "email": user.email,
        "status": user.status,
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


@router.get("/me")
def me(current_user=Depends(get_current_user)) -> dict:
    return {
        "id": current_user.id,
        "email": current_user.email,
        "displayName": current_user.display_name,
        "roles": current_user.roles,
        "status": current_user.status,
    }


@router.get("/user-management-check")
def user_management_check(_: object = Depends(require_user_management_role)) -> dict:
    return {"ok": True}
