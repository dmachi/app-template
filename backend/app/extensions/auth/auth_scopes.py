from __future__ import annotations

from typing import Any


def extend_auth_scopes(base_scopes: dict[str, Any]) -> dict[str, Any]:
    return {}


# def exted_auth_scopes(base_scopes: dict[str, Any]) -> dict[str, Any]:
#     return {
#         "groups:read": {
#             "description": "Read group memberships",
#             "userinfo_claims": ["groups"],
#         }
#     }
