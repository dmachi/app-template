from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe

import jwt
from passlib.hash import argon2

from app.core.config import Settings


DEV_ACCESS_SECRET = "dev-access-secret-change-me-32-bytes"


def hash_password(password: str) -> str:
    return argon2.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return argon2.verify(password, password_hash)


def generate_access_token(user_id: str, roles: list[str], settings: Settings) -> tuple[str, int]:
    expires_delta = timedelta(seconds=settings.jwt_access_token_ttl_seconds)
    expires_at = datetime.now(UTC) + expires_delta

    payload = {
        "sub": user_id,
        "roles": roles,
        "type": "access",
        "exp": expires_at,
        "iat": datetime.now(UTC),
    }
    if settings.jwt_issuer:
        payload["iss"] = settings.jwt_issuer
    if settings.jwt_audience:
        payload["aud"] = settings.jwt_audience

    secret = settings.jwt_access_token_secret or DEV_ACCESS_SECRET
    token = jwt.encode(payload, secret, algorithm="HS256")
    return token, settings.jwt_access_token_ttl_seconds


def decode_access_token(token: str, settings: Settings) -> dict:
    secret = settings.jwt_access_token_secret or DEV_ACCESS_SECRET
    kwargs: dict[str, str] = {}
    if settings.jwt_issuer:
        kwargs["issuer"] = settings.jwt_issuer
    if settings.jwt_audience:
        kwargs["audience"] = settings.jwt_audience

    return jwt.decode(token, secret, algorithms=["HS256"], **kwargs)


def generate_refresh_token() -> str:
    return token_urlsafe(48)


def hash_refresh_token(refresh_token: str) -> str:
    return sha256(refresh_token.encode("utf-8")).hexdigest()
