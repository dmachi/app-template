from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError

from app.cms.store import (
    CONTENT_STATUS_DRAFT,
    ContentItemRecord,
    ContentTypeRecord,
    normalize_alias_path,
)


class MongoCmsStore:
    def __init__(self, database_adapter) -> None:
        self._content_types = database_adapter.get_collection("content_types")
        self._content_items = database_adapter.get_collection("content_items")

        self._content_types.create_index([("key", ASCENDING)], unique=True, name="content_type_key")
        self._content_items.create_index(
            [("alias_path", ASCENDING)],
            unique=True,
            sparse=True,
            name="alias_path_unique_sparse",
        )
        self._content_items.create_index([("status", ASCENDING), ("visibility", ASCENDING)], name="status_visibility")
        self._content_items.create_index([("created_by_user_id", ASCENDING)], name="created_by_user_id")
        self._content_items.create_index([("updated_at", DESCENDING)], name="updated_at_desc")

        self.ensure_builtin_content_type()

    @staticmethod
    def _doc_to_content_type(doc: dict[str, Any]) -> ContentTypeRecord:
        return ContentTypeRecord(
            key=doc["key"],
            label=doc["label"],
            description=doc.get("description"),
            status=doc.get("status") or "active",
            field_definitions=list(doc.get("field_definitions") or []),
            permissions_policy=dict(doc.get("permissions_policy") or {}),
            system_managed=bool(doc.get("system_managed") or False),
            field_order=list(doc.get("field_order") or []),
            created_at=doc.get("created_at") or datetime.now(UTC),
            updated_at=doc.get("updated_at") or datetime.now(UTC),
        )

    @staticmethod
    def _doc_to_content_item(doc: dict[str, Any]) -> ContentItemRecord:
        return ContentItemRecord(
            id=doc["id"],
            content_type_key=doc["content_type_key"],
            name=doc.get("name") or "",
            content=doc.get("content") or "",
            additional_fields=dict(doc.get("additional_fields") or {}),
            alias_path=doc.get("alias_path"),
            status=doc.get("status") or CONTENT_STATUS_DRAFT,
            visibility=doc.get("visibility") or "public",
            allowed_roles=list(doc.get("allowed_roles") or []),
            layout_key=doc.get("layout_key"),
            link_refs=list(doc.get("link_refs") or []),
            created_by_user_id=doc.get("created_by_user_id") or "",
            updated_by_user_id=doc.get("updated_by_user_id") or "",
            published_at=doc.get("published_at"),
            published_by_user_id=doc.get("published_by_user_id"),
            created_at=doc.get("created_at") or datetime.now(UTC),
            updated_at=doc.get("updated_at") or datetime.now(UTC),
        )

    def ensure_builtin_content_type(self) -> None:
        now = datetime.now(UTC)
        self._content_types.update_one(
            {"key": "page"},
            {
                "$set": {
                    "label": "Page",
                    "description": "Built-in page content type",
                    "status": "active",
                    "system_managed": True,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "field_definitions": [],
                    "permissions_policy": {},
                    "field_order": ["name", "content"],
                    "created_at": now,
                },
            },
            upsert=True,
        )

    def list_content_types(self, *, active_only: bool = False) -> list[ContentTypeRecord]:
        query: dict[str, Any] = {}
        if active_only:
            query["status"] = "active"
        cursor = self._content_types.find(query).sort("key", ASCENDING)
        return [self._doc_to_content_type(doc) for doc in cursor]

    def get_content_type(self, key: str) -> ContentTypeRecord | None:
        doc = self._content_types.find_one({"key": key})
        return self._doc_to_content_type(doc) if doc else None

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
        now = datetime.now(UTC)
        normalized_field_order = list(field_order or [])
        if not normalized_field_order:
            normalized_field_order = ["name", "content"]
        try:
            self._content_types.insert_one(
                {
                    "key": normalized_key,
                    "label": label.strip(),
                    "description": description.strip() if description else None,
                    "status": "active",
                    "field_definitions": list(field_definitions or []),
                    "permissions_policy": dict(permissions_policy or {}),
                    "system_managed": False,
                    "field_order": normalized_field_order,
                    "created_at": now,
                    "updated_at": now,
                }
            )
        except DuplicateKeyError as exc:
            raise ValueError("CONTENT_TYPE_EXISTS") from exc
        return self.get_content_type(normalized_key)

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
        current = self.get_content_type(key)
        if current is None:
            return None
        if current.system_managed and status == "disabled":
            raise ValueError("CONTENT_TYPE_PROTECTED")

        update_fields: dict[str, Any] = {"updated_at": datetime.now(UTC)}
        if label is not None:
            update_fields["label"] = label.strip()
        if description is not None:
            update_fields["description"] = description.strip() if description else None
        if status is not None:
            update_fields["status"] = status
        if field_definitions is not None:
            update_fields["field_definitions"] = list(field_definitions)
        if permissions_policy is not None:
            update_fields["permissions_policy"] = dict(permissions_policy)
        if field_order is not None:
            update_fields["field_order"] = list(field_order)

        self._content_types.update_one({"key": key}, {"$set": update_fields})
        return self.get_content_type(key)

    def list_content_items(self) -> list[ContentItemRecord]:
        cursor = self._content_items.find({}).sort("updated_at", DESCENDING)
        return [self._doc_to_content_item(doc) for doc in cursor]

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
        if self.get_content_type(content_type_key) is None:
            raise ValueError("CONTENT_TYPE_NOT_FOUND")
        now = datetime.now(UTC)
        normalized_alias = normalize_alias_path(alias_path)
        record: dict[str, Any] = {
            "id": str(uuid4()),
            "content_type_key": content_type_key,
            "name": name.strip(),
            "content": content,
            "additional_fields": dict(additional_fields or {}),
            "status": CONTENT_STATUS_DRAFT,
            "visibility": visibility,
            "allowed_roles": list(allowed_roles or []),
            "layout_key": layout_key,
            "link_refs": list(link_refs or []),
            "created_by_user_id": created_by_user_id,
            "updated_by_user_id": created_by_user_id,
            "published_at": None,
            "published_by_user_id": None,
            "created_at": now,
            "updated_at": now,
        }
        if normalized_alias is not None:
            record["alias_path"] = normalized_alias
        try:
            self._content_items.insert_one(record)
        except DuplicateKeyError as exc:
            raise ValueError("ALIAS_CONFLICT") from exc
        return self._doc_to_content_item(record)

    def get_content_item(self, content_id: str) -> ContentItemRecord | None:
        doc = self._content_items.find_one({"id": content_id})
        return self._doc_to_content_item(doc) if doc else None

    def get_content_item_by_alias(self, alias_path: str) -> ContentItemRecord | None:
        normalized = normalize_alias_path(alias_path)
        if normalized is None:
            return None
        doc = self._content_items.find_one({"alias_path": normalized})
        return self._doc_to_content_item(doc) if doc else None

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
        current = self.get_content_item(content_id)
        if current is None:
            return None

        update_fields: dict[str, Any] = {
            "updated_at": datetime.now(UTC),
            "updated_by_user_id": updated_by_user_id,
        }
        if name is not None:
            update_fields["name"] = name.strip()
        if content is not None:
            update_fields["content"] = content
        if additional_fields is not None:
            update_fields["additional_fields"] = dict(additional_fields)
        if alias_path is not None:
            update_fields["alias_path"] = normalize_alias_path(alias_path)
        if visibility is not None:
            update_fields["visibility"] = visibility
        if allowed_roles is not None:
            update_fields["allowed_roles"] = list(allowed_roles)
        if layout_key is not None:
            update_fields["layout_key"] = layout_key
        if link_refs is not None:
            update_fields["link_refs"] = list(link_refs)

        update_ops: dict[str, Any] = {"$set": update_fields}
        if alias_path is not None:
            normalized_alias = normalize_alias_path(alias_path)
            if normalized_alias is None:
                update_fields.pop("alias_path", None)
                update_ops["$unset"] = {"alias_path": ""}
            else:
                update_fields["alias_path"] = normalized_alias

        try:
            self._content_items.update_one({"id": content_id}, update_ops)
        except DuplicateKeyError as exc:
            raise ValueError("ALIAS_CONFLICT") from exc
        return self.get_content_item(content_id)

    def publish_content_item(self, *, content_id: str, user_id: str) -> ContentItemRecord | None:
        now = datetime.now(UTC)
        result = self._content_items.update_one(
            {"id": content_id},
            {
                "$set": {
                    "status": "published",
                    "published_at": now,
                    "published_by_user_id": user_id,
                    "updated_at": now,
                    "updated_by_user_id": user_id,
                }
            },
        )
        if result.matched_count == 0:
            return None
        return self.get_content_item(content_id)

    def unpublish_content_item(self, *, content_id: str, user_id: str) -> ContentItemRecord | None:
        now = datetime.now(UTC)
        result = self._content_items.update_one(
            {"id": content_id},
            {
                "$set": {
                    "status": "draft",
                    "published_at": None,
                    "published_by_user_id": None,
                    "updated_at": now,
                    "updated_by_user_id": user_id,
                }
            },
        )
        if result.matched_count == 0:
            return None
        return self.get_content_item(content_id)

    def delete_content_item(self, *, content_id: str) -> bool:
        result = self._content_items.delete_one({"id": content_id})
        return result.deleted_count > 0