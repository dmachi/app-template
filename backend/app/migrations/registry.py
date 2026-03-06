from __future__ import annotations

from collections.abc import Iterable

from app.migrations.types import MigrationDefinition


def _to_mapping(migrations: Iterable[MigrationDefinition]) -> dict[str, MigrationDefinition]:
    mapping: dict[str, MigrationDefinition] = {}
    for migration in migrations:
        if migration.id in mapping:
            raise RuntimeError(f"Duplicate migration id detected: {migration.id}")
        mapping[migration.id] = migration
    return mapping


def get_template_migrations() -> list[MigrationDefinition]:
    from app.migrations.versions.template import MIGRATIONS

    return list(MIGRATIONS)


def get_extension_migrations(existing: dict[str, MigrationDefinition]) -> dict[str, MigrationDefinition]:
    try:
        from app.extensions.migrations.definitions import MIGRATION_DEFINITIONS, extend_migrations
    except Exception:
        return {}

    extension_migrations: dict[str, MigrationDefinition] = {}
    if isinstance(MIGRATION_DEFINITIONS, dict):
        extension_migrations.update(MIGRATION_DEFINITIONS)

    extended = extend_migrations(existing)
    if isinstance(extended, dict):
        extension_migrations.update(extended)

    return extension_migrations


def get_all_migrations() -> list[MigrationDefinition]:
    template_mapping = _to_mapping(get_template_migrations())
    extension_mapping = get_extension_migrations(template_mapping)

    combined = dict(template_mapping)
    for migration_id, migration in extension_mapping.items():
        if migration_id in combined:
            raise RuntimeError(f"Duplicate migration id detected: {migration_id}")
        combined[migration_id] = migration

    return [combined[migration_id] for migration_id in sorted(combined)]
