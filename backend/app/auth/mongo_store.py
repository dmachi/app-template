from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.auth.oauth_security import hash_oauth_secret
from app.auth.roles import CORE_ROLE_DESCRIPTIONS, NON_DELETABLE_CORE_ROLES
from app.auth.security import generate_refresh_token, hash_password, hash_personal_access_token, hash_refresh_token, verify_password
from app.auth.store import (
    ExternalAccountLinkageRecord,
    GroupRecord,
    InvitationRecord,
    NotificationRecord,
    OAuthAccessTokenRecord,
    OAuthAuthorizationCodeRecord,
    OAuthClientRecord,
    OAuthConsentGrantRecord,
    OAuthRefreshTokenRecord,
    PersonalAccessTokenRecord,
    UserRecord,
)
from app.core.config import Settings


class MongoAuthStore:
    def __init__(self, database_adapter) -> None:
        self._users = database_adapter.get_collection("users")
        self._groups = database_adapter.get_collection("groups")
        self._memberships = database_adapter.get_collection("group_memberships")
        self._sessions = database_adapter.get_collection("sessions")
        self._roles = database_adapter.get_collection("roles")
        self._invitations = database_adapter.get_collection("invitations")
        self._notifications = database_adapter.get_collection("notifications")
        self._external_account_linkages = database_adapter.get_collection("external_account_linkages")
        self._oauth_clients = database_adapter.get_collection("oauth_clients")
        self._oauth_authorization_codes = database_adapter.get_collection("oauth_authorization_codes")
        self._oauth_consents = database_adapter.get_collection("oauth_consents")
        self._oauth_access_tokens = database_adapter.get_collection("oauth_access_tokens")
        self._oauth_refresh_tokens = database_adapter.get_collection("oauth_refresh_tokens")
        self._personal_access_tokens = database_adapter.get_collection("personal_access_tokens")

        now = datetime.now(UTC)
        for role_name, description in CORE_ROLE_DESCRIPTIONS.items():
            self._roles.update_one(
                {"name": role_name},
                {"$setOnInsert": {"name": role_name, "description": description, "created_at": now, "updated_at": now}},
                upsert=True,
            )

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
            email_verified=doc.get("email_verified") or False,
            email_verified_at=doc.get("email_verified_at"),
            roles=doc.get("roles") or [],
            preferences=doc.get("preferences") or {},
            created_at=doc.get("created_at") or datetime.now(UTC),
            updated_at=doc.get("updated_at") or datetime.now(UTC),
        )

    def _doc_to_group(self, doc) -> GroupRecord:
        return GroupRecord(
            id=doc["id"],
            name=doc["name"],
            description=doc.get("description"),
            owner_user_id=doc["owner_user_id"],
            created_at=doc.get("created_at") or datetime.now(UTC),
            updated_at=doc.get("updated_at") or datetime.now(UTC),
            roles=doc.get("roles") or [],
        )

    def _doc_to_notification(self, doc) -> NotificationRecord:
        return NotificationRecord(
            id=doc["id"],
            user_id=doc["user_id"],
            type=doc.get("type") or "generic",
            message=doc.get("message") or "",
            severity=doc.get("severity") or "info",
            requires_acknowledgement=bool(doc.get("requires_acknowledgement") or False),
            clearance_mode=doc.get("clearance_mode") or "manual",
            source=doc.get("source") or {},
            open_endpoint=doc.get("open_endpoint"),
            delivery_options=doc.get("delivery_options") or {},
            completion_check=doc.get("completion_check"),
            status=doc.get("status") or "unread",
            merge_count=doc.get("merge_count") or 1,
            read_at=doc.get("read_at"),
            acknowledged_at=doc.get("acknowledged_at"),
            cleared_at=doc.get("cleared_at"),
            canceled_at=doc.get("canceled_at"),
            completion_satisfied_at=doc.get("completion_satisfied_at"),
            created_at=doc.get("created_at") or datetime.now(UTC),
            updated_at=doc.get("updated_at") or datetime.now(UTC),
        )

    def _doc_to_external_account_linkage(self, doc) -> ExternalAccountLinkageRecord:
        return ExternalAccountLinkageRecord(
            id=doc["id"],
            user_id=doc["user_id"],
            provider=doc["provider"],
            external_subject=doc["external_subject"],
            metadata=doc.get("metadata") or {},
            created_at=doc.get("created_at") or datetime.now(UTC),
            updated_at=doc.get("updated_at") or datetime.now(UTC),
        )

    def _doc_to_oauth_client(self, doc) -> OAuthClientRecord:
        return OAuthClientRecord(
            id=doc["id"],
            client_id=doc["client_id"],
            name=doc.get("name") or "",
            redirect_uris=doc.get("redirect_uris") or [],
            allowed_scopes=doc.get("allowed_scopes") or [],
            grant_types=doc.get("grant_types") or ["authorization_code", "refresh_token"],
            token_endpoint_auth_method=doc.get("token_endpoint_auth_method") or "none",
            client_secret_hash=doc.get("client_secret_hash"),
            trusted=bool(doc.get("trusted") or False),
            created_at=doc.get("created_at") or datetime.now(UTC),
            updated_at=doc.get("updated_at") or datetime.now(UTC),
        )

    def _doc_to_oauth_authorization_code(self, doc) -> OAuthAuthorizationCodeRecord:
        return OAuthAuthorizationCodeRecord(
            code_hash=doc["code_hash"],
            client_id=doc["client_id"],
            user_id=doc["user_id"],
            redirect_uri=doc["redirect_uri"],
            scopes=doc.get("scopes") or [],
            code_challenge=doc.get("code_challenge") or "",
            code_challenge_method=doc.get("code_challenge_method") or "S256",
            nonce=doc.get("nonce"),
            expires_at=doc.get("expires_at") or datetime.now(UTC),
            created_at=doc.get("created_at") or datetime.now(UTC),
            consumed_at=doc.get("consumed_at"),
        )

    def _doc_to_oauth_consent(self, doc) -> OAuthConsentGrantRecord:
        return OAuthConsentGrantRecord(
            user_id=doc["user_id"],
            client_id=doc["client_id"],
            scopes=doc.get("scopes") or [],
            created_at=doc.get("created_at") or datetime.now(UTC),
            updated_at=doc.get("updated_at") or datetime.now(UTC),
        )

    def _doc_to_oauth_access_token(self, doc) -> OAuthAccessTokenRecord:
        return OAuthAccessTokenRecord(
            token_hash=doc["token_hash"],
            jti=doc["jti"],
            user_id=doc["user_id"],
            client_id=doc["client_id"],
            scopes=doc.get("scopes") or [],
            expires_at=doc.get("expires_at") or datetime.now(UTC),
            created_at=doc.get("created_at") or datetime.now(UTC),
            revoked_at=doc.get("revoked_at"),
        )

    def _doc_to_oauth_refresh_token(self, doc) -> OAuthRefreshTokenRecord:
        return OAuthRefreshTokenRecord(
            token_hash=doc["token_hash"],
            user_id=doc["user_id"],
            client_id=doc["client_id"],
            scopes=doc.get("scopes") or [],
            family_id=doc.get("family_id") or "",
            expires_at=doc.get("expires_at") or datetime.now(UTC),
            created_at=doc.get("created_at") or datetime.now(UTC),
            revoked_at=doc.get("revoked_at"),
        )

    def _doc_to_personal_access_token(self, doc) -> PersonalAccessTokenRecord:
        return PersonalAccessTokenRecord(
            id=doc["id"],
            user_id=doc["user_id"],
            name=doc.get("name") or "",
            token_hash=doc["token_hash"],
            token_encrypted=doc.get("token_encrypted") or "",
            scopes=doc.get("scopes") or [],
            expires_at=doc.get("expires_at"),
            last_used_at=doc.get("last_used_at"),
            revoked_at=doc.get("revoked_at"),
            created_at=doc.get("created_at") or datetime.now(UTC),
            updated_at=doc.get("updated_at") or datetime.now(UTC),
        )

    @staticmethod
    def _notification_event_identity(type_name: str, source: dict | None) -> str | None:
        source = source or {}
        dedupe_key = source.get("dedupe_key")
        if isinstance(dedupe_key, str) and dedupe_key.strip():
            return f"{type_name}|dedupe:{dedupe_key.strip()}"
        entity_type = source.get("entity_type")
        entity_id = source.get("entity_id")
        event_id = source.get("event_id")
        if not entity_type and not entity_id and not event_id:
            return None
        return f"{type_name}|{entity_type or ''}|{entity_id or ''}|{event_id or ''}"

    def upsert_user_record(
        self,
        *,
        user_id: str,
        username: str,
        email: str,
        password_hash: str,
        display_name: str,
        status: str = "active",
        email_verified: bool = False,
        email_verified_at: datetime | None = None,
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
                    "email_verified": email_verified,
                    "email_verified_at": self._to_utc_naive(email_verified_at) if email_verified_at else None,
                    "roles": list(roles or []),
                    "preferences": dict(preferences or {}),
                    "updated_at": datetime.now(UTC),
                },
                "$setOnInsert": {"created_at": datetime.now(UTC)},
            },
            upsert=True,
        )
        return self.get_user(user_id)

    def register_local_user(
        self,
        username: str,
        email: str,
        password: str,
        display_name: str | None = None,
        preferences: dict | None = None,
    ) -> UserRecord:
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
                "status": "pending",
                "email_verified": False,
                "email_verified_at": None,
                "roles": [],
                "preferences": dict(preferences or {}),
                "created_at": now,
                "updated_at": now,
            }
        )
        return self.get_user(user_id)

    def upsert_external_account_linkage(
        self,
        user_id: str,
        provider: str,
        external_subject: str,
        metadata: dict | None = None,
    ) -> ExternalAccountLinkageRecord:
        normalized_provider = provider.strip().lower()
        now = datetime.now(UTC)
        linkage_id = str(uuid4())
        self._external_account_linkages.update_one(
            {"user_id": user_id, "provider": normalized_provider},
            {
                "$set": {
                    "user_id": user_id,
                    "provider": normalized_provider,
                    "external_subject": external_subject,
                    "metadata": dict(metadata or {}),
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "id": linkage_id,
                    "created_at": now,
                },
            },
            upsert=True,
        )
        doc = self._external_account_linkages.find_one({"user_id": user_id, "provider": normalized_provider})
        return self._doc_to_external_account_linkage(doc)

    def list_external_account_linkages(self, user_id: str) -> list[ExternalAccountLinkageRecord]:
        cursor = self._external_account_linkages.find({"user_id": user_id}).sort("provider", 1)
        return [self._doc_to_external_account_linkage(doc) for doc in cursor]

    def remove_external_account_linkage(self, user_id: str, provider: str) -> bool:
        result = self._external_account_linkages.delete_one({"user_id": user_id, "provider": provider.strip().lower()})
        return result.deleted_count > 0

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
        if (doc.get("status") or "active") != "active":
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

    def update_user_profile(
        self,
        user_id: str,
        display_name: str | None = None,
        email: str | None = None,
        preferences: dict | None = None,
    ) -> UserRecord | None:
        update_fields = {}
        if display_name is not None:
            update_fields["display_name"] = display_name.strip()
        if email is not None:
            normalized_email = self.normalize_email(email)
            current = self._users.find_one({"id": user_id})
            if current is None:
                return None
            if normalized_email != (current.get("email_normalized") or self.normalize_email(current.get("email", ""))):
                existing = self._users.find_one({"email_normalized": normalized_email})
                if existing and existing.get("id") != user_id:
                    raise ValueError("EMAIL_ALREADY_EXISTS")
                update_fields["email"] = email.strip()
                update_fields["email_normalized"] = normalized_email
                update_fields["email_verified"] = False
                update_fields["email_verified_at"] = None
        if preferences is not None:
            update_fields["preferences"] = preferences
        if not update_fields:
            return self.get_user(user_id)

        update_fields["updated_at"] = datetime.now(UTC)
        result = self._users.update_one({"id": user_id}, {"$set": update_fields})
        if result.matched_count == 0:
            return None
        return self.get_user(user_id)

    def list_users(self) -> list[UserRecord]:
        cursor = self._users.find({}).sort("username", 1)
        return [self._doc_to_user(doc) for doc in cursor]

    def admin_update_user(
        self,
        user_id: str,
        display_name: str | None = None,
        email: str | None = None,
        status: str | None = None,
        roles: list[str] | None = None,
        preferences: dict | None = None,
    ) -> UserRecord | None:
        update_fields = {"updated_at": datetime.now(UTC)}
        if display_name is not None:
            update_fields["display_name"] = display_name.strip()
        if email is not None:
            normalized_email = self.normalize_email(email)
            current = self._users.find_one({"id": user_id})
            if current is None:
                return None
            current_normalized = current.get("email_normalized") or self.normalize_email(current.get("email", ""))
            if normalized_email != current_normalized:
                existing = self._users.find_one({"email_normalized": normalized_email})
                if existing and existing.get("id") != user_id:
                    raise ValueError("EMAIL_ALREADY_EXISTS")
                update_fields["email"] = email.strip()
                update_fields["email_normalized"] = normalized_email
                update_fields["email_verified"] = False
                update_fields["email_verified_at"] = None
        if status is not None:
            update_fields["status"] = status
        if roles is not None:
            update_fields["roles"] = list(roles)
        if preferences is not None:
            update_fields["preferences"] = dict(preferences)

        result = self._users.update_one({"id": user_id}, {"$set": update_fields})
        if result.matched_count == 0:
            return None
        return self.get_user(user_id)

    def list_roles(self) -> list[dict[str, str | None]]:
        role_docs = {doc["name"]: doc.get("description") for doc in self._roles.find({}) if doc.get("name")}
        for user_doc in self._users.find({}, {"roles": 1}):
            for role in user_doc.get("roles", []):
                if role not in role_docs:
                    role_docs[role] = None
        for group_doc in self._groups.find({}, {"roles": 1}):
            for role in group_doc.get("roles", []):
                if role not in role_docs:
                    role_docs[role] = None
        for role_name, description in CORE_ROLE_DESCRIPTIONS.items():
            if role_name not in role_docs:
                role_docs[role_name] = description

        return [
            {"name": name, "description": role_docs.get(name)}
            for name in sorted(role_docs.keys())
        ]

    def create_role(self, role_name: str, description: str | None = None) -> dict[str, str | None]:
        normalized = role_name.strip()
        if not normalized:
            raise ValueError("ROLE_NAME_INVALID")
        if self._roles.find_one({"name": normalized}):
            raise ValueError("ROLE_EXISTS")

        self._roles.insert_one(
            {
                "name": normalized,
                "description": description.strip() if description else None,
                "created_at": datetime.now(UTC),
                "updated_at": datetime.now(UTC),
            }
        )
        return {"name": normalized, "description": description.strip() if description else None}

    def update_role(self, role_name: str, description: str | None = None) -> dict[str, str | None] | None:
        normalized = role_name.strip()
        result = self._roles.update_one(
            {"name": normalized},
            {"$set": {"description": description.strip() if description else None, "updated_at": datetime.now(UTC)}},
        )
        if result.matched_count == 0:
            return None
        doc = self._roles.find_one({"name": normalized})
        return {"name": normalized, "description": doc.get("description") if doc else None}

    def delete_role(self, role_name: str) -> bool:
        normalized = role_name.strip()
        if normalized in NON_DELETABLE_CORE_ROLES:
            raise ValueError("ROLE_PROTECTED")

        result = self._roles.delete_one({"name": normalized})
        if result.deleted_count == 0:
            return False

        self._users.update_many({}, {"$pull": {"roles": normalized}, "$set": {"updated_at": datetime.now(UTC)}})
        self._groups.update_many({}, {"$pull": {"roles": normalized}, "$set": {"updated_at": datetime.now(UTC)}})
        return True

    def role_exists(self, role_name: str) -> bool:
        return any(role["name"] == role_name for role in self.list_roles())

    def mark_email_verified(self, user_id: str) -> UserRecord | None:
        user = self.get_user(user_id)
        if user is None:
            return None

        next_status = "active" if user.status == "pending" else user.status
        self._users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "email_verified": True,
                    "email_verified_at": datetime.now(UTC),
                    "status": next_status,
                    "updated_at": datetime.now(UTC),
                }
            },
        )
        return self.get_user(user_id)

    def list_groups(self) -> list[GroupRecord]:
        return [self._doc_to_group(doc) for doc in self._groups.find({}).sort("name", 1)]

    def create_group(self, owner_user_id: str, name: str, description: str | None = None) -> GroupRecord:
        group_id = str(uuid4())
        now = datetime.now(UTC)
        self._groups.insert_one(
            {
                "id": group_id,
                "name": name.strip(),
                "description": description.strip() if description else None,
                "owner_user_id": owner_user_id,
                "roles": [],
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

    def update_group(self, group_id: str, name: str | None = None, description: str | None = None, roles: list[str] | None = None) -> GroupRecord | None:
        update_fields = {"updated_at": datetime.now(UTC)}
        if name is not None:
            update_fields["name"] = name.strip()
        if description is not None:
            update_fields["description"] = description.strip() if description else None
        if roles is not None:
            update_fields["roles"] = list(dict.fromkeys(roles))

        result = self._groups.update_one({"id": group_id}, {"$set": update_fields})
        if result.matched_count == 0:
            return None
        return self.get_group(group_id)

    def set_group_roles(self, group_id: str, roles: list[str]) -> GroupRecord | None:
        return self.update_group(group_id=group_id, roles=roles)

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

    def get_effective_roles_for_user(self, user_id: str) -> list[str]:
        user = self.get_user(user_id)
        if user is None:
            return []

        effective_roles = set(user.roles)
        group_ids = [doc["group_id"] for doc in self._memberships.find({"user_id": user_id}, {"group_id": 1}) if doc.get("group_id")]
        if group_ids:
            for group_doc in self._groups.find({"id": {"$in": group_ids}}, {"roles": 1}):
                effective_roles.update(group_doc.get("roles") or [])
        return sorted(effective_roles)

    def create_or_merge_notification(
        self,
        *,
        user_id: str,
        type_name: str,
        message: str,
        severity: str = "info",
        requires_acknowledgement: bool = False,
        clearance_mode: str = "manual",
        source: dict | None = None,
        open_endpoint: str | None = None,
        delivery_options: dict | None = None,
        completion_check: dict | None = None,
    ) -> tuple[NotificationRecord, bool]:
        if self.get_user(user_id) is None:
            raise ValueError("USER_NOT_FOUND")

        event_identity = self._notification_event_identity(type_name, source)
        active_notifications = self._notifications.find(
            {
                "user_id": user_id,
                "cleared_at": None,
                "canceled_at": None,
            }
        )
        if event_identity is not None:
            for existing in active_notifications:
                existing_identity = self._notification_event_identity(existing.get("type") or "", existing.get("source") or {})
                if existing_identity != event_identity:
                    continue
                now = datetime.now(UTC)
                self._notifications.update_one(
                    {"id": existing["id"]},
                    {
                        "$set": {
                            "message": message.strip(),
                            "severity": severity,
                            "requires_acknowledgement": requires_acknowledgement,
                            "clearance_mode": clearance_mode,
                            "source": dict(source or {}),
                            "open_endpoint": open_endpoint,
                            "delivery_options": dict(delivery_options or {}),
                            "completion_check": dict(completion_check) if completion_check else None,
                            "updated_at": now,
                        },
                        "$inc": {"merge_count": 1},
                    },
                )
                updated = self._notifications.find_one({"id": existing["id"]})
                return self._doc_to_notification(updated), False

        now = datetime.now(UTC)
        notification_id = str(uuid4())
        self._notifications.insert_one(
            {
                "id": notification_id,
                "user_id": user_id,
                "type": type_name.strip(),
                "message": message.strip(),
                "severity": severity,
                "requires_acknowledgement": requires_acknowledgement,
                "clearance_mode": clearance_mode,
                "source": dict(source or {}),
                "open_endpoint": open_endpoint,
                "delivery_options": dict(delivery_options or {}),
                "completion_check": dict(completion_check) if completion_check else None,
                "status": "unread",
                "merge_count": 1,
                "read_at": None,
                "acknowledged_at": None,
                "cleared_at": None,
                "canceled_at": None,
                "completion_satisfied_at": None,
                "created_at": now,
                "updated_at": now,
            }
        )
        created = self._notifications.find_one({"id": notification_id})
        return self._doc_to_notification(created), True

    def get_notification(self, notification_id: str) -> NotificationRecord | None:
        doc = self._notifications.find_one({"id": notification_id})
        return self._doc_to_notification(doc) if doc else None

    def list_notifications_for_user(self, user_id: str, status: str | None = None, type_name: str | None = None) -> list[NotificationRecord]:
        query = {"user_id": user_id}
        if status:
            query["status"] = status
        if type_name:
            query["type"] = type_name
        docs = self._notifications.find(query).sort("created_at", -1)
        return [self._doc_to_notification(doc) for doc in docs]

    def purge_completed_notifications(self, retention_hours: int) -> int:
        cutoff = datetime.now(UTC) - timedelta(hours=retention_hours)
        result = self._notifications.delete_many(
            {
                "$or": [
                    {"cleared_at": {"$lte": cutoff}},
                    {"acknowledged_at": {"$lte": cutoff}},
                    {"read_at": {"$lte": cutoff}},
                    {"canceled_at": {"$lte": cutoff}},
                ]
            }
        )
        return int(result.deleted_count)

    def list_notifications(self, *, status: str | None = None, type_name: str | None = None, user_id: str | None = None) -> list[NotificationRecord]:
        query: dict = {}
        if status:
            query["status"] = status
        if type_name:
            query["type"] = type_name
        if user_id:
            query["user_id"] = user_id
        docs = self._notifications.find(query).sort("created_at", -1)
        return [self._doc_to_notification(doc) for doc in docs]

    def mark_notification_read(self, notification_id: str, user_id: str | None = None) -> NotificationRecord | None:
        query: dict = {"id": notification_id}
        if user_id:
            query["user_id"] = user_id
        now = datetime.now(UTC)
        self._notifications.update_one(
            query,
            {
                "$set": {
                    "read_at": now,
                    "updated_at": now,
                }
            },
        )
        notification = self.get_notification(notification_id)
        if notification is None:
            return None
        if user_id and notification.user_id != user_id:
            return None
        if notification.status == "unread":
            self._notifications.update_one({"id": notification_id}, {"$set": {"status": "read"}})
            notification.status = "read"
        if notification.read_at is None:
            notification.read_at = now
        notification.updated_at = now
        return notification

    def acknowledge_notification(self, notification_id: str, user_id: str | None = None) -> NotificationRecord | None:
        query: dict = {"id": notification_id}
        if user_id:
            query["user_id"] = user_id
        now = datetime.now(UTC)
        result = self._notifications.update_one(
            query,
            {
                "$set": {
                    "read_at": now,
                    "acknowledged_at": now,
                    "status": "acknowledged",
                    "updated_at": now,
                }
            },
        )
        if result.matched_count == 0:
            return None
        return self.get_notification(notification_id)

    def evaluate_notification_completion(self, notification_id: str, user_id: str | None = None) -> tuple[NotificationRecord | None, bool]:
        notification = self.get_notification(notification_id)
        if notification is None:
            return None, False
        if user_id and notification.user_id != user_id:
            return None, False

        check = notification.completion_check or {}
        arguments = check.get("arguments") if isinstance(check.get("arguments"), dict) else {}
        completed = bool(arguments.get("completed") is True)
        if completed:
            now = datetime.now(UTC)
            self._notifications.update_one(
                {"id": notification_id},
                {"$set": {"completion_satisfied_at": now, "updated_at": now}},
            )
            notification.completion_satisfied_at = now
            notification.updated_at = now
        return notification, completed

    def clear_notification(self, notification_id: str, user_id: str | None = None) -> NotificationRecord | None:
        notification = self.get_notification(notification_id)
        if notification is None:
            return None
        if user_id and notification.user_id != user_id:
            return None
        if notification.clearance_mode == "ack" and notification.acknowledged_at is None:
            raise ValueError("ACK_REQUIRED")
        if notification.clearance_mode == "task_gate" and notification.completion_satisfied_at is None:
            raise ValueError("TASK_NOT_COMPLETED")

        now = datetime.now(UTC)
        self._notifications.update_one(
            {"id": notification_id},
            {
                "$set": {
                    "read_at": notification.read_at or now,
                    "cleared_at": now,
                    "status": "cleared",
                    "updated_at": now,
                }
            },
        )
        return self.get_notification(notification_id)

    def cancel_notification(self, notification_id: str) -> NotificationRecord | None:
        now = datetime.now(UTC)
        result = self._notifications.update_one(
            {"id": notification_id},
            {
                "$set": {
                    "canceled_at": now,
                    "status": "cleared",
                    "updated_at": now,
                }
            },
        )
        if result.matched_count == 0:
            return None
        return self.get_notification(notification_id)

    def delete_notification(self, notification_id: str) -> bool:
        result = self._notifications.delete_one({"id": notification_id})
        return result.deleted_count > 0

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

    def create_oauth_client(
        self,
        *,
        name: str,
        redirect_uris: list[str],
        allowed_scopes: list[str],
        grant_types: list[str] | None = None,
        trusted: bool = False,
        token_endpoint_auth_method: str = "none",
        client_secret: str | None = None,
    ) -> OAuthClientRecord:
        now = datetime.now(UTC)
        client_id = f"client_{uuid4().hex}"
        doc = {
            "id": str(uuid4()),
            "client_id": client_id,
            "name": name.strip(),
            "redirect_uris": list(dict.fromkeys(item.strip() for item in redirect_uris if item.strip())),
            "allowed_scopes": list(dict.fromkeys(item.strip() for item in allowed_scopes if item.strip())),
            "grant_types": list(dict.fromkeys(item.strip() for item in (grant_types or ["authorization_code", "refresh_token"]) if item.strip())),
            "token_endpoint_auth_method": token_endpoint_auth_method,
            "client_secret_hash": hash_oauth_secret(client_secret) if client_secret else None,
            "trusted": trusted,
            "created_at": now,
            "updated_at": now,
        }
        self._oauth_clients.insert_one(doc)
        return self._doc_to_oauth_client(doc)

    def list_oauth_clients(self) -> list[OAuthClientRecord]:
        docs = self._oauth_clients.find({}).sort("name", 1)
        return [self._doc_to_oauth_client(doc) for doc in docs]

    def get_oauth_client_by_client_id(self, client_id: str) -> OAuthClientRecord | None:
        doc = self._oauth_clients.find_one({"client_id": client_id})
        return self._doc_to_oauth_client(doc) if doc else None

    def update_oauth_client(
        self,
        *,
        client_id: str,
        name: str | None = None,
        redirect_uris: list[str] | None = None,
        allowed_scopes: list[str] | None = None,
        grant_types: list[str] | None = None,
        trusted: bool | None = None,
        token_endpoint_auth_method: str | None = None,
        client_secret: str | None = None,
    ) -> OAuthClientRecord | None:
        update_fields: dict = {"updated_at": datetime.now(UTC)}
        if name is not None:
            update_fields["name"] = name.strip()
        if redirect_uris is not None:
            update_fields["redirect_uris"] = list(dict.fromkeys(item.strip() for item in redirect_uris if item.strip()))
        if allowed_scopes is not None:
            update_fields["allowed_scopes"] = list(dict.fromkeys(item.strip() for item in allowed_scopes if item.strip()))
        if grant_types is not None:
            update_fields["grant_types"] = list(dict.fromkeys(item.strip() for item in grant_types if item.strip()))
        if trusted is not None:
            update_fields["trusted"] = trusted
        if token_endpoint_auth_method is not None:
            update_fields["token_endpoint_auth_method"] = token_endpoint_auth_method
        if client_secret is not None:
            update_fields["client_secret_hash"] = hash_oauth_secret(client_secret)

        result = self._oauth_clients.update_one({"client_id": client_id}, {"$set": update_fields})
        if result.matched_count == 0:
            return None
        return self.get_oauth_client_by_client_id(client_id)

    def delete_oauth_client(self, client_id: str) -> bool:
        result = self._oauth_clients.delete_one({"client_id": client_id})
        return result.deleted_count > 0

    def create_oauth_authorization_code(
        self,
        *,
        code: str,
        client_id: str,
        user_id: str,
        redirect_uri: str,
        scopes: list[str],
        code_challenge: str,
        code_challenge_method: str,
        nonce: str | None,
        expires_at: datetime,
    ) -> OAuthAuthorizationCodeRecord:
        now = datetime.now(UTC)
        doc = {
            "code_hash": hash_oauth_secret(code),
            "client_id": client_id,
            "user_id": user_id,
            "redirect_uri": redirect_uri,
            "scopes": list(dict.fromkeys(scopes)),
            "code_challenge": code_challenge,
            "code_challenge_method": code_challenge_method,
            "nonce": nonce,
            "expires_at": expires_at,
            "created_at": now,
            "consumed_at": None,
        }
        self._oauth_authorization_codes.update_one({"code_hash": doc["code_hash"]}, {"$set": doc}, upsert=True)
        return self._doc_to_oauth_authorization_code(doc)

    def consume_oauth_authorization_code(self, code: str) -> OAuthAuthorizationCodeRecord | None:
        code_hash = hash_oauth_secret(code)
        now = datetime.now(UTC)
        doc = self._oauth_authorization_codes.find_one({"code_hash": code_hash})
        if doc is None:
            return None
        if doc.get("consumed_at") is not None:
            return None
        expires_at = self._to_utc_naive(doc.get("expires_at"))
        if expires_at <= self._to_utc_naive(now):
            return None

        result = self._oauth_authorization_codes.update_one(
            {"code_hash": code_hash, "consumed_at": None},
            {"$set": {"consumed_at": now}},
        )
        if result.matched_count == 0:
            return None
        updated = self._oauth_authorization_codes.find_one({"code_hash": code_hash})
        return self._doc_to_oauth_authorization_code(updated) if updated else None

    def has_oauth_consent_for_scopes(self, *, user_id: str, client_id: str, scopes: list[str]) -> bool:
        doc = self._oauth_consents.find_one({"user_id": user_id, "client_id": client_id})
        if doc is None:
            return False
        granted_scopes = set(doc.get("scopes") or [])
        return set(scopes).issubset(granted_scopes)

    def upsert_oauth_consent_grant(self, *, user_id: str, client_id: str, scopes: list[str]) -> OAuthConsentGrantRecord:
        now = datetime.now(UTC)
        current = self._oauth_consents.find_one({"user_id": user_id, "client_id": client_id})
        existing_scopes = set(current.get("scopes") or []) if current else set()
        merged_scopes = sorted(existing_scopes.union(scopes))
        self._oauth_consents.update_one(
            {"user_id": user_id, "client_id": client_id},
            {
                "$set": {"scopes": merged_scopes, "updated_at": now},
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
        doc = self._oauth_consents.find_one({"user_id": user_id, "client_id": client_id})
        return self._doc_to_oauth_consent(doc)

    def list_oauth_connected_apps_for_user(self, user_id: str) -> list[tuple[OAuthConsentGrantRecord, OAuthClientRecord]]:
        consent_docs = list(
            self._oauth_consents.find(
                {"user_id": user_id},
                sort=[("updated_at", -1)],
            )
        )
        if not consent_docs:
            return []

        client_ids = list({doc.get("client_id") for doc in consent_docs if doc.get("client_id")})
        client_docs = self._oauth_clients.find({"client_id": {"$in": client_ids}})
        clients_by_client_id = {doc.get("client_id"): self._doc_to_oauth_client(doc) for doc in client_docs if doc.get("client_id")}

        connected: list[tuple[OAuthConsentGrantRecord, OAuthClientRecord]] = []
        for consent_doc in consent_docs:
            client_id = consent_doc.get("client_id")
            if not client_id:
                continue
            client = clients_by_client_id.get(client_id)
            if client is None:
                continue
            connected.append((self._doc_to_oauth_consent(consent_doc), client))
        return connected

    def revoke_oauth_connected_app_for_user(self, *, user_id: str, client_id: str) -> bool:
        now = datetime.now(UTC)
        consent_result = self._oauth_consents.delete_one({"user_id": user_id, "client_id": client_id})

        access_result = self._oauth_access_tokens.update_many(
            {
                "user_id": user_id,
                "client_id": client_id,
                "revoked_at": None,
            },
            {"$set": {"revoked_at": now}},
        )

        refresh_result = self._oauth_refresh_tokens.update_many(
            {
                "user_id": user_id,
                "client_id": client_id,
                "revoked_at": None,
            },
            {"$set": {"revoked_at": now}},
        )

        return bool(consent_result.deleted_count or access_result.modified_count or refresh_result.modified_count)

    def store_oauth_access_token(
        self,
        *,
        token: str,
        jti: str,
        user_id: str,
        client_id: str,
        scopes: list[str],
        expires_at: datetime,
    ) -> OAuthAccessTokenRecord:
        now = datetime.now(UTC)
        doc = {
            "token_hash": hash_oauth_secret(token),
            "jti": jti,
            "user_id": user_id,
            "client_id": client_id,
            "scopes": list(dict.fromkeys(scopes)),
            "expires_at": expires_at,
            "created_at": now,
            "revoked_at": None,
        }
        self._oauth_access_tokens.update_one({"token_hash": doc["token_hash"]}, {"$set": doc}, upsert=True)
        return self._doc_to_oauth_access_token(doc)

    def revoke_oauth_access_token(self, token: str) -> bool:
        token_hash = hash_oauth_secret(token)
        result = self._oauth_access_tokens.update_one(
            {"token_hash": token_hash, "revoked_at": None},
            {"$set": {"revoked_at": datetime.now(UTC)}},
        )
        return result.matched_count > 0

    def is_oauth_access_token_active(self, token: str) -> bool:
        token_hash = hash_oauth_secret(token)
        doc = self._oauth_access_tokens.find_one({"token_hash": token_hash})
        if doc is None:
            return False
        if doc.get("revoked_at") is not None:
            return False
        expires_at = self._to_utc_naive(doc.get("expires_at"))
        return expires_at > self._to_utc_naive(datetime.now(UTC))

    def create_oauth_refresh_token(
        self,
        *,
        user_id: str,
        client_id: str,
        scopes: list[str],
        expires_at: datetime,
        family_id: str | None = None,
    ) -> tuple[str, OAuthRefreshTokenRecord]:
        token = generate_refresh_token()
        now = datetime.now(UTC)
        doc = {
            "token_hash": hash_oauth_secret(token),
            "user_id": user_id,
            "client_id": client_id,
            "scopes": list(dict.fromkeys(scopes)),
            "family_id": family_id or str(uuid4()),
            "expires_at": expires_at,
            "created_at": now,
            "revoked_at": None,
        }
        self._oauth_refresh_tokens.update_one({"token_hash": doc["token_hash"]}, {"$set": doc}, upsert=True)
        return token, self._doc_to_oauth_refresh_token(doc)

    def get_active_oauth_refresh_token(self, token: str) -> OAuthRefreshTokenRecord | None:
        token_hash = hash_oauth_secret(token)
        doc = self._oauth_refresh_tokens.find_one({"token_hash": token_hash})
        if doc is None:
            return None
        if doc.get("revoked_at") is not None:
            return None
        expires_at = self._to_utc_naive(doc.get("expires_at"))
        if expires_at <= self._to_utc_naive(datetime.now(UTC)):
            return None
        return self._doc_to_oauth_refresh_token(doc)

    def revoke_oauth_refresh_token(self, token: str) -> bool:
        token_hash = hash_oauth_secret(token)
        result = self._oauth_refresh_tokens.update_one(
            {"token_hash": token_hash, "revoked_at": None},
            {"$set": {"revoked_at": datetime.now(UTC)}},
        )
        return result.matched_count > 0

    def create_personal_access_token(
        self,
        *,
        user_id: str,
        name: str,
        token: str,
        token_encrypted: str,
        scopes: list[str],
        expires_at: datetime | None,
    ) -> PersonalAccessTokenRecord:
        now = datetime.now(UTC)
        doc = {
            "id": str(uuid4()),
            "user_id": user_id,
            "name": name.strip(),
            "token_hash": hash_personal_access_token(token),
            "token_encrypted": token_encrypted,
            "scopes": list(dict.fromkeys(scopes)),
            "expires_at": expires_at,
            "last_used_at": None,
            "revoked_at": None,
            "created_at": now,
            "updated_at": now,
        }
        self._personal_access_tokens.insert_one(doc)
        return self._doc_to_personal_access_token(doc)

    def list_active_personal_access_tokens_for_user(self, user_id: str) -> list[PersonalAccessTokenRecord]:
        now = datetime.now(UTC)
        docs = self._personal_access_tokens.find(
            {
                "user_id": user_id,
                "revoked_at": None,
                "$or": [{"expires_at": None}, {"expires_at": {"$gt": now}}],
            },
            sort=[("created_at", -1)],
        )
        return [self._doc_to_personal_access_token(doc) for doc in docs]

    def resolve_active_personal_access_token(self, token: str) -> PersonalAccessTokenRecord | None:
        now = datetime.now(UTC)
        token_hash = hash_personal_access_token(token)
        doc = self._personal_access_tokens.find_one(
            {
                "token_hash": token_hash,
                "revoked_at": None,
                "$or": [{"expires_at": None}, {"expires_at": {"$gt": now}}],
            }
        )
        if doc is None:
            return None
        return self._doc_to_personal_access_token(doc)

    def touch_personal_access_token_last_used(self, token_id: str) -> bool:
        now = datetime.now(UTC)
        result = self._personal_access_tokens.update_one(
            {"id": token_id},
            {"$set": {"last_used_at": now, "updated_at": now}},
        )
        return result.matched_count > 0

    def revoke_personal_access_token(self, *, user_id: str, token_id: str) -> bool:
        now = datetime.now(UTC)
        result = self._personal_access_tokens.update_one(
            {"id": token_id, "user_id": user_id, "revoked_at": None},
            {"$set": {"revoked_at": now, "updated_at": now}},
        )
        if result.matched_count > 0:
            return True

        existing = self._personal_access_tokens.find_one({"id": token_id, "user_id": user_id})
        return existing is not None

    def create_invitation(
        self,
        invited_email: str,
        invited_by_user_id: str,
        group_ids: list[str],
        settings: Settings,
    ) -> tuple[str, InvitationRecord]:
        token = generate_refresh_token()
        token_hash = hash_refresh_token(token)
        now = datetime.now(UTC)
        invitation_id = str(uuid4())
        doc = {
            "id": invitation_id,
            "token_hash": token_hash,
            "invited_email": invited_email.strip(),
            "invited_email_normalized": self.normalize_email(invited_email),
            "invited_by_user_id": invited_by_user_id,
            "group_ids": list(dict.fromkeys(group_ids)),
            "created_at": now,
            "expires_at": now + timedelta(seconds=settings.email_invitation_ttl_seconds),
            "accepted_at": None,
            "accepted_by_user_id": None,
            "revoked_at": None,
        }
        self._invitations.insert_one(doc)
        return token, InvitationRecord(
            id=invitation_id,
            token_hash=token_hash,
            invited_email=doc["invited_email"],
            invited_email_normalized=doc["invited_email_normalized"],
            invited_by_user_id=doc["invited_by_user_id"],
            group_ids=doc["group_ids"],
            created_at=doc["created_at"],
            expires_at=doc["expires_at"],
        )

    def get_invitation_by_token(self, token: str) -> InvitationRecord | None:
        token_hash = hash_refresh_token(token)
        now = datetime.now(UTC)
        doc = self._invitations.find_one(
            {
                "token_hash": token_hash,
                "accepted_at": None,
                "revoked_at": None,
                "expires_at": {"$gt": now},
            }
        )
        if doc is None:
            return None
        return InvitationRecord(
            id=doc["id"],
            token_hash=doc["token_hash"],
            invited_email=doc["invited_email"],
            invited_email_normalized=doc["invited_email_normalized"],
            invited_by_user_id=doc["invited_by_user_id"],
            group_ids=doc.get("group_ids") or [],
            created_at=doc.get("created_at") or now,
            expires_at=doc.get("expires_at") or now,
            accepted_at=doc.get("accepted_at"),
            accepted_by_user_id=doc.get("accepted_by_user_id"),
            revoked_at=doc.get("revoked_at"),
        )

    def get_outstanding_invitation_by_id(self, invitation_id: str) -> InvitationRecord | None:
        now = datetime.now(UTC)
        doc = self._invitations.find_one(
            {
                "id": invitation_id,
                "accepted_at": None,
                "revoked_at": None,
                "expires_at": {"$gt": now},
            }
        )
        if doc is None:
            return None
        return InvitationRecord(
            id=doc["id"],
            token_hash=doc["token_hash"],
            invited_email=doc["invited_email"],
            invited_email_normalized=doc["invited_email_normalized"],
            invited_by_user_id=doc["invited_by_user_id"],
            group_ids=doc.get("group_ids") or [],
            created_at=doc.get("created_at") or now,
            expires_at=doc.get("expires_at") or now,
            accepted_at=doc.get("accepted_at"),
            accepted_by_user_id=doc.get("accepted_by_user_id"),
            revoked_at=doc.get("revoked_at"),
        )

    def revoke_invitation(self, invitation_id: str) -> bool:
        result = self._invitations.update_one(
            {
                "id": invitation_id,
                "accepted_at": None,
                "revoked_at": None,
                "expires_at": {"$gt": datetime.now(UTC)},
            },
            {"$set": {"revoked_at": datetime.now(UTC)}},
        )
        return result.modified_count > 0

    def list_outstanding_invitations(self) -> list[InvitationRecord]:
        now = datetime.now(UTC)
        docs = list(
            self._invitations.find(
                {
                    "accepted_at": None,
                    "revoked_at": None,
                    "expires_at": {"$gt": now},
                }
            ).sort("created_at", -1)
        )
        return [
            InvitationRecord(
                id=doc["id"],
                token_hash=doc["token_hash"],
                invited_email=doc["invited_email"],
                invited_email_normalized=doc["invited_email_normalized"],
                invited_by_user_id=doc["invited_by_user_id"],
                group_ids=doc.get("group_ids") or [],
                created_at=doc.get("created_at") or now,
                expires_at=doc.get("expires_at") or now,
                accepted_at=doc.get("accepted_at"),
                accepted_by_user_id=doc.get("accepted_by_user_id"),
                revoked_at=doc.get("revoked_at"),
            )
            for doc in docs
        ]

    def accept_invitation(self, token: str, user_id: str) -> InvitationRecord | None:
        invitation = self.get_invitation_by_token(token)
        if invitation is None:
            return None

        user = self.get_user(user_id)
        if user is None:
            return None

        for group_id in invitation.group_ids:
            if self.get_group(group_id) is None:
                continue
            self.add_group_member(group_id=group_id, user_id=user_id)

        now = datetime.now(UTC)
        self._invitations.update_one(
            {"token_hash": invitation.token_hash, "accepted_at": None},
            {"$set": {"accepted_at": now, "accepted_by_user_id": user_id}},
        )
        invitation.accepted_at = now
        invitation.accepted_by_user_id = user_id
        return invitation
