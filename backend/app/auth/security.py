from base64 import urlsafe_b64encode
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe

import jwt
from cryptography.fernet import Fernet
from passlib.hash import argon2

from app.core.config import Settings


DEV_ACCESS_SECRET = "dev-access-secret-change-me-32-bytes"
DEV_EMAIL_VERIFICATION_SECRET = "dev-email-verification-secret-change-me"


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


def generate_email_verification_token(user_id: str, email: str, settings: Settings) -> tuple[str, int]:
    expires_delta = timedelta(seconds=settings.email_verification_token_ttl_seconds)
    expires_at = datetime.now(UTC) + expires_delta
    payload = {
        "sub": user_id,
        "email": email,
        "type": "email_verification",
        "exp": expires_at,
        "iat": datetime.now(UTC),
    }
    secret = settings.email_verification_token_secret or settings.jwt_access_token_secret or DEV_EMAIL_VERIFICATION_SECRET
    token = jwt.encode(payload, secret, algorithm="HS256")
    return token, settings.email_verification_token_ttl_seconds


def decode_email_verification_token(token: str, settings: Settings) -> dict:
    secret = settings.email_verification_token_secret or settings.jwt_access_token_secret or DEV_EMAIL_VERIFICATION_SECRET
    return jwt.decode(token, secret, algorithms=["HS256"])


def generate_refresh_token() -> str:
    return token_urlsafe(48)


def hash_refresh_token(refresh_token: str) -> str:
    return sha256(refresh_token.encode("utf-8")).hexdigest()


def generate_personal_access_token() -> str:
    return f"pat_{token_urlsafe(40)}"


def hash_personal_access_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def _resolve_pat_fernet(settings: Settings) -> Fernet:
    key_source = settings.personal_access_token_encryption_key or settings.jwt_access_token_secret or DEV_ACCESS_SECRET
    key = urlsafe_b64encode(sha256(key_source.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_personal_access_token(token: str, settings: Settings) -> str:
    fernet = _resolve_pat_fernet(settings)
    return fernet.encrypt(token.encode("utf-8")).decode("utf-8")


def decrypt_personal_access_token(token_encrypted: str, settings: Settings) -> str:
    fernet = _resolve_pat_fernet(settings)
    return fernet.decrypt(token_encrypted.encode("utf-8")).decode("utf-8")


def _resolve_external_account_fernet(settings: Settings) -> Fernet:
    key_source = (
        settings.external_account_token_encryption_key
        or settings.personal_access_token_encryption_key
        or settings.jwt_access_token_secret
        or DEV_ACCESS_SECRET
    )
    key = urlsafe_b64encode(sha256(key_source.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_external_account_token(token: str, settings: Settings) -> str:
    fernet = _resolve_external_account_fernet(settings)
    return fernet.encrypt(token.encode("utf-8")).decode("utf-8")


def decrypt_external_account_token(token_encrypted: str, settings: Settings) -> str:
    fernet = _resolve_external_account_fernet(settings)
    return fernet.decrypt(token_encrypted.encode("utf-8")).decode("utf-8")
