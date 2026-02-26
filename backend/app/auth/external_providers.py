from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from fastapi import Request

from app.core.config import Settings
from app.core.errors import ApiError


@dataclass
class ExternalProviderStartResult:
    provider: str
    mode: str
    redirect_url: str | None = None


@dataclass
class ExternalProviderCallbackResult:
    provider: str
    status: str


class ExternalAuthProvider(Protocol):
    provider_id: str
    display_name: str

    def initiate_auth(self, request: Request, settings: Settings) -> ExternalProviderStartResult: ...

    def handle_callback(self, request: Request, settings: Settings) -> ExternalProviderCallbackResult: ...


class UvaNetBadgeProvider:
    provider_id = "uva-netbadge"
    display_name = "UVA NetBadge"

    def initiate_auth(self, request: Request, settings: Settings) -> ExternalProviderStartResult:
        raise ApiError(
            status_code=501,
            code="PROVIDER_NOT_IMPLEMENTED",
            message="UVA NetBadge provider scaffolding is in place but not implemented",
            details={"provider": self.provider_id, "phase": "milestone-3-scaffold"},
        )

    def handle_callback(self, request: Request, settings: Settings) -> ExternalProviderCallbackResult:
        raise ApiError(
            status_code=501,
            code="PROVIDER_NOT_IMPLEMENTED",
            message="UVA NetBadge provider scaffolding is in place but not implemented",
            details={"provider": self.provider_id, "phase": "milestone-3-scaffold"},
        )


class UnsupportedExternalProvider:
    def __init__(self, provider_id: str) -> None:
        self.provider_id = provider_id

    def initiate_auth(self, request: Request, settings: Settings) -> ExternalProviderStartResult:
        raise ApiError(status_code=400, code="PROVIDER_NOT_REDIRECT", message=f"Provider '{self.provider_id}' is not redirect-based")

    def handle_callback(self, request: Request, settings: Settings) -> ExternalProviderCallbackResult:
        raise ApiError(status_code=400, code="PROVIDER_NOT_REDIRECT", message=f"Provider '{self.provider_id}' is not redirect-based")


def get_external_provider_adapter(provider_id: str, settings: Settings) -> ExternalAuthProvider:
    if provider_id not in settings.auth_provider_list:
        raise ApiError(status_code=404, code="PROVIDER_DISABLED", message=f"Provider '{provider_id}' is not enabled")

    if provider_id == "uva-netbadge":
        return UvaNetBadgeProvider()

    return UnsupportedExternalProvider(provider_id)
