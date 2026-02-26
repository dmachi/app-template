from functools import lru_cache
from typing import Literal

from pydantic import ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


SUPPORTED_AUTH_PROVIDERS = {"local", "uva-netbadge"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    app_name: str = "Basic System Template"
    app_icon: str = "🧩"
    app_env: Literal["development", "test", "production"] = "development"
    api_prefix: str = "/api/v1"
    cors_allow_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    auth_mode: Literal["jwt"] = "jwt"
    jwt_access_token_secret: str | None = None
    jwt_access_token_ttl_seconds: int = 900
    jwt_refresh_token_secret: str | None = None
    jwt_refresh_token_ttl_seconds: int = 604800
    jwt_issuer: str | None = None
    jwt_audience: str | None = None
    refresh_token_rotation_enabled: bool = True
    token_transport_mode: Literal["bearer-header", "cookie"] = "bearer-header"
    refresh_token_request_field: str = "refreshToken"
    cookie_secure: bool | None = None
    cookie_same_site: Literal["lax", "strict", "none"] | None = None

    database_provider: Literal["mongodb", "sql"] = "mongodb"
    database_url: str | None = None
    database_name: str | None = None
    database_auto_create_indexes: bool = True
    database_log_level: str | None = None

    mongodb_uri: str | None = "mongodb://localhost:27017"
    mongodb_db_name: str | None = "basic_system_template"

    auth_providers_enabled: str = "local,uva-netbadge"
    local_registration_enabled: bool = True
    email_verification_required_for_login: bool = False

    email_delivery_mode: Literal["local", "external"] = "local"
    email_local_sendmail: bool = False
    email_debug: bool = False
    email_logger: bool = False
    email_from_address: str = "noreply@basic-system-template.local"
    email_from_name: str = "Basic System Template"
    email_verification_link_base_url: str = "http://localhost:5173/verify-email"
    email_verification_token_secret: str | None = None
    email_verification_token_ttl_seconds: int = 86400
    email_invitation_link_base_url: str = "http://localhost:5173/accept-invite"
    email_invitation_ttl_seconds: int = 604800

    local_smtp_host: str = "localhost"
    local_smtp_port: int = 1025
    local_smtp_use_starttls: bool = False
    local_smtp_use_ssl: bool = False

    external_smtp_host: str | None = None
    external_smtp_port: int = 587
    external_smtp_use_starttls: bool = True
    external_smtp_use_ssl: bool = False
    external_smtp_username: str | None = None
    external_smtp_password: str | None = None
    email_smtp_timeout_seconds: int = 10

    email_dkim_enabled: bool = False
    email_dkim_domain_name: str | None = None
    email_dkim_key_selector: str | None = None
    email_dkim_private_key: str | None = None
    email_dkim_private_key_path: str | None = None

    superuser_role_name: str = "superuser"
    user_management_roles: str = "superuser"

    @field_validator("jwt_access_token_ttl_seconds", "jwt_refresh_token_ttl_seconds", "email_verification_token_ttl_seconds", "email_invitation_ttl_seconds")
    @classmethod
    def validate_positive_ttl(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("Token TTL values must be positive integers")
        return value

    @field_validator("local_smtp_port", "external_smtp_port", "email_smtp_timeout_seconds")
    @classmethod
    def validate_positive_port(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("SMTP ports/timeouts must be positive integers")
        return value

    @property
    def auth_provider_list(self) -> list[str]:
        return [item.strip() for item in self.auth_providers_enabled.split(",") if item.strip()]

    @property
    def user_management_role_list(self) -> list[str]:
        return [item.strip() for item in self.user_management_roles.split(",") if item.strip()]

    @property
    def cors_allow_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_allow_origins.split(",") if item.strip()]

    @property
    def resolved_database_url(self) -> str:
        if self.database_provider == "mongodb":
            return self.mongodb_uri or self.database_url or ""
        return self.database_url or ""

    @property
    def resolved_database_name(self) -> str:
        if self.database_provider == "mongodb":
            return self.mongodb_db_name or self.database_name or ""
        return self.database_name or ""

    @model_validator(mode="after")
    def validate_runtime_configuration(self) -> "Settings":
        if self.app_env in {"production", "test"}:
            if not self.jwt_access_token_secret or not self.jwt_refresh_token_secret:
                raise ValueError("JWT secrets are required for non-development environments")

        if self.token_transport_mode == "cookie":
            if self.cookie_secure is None or self.cookie_same_site is None:
                raise ValueError("cookie_secure and cookie_same_site are required in cookie transport mode")

        if self.database_provider == "mongodb":
            if not self.resolved_database_url:
                raise ValueError("MongoDB connection URL is required for database_provider=mongodb")
            if not self.resolved_database_name:
                raise ValueError("MongoDB database name is required for database_provider=mongodb")

        unknown_providers = [provider for provider in self.auth_provider_list if provider not in SUPPORTED_AUTH_PROVIDERS]
        if unknown_providers:
            raise ValueError(f"Unknown auth provider(s): {', '.join(unknown_providers)}")

        if self.superuser_role_name not in self.user_management_role_list:
            raise ValueError("user_management_roles must include superuser_role_name")

        if self.email_delivery_mode == "external":
            if not self.external_smtp_host:
                raise ValueError("external_smtp_host is required when email_delivery_mode=external")

        if self.local_smtp_use_ssl and self.local_smtp_use_starttls:
            raise ValueError("local_smtp_use_ssl and local_smtp_use_starttls cannot both be true")

        if self.external_smtp_use_ssl and self.external_smtp_use_starttls:
            raise ValueError("external_smtp_use_ssl and external_smtp_use_starttls cannot both be true")

        if self.email_dkim_enabled:
            if not self.email_dkim_domain_name or not self.email_dkim_key_selector:
                raise ValueError("email_dkim_domain_name and email_dkim_key_selector are required when email_dkim_enabled=true")
            if not self.email_dkim_private_key and not self.email_dkim_private_key_path:
                raise ValueError("email_dkim_private_key or email_dkim_private_key_path is required when email_dkim_enabled=true")

        return self


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as exc:
        raise RuntimeError(f"Configuration validation failed: {exc}") from exc
