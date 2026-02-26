import argparse
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from pymongo import MongoClient

from app.auth.security import hash_password
from app.core.config import get_settings


def normalize_email(email: str) -> str:
    return email.strip().lower()


def upsert_superuser_user(
    users_collection,
    *,
    username: str,
    email: str,
    password: str,
    display_name: str,
    superuser_role_name: str,
) -> tuple[str, str]:
    normalized_username = username.strip()
    normalized_username_lookup = username.strip().lower()
    normalized_email = normalize_email(email)
    now = datetime.now(UTC)

    existing = users_collection.find_one(
        {
            "$or": [
                {"email_normalized": normalized_email},
                {"username": {"$regex": f"^{normalized_username}$", "$options": "i"}},
            ]
        }
    )

    if existing is None:
        user_id = str(uuid4())
        users_collection.insert_one(
            {
                "id": user_id,
                "username": normalized_username,
                "username_normalized": normalized_username_lookup,
                "email": email.strip(),
                "email_normalized": normalized_email,
                "password_hash": hash_password(password),
                "display_name": display_name.strip(),
                "status": "active",
                "roles": [superuser_role_name],
                "preferences": {},
                "created_at": now,
                "updated_at": now,
            }
        )
        return "created", user_id

    roles = existing.get("roles") or []
    if superuser_role_name not in roles:
        roles.append(superuser_role_name)

    users_collection.update_one(
        {"id": existing["id"]},
        {
            "$set": {
                "username": normalized_username,
                "username_normalized": normalized_username_lookup,
                "email": email.strip(),
                "email_normalized": normalized_email,
                "password_hash": hash_password(password),
                "display_name": display_name.strip(),
                "status": "active",
                "roles": roles,
                "updated_at": now,
            }
        },
    )
    return "updated", existing["id"]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed or update a superuser in the configured MongoDB database")
    parser.add_argument("--username", required=True, help="Superuser username")
    parser.add_argument("--email", required=True, help="Superuser email")
    parser.add_argument("--password", required=True, help="Superuser password")
    parser.add_argument("--display-name", default="System Superuser", help="Display name for the superuser")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    settings = get_settings()

    if settings.database_provider != "mongodb":
        raise RuntimeError("seed-superuser currently supports database_provider=mongodb only")

    if len(args.password) < 8:
        raise RuntimeError("Password must be at least 8 characters")

    mongo_uri = settings.resolved_database_url
    database_name = settings.resolved_database_name
    if not mongo_uri or not database_name:
        raise RuntimeError("MongoDB configuration is required (MONGODB_URI and MONGODB_DB_NAME)")

    client = MongoClient(mongo_uri)
    try:
        database = client[database_name]
        users_collection = database["users"]
        action, user_id = upsert_superuser_user(
            users_collection,
            username=args.username,
            email=args.email,
            password=args.password,
            display_name=args.display_name,
            superuser_role_name=settings.superuser_role_name,
        )
    finally:
        client.close()

    print(f"seed-superuser: {action} user id={user_id}")


if __name__ == "__main__":
    main()
