from __future__ import annotations

from base64 import urlsafe_b64encode
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from hashlib import sha256
from typing import Any
from uuid import uuid4

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.config import Settings


@dataclass(frozen=True)
class OAuthKeyPair:
    key_id: str
    private_key_pem: str
    public_key_pem: str


def _b64url_uint(value: int) -> str:
    encoded = value.to_bytes((value.bit_length() + 7) // 8, byteorder="big")
    return urlsafe_b64encode(encoded).decode("ascii").rstrip("=")


@lru_cache
def _generated_dev_key_pair() -> OAuthKeyPair:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")
    return OAuthKeyPair(key_id="oauth-dev-generated", private_key_pem=private_pem, public_key_pem=public_pem)


def resolve_oauth_key_pair(settings: Settings) -> OAuthKeyPair:
    if settings.oauth_rs256_private_key_pem and settings.oauth_rs256_public_key_pem:
        return OAuthKeyPair(
            key_id=settings.oauth_signing_key_id,
            private_key_pem=settings.oauth_rs256_private_key_pem,
            public_key_pem=settings.oauth_rs256_public_key_pem,
        )
    return _generated_dev_key_pair()


def build_jwks(settings: Settings) -> dict[str, list[dict[str, str]]]:
    key_pair = resolve_oauth_key_pair(settings)
    public_key = serialization.load_pem_public_key(key_pair.public_key_pem.encode("utf-8"))
    if not isinstance(public_key, rsa.RSAPublicKey):
        raise RuntimeError("OAuth public key must be RSA")

    numbers = public_key.public_numbers()
    return {
        "keys": [
            {
                "kty": "RSA",
                "kid": key_pair.key_id,
                "alg": "RS256",
                "use": "sig",
                "n": _b64url_uint(numbers.n),
                "e": _b64url_uint(numbers.e),
            }
        ]
    }


def normalize_scope(scope: str) -> list[str]:
    return sorted({item for item in scope.split() if item.strip()})


def hash_oauth_secret(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def verify_pkce_s256(code_verifier: str, code_challenge: str) -> bool:
    computed = urlsafe_b64encode(sha256(code_verifier.encode("utf-8")).digest()).decode("ascii").rstrip("=")
    return computed == code_challenge


def issue_oauth_access_token(
    *,
    settings: Settings,
    subject: str,
    client_id: str,
    scopes: list[str],
    audience: str | None,
) -> tuple[str, str, int, datetime]:
    now = datetime.now(UTC)
    expires_at = now + timedelta(seconds=settings.oauth_access_token_ttl_seconds)
    jti = str(uuid4())
    payload: dict[str, Any] = {
        "iss": settings.oauth_issuer,
        "sub": subject,
        "aud": audience or client_id,
        "azp": client_id,
        "scope": " ".join(sorted(scopes)),
        "iat": now,
        "exp": expires_at,
        "jti": jti,
        "token_use": "access",
    }

    key_pair = resolve_oauth_key_pair(settings)
    token = jwt.encode(payload, key_pair.private_key_pem, algorithm="RS256", headers={"kid": key_pair.key_id})
    return token, jti, settings.oauth_access_token_ttl_seconds, expires_at


def decode_oauth_access_token(token: str, settings: Settings) -> dict[str, Any]:
    key_pair = resolve_oauth_key_pair(settings)
    return jwt.decode(
        token,
        key_pair.public_key_pem,
        algorithms=["RS256"],
        issuer=settings.oauth_issuer,
        options={"verify_aud": False},
    )


def issue_oidc_id_token(
    *,
    settings: Settings,
    subject: str,
    audience: str,
    user_claims: dict[str, Any],
    nonce: str | None,
) -> tuple[str, int]:
    now = datetime.now(UTC)
    expires_at = now + timedelta(seconds=settings.oauth_id_token_ttl_seconds)
    payload: dict[str, Any] = {
        "iss": settings.oauth_issuer,
        "sub": subject,
        "aud": audience,
        "iat": now,
        "exp": expires_at,
        **user_claims,
    }
    if nonce:
        payload["nonce"] = nonce

    key_pair = resolve_oauth_key_pair(settings)
    token = jwt.encode(payload, key_pair.private_key_pem, algorithm="RS256", headers={"kid": key_pair.key_id})
    return token, settings.oauth_id_token_ttl_seconds


def decode_oidc_id_token(token: str, settings: Settings) -> dict[str, Any]:
    key_pair = resolve_oauth_key_pair(settings)
    return jwt.decode(
        token,
        key_pair.public_key_pem,
        algorithms=["RS256"],
        issuer=settings.oauth_issuer,
        options={"verify_aud": False},
    )
