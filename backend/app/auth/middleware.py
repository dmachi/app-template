from __future__ import annotations

from dataclasses import dataclass

import jwt
from fastapi import Request

from app.auth.auth_scopes import get_token_scopes
from app.auth.oauth_security import decode_oauth_access_token
from app.auth.security import decode_access_token
from app.core.config import Settings


@dataclass
class AuthContext:
    is_authenticated: bool
    user_id: str | None = None
    roles: list[str] | None = None
    auth_type: str | None = None
    scopes: list[str] | None = None
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
        if authorization and authorization.startswith("Bearer ") and settings.personal_access_tokens_enabled:
            auth_store = request.app.state.auth_store
            pat = auth_store.resolve_active_personal_access_token(token)
            if pat is not None:
                auth_store.touch_personal_access_token_last_used(pat.id)
                return AuthContext(
                    is_authenticated=True,
                    user_id=pat.user_id,
                    roles=[],
                    auth_type="pat",
                    scopes=list(pat.scopes),
                )

        if authorization and authorization.startswith("Bearer "):
            auth_store = request.app.state.auth_store
            try:
                oauth_payload = decode_oauth_access_token(token, settings)
            except jwt.ExpiredSignatureError:
                return AuthContext(is_authenticated=False, error_code="TOKEN_EXPIRED")
            except jwt.InvalidTokenError:
                pass
            else:
                user_id = oauth_payload.get("sub")
                token_use = oauth_payload.get("token_use")
                if isinstance(user_id, str) and user_id and token_use == "access" and auth_store.is_oauth_access_token_active(token):
                    return AuthContext(
                        is_authenticated=True,
                        user_id=user_id,
                        roles=[],
                        auth_type="oauth",
                        scopes=sorted(get_token_scopes(oauth_payload)),
                    )
        return AuthContext(is_authenticated=False, error_code="TOKEN_INVALID")

    user_id = payload.get("sub")
    if not user_id:
        return AuthContext(is_authenticated=False, error_code="TOKEN_INVALID")

    roles = payload.get("roles") or []
    if not isinstance(roles, list):
        roles = []

    return AuthContext(is_authenticated=True, user_id=user_id, roles=roles, auth_type="jwt", scopes=[])
