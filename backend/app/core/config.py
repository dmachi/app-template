from functools import lru_cache
from typing import Literal

from pydantic import ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


SUPPORTED_AUTH_PROVIDERS = {"local", "uva-netbadge"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    app_name: str = "Basic System Template"
    app_env: Literal["development", "test", "production"] = "development"
    api_prefix: str = "/api/v1"

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

    superuser_role_name: str = "superuser"
    user_management_roles: str = "superuser"

    @field_validator("jwt_access_token_ttl_seconds", "jwt_refresh_token_ttl_seconds")
    @classmethod
    def validate_positive_ttl(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("Token TTL values must be positive integers")
        return value

    @property
    def auth_provider_list(self) -> list[str]:
        return [item.strip() for item in self.auth_providers_enabled.split(",") if item.strip()]

    @property
    def user_management_role_list(self) -> list[str]:
        return [item.strip() for item in self.user_management_roles.split(",") if item.strip()]

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

        return self


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as exc:
        raise RuntimeError(f"Configuration validation failed: {exc}") from exc
