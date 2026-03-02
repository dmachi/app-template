from dataclasses import dataclass, field
from datetime import UTC, datetime
from hashlib import sha256
from typing import Any
from uuid import uuid4


@dataclass
class MediaAssetRecord:
    id: str
    filename: str
    content_type: str
    byte_size: int
    sha256: str
    uploaded_by_user_id: str
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    alt_text: str | None = None
    title: str | None = None
    tags: list[str] = field(default_factory=list)


class InMemoryMediaStore:
    def __init__(self) -> None:
        self._assets: dict[str, MediaAssetRecord] = {}
        self._bytes_by_id: dict[str, bytes] = {}

    def upload_image(
        self,
        *,
        filename: str,
        content_type: str,
        file_bytes: bytes,
        uploaded_by_user_id: str,
    ) -> MediaAssetRecord:
        now = datetime.now(UTC)
        media_id = str(uuid4())
        payload = bytes(file_bytes)
        record = MediaAssetRecord(
            id=media_id,
            filename=filename,
            content_type=content_type,
            byte_size=len(payload),
            sha256=sha256(payload).hexdigest(),
            uploaded_by_user_id=uploaded_by_user_id,
            created_at=now,
            updated_at=now,
        )
        self._assets[media_id] = record
        self._bytes_by_id[media_id] = payload
        return record

    def list_media(self) -> list[MediaAssetRecord]:
        return sorted(self._assets.values(), key=lambda item: item.created_at, reverse=True)

    def get_media(self, media_id: str) -> MediaAssetRecord | None:
        return self._assets.get(media_id)

    def get_media_bytes(self, media_id: str) -> bytes | None:
        return self._bytes_by_id.get(media_id)

    def update_media_metadata(
        self,
        *,
        media_id: str,
        alt_text: str | None = None,
        title: str | None = None,
        tags: list[str] | None = None,
    ) -> MediaAssetRecord | None:
        record = self._assets.get(media_id)
        if record is None:
            return None
        if alt_text is not None:
            record.alt_text = alt_text.strip() if alt_text else None
        if title is not None:
            record.title = title.strip() if title else None
        if tags is not None:
            record.tags = [tag.strip() for tag in tags if tag.strip()]
        record.updated_at = datetime.now(UTC)
        return record

    def delete_media(self, media_id: str) -> bool:
        removed_asset = self._assets.pop(media_id, None)
        self._bytes_by_id.pop(media_id, None)
        return removed_asset is not None
