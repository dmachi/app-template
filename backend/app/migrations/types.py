from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from app.core.config import Settings
    from app.db.base import DatabaseAdapter

MigrationCallable = Callable[["MigrationContext"], None]


@dataclass(frozen=True)
class MigrationDefinition:
    id: str
    description: str
    run: MigrationCallable
    checksum: str | None = None

    @property
    def resolved_checksum(self) -> str:
        if self.checksum and self.checksum.strip():
            return self.checksum.strip()
        payload = f"{self.id}:{self.description}".encode("utf-8")
        return sha256(payload).hexdigest()


@dataclass
class MigrationContext:
    database_adapter: "DatabaseAdapter"
    settings: "Settings"


@dataclass(frozen=True)
class AppliedMigrationRecord:
    migration_id: str
    checksum: str
    applied_at: datetime
    applied_by: str | None = None


@dataclass(frozen=True)
class MigrationStatus:
    applied_ids: tuple[str, ...]
    pending_ids: tuple[str, ...]

    @property
    def applied_count(self) -> int:
        return len(self.applied_ids)

    @property
    def pending_count(self) -> int:
        return len(self.pending_ids)
