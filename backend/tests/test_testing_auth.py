"""Tests for testing authentication bypass mechanism."""

import re
from urllib.parse import unquote

from fastapi.testclient import TestClient

from app.core.config import Settings


def register_user(client: TestClient, username: str, email: str, password: str = "Password123") -> None:
    """Register and verify user."""
    register = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "displayName": username.title(),
        },
    )
    assert register.status_code == 200

    mail_sender = client.app.state.mail_sender
    assert hasattr(mail_sender, "outbox")
    assert mail_sender.outbox
    body = mail_sender.outbox[-1].text_body
    match = re.search(r"token=([^\s]+)", body)
    assert match is not None

    verify = client.get("/api/v1/auth/verify-email", params={"token": unquote(match.group(1))})
    assert verify.status_code == 200


def test_testing_auth_allows_notification_create_in_dev(client: TestClient) -> None:
    """Testing credentials should work in development mode."""
    auth_store = client.app.state.auth_store
    
    # Create and verify users via registration API
    register_user(client, "testinguser", "testinguser@example.com")
    register_user(client, "recipient", "recipient@example.com")
    
    # Make the testing user a superuser
    superuser = auth_store.authenticate_local_user("testinguser", "Password123")
    assert superuser is not None
    superuser.roles = ["Superuser"]
    
    # Get recipient user ID
    recipient_user = auth_store.authenticate_local_user("recipient", "Password123")
    assert recipient_user is not None
    
    # Override settings with testing credentials
    settings = Settings(
        app_env="development",
        testing_id=superuser.id,
        testing_key="test-secret-key",
        jwt_access_token_secret="test-secret",
        jwt_refresh_token_secret="test-secret",
    )
    
    # Store original settings getter
    from app.core import config as config_module
    original_get_settings = config_module.get_settings
    
    try:
        # Override get_settings to return our test settings
        config_module.get_settings = lambda: settings
        
        # Make request with testing headers
        response = client.post(
            "/api/v1/notifications",
            json={
                "userIds": [recipient_user.id],
                "type": "test",
                "message": "Testing notification",
                "severity": "info",
                "requiresAcknowledgement": False,
                "clearanceMode": "manual",
            },
            headers={
                "X-Testing-Id": superuser.id,
                "X-Testing-Key": "test-secret-key",
            }
        )
        
        assert response.status_code == 200
        result = response.json()
        assert "created" in result
        assert len(result["created"]) == 1
        assert result["created"][0]["message"] == "Testing notification"
        
    finally:
        # Restore original settings getter
        config_module.get_settings = original_get_settings


def test_testing_auth_rejected_with_wrong_key(client: TestClient) -> None:
    """Testing credentials should be rejected with wrong key."""
    auth_store = client.app.state.auth_store
    
    register_user(client, "testinguser2", "testinguser2@example.com")
    register_user(client, "recipient2", "recipient2@example.com")
    
    superuser = auth_store.authenticate_local_user("testinguser2", "Password123")
    assert superuser is not None
    superuser.roles = ["Superuser"]
    
    recipient_user = auth_store.authenticate_local_user("recipient2", "Password123")
    assert recipient_user is not None
    
    settings = Settings(
        app_env="development",
        testing_id=superuser.id,
        testing_key="correct-key",
        jwt_access_token_secret="test-secret",
        jwt_refresh_token_secret="test-secret",
    )
    
    from app.core import config as config_module
    original_get_settings = config_module.get_settings
    
    try:
        config_module.get_settings = lambda: settings
        
        # Make request with wrong testing key
        response = client.post(
            "/api/v1/notifications",
            json={
                "userIds": [recipient_user.id],
                "type": "test",
                "message": "Should not work",
                "severity": "info",
            },
            headers={
                "X-Testing-Id": superuser.id,
                "X-Testing-Key": "wrong-key",
            }
        )
        
        # Should fail with 401 (falls through to normal auth which requires JWT)
        assert response.status_code == 401
        
    finally:
        config_module.get_settings = original_get_settings


def test_testing_auth_disabled_in_production(client: TestClient) -> None:
    """Testing credentials should not work in production mode."""
    auth_store = client.app.state.auth_store
    
    register_user(client, "testinguser3", "testinguser3@example.com")
    register_user(client, "recipient3", "recipient3@example.com")
    
    superuser = auth_store.authenticate_local_user("testinguser3", "Password123")
    assert superuser is not None
    superuser.roles = ["Superuser"]
    
    recipient_user = auth_store.authenticate_local_user("recipient3", "Password123")
    assert recipient_user is not None
    
    settings = Settings(
        app_env="production",
        testing_id=superuser.id,
        testing_key="test-secret-key",
        jwt_access_token_secret="test-secret",
        jwt_refresh_token_secret="test-secret",
    )
    
    from app.core import config as config_module
    original_get_settings = config_module.get_settings
    
    try:
        config_module.get_settings = lambda: settings
        
        # Make request with testing headers in production mode
        response = client.post(
            "/api/v1/notifications",
            json={
                "userIds": [recipient_user.id],
                "type": "test",
                "message": "Should not work in production",
                "severity": "info",
            },
            headers={
                "X-Testing-Id": superuser.id,
                "X-Testing-Key": "test-secret-key",
            }
        )
        
        # Should fail with 401 since testing auth is disabled in production
        assert response.status_code == 401
        
    finally:
        config_module.get_settings = original_get_settings
