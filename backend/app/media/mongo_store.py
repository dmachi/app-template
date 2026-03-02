from datetime import UTC, datetime
from hashlib import sha256
from typing import Any
from uuid import uuid4

from bson import ObjectId
from gridfs import GridFSBucket
from pymongo import ASCENDING, DESCENDING

from app.media.store import MediaAssetRecord


class MongoMediaStore:
    def __init__(self, database_adapter) -> None:
        self._database_adapter = database_adapter
        self._assets = database_adapter.get_collection("media_assets")
        self._assets.create_index([("id", ASCENDING)], unique=True, name="media_id")
        self._assets.create_index([("created_at", DESCENDING)], name="created_at_desc")
        self._assets.create_index([("uploaded_by_user_id", ASCENDING)], name="uploaded_by_user_id")

    def _get_bucket(self) -> GridFSBucket:
        client = getattr(self._database_adapter, "_client", None)
        database_name = getattr(self._database_adapter, "_database_name", None)
        if client is None or not database_name:
            raise RuntimeError("Mongo client is not connected")
        return GridFSBucket(client[database_name])

    @staticmethod
    def _doc_to_record(doc: dict[str, Any]) -> MediaAssetRecord:
        return MediaAssetRecord(
            id=doc["id"],
            filename=doc["filename"],
            content_type=doc["content_type"],
            byte_size=int(doc.get("byte_size") or 0),
            sha256=doc.get("sha256") or "",
            uploaded_by_user_id=doc.get("uploaded_by_user_id") or "",
            created_at=doc.get("created_at") or datetime.now(UTC),
            updated_at=doc.get("updated_at") or datetime.now(UTC),
            alt_text=doc.get("alt_text"),
            title=doc.get("title"),
            tags=list(doc.get("tags") or []),
        )

    def upload_image(
        self,
        *,
        filename: str,
        content_type: str,
        file_bytes: bytes,
        uploaded_by_user_id: str,
    ) -> MediaAssetRecord:
        media_id = str(uuid4())
        payload = bytes(file_bytes)
        digest = sha256(payload).hexdigest()
        now = datetime.now(UTC)

        bucket = self._get_bucket()
        gridfs_file_id = bucket.upload_from_stream(filename, payload, metadata={"content_type": content_type})

        doc = {
            "id": media_id,
            "gridfs_file_id": gridfs_file_id,
            "filename": filename,
            "content_type": content_type,
            "byte_size": len(payload),
            "sha256": digest,
            "uploaded_by_user_id": uploaded_by_user_id,
            "created_at": now,
            "updated_at": now,
            "alt_text": None,
            "title": None,
            "tags": [],
        }
        self._assets.insert_one(doc)
        return self._doc_to_record(doc)

    def list_media(self) -> list[MediaAssetRecord]:
        cursor = self._assets.find({}).sort("created_at", DESCENDING)
        return [self._doc_to_record(doc) for doc in cursor]

    def get_media(self, media_id: str) -> MediaAssetRecord | None:
        doc = self._assets.find_one({"id": media_id})
        return self._doc_to_record(doc) if doc else None

    def get_media_bytes(self, media_id: str) -> bytes | None:
        doc = self._assets.find_one({"id": media_id})
        if doc is None:
            return None
        file_id = doc.get("gridfs_file_id")
        if file_id is None:
            return None

        bucket = self._get_bucket()
        stream = bucket.open_download_stream(file_id if isinstance(file_id, ObjectId) else ObjectId(file_id))
        return stream.read()

    def update_media_metadata(
        self,
        *,
        media_id: str,
        alt_text: str | None = None,
        title: str | None = None,
        tags: list[str] | None = None,
    ) -> MediaAssetRecord | None:
        doc = self._assets.find_one({"id": media_id})
        if doc is None:
            return None

        update_fields: dict[str, Any] = {"updated_at": datetime.now(UTC)}
        if alt_text is not None:
            update_fields["alt_text"] = alt_text.strip() if alt_text else None
        if title is not None:
            update_fields["title"] = title.strip() if title else None
        if tags is not None:
            update_fields["tags"] = [tag.strip() for tag in tags if tag.strip()]

        self._assets.update_one({"id": media_id}, {"$set": update_fields})
        updated = self._assets.find_one({"id": media_id})
        return self._doc_to_record(updated) if updated else None

    def delete_media(self, media_id: str) -> bool:
        doc = self._assets.find_one({"id": media_id})
        if doc is None:
            return False

        file_id = doc.get("gridfs_file_id")
        if file_id is not None:
            bucket = self._get_bucket()
            bucket.delete(file_id if isinstance(file_id, ObjectId) else ObjectId(file_id))

        result = self._assets.delete_one({"id": media_id})
        return result.deleted_count > 0
