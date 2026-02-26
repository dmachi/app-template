import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_cookie_transport_requires_cookie_settings():
    with pytest.raises(ValidationError):
        Settings(token_transport_mode="cookie", cookie_secure=None, cookie_same_site=None)


def test_unknown_auth_provider_fails_validation():
    with pytest.raises(ValidationError):
        Settings(auth_providers_enabled="local,unknown-provider")


def test_external_email_mode_requires_host_but_not_auth_settings():
    with pytest.raises(ValidationError):
        Settings(email_delivery_mode="external", external_smtp_host=None)

    settings = Settings(email_delivery_mode="external", external_smtp_host="smtp.example.org")
    assert settings.email_delivery_mode == "external"


def test_dkim_enabled_requires_domain_selector_and_key():
    with pytest.raises(ValidationError):
        Settings(
            email_dkim_enabled=True,
            email_dkim_domain_name=None,
            email_dkim_key_selector=None,
            email_dkim_private_key=None,
            email_dkim_private_key_path=None,
        )

    with pytest.raises(ValidationError):
        Settings(
            email_dkim_enabled=True,
            email_dkim_domain_name="bii.virginia.edu",
            email_dkim_key_selector="biocomplexity",
            email_dkim_private_key=None,
            email_dkim_private_key_path=None,
        )

    settings = Settings(
        email_dkim_enabled=True,
        email_dkim_domain_name="bii.virginia.edu",
        email_dkim_key_selector="biocomplexity",
        email_dkim_private_key="-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
    )
    assert settings.email_dkim_enabled is True


def test_smtp_ssl_and_starttls_are_mutually_exclusive():
    with pytest.raises(ValidationError):
        Settings(local_smtp_use_ssl=True, local_smtp_use_starttls=True)

    with pytest.raises(ValidationError):
        Settings(external_smtp_use_ssl=True, external_smtp_use_starttls=True)
