from __future__ import annotations

from dataclasses import dataclass

import jwt
from fastapi import Request

from app.auth.security import decode_access_token
from app.core.config import Settings


@dataclass
class AuthContext:
    is_authenticated: bool
    user_id: str | None = None
    roles: list[str] | None = None
    error_code: str | None = None


def resolve_auth_context(request: Request, settings: Settings) -> AuthContext:
    authorization = request.headers.get("Authorization")
    token: str | None = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
    else:
        token = request.cookies.get(settings.oauth_session_cookie_name)

    if not token:
        return AuthContext(is_authenticated=False)

    try:
        payload = decode_access_token(token, settings)
    except jwt.ExpiredSignatureError:
        return AuthContext(is_authenticated=False, error_code="TOKEN_EXPIRED")
    except jwt.InvalidTokenError:
        return AuthContext(is_authenticated=False, error_code="TOKEN_INVALID")

    user_id = payload.get("sub")
    if not user_id:
        return AuthContext(is_authenticated=False, error_code="TOKEN_INVALID")

    roles = payload.get("roles") or []
    if not isinstance(roles, list):
        roles = []

    return AuthContext(is_authenticated=True, user_id=user_id, roles=roles)
