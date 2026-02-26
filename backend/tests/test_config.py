import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_user_management_roles_must_include_superuser():
    with pytest.raises(ValidationError):
        Settings(user_management_roles="user-manager", superuser_role_name="superuser")


def test_cookie_transport_requires_cookie_settings():
    with pytest.raises(ValidationError):
        Settings(token_transport_mode="cookie", cookie_secure=None, cookie_same_site=None)


def test_unknown_auth_provider_fails_validation():
    with pytest.raises(ValidationError):
        Settings(auth_providers_enabled="local,unknown-provider")
