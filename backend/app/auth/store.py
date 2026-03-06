from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from app.auth.oauth_security import hash_oauth_secret
from app.auth.roles import CORE_ROLE_DESCRIPTIONS, NON_DELETABLE_CORE_ROLES
from app.auth.security import generate_refresh_token, hash_password, hash_personal_access_token, hash_refresh_token, verify_password
from app.core.config import Settings


@dataclass
class UserRecord:
    id: str
    username: str
    email: str
    email_normalized: str
    password_hash: str
    display_name: str
    status: str = "active"
    email_verified: bool = False
    email_verified_at: datetime | None = None
    roles: list[str] = field(default_factory=list)
    preferences: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class GroupRecord:
    id: str
    name: str
    description: str | None
    owner_user_id: str
    created_at: datetime
    updated_at: datetime
    roles: list[str] = field(default_factory=list)


@dataclass
class GroupMembershipRecord:
    group_id: str
    user_id: str
    membership_role: str = "member"


@dataclass
class RefreshSessionRecord:
    token_hash: str
    user_id: str
    family_id: str
    expires_at: datetime
    revoked_at: datetime | None = None

    @property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None

    @property
    def is_expired(self) -> bool:
        return datetime.now(UTC) >= self.expires_at


@dataclass
class InvitationRecord:
    id: str
    token_hash: str
    invited_email: str
    invited_email_normalized: str
    invited_by_user_id: str
    group_ids: list[str]
    created_at: datetime
    expires_at: datetime
    accepted_at: datetime | None = None
    accepted_by_user_id: str | None = None
    revoked_at: datetime | None = None


@dataclass
class ExternalAccountLinkageRecord:
    id: str
    user_id: str
    provider: str
    external_subject: str
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class NotificationRecord:
    id: str
    user_id: str
    type: str
    message: str
    severity: str
    requires_acknowledgement: bool
    clearance_mode: str
    source: dict[str, Any] = field(default_factory=dict)
    open_endpoint: str | None = None
    delivery_options: dict[str, Any] = field(default_factory=dict)
    completion_check: dict[str, Any] | None = None
    status: str = "unread"
    merge_count: int = 1
    read_at: datetime | None = None
    acknowledged_at: datetime | None = None
    cleared_at: datetime | None = None
    canceled_at: datetime | None = None
    completion_satisfied_at: datetime | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class OAuthClientRecord:
    id: str
    client_id: str
    name: str
    redirect_uris: list[str]
    allowed_scopes: list[str]
    grant_types: list[str]
    token_endpoint_auth_method: str = "none"
    client_secret_hash: str | None = None
    trusted: bool = False
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class OAuthAuthorizationCodeRecord:
    code_hash: str
    client_id: str
    user_id: str
    redirect_uri: str
    scopes: list[str]
    code_challenge: str
    code_challenge_method: str
    nonce: str | None
    expires_at: datetime
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    consumed_at: datetime | None = None


@dataclass
class OAuthConsentGrantRecord:
    user_id: str
    client_id: str
    scopes: list[str]
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class OAuthAccessTokenRecord:
    token_hash: str
    jti: str
    user_id: str
    client_id: str
    scopes: list[str]
    expires_at: datetime
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    revoked_at: datetime | None = None


@dataclass
class OAuthRefreshTokenRecord:
    token_hash: str
    user_id: str
    client_id: str
    scopes: list[str]
    family_id: str
    expires_at: datetime
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    revoked_at: datetime | None = None


@dataclass
class PersonalAccessTokenRecord:
    id: str
    user_id: str
    name: str
    token_hash: str
    token_encrypted: str
    scopes: list[str]
    expires_at: datetime | None = None
    last_used_at: datetime | None = None
    revoked_at: datetime | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))


class AuthStore:
    def __init__(self) -> None:
        self._users_by_id: dict[str, UserRecord] = {}
        self._users_by_email: dict[str, UserRecord] = {}
        self._users_by_username: dict[str, UserRecord] = {}
        self._sessions: dict[str, RefreshSessionRecord] = {}
        self._invitations: dict[str, InvitationRecord] = {}
        self._groups_by_id: dict[str, GroupRecord] = {}
        self._memberships_by_group: dict[str, dict[str, GroupMembershipRecord]] = {}
        self._roles: dict[str, str | None] = dict(CORE_ROLE_DESCRIPTIONS)
        self._notifications_by_id: dict[str, NotificationRecord] = {}
        self._external_account_linkages: dict[tuple[str, str], ExternalAccountLinkageRecord] = {}
        self._oauth_clients_by_client_id: dict[str, OAuthClientRecord] = {}
        self._oauth_authorization_codes: dict[str, OAuthAuthorizationCodeRecord] = {}
        self._oauth_consent_grants: dict[tuple[str, str], OAuthConsentGrantRecord] = {}
        self._oauth_access_tokens: dict[str, OAuthAccessTokenRecord] = {}
        self._oauth_refresh_tokens: dict[str, OAuthRefreshTokenRecord] = {}
        self._personal_access_tokens: dict[str, PersonalAccessTokenRecord] = {}

    @staticmethod
    def normalize_email(email: str) -> str:
        return email.strip().lower()

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
        preferences: dict[str, Any] | None = None,
    ) -> UserRecord:
        now = datetime.now(UTC)
        normalized_email = self.normalize_email(email)
        normalized_username = username.strip().lower()

        user = UserRecord(
            id=user_id,
            username=username.strip(),
            email=email.strip(),
            email_normalized=normalized_email,
            password_hash=password_hash,
            display_name=display_name.strip(),
            status=status,
            email_verified=email_verified,
            email_verified_at=email_verified_at,
            roles=list(roles or []),
            preferences=dict(preferences or {}),
            updated_at=now,
        )
        existing = self._users_by_id.get(user_id)
        if existing is not None:
            user.created_at = existing.created_at
        else:
            user.created_at = now
        self._users_by_id[user.id] = user
        self._users_by_email[normalized_email] = user
        self._users_by_username[normalized_username] = user
        return user

    def register_local_user(
        self,
        username: str,
        email: str,
        password: str,
        display_name: str | None = None,
        preferences: dict[str, Any] | None = None,
    ) -> UserRecord:
        normalized_email = self.normalize_email(email)
        normalized_username = username.strip().lower()

        if normalized_email in self._users_by_email:
            raise ValueError("EMAIL_ALREADY_EXISTS")
        if normalized_username in self._users_by_username:
            raise ValueError("USERNAME_ALREADY_EXISTS")

        user_id = str(uuid4())
        user = UserRecord(
            id=user_id,
            username=username.strip(),
            email=email.strip(),
            email_normalized=normalized_email,
            password_hash=hash_password(password),
            display_name=(display_name or username).strip(),
            status="pending",
            email_verified=False,
            roles=[],
            preferences=dict(preferences or {}),
        )
        self._users_by_id[user.id] = user
        self._users_by_email[normalized_email] = user
        self._users_by_username[normalized_username] = user
        return user

    def upsert_external_account_linkage(
        self,
        user_id: str,
        provider: str,
        external_subject: str,
        metadata: dict[str, Any] | None = None,
    ) -> ExternalAccountLinkageRecord:
        normalized_provider = provider.strip().lower()
        key = (user_id, normalized_provider)
        now = datetime.now(UTC)
        existing = self._external_account_linkages.get(key)
        if existing is None:
            record = ExternalAccountLinkageRecord(
                id=str(uuid4()),
                user_id=user_id,
                provider=normalized_provider,
                external_subject=external_subject,
                metadata=dict(metadata or {}),
                created_at=now,
                updated_at=now,
            )
            self._external_account_linkages[key] = record
            return record

        existing.external_subject = external_subject
        existing.metadata = dict(metadata or {})
        existing.updated_at = now
        return existing

    def list_external_account_linkages(self, user_id: str) -> list[ExternalAccountLinkageRecord]:
        return sorted(
            [record for (linked_user_id, _), record in self._external_account_linkages.items() if linked_user_id == user_id],
            key=lambda item: item.provider,
        )

    def remove_external_account_linkage(self, user_id: str, provider: str) -> bool:
        key = (user_id, provider.strip().lower())
        return self._external_account_linkages.pop(key, None) is not None

    def authenticate_local_user(self, username_or_email: str, password: str) -> UserRecord | None:
        lookup = username_or_email.strip().lower()
        user = self._users_by_email.get(lookup) or self._users_by_username.get(lookup)
        if user is None:
            return None
        if user.status != "active":
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    def get_user(self, user_id: str) -> UserRecord | None:
        return self._users_by_id.get(user_id)

    def find_user_by_username_or_email(self, username_or_email: str) -> UserRecord | None:
        lookup = username_or_email.strip().lower()
        return self._users_by_email.get(lookup) or self._users_by_username.get(lookup)

    def search_users(self, query: str, limit: int = 10) -> list[UserRecord]:
        needle = query.strip().lower()
        if not needle:
            return []

        matches: list[UserRecord] = []
        seen_ids: set[str] = set()

        for user in self._users_by_id.values():
            haystacks = [user.username.lower(), user.email.lower(), user.display_name.lower()]
            if any(needle in hay for hay in haystacks):
                if user.id in seen_ids:
                    continue
                matches.append(user)
                seen_ids.add(user.id)
            if len(matches) >= limit:
                break

        return matches

    def update_user_profile(
        self,
        user_id: str,
        display_name: str | None = None,
        email: str | None = None,
        preferences: dict[str, Any] | None = None,
    ) -> UserRecord | None:
        user = self.get_user(user_id)
        if user is None:
            return None

        if display_name is not None:
            user.display_name = display_name.strip()
        if email is not None:
            normalized_email = self.normalize_email(email)
            if normalized_email != user.email_normalized:
                if normalized_email in self._users_by_email:
                    raise ValueError("EMAIL_ALREADY_EXISTS")
                self._users_by_email.pop(user.email_normalized, None)
                user.email = email.strip()
                user.email_normalized = normalized_email
                user.email_verified = False
                user.email_verified_at = None
                self._users_by_email[normalized_email] = user
        if preferences is not None:
            user.preferences = preferences
        user.updated_at = datetime.now(UTC)
        return user

    def list_users(self) -> list[UserRecord]:
        return sorted(self._users_by_id.values(), key=lambda user: user.username.lower())

    def admin_update_user(
        self,
        user_id: str,
        display_name: str | None = None,
        email: str | None = None,
        status: str | None = None,
        roles: list[str] | None = None,
        preferences: dict[str, Any] | None = None,
    ) -> UserRecord | None:
        user = self.get_user(user_id)
        if user is None:
            return None

        if display_name is not None:
            user.display_name = display_name.strip()
        if email is not None:
            normalized_email = self.normalize_email(email)
            if normalized_email != user.email_normalized:
                if normalized_email in self._users_by_email:
                    raise ValueError("EMAIL_ALREADY_EXISTS")
                self._users_by_email.pop(user.email_normalized, None)
                user.email = email.strip()
                user.email_normalized = normalized_email
                user.email_verified = False
                user.email_verified_at = None
                self._users_by_email[normalized_email] = user
        if status is not None:
            user.status = status
        if roles is not None:
            user.roles = list(roles)
        if preferences is not None:
            user.preferences = dict(preferences)
        user.updated_at = datetime.now(UTC)
        return user

    def list_roles(self) -> list[dict[str, str | None]]:
        role_names = set(self._roles.keys())
        for user in self._users_by_id.values():
            role_names.update(user.roles)
        for group in self._groups_by_id.values():
            role_names.update(group.roles)
        role_names.update(NON_DELETABLE_CORE_ROLES)

        return [
            {"name": name, "description": self._roles.get(name)}
            for name in sorted(role_names)
        ]

    def create_role(self, role_name: str, description: str | None = None) -> dict[str, str | None]:
        normalized = role_name.strip()
        if not normalized:
            raise ValueError("ROLE_NAME_INVALID")
        if normalized in self._roles:
            raise ValueError("ROLE_EXISTS")

        self._roles[normalized] = description.strip() if description else None
        return {"name": normalized, "description": self._roles[normalized]}

    def update_role(self, role_name: str, description: str | None = None) -> dict[str, str | None] | None:
        normalized = role_name.strip()
        if normalized not in self._roles:
            return None
        self._roles[normalized] = description.strip() if description else None
        return {"name": normalized, "description": self._roles[normalized]}

    def delete_role(self, role_name: str) -> bool:
        normalized = role_name.strip()
        if normalized in NON_DELETABLE_CORE_ROLES:
            raise ValueError("ROLE_PROTECTED")
        if normalized not in self._roles:
            return False

        del self._roles[normalized]
        for user in self._users_by_id.values():
            user.roles = [role for role in user.roles if role != normalized]
        for group in self._groups_by_id.values():
            group.roles = [role for role in group.roles if role != normalized]
        return True

    def role_exists(self, role_name: str) -> bool:
        return any(role["name"] == role_name for role in self.list_roles())

    def mark_email_verified(self, user_id: str) -> UserRecord | None:
        user = self.get_user(user_id)
        if user is None:
            return None

        user.email_verified = True
        user.email_verified_at = datetime.now(UTC)
        if user.status == "pending":
            user.status = "active"
        user.updated_at = datetime.now(UTC)
        return user

    def list_groups(self) -> list[GroupRecord]:
        return sorted(self._groups_by_id.values(), key=lambda group: group.name.lower())

    def create_group(self, owner_user_id: str, name: str, description: str | None = None) -> GroupRecord:
        now = datetime.now(UTC)
        group = GroupRecord(
            id=str(uuid4()),
            name=name.strip(),
            description=description.strip() if description else None,
            owner_user_id=owner_user_id,
            roles=[],
            created_at=now,
            updated_at=now,
        )
        self._groups_by_id[group.id] = group
        self._memberships_by_group[group.id] = {
            owner_user_id: GroupMembershipRecord(group_id=group.id, user_id=owner_user_id, membership_role="owner")
        }
        return group

    def list_groups_owned_by_user(self, owner_user_id: str) -> list[GroupRecord]:
        return [group for group in self._groups_by_id.values() if group.owner_user_id == owner_user_id]

    def list_groups_member_of_user(self, user_id: str) -> list[GroupRecord]:
        groups: list[GroupRecord] = []
        for group_id, memberships in self._memberships_by_group.items():
            if user_id not in memberships:
                continue
            group = self._groups_by_id.get(group_id)
            if group is None:
                continue
            if group.owner_user_id == user_id:
                continue
            groups.append(group)
        return groups

    def get_group(self, group_id: str) -> GroupRecord | None:
        return self._groups_by_id.get(group_id)

    def update_group(
        self,
        group_id: str,
        name: str | None = None,
        description: str | None = None,
        roles: list[str] | None = None,
    ) -> GroupRecord | None:
        group = self.get_group(group_id)
        if group is None:
            return None

        if name is not None:
            group.name = name.strip()
        if description is not None:
            group.description = description.strip() if description else None
        if roles is not None:
            group.roles = list(dict.fromkeys(roles))
        group.updated_at = datetime.now(UTC)
        return group

    def set_group_roles(self, group_id: str, roles: list[str]) -> GroupRecord | None:
        return self.update_group(group_id=group_id, roles=roles)

    def delete_group(self, group_id: str) -> bool:
        if group_id not in self._groups_by_id:
            return False
        del self._groups_by_id[group_id]
        self._memberships_by_group.pop(group_id, None)
        return True

    def is_group_member(self, group_id: str, user_id: str) -> bool:
        memberships = self._memberships_by_group.get(group_id, {})
        return user_id in memberships

    def list_group_members(self, group_id: str) -> list[tuple[UserRecord, str]]:
        memberships = self._memberships_by_group.get(group_id, {})
        members: list[tuple[UserRecord, str]] = []
        for membership in memberships.values():
            user = self.get_user(membership.user_id)
            if user is None:
                continue
            members.append((user, membership.membership_role))
        return members

    def count_group_members(self, group_id: str) -> int:
        return len(self._memberships_by_group.get(group_id, {}))

    def add_group_member(self, group_id: str, user_id: str, membership_role: str = "member") -> bool:
        group = self.get_group(group_id)
        user = self.get_user(user_id)
        if group is None or user is None:
            return False

        memberships = self._memberships_by_group.setdefault(group_id, {})
        if user_id in memberships:
            return True

        memberships[user_id] = GroupMembershipRecord(group_id=group_id, user_id=user_id, membership_role=membership_role)
        group.updated_at = datetime.now(UTC)
        return True

    def remove_group_member(self, group_id: str, user_id: str) -> bool:
        group = self.get_group(group_id)
        if group is None:
            return False
        if group.owner_user_id == user_id:
            return False

        memberships = self._memberships_by_group.get(group_id, {})
        if user_id not in memberships:
            return False

        del memberships[user_id]
        group.updated_at = datetime.now(UTC)
        return True

    def get_effective_roles_for_user(self, user_id: str) -> list[str]:
        user = self.get_user(user_id)
        if user is None:
            return []
        effective_roles = set(user.roles)
        for group_id, memberships in self._memberships_by_group.items():
            if user_id not in memberships:
                continue
            group = self.get_group(group_id)
            if group is None:
                continue
            effective_roles.update(group.roles)
        return sorted(effective_roles)

    @staticmethod
    def _notification_event_identity(type_name: str, source: dict[str, Any] | None) -> str | None:
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

    def create_or_merge_notification(
        self,
        *,
        user_id: str,
        type_name: str,
        message: str,
        severity: str = "info",
        requires_acknowledgement: bool = False,
        clearance_mode: str = "manual",
        source: dict[str, Any] | None = None,
        open_endpoint: str | None = None,
        delivery_options: dict[str, Any] | None = None,
        completion_check: dict[str, Any] | None = None,
    ) -> tuple[NotificationRecord, bool]:
        if self.get_user(user_id) is None:
            raise ValueError("USER_NOT_FOUND")

        event_identity = self._notification_event_identity(type_name, source)
        now = datetime.now(UTC)

        if event_identity is not None:
            for notification in self._notifications_by_id.values():
                if notification.user_id != user_id:
                    continue
                if notification.cleared_at is not None or notification.canceled_at is not None:
                    continue
                if self._notification_event_identity(notification.type, notification.source) != event_identity:
                    continue
                notification.message = message
                notification.severity = severity
                notification.requires_acknowledgement = requires_acknowledgement
                notification.clearance_mode = clearance_mode
                notification.source = dict(source or {})
                notification.open_endpoint = open_endpoint
                notification.delivery_options = dict(delivery_options or {})
                notification.completion_check = dict(completion_check) if completion_check else None
                notification.merge_count += 1
                notification.updated_at = now
                return notification, False

        notification = NotificationRecord(
            id=str(uuid4()),
            user_id=user_id,
            type=type_name.strip(),
            message=message.strip(),
            severity=severity,
            requires_acknowledgement=requires_acknowledgement,
            clearance_mode=clearance_mode,
            source=dict(source or {}),
            open_endpoint=open_endpoint,
            delivery_options=dict(delivery_options or {}),
            completion_check=dict(completion_check) if completion_check else None,
            status="unread",
            merge_count=1,
            created_at=now,
            updated_at=now,
        )
        self._notifications_by_id[notification.id] = notification
        return notification, True

    def get_notification(self, notification_id: str) -> NotificationRecord | None:
        return self._notifications_by_id.get(notification_id)

    @staticmethod
    def _notification_completed_at(notification: NotificationRecord) -> datetime | None:
        return notification.cleared_at or notification.acknowledged_at or notification.read_at or notification.canceled_at

    def purge_completed_notifications(self, retention_hours: int) -> int:
        cutoff = datetime.now(UTC) - timedelta(hours=retention_hours)
        to_delete: list[str] = []
        for notification_id, notification in self._notifications_by_id.items():
            completed_at = self._notification_completed_at(notification)
            if completed_at is None:
                continue
            if completed_at <= cutoff:
                to_delete.append(notification_id)
        for notification_id in to_delete:
            self._notifications_by_id.pop(notification_id, None)
        return len(to_delete)

    def list_notifications_for_user(self, user_id: str, status: str | None = None, type_name: str | None = None) -> list[NotificationRecord]:
        notifications = [item for item in self._notifications_by_id.values() if item.user_id == user_id]
        if status:
            notifications = [item for item in notifications if item.status == status]
        if type_name:
            notifications = [item for item in notifications if item.type == type_name]
        return sorted(notifications, key=lambda item: item.created_at, reverse=True)

    def list_notifications(
        self,
        *,
        status: str | None = None,
        type_name: str | None = None,
        user_id: str | None = None,
    ) -> list[NotificationRecord]:
        notifications = list(self._notifications_by_id.values())
        if status:
            notifications = [item for item in notifications if item.status == status]
        if type_name:
            notifications = [item for item in notifications if item.type == type_name]
        if user_id:
            notifications = [item for item in notifications if item.user_id == user_id]
        return sorted(notifications, key=lambda item: item.created_at, reverse=True)

    def mark_notification_read(self, notification_id: str, user_id: str | None = None) -> NotificationRecord | None:
        notification = self.get_notification(notification_id)
        if notification is None:
            return None
        if user_id and notification.user_id != user_id:
            return None
        if notification.read_at is None:
            notification.read_at = datetime.now(UTC)
        if notification.status == "unread":
            notification.status = "read"
        notification.updated_at = datetime.now(UTC)
        return notification

    def acknowledge_notification(self, notification_id: str, user_id: str | None = None) -> NotificationRecord | None:
        notification = self.get_notification(notification_id)
        if notification is None:
            return None
        if user_id and notification.user_id != user_id:
            return None
        now = datetime.now(UTC)
        if notification.read_at is None:
            notification.read_at = now
        notification.acknowledged_at = now
        notification.status = "acknowledged"
        notification.updated_at = now
        return notification

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
            notification.completion_satisfied_at = datetime.now(UTC)
            notification.updated_at = datetime.now(UTC)
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
        if notification.read_at is None:
            notification.read_at = now
        notification.cleared_at = now
        notification.status = "cleared"
        notification.updated_at = now
        return notification

    def cancel_notification(self, notification_id: str) -> NotificationRecord | None:
        notification = self.get_notification(notification_id)
        if notification is None:
            return None
        if notification.canceled_at is None:
            notification.canceled_at = datetime.now(UTC)
        notification.status = "cleared"
        notification.updated_at = datetime.now(UTC)
        return notification

    def delete_notification(self, notification_id: str) -> bool:
        if notification_id not in self._notifications_by_id:
            return False
        del self._notifications_by_id[notification_id]
        return True

    def create_refresh_session(self, user_id: str, settings: Settings, family_id: str | None = None) -> tuple[str, int]:
        refresh_token = generate_refresh_token()
        token_hash = hash_refresh_token(refresh_token)
        session_family = family_id or str(uuid4())

        session = RefreshSessionRecord(
            token_hash=token_hash,
            user_id=user_id,
            family_id=session_family,
            expires_at=datetime.now(UTC) + timedelta(seconds=settings.jwt_refresh_token_ttl_seconds),
        )
        self._sessions[token_hash] = session
        return refresh_token, settings.jwt_refresh_token_ttl_seconds

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
        record = InvitationRecord(
            id=str(uuid4()),
            token_hash=token_hash,
            invited_email=invited_email.strip(),
            invited_email_normalized=self.normalize_email(invited_email),
            invited_by_user_id=invited_by_user_id,
            group_ids=list(dict.fromkeys(group_ids)),
            created_at=now,
            expires_at=now + timedelta(seconds=settings.email_invitation_ttl_seconds),
            revoked_at=None,
        )
        self._invitations[token_hash] = record
        return token, record

    def get_invitation_by_token(self, token: str) -> InvitationRecord | None:
        token_hash = hash_refresh_token(token)
        invitation = self._invitations.get(token_hash)
        if invitation is None:
            return None
        if invitation.accepted_at is not None:
            return None
        if invitation.revoked_at is not None:
            return None
        if datetime.now(UTC) >= invitation.expires_at:
            return None
        return invitation

    def get_outstanding_invitation_by_id(self, invitation_id: str) -> InvitationRecord | None:
        now = datetime.now(UTC)
        for invitation in self._invitations.values():
            if invitation.id != invitation_id:
                continue
            if invitation.accepted_at is not None:
                return None
            if invitation.revoked_at is not None:
                return None
            if invitation.expires_at <= now:
                return None
            return invitation
        return None

    def revoke_invitation(self, invitation_id: str) -> bool:
        invitation = self.get_outstanding_invitation_by_id(invitation_id)
        if invitation is None:
            return False
        invitation.revoked_at = datetime.now(UTC)
        return True

    def list_outstanding_invitations(self) -> list[InvitationRecord]:
        now = datetime.now(UTC)
        invitations = [
            invitation
            for invitation in self._invitations.values()
            if invitation.accepted_at is None and invitation.revoked_at is None and invitation.expires_at > now
        ]
        return sorted(invitations, key=lambda item: item.created_at, reverse=True)

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

        invitation.accepted_at = datetime.now(UTC)
        invitation.accepted_by_user_id = user_id
        return invitation

    def rotate_refresh_session(self, refresh_token: str, settings: Settings) -> tuple[UserRecord | None, str | None, int | None]:
        current_hash = hash_refresh_token(refresh_token)
        session = self._sessions.get(current_hash)
        if session is None or session.is_revoked or session.is_expired:
            return None, None, None

        session.revoked_at = datetime.now(UTC)
        user = self.get_user(session.user_id)
        if user is None:
            return None, None, None

        new_refresh_token, ttl = self.create_refresh_session(user.id, settings, family_id=session.family_id)
        return user, new_refresh_token, ttl

    def revoke_refresh_session(self, refresh_token: str) -> bool:
        token_hash = hash_refresh_token(refresh_token)
        session = self._sessions.get(token_hash)
        if session is None:
            return False
        if session.revoked_at is None:
            session.revoked_at = datetime.now(UTC)
        return True

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
        client_id = f"client_{uuid4().hex}"
        now = datetime.now(UTC)
        record = OAuthClientRecord(
            id=str(uuid4()),
            client_id=client_id,
            name=name.strip(),
            redirect_uris=list(dict.fromkeys(item.strip() for item in redirect_uris if item.strip())),
            allowed_scopes=list(dict.fromkeys(item.strip() for item in allowed_scopes if item.strip())),
            grant_types=list(dict.fromkeys(item.strip() for item in (grant_types or ["authorization_code", "refresh_token"]) if item.strip())),
            token_endpoint_auth_method=token_endpoint_auth_method,
            client_secret_hash=hash_oauth_secret(client_secret) if client_secret else None,
            trusted=trusted,
            created_at=now,
            updated_at=now,
        )
        self._oauth_clients_by_client_id[record.client_id] = record
        return record

    def list_oauth_clients(self) -> list[OAuthClientRecord]:
        return sorted(self._oauth_clients_by_client_id.values(), key=lambda item: item.name.lower())

    def get_oauth_client_by_client_id(self, client_id: str) -> OAuthClientRecord | None:
        return self._oauth_clients_by_client_id.get(client_id)

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
        client = self.get_oauth_client_by_client_id(client_id)
        if client is None:
            return None
        if name is not None:
            client.name = name.strip()
        if redirect_uris is not None:
            client.redirect_uris = list(dict.fromkeys(item.strip() for item in redirect_uris if item.strip()))
        if allowed_scopes is not None:
            client.allowed_scopes = list(dict.fromkeys(item.strip() for item in allowed_scopes if item.strip()))
        if grant_types is not None:
            client.grant_types = list(dict.fromkeys(item.strip() for item in grant_types if item.strip()))
        if trusted is not None:
            client.trusted = trusted
        if token_endpoint_auth_method is not None:
            client.token_endpoint_auth_method = token_endpoint_auth_method
        if client_secret is not None:
            client.client_secret_hash = hash_oauth_secret(client_secret)
        client.updated_at = datetime.now(UTC)
        return client

    def delete_oauth_client(self, client_id: str) -> bool:
        return self._oauth_clients_by_client_id.pop(client_id, None) is not None

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
        record = OAuthAuthorizationCodeRecord(
            code_hash=hash_oauth_secret(code),
            client_id=client_id,
            user_id=user_id,
            redirect_uri=redirect_uri,
            scopes=list(dict.fromkeys(scopes)),
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
            nonce=nonce,
            expires_at=expires_at,
        )
        self._oauth_authorization_codes[record.code_hash] = record
        return record

    def consume_oauth_authorization_code(self, code: str) -> OAuthAuthorizationCodeRecord | None:
        code_hash = hash_oauth_secret(code)
        record = self._oauth_authorization_codes.get(code_hash)
        if record is None:
            return None
        if record.consumed_at is not None:
            return None
        if datetime.now(UTC) >= record.expires_at:
            return None
        record.consumed_at = datetime.now(UTC)
        return record

    def has_oauth_consent_for_scopes(self, *, user_id: str, client_id: str, scopes: list[str]) -> bool:
        record = self._oauth_consent_grants.get((user_id, client_id))
        if record is None:
            return False
        granted_scopes = set(record.scopes)
        return set(scopes).issubset(granted_scopes)

    def upsert_oauth_consent_grant(self, *, user_id: str, client_id: str, scopes: list[str]) -> OAuthConsentGrantRecord:
        key = (user_id, client_id)
        now = datetime.now(UTC)
        existing = self._oauth_consent_grants.get(key)
        if existing is None:
            record = OAuthConsentGrantRecord(user_id=user_id, client_id=client_id, scopes=list(dict.fromkeys(scopes)), created_at=now, updated_at=now)
            self._oauth_consent_grants[key] = record
            return record

        existing.scopes = sorted(set(existing.scopes).union(scopes))
        existing.updated_at = now
        return existing

    def list_oauth_connected_apps_for_user(self, user_id: str) -> list[tuple[OAuthConsentGrantRecord, OAuthClientRecord]]:
        connected: list[tuple[OAuthConsentGrantRecord, OAuthClientRecord]] = []
        for (grant_user_id, client_id), grant in self._oauth_consent_grants.items():
            if grant_user_id != user_id:
                continue
            client = self._oauth_clients_by_client_id.get(client_id)
            if client is None:
                continue
            connected.append((grant, client))
        connected.sort(key=lambda item: item[0].updated_at, reverse=True)
        return connected

    def revoke_oauth_connected_app_for_user(self, *, user_id: str, client_id: str) -> bool:
        removed = self._oauth_consent_grants.pop((user_id, client_id), None) is not None
        now = datetime.now(UTC)

        for access_token in self._oauth_access_tokens.values():
            if access_token.user_id == user_id and access_token.client_id == client_id and access_token.revoked_at is None:
                access_token.revoked_at = now
                removed = True

        for refresh_token in self._oauth_refresh_tokens.values():
            if refresh_token.user_id == user_id and refresh_token.client_id == client_id and refresh_token.revoked_at is None:
                refresh_token.revoked_at = now
                removed = True

        return removed

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
        token_hash = hash_oauth_secret(token)
        record = OAuthAccessTokenRecord(
            token_hash=token_hash,
            jti=jti,
            user_id=user_id,
            client_id=client_id,
            scopes=list(dict.fromkeys(scopes)),
            expires_at=expires_at,
            created_at=datetime.now(UTC),
        )
        self._oauth_access_tokens[token_hash] = record
        return record

    def revoke_oauth_access_token(self, token: str) -> bool:
        token_hash = hash_oauth_secret(token)
        record = self._oauth_access_tokens.get(token_hash)
        if record is None:
            return False
        if record.revoked_at is None:
            record.revoked_at = datetime.now(UTC)
        return True

    def is_oauth_access_token_active(self, token: str) -> bool:
        token_hash = hash_oauth_secret(token)
        record = self._oauth_access_tokens.get(token_hash)
        if record is None:
            return False
        if record.revoked_at is not None:
            return False
        return datetime.now(UTC) < record.expires_at

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
        token_hash = hash_oauth_secret(token)
        record = OAuthRefreshTokenRecord(
            token_hash=token_hash,
            user_id=user_id,
            client_id=client_id,
            scopes=list(dict.fromkeys(scopes)),
            family_id=family_id or str(uuid4()),
            expires_at=expires_at,
            created_at=datetime.now(UTC),
        )
        self._oauth_refresh_tokens[token_hash] = record
        return token, record

    def get_active_oauth_refresh_token(self, token: str) -> OAuthRefreshTokenRecord | None:
        token_hash = hash_oauth_secret(token)
        record = self._oauth_refresh_tokens.get(token_hash)
        if record is None:
            return None
        if record.revoked_at is not None:
            return None
        if datetime.now(UTC) >= record.expires_at:
            return None
        return record

    def revoke_oauth_refresh_token(self, token: str) -> bool:
        token_hash = hash_oauth_secret(token)
        record = self._oauth_refresh_tokens.get(token_hash)
        if record is None:
            return False
        if record.revoked_at is None:
            record.revoked_at = datetime.now(UTC)
        return True

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
        token_hash = hash_personal_access_token(token)
        record = PersonalAccessTokenRecord(
            id=str(uuid4()),
            user_id=user_id,
            name=name.strip(),
            token_hash=token_hash,
            token_encrypted=token_encrypted,
            scopes=list(dict.fromkeys(scopes)),
            expires_at=expires_at,
            created_at=now,
            updated_at=now,
        )
        self._personal_access_tokens[record.id] = record
        return record

    def list_active_personal_access_tokens_for_user(self, user_id: str) -> list[PersonalAccessTokenRecord]:
        now = datetime.now(UTC)
        records = [
            token
            for token in self._personal_access_tokens.values()
            if token.user_id == user_id
            and token.revoked_at is None
            and (token.expires_at is None or token.expires_at > now)
        ]
        return sorted(records, key=lambda item: item.created_at, reverse=True)

    def resolve_active_personal_access_token(self, token: str) -> PersonalAccessTokenRecord | None:
        now = datetime.now(UTC)
        token_hash = hash_personal_access_token(token)
        for record in self._personal_access_tokens.values():
            if record.token_hash != token_hash:
                continue
            if record.revoked_at is not None:
                return None
            if record.expires_at is not None and record.expires_at <= now:
                return None
            return record
        return None

    def touch_personal_access_token_last_used(self, token_id: str) -> bool:
        record = self._personal_access_tokens.get(token_id)
        if record is None:
            return False
        record.last_used_at = datetime.now(UTC)
        record.updated_at = record.last_used_at
        return True

    def revoke_personal_access_token(self, *, user_id: str, token_id: str) -> bool:
        record = self._personal_access_tokens.get(token_id)
        if record is None or record.user_id != user_id:
            return False
        if record.revoked_at is None:
            now = datetime.now(UTC)
            record.revoked_at = now
            record.updated_at = now
        return True
