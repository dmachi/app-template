from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.migrations.runner import MigrationRunner
from app.migrations.startup import run_migrations_for_startup
from app.migrations.store import MigrationLockError
from app.migrations.types import AppliedMigrationRecord, MigrationContext, MigrationDefinition


class InMemoryMigrationStore:
    def __init__(self) -> None:
        self.records: dict[str, AppliedMigrationRecord] = {}
        self.lock_owner: str | None = None

    def list_applied_migrations(self) -> dict[str, AppliedMigrationRecord]:
        return dict(self.records)

    def record_applied_migration(self, record: AppliedMigrationRecord) -> None:
        self.records[record.migration_id] = record

    def acquire_lock(self, lock_name: str, owner_id: str, stale_after_seconds: int) -> bool:
        del lock_name, stale_after_seconds
        if self.lock_owner is None or self.lock_owner == owner_id:
            self.lock_owner = owner_id
            return True
        return False

    def release_lock(self, lock_name: str, owner_id: str) -> None:
        del lock_name
        if self.lock_owner == owner_id:
            self.lock_owner = None


class StubAdapter:
    provider_name = "mongodb"


class StubSettings:
    migrations_mode = "off"
    migrations_lock_stale_after_seconds = 900


def _make_migration(migration_id: str, events: list[str]) -> MigrationDefinition:
    def _run(_: MigrationContext) -> None:
        events.append(migration_id)

    return MigrationDefinition(id=migration_id, description=f"migration {migration_id}", run=_run)


def test_runner_apply_updates_status_and_records() -> None:
    events: list[str] = []
    migrations = [_make_migration("202603050001_a", events), _make_migration("202603050002_b", events)]
    store = InMemoryMigrationStore()
    runner = MigrationRunner(
        store=store,
        migrations=migrations,
        context=MigrationContext(database_adapter=StubAdapter(), settings=StubSettings()),
    )

    applied_now = runner.apply()
    status = runner.status()

    assert applied_now == ["202603050001_a", "202603050002_b"]
    assert events == ["202603050001_a", "202603050002_b"]
    assert status.pending_count == 0
    assert status.applied_count == 2


def test_runner_check_raises_when_pending() -> None:
    events: list[str] = []
    store = InMemoryMigrationStore()
    runner = MigrationRunner(
        store=store,
        migrations=[_make_migration("202603050003_c", events)],
        context=MigrationContext(database_adapter=StubAdapter(), settings=StubSettings()),
    )

    with pytest.raises(RuntimeError, match="Pending migrations detected"):
        runner.check()


def test_runner_detects_checksum_mismatch() -> None:
    events: list[str] = []
    migration = _make_migration("202603050004_d", events)
    mismatched_record = AppliedMigrationRecord(
        migration_id=migration.id,
        checksum="different",
        applied_at=datetime.now(UTC),
        applied_by="test",
    )

    store = InMemoryMigrationStore()
    store.record_applied_migration(mismatched_record)

    runner = MigrationRunner(
        store=store,
        migrations=[migration],
        context=MigrationContext(database_adapter=StubAdapter(), settings=StubSettings()),
    )

    with pytest.raises(RuntimeError, match="checksum mismatch"):
        runner.apply()


def test_runner_raises_when_lock_unavailable() -> None:
    events: list[str] = []
    store = InMemoryMigrationStore()
    store.lock_owner = "someone-else"

    runner = MigrationRunner(
        store=store,
        migrations=[_make_migration("202603050005_e", events)],
        context=MigrationContext(database_adapter=StubAdapter(), settings=StubSettings()),
    )

    with pytest.raises(MigrationLockError):
        runner.apply()


def test_startup_mode_off_skips_runner(monkeypatch) -> None:
    calls: list[str] = []

    def _unexpected_runner(settings, adapter):
        del settings, adapter
        calls.append("called")
        raise RuntimeError("should not be called")

    monkeypatch.setattr("app.migrations.startup.create_migration_runner", _unexpected_runner)
    settings = StubSettings()
    settings.migrations_mode = "off"

    run_migrations_for_startup(settings, StubAdapter())
    assert calls == []


def test_startup_mode_check_invokes_runner_check(monkeypatch) -> None:
    calls: list[str] = []

    class _Runner:
        def check(self) -> None:
            calls.append("check")

        def apply(self) -> list[str]:
            calls.append("apply")
            return []

    monkeypatch.setattr("app.migrations.startup.create_migration_runner", lambda settings, adapter: _Runner())
    settings = StubSettings()
    settings.migrations_mode = "check"

    run_migrations_for_startup(settings, StubAdapter())
    assert calls == ["check"]


def test_startup_mode_apply_invokes_runner_apply(monkeypatch) -> None:
    calls: list[str] = []

    class _Runner:
        def check(self) -> None:
            calls.append("check")

        def apply(self) -> list[str]:
            calls.append("apply")
            return []

    monkeypatch.setattr("app.migrations.startup.create_migration_runner", lambda settings, adapter: _Runner())
    settings = StubSettings()
    settings.migrations_mode = "apply"

    run_migrations_for_startup(settings, StubAdapter())
    assert calls == ["apply"]
