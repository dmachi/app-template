from typing import Annotated

import jwt
from fastapi import Depends, Header, Request

from app.auth.middleware import AuthContext
from app.auth.security import decode_access_token
from app.auth.store import UserRecord
from app.core.config import Settings, get_settings
from app.core.errors import ApiError


def get_auth_store(request: Request):
    return request.app.state.auth_store


def get_current_user(
    request: Request,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    settings: Settings = Depends(get_settings),
    auth_store=Depends(get_auth_store),
) -> UserRecord:
    auth_context: AuthContext | None = getattr(request.state, "auth_context", None)
    if auth_context is not None:
        if not auth_context.is_authenticated:
            if auth_context.error_code:
                raise ApiError(status_code=401, code=auth_context.error_code, message="Access token is invalid")
            raise ApiError(status_code=401, code="AUTH_REQUIRED", message="Missing bearer token")

        user = auth_store.get_user(auth_context.user_id)
        if user is None:
            raise ApiError(status_code=401, code="TOKEN_INVALID", message="Token subject not found")
        if user.status != "active":
            raise ApiError(status_code=403, code="USER_DISABLED", message="User account is disabled")
        return user

    if not authorization or not authorization.startswith("Bearer "):
        raise ApiError(status_code=401, code="AUTH_REQUIRED", message="Missing bearer token")

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token, settings)
    except jwt.ExpiredSignatureError as exc:
        raise ApiError(status_code=401, code="TOKEN_EXPIRED", message="Access token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise ApiError(status_code=401, code="TOKEN_INVALID", message="Access token is invalid") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise ApiError(status_code=401, code="TOKEN_INVALID", message="Access token missing subject")

    user = auth_store.get_user(user_id)
    if user is None:
        raise ApiError(status_code=401, code="TOKEN_INVALID", message="Token subject not found")
    if user.status != "active":
        raise ApiError(status_code=403, code="USER_DISABLED", message="User account is disabled")

    return user


def require_user_management_role(
    current_user: UserRecord = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> UserRecord:
    allowed_roles = set(settings.user_management_role_list)
    if not any(role in allowed_roles for role in current_user.roles):
        raise ApiError(status_code=403, code="INSUFFICIENT_ROLE", message="Insufficient role")
    return current_user


def require_superuser(
    current_user: UserRecord = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> UserRecord:
    if settings.superuser_role_name not in current_user.roles:
        raise ApiError(status_code=403, code="INSUFFICIENT_ROLE", message="Insufficient role")
    return current_user
