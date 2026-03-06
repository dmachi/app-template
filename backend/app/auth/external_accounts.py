from __future__ import annotations

from app.auth.security import decrypt_external_account_token
from app.core.config import Settings
from app.core.errors import ApiError


def has_linked_external_account(auth_store, user_id: str, provider: str) -> bool:
    record = auth_store.get_active_external_account_linkage(user_id=user_id, provider=provider)
    return record is not None


def get_linked_external_account_scopes(auth_store, user_id: str, provider: str) -> set[str]:
    record = auth_store.get_active_external_account_linkage(user_id=user_id, provider=provider)
    if record is None:
        return set()
    return {scope.strip() for scope in record.scopes if scope and scope.strip()}


def get_linked_external_access_token(
    *,
    auth_store,
    settings: Settings,
    user_id: str,
    provider: str,
    required_scopes: set[str] | None = None,
) -> str:
    record = auth_store.get_active_external_account_linkage(user_id=user_id, provider=provider)
    if record is None:
        raise ApiError(status_code=404, code="LINKED_ACCOUNT_NOT_FOUND", message="Linked external account not found")

    available_scopes = {scope.strip() for scope in (record.scopes or []) if scope and scope.strip()}
    needed_scopes = {scope.strip() for scope in (required_scopes or set()) if scope and scope.strip()}
    if needed_scopes and not needed_scopes.issubset(available_scopes):
        raise ApiError(status_code=403, code="INSUFFICIENT_EXTERNAL_SCOPE", message="Linked account does not include required scope")

    if not record.access_token_encrypted:
        raise ApiError(status_code=409, code="LINKED_ACCOUNT_TOKEN_UNAVAILABLE", message="Linked account access token is unavailable")

    auth_store.touch_external_account_linkage_last_used(user_id=user_id, provider=provider)
    return decrypt_external_account_token(record.access_token_encrypted, settings)
