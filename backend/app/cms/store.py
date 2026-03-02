from dataclasses import dataclass, field
from datetime import UTC, datetime
import re
from typing import Any
from uuid import uuid4


CONTENT_STATUS_DRAFT = "draft"
CONTENT_STATUS_PUBLISHED = "published"
CONTENT_STATUS_ARCHIVED = "archived"

CONTENT_VISIBILITY_PUBLIC = "public"
CONTENT_VISIBILITY_AUTHENTICATED = "authenticated"
CONTENT_VISIBILITY_ROLES = "roles"


def normalize_alias_path(alias_path: str | None) -> str | None:
    if alias_path is None:
        return None
    value = alias_path.strip().lower()
    if not value:
        return None
    if not value.startswith("/"):
        value = f"/{value}"
    while "//" in value:
        value = value.replace("//", "/")
    if value != "/" and value.endswith("/"):
        value = value.rstrip("/")
    if not re.fullmatch(r"/[a-z0-9\-/]*", value):
        raise ValueError("ALIAS_INVALID")
    return value or "/"


@dataclass
class ContentTypeRecord:
    key: str
    label: str
    description: str | None = None
    status: str = "active"
    field_definitions: list[dict[str, Any]] = field(default_factory=list)
    permissions_policy: dict[str, Any] = field(default_factory=dict)
    system_managed: bool = False
    field_order: list[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class ContentItemRecord:
    id: str
    content_type_key: str
    name: str
    content: str
    additional_fields: dict[str, Any] = field(default_factory=dict)
    alias_path: str | None = None
    status: str = CONTENT_STATUS_DRAFT
    visibility: str = CONTENT_VISIBILITY_PUBLIC
    allowed_roles: list[str] = field(default_factory=list)
    layout_key: str | None = None
    link_refs: list[dict[str, Any]] = field(default_factory=list)
    created_by_user_id: str = ""
    updated_by_user_id: str = ""
    published_at: datetime | None = None
    published_by_user_id: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))


class InMemoryCmsStore:
    def __init__(self) -> None:
        self._content_types: dict[str, ContentTypeRecord] = {}
        self._content_items: dict[str, ContentItemRecord] = {}
        self.ensure_builtin_content_type()

    def ensure_builtin_content_type(self) -> None:
        existing = self._content_types.get("page")
        now = datetime.now(UTC)
        if existing is None:
            self._content_types["page"] = ContentTypeRecord(
                key="page",
                label="Page",
                description="Built-in page content type",
                status="active",
                field_definitions=[],
                permissions_policy={},
                system_managed=True,
                created_at=now,
                updated_at=now,
            )
            return
        existing.label = existing.label or "Page"
        existing.status = "active"
        existing.system_managed = True
        existing.updated_at = now

    def list_content_types(self, *, active_only: bool = False) -> list[ContentTypeRecord]:
        items = list(self._content_types.values())
        if active_only:
            items = [item for item in items if item.status == "active"]
        return sorted(items, key=lambda item: item.key)

    def get_content_type(self, key: str) -> ContentTypeRecord | None:
        return self._content_types.get(key)

    def create_content_type(
        self,
        *,
        key: str,
        label: str,
        description: str | None,
        field_definitions: list[dict[str, Any]] | None,
        permissions_policy: dict[str, Any] | None,
        field_order: list[str] | None = None,
    ) -> ContentTypeRecord:
        normalized_key = key.strip().lower()
        if normalized_key in self._content_types:
            raise ValueError("CONTENT_TYPE_EXISTS")
        now = datetime.now(UTC)
        record = ContentTypeRecord(
            key=normalized_key,
            label=label.strip(),
            description=description.strip() if description else None,
            status="active",
            field_definitions=list(field_definitions or []),
            permissions_policy=dict(permissions_policy or {}),
            system_managed=False,
            field_order=list(field_order or []),
            created_at=now,
            updated_at=now,
        )
        self._content_types[record.key] = record
        return record

    def update_content_type(
        self,
        *,
        key: str,
        label: str | None = None,
        description: str | None = None,
        status: str | None = None,
        field_definitions: list[dict[str, Any]] | None = None,
        permissions_policy: dict[str, Any] | None = None,
        field_order: list[str] | None = None,
    ) -> ContentTypeRecord | None:
        record = self._content_types.get(key)
        if record is None:
            return None
        if record.system_managed and status == "disabled":
            raise ValueError("CONTENT_TYPE_PROTECTED")
        if label is not None:
            record.label = label.strip()
        if description is not None:
            record.description = description.strip() if description else None
        if status is not None:
            record.status = status
        if field_definitions is not None:
            record.field_definitions = list(field_definitions)
        if permissions_policy is not None:
            record.permissions_policy = dict(permissions_policy)
        if field_order is not None:
            record.field_order = list(field_order)
        record.updated_at = datetime.now(UTC)
        return record

    def list_content_items(self) -> list[ContentItemRecord]:
        return sorted(self._content_items.values(), key=lambda item: item.updated_at, reverse=True)

    def _check_alias_conflict(self, alias_path: str | None, *, ignore_content_id: str | None = None) -> None:
        if alias_path is None:
            return
        for item in self._content_items.values():
            if item.id == ignore_content_id:
                continue
            if item.alias_path == alias_path:
                raise ValueError("ALIAS_CONFLICT")

    def create_content_item(
        self,
        *,
        content_type_key: str,
        name: str,
        content: str,
        additional_fields: dict[str, Any] | None,
        alias_path: str | None,
        visibility: str,
        allowed_roles: list[str] | None,
        layout_key: str | None,
        link_refs: list[dict[str, Any]] | None,
        created_by_user_id: str,
    ) -> ContentItemRecord:
        if content_type_key not in self._content_types:
            raise ValueError("CONTENT_TYPE_NOT_FOUND")
        normalized_alias = normalize_alias_path(alias_path)
        self._check_alias_conflict(normalized_alias)
        now = datetime.now(UTC)
        record = ContentItemRecord(
            id=str(uuid4()),
            content_type_key=content_type_key,
            name=name.strip(),
            content=content,
            additional_fields=dict(additional_fields or {}),
            alias_path=normalized_alias,
            status=CONTENT_STATUS_DRAFT,
            visibility=visibility,
            allowed_roles=list(allowed_roles or []),
            layout_key=layout_key,
            link_refs=list(link_refs or []),
            created_by_user_id=created_by_user_id,
            updated_by_user_id=created_by_user_id,
            created_at=now,
            updated_at=now,
        )
        self._content_items[record.id] = record
        return record

    def get_content_item(self, content_id: str) -> ContentItemRecord | None:
        return self._content_items.get(content_id)

    def get_content_item_by_alias(self, alias_path: str) -> ContentItemRecord | None:
        normalized = normalize_alias_path(alias_path)
        if normalized is None:
            return None
        for item in self._content_items.values():
            if item.alias_path == normalized:
                return item
        return None

    def update_content_item(
        self,
        *,
        content_id: str,
        name: str | None = None,
        content: str | None = None,
        additional_fields: dict[str, Any] | None = None,
        alias_path: str | None = None,
        visibility: str | None = None,
        allowed_roles: list[str] | None = None,
        layout_key: str | None = None,
        link_refs: list[dict[str, Any]] | None = None,
        updated_by_user_id: str,
    ) -> ContentItemRecord | None:
        record = self._content_items.get(content_id)
        if record is None:
            return None
        normalized_alias = normalize_alias_path(alias_path) if alias_path is not None else record.alias_path
        self._check_alias_conflict(normalized_alias, ignore_content_id=content_id)

        if name is not None:
            record.name = name.strip()
        if content is not None:
            record.content = content
        if additional_fields is not None:
            record.additional_fields = dict(additional_fields)
        if alias_path is not None:
            record.alias_path = normalized_alias
        if visibility is not None:
            record.visibility = visibility
        if allowed_roles is not None:
            record.allowed_roles = list(allowed_roles)
        if layout_key is not None:
            record.layout_key = layout_key
        if link_refs is not None:
            record.link_refs = list(link_refs)
        record.updated_by_user_id = updated_by_user_id
        record.updated_at = datetime.now(UTC)
        return record

    def publish_content_item(self, *, content_id: str, user_id: str) -> ContentItemRecord | None:
        record = self._content_items.get(content_id)
        if record is None:
            return None
        now = datetime.now(UTC)
        record.status = CONTENT_STATUS_PUBLISHED
        record.published_at = now
        record.published_by_user_id = user_id
        record.updated_by_user_id = user_id
        record.updated_at = now
        return record

    def unpublish_content_item(self, *, content_id: str, user_id: str) -> ContentItemRecord | None:
        record = self._content_items.get(content_id)
        if record is None:
            return None
        now = datetime.now(UTC)
        record.status = CONTENT_STATUS_DRAFT
        record.published_at = None
        record.published_by_user_id = None
        record.updated_by_user_id = user_id
        record.updated_at = now
        return record

    def delete_content_item(self, *, content_id: str) -> bool:
        return self._content_items.pop(content_id, None) is not None