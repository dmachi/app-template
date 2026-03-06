from __future__ import annotations

from typing import Protocol

from app.migrations.types import AppliedMigrationRecord


class MigrationStore(Protocol):
    def list_applied_migrations(self) -> dict[str, AppliedMigrationRecord]:
        ...

    def record_applied_migration(self, record: AppliedMigrationRecord) -> None:
        ...

    def acquire_lock(self, lock_name: str, owner_id: str, stale_after_seconds: int) -> bool:
        ...

    def release_lock(self, lock_name: str, owner_id: str) -> None:
        ...


class MigrationLockError(RuntimeError):
    pass
