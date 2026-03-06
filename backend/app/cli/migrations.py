from __future__ import annotations

import argparse

from app.core.config import get_settings
from app.db.factory import create_database_adapter
from app.migrations.startup import create_migration_runner


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run backend schema/data migrations")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("list", help="List all known migrations")
    subparsers.add_parser("status", help="Show applied/pending migration status")
    subparsers.add_parser("check", help="Exit non-zero when migrations are pending")

    apply_parser = subparsers.add_parser("apply", help="Apply pending migrations")
    apply_parser.add_argument("--dry-run", action="store_true", help="List pending migrations without applying")
    apply_parser.add_argument("--max", type=int, default=None, dest="max_migrations", help="Apply at most N pending migrations")

    return parser


def main(argv: list[str] | None = None) -> None:
    args = _build_parser().parse_args(argv)
    settings = get_settings()
    adapter = create_database_adapter(settings)
    adapter.connect()

    try:
        runner = create_migration_runner(settings, adapter)

        if args.command == "list":
            for migration in runner.list_migrations():
                print(f"{migration.id} - {migration.description}")
            return

        if args.command == "status":
            status = runner.status()
            print(f"applied={status.applied_count} pending={status.pending_count}")
            if status.pending_ids:
                print("pending:")
                for migration_id in status.pending_ids:
                    print(f"- {migration_id}")
            return

        if args.command == "check":
            runner.check()
            print("ok: no pending migrations")
            return

        if args.command == "apply":
            applied_now = runner.apply(dry_run=args.dry_run, max_migrations=args.max_migrations)
            if args.dry_run:
                print("dry-run pending:")
            else:
                print("applied:")
            for migration_id in applied_now:
                print(f"- {migration_id}")
            if not applied_now:
                print("- none")
            return

        raise RuntimeError(f"Unsupported command: {args.command}")
    finally:
        adapter.close()


if __name__ == "__main__":
    main()
