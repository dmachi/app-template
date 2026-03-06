from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from app.migrations.store import MigrationLockError, MigrationStore
from app.migrations.types import AppliedMigrationRecord, MigrationContext, MigrationDefinition, MigrationStatus


class MigrationRunner:
    def __init__(
        self,
        *,
        store: MigrationStore,
        migrations: list[MigrationDefinition],
        context: MigrationContext,
        lock_name: str = "default",
        lock_owner_id: str | None = None,
        lock_stale_after_seconds: int = 900,
    ) -> None:
        self._store = store
        self._migrations = migrations
        self._context = context
        self._lock_name = lock_name
        self._lock_owner_id = lock_owner_id or str(uuid4())
        self._lock_stale_after_seconds = lock_stale_after_seconds

    def _applied(self) -> dict[str, AppliedMigrationRecord]:
        return self._store.list_applied_migrations()

    def list_migrations(self) -> tuple[MigrationDefinition, ...]:
        return tuple(self._migrations)

    def status(self) -> MigrationStatus:
        applied = self._applied()
        pending_ids = tuple(migration.id for migration in self._migrations if migration.id not in applied)
        return MigrationStatus(applied_ids=tuple(sorted(applied)), pending_ids=pending_ids)

    def check(self) -> None:
        status = self.status()
        if status.pending_count:
            pending = ", ".join(status.pending_ids)
            raise RuntimeError(f"Pending migrations detected: {pending}")

    def apply(self, *, dry_run: bool = False, max_migrations: int | None = None) -> list[str]:
        lock_acquired = self._store.acquire_lock(
            self._lock_name,
            self._lock_owner_id,
            stale_after_seconds=self._lock_stale_after_seconds,
        )
        if not lock_acquired:
            raise MigrationLockError("Failed to acquire migration lock")

        applied_now: list[str] = []
        try:
            applied = self._applied()
            pending_processed = 0

            for migration in self._migrations:
                existing = applied.get(migration.id)
                resolved_checksum = migration.resolved_checksum

                if existing is not None:
                    if existing.checksum != resolved_checksum:
                        raise RuntimeError(
                            f"Migration checksum mismatch for {migration.id}: "
                            f"stored={existing.checksum} current={resolved_checksum}"
                        )
                    continue

                if max_migrations is not None and pending_processed >= max_migrations:
                    break

                pending_processed += 1
                applied_now.append(migration.id)
                if dry_run:
                    continue

                migration.run(self._context)
                record = AppliedMigrationRecord(
                    migration_id=migration.id,
                    checksum=resolved_checksum,
                    applied_at=datetime.now(UTC),
                    applied_by=self._lock_owner_id,
                )
                self._store.record_applied_migration(record)

            return applied_now
        finally:
            self._store.release_lock(self._lock_name, self._lock_owner_id)
