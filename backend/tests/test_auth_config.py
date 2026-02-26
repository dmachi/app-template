from app.core.config import get_settings


def test_auth_settings_defaults():
    settings = get_settings()
    assert settings.token_transport_mode in {"bearer-header", "cookie"}
    assert settings.refresh_token_rotation_enabled is True
    assert "superuser" in settings.user_management_role_list
