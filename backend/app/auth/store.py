from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.auth.security import generate_refresh_token, hash_password, hash_refresh_token, verify_password
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
    roles: list[str] = field(default_factory=list)


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


class AuthStore:
    def __init__(self) -> None:
        self._users_by_id: dict[str, UserRecord] = {}
        self._users_by_email: dict[str, UserRecord] = {}
        self._users_by_username: dict[str, UserRecord] = {}
        self._sessions: dict[str, RefreshSessionRecord] = {}

    @staticmethod
    def normalize_email(email: str) -> str:
        return email.strip().lower()

    def register_local_user(self, username: str, email: str, password: str, display_name: str | None = None) -> UserRecord:
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
            roles=[],
        )
        self._users_by_id[user.id] = user
        self._users_by_email[normalized_email] = user
        self._users_by_username[normalized_username] = user
        return user

    def authenticate_local_user(self, username_or_email: str, password: str) -> UserRecord | None:
        lookup = username_or_email.strip().lower()
        user = self._users_by_email.get(lookup) or self._users_by_username.get(lookup)
        if user is None:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    def get_user(self, user_id: str) -> UserRecord | None:
        return self._users_by_id.get(user_id)

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
