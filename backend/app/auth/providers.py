from dataclasses import dataclass

from app.core.config import Settings


@dataclass(frozen=True)
class AuthProviderDescriptor:
    provider_id: str
    display_name: str
    provider_type: str


KNOWN_PROVIDERS: dict[str, AuthProviderDescriptor] = {
    "local": AuthProviderDescriptor(provider_id="local", display_name="Local Account", provider_type="credentials"),
    "uva-netbadge": AuthProviderDescriptor(provider_id="uva-netbadge", display_name="UVA NetBadge", provider_type="redirect"),
}


def get_enabled_providers(settings: Settings) -> list[AuthProviderDescriptor]:
    return [KNOWN_PROVIDERS[provider_id] for provider_id in settings.auth_provider_list if provider_id in KNOWN_PROVIDERS]
