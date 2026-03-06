from __future__ import annotations

from datetime import UTC, datetime, timedelta

from pymongo.errors import DuplicateKeyError

from app.migrations.types import AppliedMigrationRecord


class MongoMigrationStore:
    def __init__(
        self,
        database_adapter,
        *,
        migrations_collection_name: str = "_schema_migrations",
        locks_collection_name: str = "_schema_migration_locks",
    ) -> None:
        self._database_adapter = database_adapter
        self._migrations_collection_name = migrations_collection_name
        self._locks_collection_name = locks_collection_name

    @property
    def _migrations_collection(self):
        return self._database_adapter.get_collection(self._migrations_collection_name)

    @property
    def _locks_collection(self):
        return self._database_adapter.get_collection(self._locks_collection_name)

    def list_applied_migrations(self) -> dict[str, AppliedMigrationRecord]:
        records: dict[str, AppliedMigrationRecord] = {}
        for document in self._migrations_collection.find({}):
            migration_id = str(document.get("migration_id") or "")
            checksum = str(document.get("checksum") or "")
            applied_at = document.get("applied_at")
            if not migration_id or not checksum or not isinstance(applied_at, datetime):
                continue
            applied_by_value = document.get("applied_by")
            applied_by = str(applied_by_value) if isinstance(applied_by_value, str) else None
            records[migration_id] = AppliedMigrationRecord(
                migration_id=migration_id,
                checksum=checksum,
                applied_at=applied_at,
                applied_by=applied_by,
            )
        return records

    def record_applied_migration(self, record: AppliedMigrationRecord) -> None:
        self._migrations_collection.update_one(
            {"migration_id": record.migration_id},
            {
                "$set": {
                    "checksum": record.checksum,
                    "applied_at": record.applied_at,
                    "applied_by": record.applied_by,
                },
                "$setOnInsert": {"migration_id": record.migration_id},
            },
            upsert=True,
        )

    def acquire_lock(self, lock_name: str, owner_id: str, stale_after_seconds: int) -> bool:
        now = datetime.now(UTC)
        stale_cutoff = now - timedelta(seconds=stale_after_seconds)

        existing = self._locks_collection.find_one({"_id": lock_name})
        if existing is None:
            try:
                self._locks_collection.insert_one({"_id": lock_name, "owner_id": owner_id, "acquired_at": now})
                return True
            except DuplicateKeyError:
                existing = self._locks_collection.find_one({"_id": lock_name})

        if existing is None:
            return False

        query = {
            "_id": lock_name,
            "$or": [
                {"owner_id": owner_id},
                {"acquired_at": {"$lt": stale_cutoff}},
            ],
        }
        update_result = self._locks_collection.update_one(query, {"$set": {"owner_id": owner_id, "acquired_at": now}})
        return update_result.modified_count > 0

    def release_lock(self, lock_name: str, owner_id: str) -> None:
        self._locks_collection.delete_one({"_id": lock_name, "owner_id": owner_id})
