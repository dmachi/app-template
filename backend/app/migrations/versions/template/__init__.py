from __future__ import annotations

from app.migrations.types import MigrationContext, MigrationDefinition


def _template_baseline(_: MigrationContext) -> None:
    return None


MIGRATIONS: list[MigrationDefinition] = [
    MigrationDefinition(
        id="202603050000_template_baseline",
        description="Template baseline migration marker",
        run=_template_baseline,
        checksum="template-baseline-v1",
    )
]
