from __future__ import annotations

from typing import Any


EXTERNAL_OAUTH_PROVIDER_DEFINITIONS: dict[str, dict[str, Any]] = {}


ENABLED_EXTERNAL_OAUTH_PROVIDER_CONFIGS: dict[str, dict[str, Any]] = {}

# Example downstream app enablement (disabled by default):
# ENABLED_EXTERNAL_OAUTH_PROVIDER_CONFIGS = {
#     "github": {
#         "client_id": "github-client-id",
#         "client_secret": "github-client-secret",
#         "required_scopes": ["read:user"],
#         "optional_scopes": [],
#         "redirect_uri": "http://localhost:5173/settings/linked-accounts",
#     },
#     "orcid": {
#         "client_id": "orcid-client-id",
#         "client_secret": "orcid-client-secret",
#         "required_scopes": ["/authenticate"],
#         "optional_scopes": [],
#         "redirect_uri": "http://localhost:5173/settings/linked-accounts",
#     },
# }


def extend_external_oauth_provider_definitions(existing: dict[str, Any]) -> dict[str, Any]:
    return {}


def extend_enabled_external_oauth_provider_configs(existing: dict[str, Any], provider_registry: dict[str, Any]) -> dict[str, Any]:
    return {}
