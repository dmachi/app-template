from __future__ import annotations

from app.core.config import Settings
from app.migrations.mongo_store import MongoMigrationStore
from app.migrations.registry import get_all_migrations
from app.migrations.runner import MigrationRunner
from app.migrations.types import MigrationContext


def create_migration_runner(settings: Settings, database_adapter) -> MigrationRunner:
    if database_adapter.provider_name != "mongodb":
        raise RuntimeError(f"Migrations are not yet implemented for provider={database_adapter.provider_name}")

    migration_store = MongoMigrationStore(database_adapter)
    migration_context = MigrationContext(database_adapter=database_adapter, settings=settings)
    migrations = get_all_migrations()
    return MigrationRunner(
        store=migration_store,
        migrations=migrations,
        context=migration_context,
        lock_name="schema-migrations",
        lock_stale_after_seconds=settings.migrations_lock_stale_after_seconds,
    )


def run_migrations_for_startup(settings: Settings, database_adapter) -> None:
    mode = settings.migrations_mode
    if mode == "off":
        return

    runner = create_migration_runner(settings, database_adapter)
    if mode == "check":
        runner.check()
        return

    if mode == "apply":
        runner.apply()
        return

    raise RuntimeError(f"Unsupported migrations_mode value: {mode}")
