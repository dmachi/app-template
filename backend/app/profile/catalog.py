from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse


ORCID_PATTERN = re.compile(r"^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$")


@dataclass(frozen=True)
class ProfilePropertyDefinition:
    key: str
    label: str
    description: str
    value_type: str
    placeholder: str | None = None
    allowed_hosts: tuple[str, ...] = ()
    max_items: int | None = None
    is_core: bool = False

    def to_public_dict(self, required: bool = False) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "key": self.key,
            "label": self.label,
            "description": self.description,
            "valueType": self.value_type,
            "required": required,
        }
        if self.placeholder:
            payload["placeholder"] = self.placeholder
        if self.allowed_hosts:
            payload["allowedHosts"] = list(self.allowed_hosts)
        if self.max_items is not None:
            payload["maxItems"] = self.max_items
        return payload


@dataclass(frozen=True)
class ProfilePropertySelection:
    enabled_keys: list[str]
    required_keys: set[str]


PROFILE_PROPERTY_DEFINITIONS: tuple[ProfilePropertyDefinition, ...] = (
    ProfilePropertyDefinition(
        key="orcid",
        label="ORCID",
        description="ORCID researcher identifier in 0000-0000-0000-0000 format.",
        value_type="text",
        placeholder="0000-0000-0000-0000",
    ),
    ProfilePropertyDefinition(
        key="googleScholarUrl",
        label="Google Scholar URL",
        description="Link to your Google Scholar profile.",
        value_type="url",
        placeholder="https://scholar.google.com/citations?user=...",
        allowed_hosts=("scholar.google.com",),
    ),
    ProfilePropertyDefinition(
        key="githubProfileUrl",
        label="GitHub Profile URL",
        description="Link to your public GitHub profile.",
        value_type="url",
        placeholder="https://github.com/username",
        allowed_hosts=("github.com", "www.github.com"),
    ),
    ProfilePropertyDefinition(
        key="linkedInUrl",
        label="LinkedIn URL",
        description="Link to your LinkedIn profile.",
        value_type="url",
        placeholder="https://www.linkedin.com/in/username",
        allowed_hosts=("linkedin.com", "www.linkedin.com"),
    ),
    ProfilePropertyDefinition(
        key="researchGateUrl",
        label="ResearchGate URL",
        description="Link to your ResearchGate profile.",
        value_type="url",
        placeholder="https://www.researchgate.net/profile/...",
        allowed_hosts=("researchgate.net", "www.researchgate.net"),
    ),
    ProfilePropertyDefinition(
        key="xUrl",
        label="X/Twitter URL",
        description="Link to your X (Twitter) profile.",
        value_type="url",
        placeholder="https://x.com/username",
        allowed_hosts=("x.com", "www.x.com", "twitter.com", "www.twitter.com"),
    ),
    ProfilePropertyDefinition(
        key="personalWebsiteUrl",
        label="Personal Website",
        description="Main personal or lab website URL.",
        value_type="url",
        placeholder="https://example.org",
    ),
    ProfilePropertyDefinition(
        key="organization",
        label="Organization",
        description="Organization, department, or affiliation.",
        value_type="text",
        placeholder="Department of ...",
    ),
    ProfilePropertyDefinition(
        key="externalLinks",
        label="Additional Links",
        description="Arbitrary external links (e.g., lab pages, social profiles, publications).",
        value_type="links",
        max_items=10,
    ),
)

PROFILE_PROPERTY_KEYS = {item.key for item in PROFILE_PROPERTY_DEFINITIONS}
PROFILE_PROPERTY_BY_KEY = {item.key: item for item in PROFILE_PROPERTY_DEFINITIONS}
PROFILE_PROPERTY_CORE_KEYS = {item.key for item in PROFILE_PROPERTY_DEFINITIONS if item.is_core}
PROFILE_PROPERTY_NON_CORE_KEYS = {item.key for item in PROFILE_PROPERTY_DEFINITIONS if not item.is_core}


def parse_profile_property_selection(configured_keys: str) -> ProfilePropertySelection:
    normalized_tokens = [item.strip() for item in configured_keys.split(",") if item.strip()]

    has_wildcard = any((token[1:] if token.startswith("!") else token) == "*" for token in normalized_tokens)

    enabled: list[str] = []
    seen: set[str] = set()

    for definition in PROFILE_PROPERTY_DEFINITIONS:
        if definition.is_core and definition.key not in seen:
            enabled.append(definition.key)
            seen.add(definition.key)

    if has_wildcard:
        for definition in PROFILE_PROPERTY_DEFINITIONS:
            if not definition.is_core and definition.key not in seen:
                enabled.append(definition.key)
                seen.add(definition.key)
    else:
        for token in normalized_tokens:
            key = token[1:] if token.startswith("!") else token
            if key == "*":
                continue
            if key in PROFILE_PROPERTY_NON_CORE_KEYS and key not in seen:
                enabled.append(key)
                seen.add(key)

    required: set[str] = set()
    for token in normalized_tokens:
        if not token.startswith("!"):
            continue
        key = token[1:]
        if key == "*":
            for enabled_key in enabled:
                required.add(enabled_key)
            continue
        if key in seen:
            required.add(key)

    return ProfilePropertySelection(enabled_keys=enabled, required_keys=required)


def parse_enabled_profile_property_keys(configured_keys: str) -> list[str]:
    return parse_profile_property_selection(configured_keys).enabled_keys


def serialize_profile_property_catalog(configured_keys: str) -> list[dict[str, Any]]:
    selection = parse_profile_property_selection(configured_keys)
    return [
        PROFILE_PROPERTY_BY_KEY[key].to_public_dict(required=key in selection.required_keys)
        for key in selection.enabled_keys
    ]


def get_required_profile_property_keys(configured_keys: str) -> set[str]:
    return set(parse_profile_property_selection(configured_keys).required_keys)


def _validate_url(value: Any, allowed_hosts: tuple[str, ...], key: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"PROFILE_PROPERTY_INVALID:{key}:Expected URL string")
    text = value.strip()
    if not text:
        return ""

    parsed = urlparse(text)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"PROFILE_PROPERTY_INVALID:{key}:Expected http/https URL")

    host = parsed.netloc.lower()
    if allowed_hosts and host not in {allowed.lower() for allowed in allowed_hosts}:
        hosts = ", ".join(allowed_hosts)
        raise ValueError(f"PROFILE_PROPERTY_INVALID:{key}:URL host must be one of {hosts}")
    return text


def _validate_links(value: Any, max_items: int | None, key: str) -> list[dict[str, str]]:
    if not isinstance(value, list):
        raise ValueError(f"PROFILE_PROPERTY_INVALID:{key}:Expected list of links")

    if max_items is not None and len(value) > max_items:
        raise ValueError(f"PROFILE_PROPERTY_INVALID:{key}:At most {max_items} links are allowed")

    validated: list[dict[str, str]] = []
    for index, item in enumerate(value):
        if not isinstance(item, dict):
            raise ValueError(f"PROFILE_PROPERTY_INVALID:{key}:Link #{index + 1} must be an object")

        label = item.get("label")
        url = item.get("url")
        if not isinstance(label, str) or not label.strip():
            raise ValueError(f"PROFILE_PROPERTY_INVALID:{key}:Link #{index + 1} requires a label")

        normalized_url = _validate_url(url, (), f"{key}.url")
        if not normalized_url:
            raise ValueError(f"PROFILE_PROPERTY_INVALID:{key}:Link #{index + 1} requires a URL")

        validated.append(
            {
                "label": label.strip(),
                "url": normalized_url,
            }
        )
    return validated


def sanitize_profile_properties(raw: Any, configured_keys: str) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    enabled_keys = set(parse_profile_property_selection(configured_keys).enabled_keys)
    return {key: value for key, value in raw.items() if key in enabled_keys}


def validate_profile_properties(payload: dict[str, Any], configured_keys: str) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("PROFILE_PROPERTY_INVALID:profileProperties:Expected object")

    enabled_keys = set(parse_profile_property_selection(configured_keys).enabled_keys)
    validated: dict[str, Any] = {}
    for key, value in payload.items():
        if key not in PROFILE_PROPERTY_BY_KEY:
            raise ValueError(f"PROFILE_PROPERTY_UNKNOWN:{key}:Unknown profile property")
        if key not in enabled_keys:
            raise ValueError(f"PROFILE_PROPERTY_DISABLED:{key}:Property is disabled for this application")

        definition = PROFILE_PROPERTY_BY_KEY[key]
        if definition.value_type == "text":
            if not isinstance(value, str):
                raise ValueError(f"PROFILE_PROPERTY_INVALID:{key}:Expected string")
            normalized_text = value.strip()
            if key == "orcid" and normalized_text and not ORCID_PATTERN.fullmatch(normalized_text):
                raise ValueError(f"PROFILE_PROPERTY_INVALID:{key}:Expected ORCID format 0000-0000-0000-0000")
            if normalized_text:
                validated[key] = normalized_text
        elif definition.value_type == "url":
            normalized_url = _validate_url(value, definition.allowed_hosts, key)
            if normalized_url:
                validated[key] = normalized_url
        elif definition.value_type == "boolean":
            if not isinstance(value, bool):
                raise ValueError(f"PROFILE_PROPERTY_INVALID:{key}:Expected boolean")
            validated[key] = value
        elif definition.value_type == "links":
            links = _validate_links(value, definition.max_items, key)
            if links:
                validated[key] = links
        else:
            raise ValueError(f"PROFILE_PROPERTY_INVALID:{key}:Unsupported value type")
    return validated


def validate_required_profile_properties(validated_payload: dict[str, Any], configured_keys: str) -> None:
    required_keys = get_required_profile_property_keys(configured_keys)
    for key in required_keys:
        if key not in validated_payload:
            raise ValueError(f"PROFILE_PROPERTY_REQUIRED:{key}:Property is required")