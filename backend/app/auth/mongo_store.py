from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.auth.security import generate_refresh_token, hash_password, hash_refresh_token, verify_password
from app.auth.store import GroupRecord, UserRecord
from app.core.config import Settings


class MongoAuthStore:
    def __init__(self, database_adapter) -> None:
        self._users = database_adapter.get_collection("users")
        self._groups = database_adapter.get_collection("groups")
        self._memberships = database_adapter.get_collection("group_memberships")
        self._sessions = database_adapter.get_collection("sessions")

    @staticmethod
    def normalize_email(email: str) -> str:
        return email.strip().lower()

    @staticmethod
    def normalize_username(username: str) -> str:
        return username.strip().lower()

    @staticmethod
    def _to_utc_naive(value: datetime | None) -> datetime:
        if value is None:
            return datetime.utcnow()
        if value.tzinfo is None:
            return value
        return value.astimezone(UTC).replace(tzinfo=None)

    def _doc_to_user(self, doc) -> UserRecord:
        return UserRecord(
            id=doc["id"],
            username=doc["username"],
            email=doc["email"],
            email_normalized=doc.get("email_normalized") or self.normalize_email(doc["email"]),
            password_hash=doc["password_hash"],
            display_name=doc.get("display_name") or doc["username"],
            status=doc.get("status") or "active",
            roles=doc.get("roles") or [],
            preferences=doc.get("preferences") or {},
        )

    def _doc_to_group(self, doc) -> GroupRecord:
        return GroupRecord(
            id=doc["id"],
            name=doc["name"],
            description=doc.get("description"),
            owner_user_id=doc["owner_user_id"],
            created_at=doc.get("created_at") or datetime.now(UTC),
            updated_at=doc.get("updated_at") or datetime.now(UTC),
        )

    def upsert_user_record(
        self,
        *,
        user_id: str,
        username: str,
        email: str,
        password_hash: str,
        display_name: str,
        status: str = "active",
        roles: list[str] | None = None,
        preferences: dict | None = None,
    ) -> UserRecord:
        self._users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "id": user_id,
                    "username": username.strip(),
                    "username_normalized": self.normalize_username(username),
                    "email": email.strip(),
                    "email_normalized": self.normalize_email(email),
                    "password_hash": password_hash,
                    "display_name": display_name.strip(),
                    "status": status,
                    "roles": list(roles or []),
                    "preferences": dict(preferences or {}),
                    "updated_at": datetime.now(UTC),
                },
                "$setOnInsert": {"created_at": datetime.now(UTC)},
            },
            upsert=True,
        )
        return self.get_user(user_id)

    def register_local_user(self, username: str, email: str, password: str, display_name: str | None = None) -> UserRecord:
        normalized_email = self.normalize_email(email)
        normalized_username = self.normalize_username(username)

        if self._users.find_one({"email_normalized": normalized_email}):
            raise ValueError("EMAIL_ALREADY_EXISTS")
        if self._users.find_one({"username_normalized": normalized_username}) or self._users.find_one(
            {"username": {"$regex": f"^{username.strip()}$", "$options": "i"}}
        ):
            raise ValueError("USERNAME_ALREADY_EXISTS")

        user_id = str(uuid4())
        now = datetime.now(UTC)
        self._users.insert_one(
            {
                "id": user_id,
                "username": username.strip(),
                "username_normalized": normalized_username,
                "email": email.strip(),
                "email_normalized": normalized_email,
                "password_hash": hash_password(password),
                "display_name": (display_name or username).strip(),
                "status": "active",
                "roles": [],
                "preferences": {},
                "created_at": now,
                "updated_at": now,
            }
        )
        return self.get_user(user_id)

    def authenticate_local_user(self, username_or_email: str, password: str) -> UserRecord | None:
        lookup = username_or_email.strip().lower()
        doc = self._users.find_one(
            {
                "$or": [
                    {"email_normalized": lookup},
                    {"username_normalized": lookup},
                    {"username": {"$regex": f"^{username_or_email.strip()}$", "$options": "i"}},
                ]
            }
        )
        if doc is None:
            return None
        if not verify_password(password, doc["password_hash"]):
            return None
        return self._doc_to_user(doc)

    def get_user(self, user_id: str) -> UserRecord | None:
        doc = self._users.find_one({"id": user_id})
        return self._doc_to_user(doc) if doc else None

    def find_user_by_username_or_email(self, username_or_email: str) -> UserRecord | None:
        lookup = username_or_email.strip().lower()
        doc = self._users.find_one(
            {
                "$or": [
                    {"email_normalized": lookup},
                    {"username_normalized": lookup},
                    {"username": {"$regex": f"^{username_or_email.strip()}$", "$options": "i"}},
                ]
            }
        )
        return self._doc_to_user(doc) if doc else None

    def search_users(self, query: str, limit: int = 10) -> list[UserRecord]:
        needle = query.strip()
        if not needle:
            return []
        cursor = self._users.find(
            {
                "$or": [
                    {"username": {"$regex": needle, "$options": "i"}},
                    {"email": {"$regex": needle, "$options": "i"}},
                    {"display_name": {"$regex": needle, "$options": "i"}},
                ]
            }
        ).limit(limit)
        return [self._doc_to_user(doc) for doc in cursor]

    def update_user_profile(self, user_id: str, display_name: str | None = None, preferences: dict | None = None) -> UserRecord | None:
        update_fields = {}
        if display_name is not None:
            update_fields["display_name"] = display_name.strip()
        if preferences is not None:
            update_fields["preferences"] = preferences
        if not update_fields:
            return self.get_user(user_id)

        update_fields["updated_at"] = datetime.now(UTC)
        result = self._users.update_one({"id": user_id}, {"$set": update_fields})
        if result.matched_count == 0:
            return None
        return self.get_user(user_id)

    def create_group(self, owner_user_id: str, name: str, description: str | None = None) -> GroupRecord:
        group_id = str(uuid4())
        now = datetime.now(UTC)
        self._groups.insert_one(
            {
                "id": group_id,
                "name": name.strip(),
                "description": description.strip() if description else None,
                "owner_user_id": owner_user_id,
                "created_at": now,
                "updated_at": now,
            }
        )
        self._memberships.update_one(
            {"group_id": group_id, "user_id": owner_user_id},
            {"$set": {"group_id": group_id, "user_id": owner_user_id, "membership_role": "owner", "added_at": now}},
            upsert=True,
        )
        return self.get_group(group_id)

    def list_groups_owned_by_user(self, owner_user_id: str) -> list[GroupRecord]:
        return [self._doc_to_group(doc) for doc in self._groups.find({"owner_user_id": owner_user_id})]

    def list_groups_member_of_user(self, user_id: str) -> list[GroupRecord]:
        group_ids = [m["group_id"] for m in self._memberships.find({"user_id": user_id})]
        if not group_ids:
            return []
        docs = self._groups.find({"id": {"$in": group_ids}, "owner_user_id": {"$ne": user_id}})
        return [self._doc_to_group(doc) for doc in docs]

    def get_group(self, group_id: str) -> GroupRecord | None:
        doc = self._groups.find_one({"id": group_id})
        return self._doc_to_group(doc) if doc else None

    def update_group(self, group_id: str, name: str | None = None, description: str | None = None) -> GroupRecord | None:
        update_fields = {"updated_at": datetime.now(UTC)}
        if name is not None:
            update_fields["name"] = name.strip()
        if description is not None:
            update_fields["description"] = description.strip() if description else None

        result = self._groups.update_one({"id": group_id}, {"$set": update_fields})
        if result.matched_count == 0:
            return None
        return self.get_group(group_id)

    def delete_group(self, group_id: str) -> bool:
        result = self._groups.delete_one({"id": group_id})
        self._memberships.delete_many({"group_id": group_id})
        return result.deleted_count > 0

    def is_group_member(self, group_id: str, user_id: str) -> bool:
        return self._memberships.find_one({"group_id": group_id, "user_id": user_id}) is not None

    def list_group_members(self, group_id: str) -> list[tuple[UserRecord, str]]:
        memberships = list(self._memberships.find({"group_id": group_id}))
        if not memberships:
            return []
        user_ids = [m["user_id"] for m in memberships]
        user_docs = {doc["id"]: doc for doc in self._users.find({"id": {"$in": user_ids}})}
        members: list[tuple[UserRecord, str]] = []
        for membership in memberships:
            user_doc = user_docs.get(membership["user_id"])
            if user_doc is None:
                continue
            members.append((self._doc_to_user(user_doc), membership.get("membership_role") or "member"))
        return members

    def count_group_members(self, group_id: str) -> int:
        return self._memberships.count_documents({"group_id": group_id})

    def add_group_member(self, group_id: str, user_id: str, membership_role: str = "member") -> bool:
        if self.get_group(group_id) is None or self.get_user(user_id) is None:
            return False
        self._memberships.update_one(
            {"group_id": group_id, "user_id": user_id},
            {
                "$set": {
                    "group_id": group_id,
                    "user_id": user_id,
                    "membership_role": membership_role,
                    "added_at": datetime.now(UTC),
                }
            },
            upsert=True,
        )
        self._groups.update_one({"id": group_id}, {"$set": {"updated_at": datetime.now(UTC)}})
        return True

    def remove_group_member(self, group_id: str, user_id: str) -> bool:
        group = self.get_group(group_id)
        if group is None:
            return False
        if group.owner_user_id == user_id:
            return False
        result = self._memberships.delete_one({"group_id": group_id, "user_id": user_id})
        if result.deleted_count == 0:
            return False
        self._groups.update_one({"id": group_id}, {"$set": {"updated_at": datetime.now(UTC)}})
        return True

    def create_refresh_session(self, user_id: str, settings: Settings, family_id: str | None = None) -> tuple[str, int]:
        refresh_token = generate_refresh_token()
        token_hash = hash_refresh_token(refresh_token)
        issued_at = datetime.now(UTC)
        self._sessions.insert_one(
            {
                "id": str(uuid4()),
                "user_id": user_id,
                "refresh_token_hash": token_hash,
                "token_family_id": family_id or str(uuid4()),
                "issued_at": issued_at,
                "expires_at": issued_at + timedelta(seconds=settings.jwt_refresh_token_ttl_seconds),
                "revoked_at": None,
            }
        )
        return refresh_token, settings.jwt_refresh_token_ttl_seconds

    def rotate_refresh_session(self, refresh_token: str, settings: Settings) -> tuple[UserRecord | None, str | None, int | None]:
        current_hash = hash_refresh_token(refresh_token)
        now = datetime.utcnow()
        session = self._sessions.find_one({"refresh_token_hash": current_hash})
        if session is None:
            return None, None, None
        if session.get("revoked_at") is not None:
            return None, None, None
        expires_at = self._to_utc_naive(session.get("expires_at"))
        if expires_at <= now:
            return None, None, None

        self._sessions.update_one({"refresh_token_hash": current_hash}, {"$set": {"revoked_at": now}})
        user = self.get_user(session["user_id"])
        if user is None:
            return None, None, None

        new_refresh, ttl = self.create_refresh_session(user.id, settings, family_id=session.get("token_family_id"))
        return user, new_refresh, ttl

    def revoke_refresh_session(self, refresh_token: str) -> bool:
        token_hash = hash_refresh_token(refresh_token)
        result = self._sessions.update_one(
            {"refresh_token_hash": token_hash, "revoked_at": None},
            {"$set": {"revoked_at": datetime.now(UTC)}},
        )
        return result.matched_count > 0
