# Data Model Specification (v1 Draft)

## 1) Purpose
Define a database-agnostic persistence model for authentication, users, role assignment, user-owned groups, and auditing.

## 2) Design Principles
- Keep domain model independent from storage engine implementation
- Use repository/adapter interfaces so the backend is non-committal to a specific database technology
- Prefer MongoDB as the default adapter for MVP deployments
- Use immutable surrogate primary keys (`uuid` or provider-equivalent string ids) for core entities
- Enforce case-insensitive email uniqueness using canonicalized email values
- Store timestamps in UTC
- Enforce ownership and authorization constraints at application and DB levels where practical

## 3) Entity Overview
- `users`
- `auth_identities`
- `sessions`
- `roles`
- `user_roles`
- `groups`
- `group_memberships`
- `notifications`
- `notification_deliveries`
- `audit_events`

## 4) Storage Model

### 4.1 MongoDB Preferred Collection Mapping (MVP)
- `users`
- `auth_identities`
- `sessions`
- `roles`
- `user_roles`
- `groups`
- `group_memberships`
- `notifications`
- `notification_deliveries`
- `audit_events`

### 4.2 Optional SQL-Compatible Mapping (Future)
The same entities may be represented in relational tables with equivalent fields and constraints. Domain services must consume repository interfaces and remain unchanged when adapters are swapped.

## 5) Entity Definitions

### `users`
Core user profile/account record.

Fields (draft):
- `id` (string/uuid, primary id)
- `username` (string, unique, nullable for external-only users if policy allows)
- `email` (string, required, display/original value preserved for UI and audit)
- `email_normalized` (string, required, canonical identity value: trimmed + lowercase)
- `email_verified` (boolean, default false)
- `display_name` (string)
- `status` (enum: `active`, `disabled`, `pending`)
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `last_login_at` (timestamp, nullable)
- `preferences` (json/object, optional; includes `profileProperties` map for configurable built-in profile attributes only)

Indexes/Constraints:
- unique on `username`
- unique on `email_normalized`
- index on `status`

Email canonicalization rules:
- On create/update, derive `email_normalized` from `email` using `trim + lowercase`
- Uniqueness and account-linking comparisons use `email_normalized` only
- Preserve original casing/format in `email` for display and audit history
- Do not apply provider-specific rewrites (e.g., dot folding or `+tag` stripping)

### `auth_identities`
Links external/local auth provider identities to users.

Notes:
- External account linkage state is stored in this table/collection (or equivalent linkage table), not in `users.preferences.profileProperties`.

Data minimization guidance:
- Persist only provider attributes required for identity linking, account display, and authorization decisions
- Do not persist full raw assertions/tokens/claims payloads unless explicitly required by policy

Fields (draft):
- `id` (string/uuid, primary id)
- `user_id` (string/uuid, ref -> `users.id`)
- `provider` (string)
- `provider_subject` (string)
- `provider_username` (string, nullable)
- `provider_email` (string, nullable)
- `linked_at` (timestamp)
- `last_used_at` (timestamp, nullable)

Constraints:
- unique (`provider`, `provider_subject`)

Indexes:
- index on `user_id`
- index on `provider`

### `sessions`
Refresh token/session-family tracking records.

Fields (draft):
- `id` (string/uuid, primary id)
- `user_id` (string/uuid, ref -> `users.id`)
- `refresh_token_hash` (string, unique)
- `token_family_id` (string/uuid)
- `issued_at` (timestamp)
- `expires_at` (timestamp)
- `revoked_at` (timestamp, nullable)
- `rotated_at` (timestamp, nullable)
- `ip_address` (string, nullable)
- `user_agent` (string, nullable)

Indexes:
- index on `user_id`
- index on `expires_at`

### `roles`
Admin-managed role catalog.

Fields (draft):
- `id` (string/uuid, primary id)
- `name` (string, unique)
- `description` (string, nullable)
- `is_system` (boolean, default false)
- `created_at` (timestamp)
- `updated_at` (timestamp)

Indexes:
- unique index on `name`

### `user_roles`
Many-to-many mapping between users and roles.

Fields (draft):
- `user_id` (string/uuid, ref -> `users.id`)
- `role_id` (string/uuid, ref -> `roles.id`)
- `assigned_by_user_id` (string/uuid, ref -> `users.id`, nullable)
- `assigned_at` (timestamp)

Constraints:
- primary key (`user_id`, `role_id`)

Indexes:
- index on `role_id`

### `groups`
User-owned groups.

Fields (draft):
- `id` (string/uuid, primary id)
- `name` (string)
- `description` (string, nullable)
- `owner_user_id` (string/uuid, ref -> `users.id`)
- `visibility` (enum: `private`, `internal`, default `private`)
- `created_at` (timestamp)
- `updated_at` (timestamp)

Indexes:
- index on `owner_user_id`
- index on `name`
- index on (`owner_user_id`, `name`)

### `group_memberships`
Tracks users in groups (owner is normally also a member).

Fields (draft):
- `group_id` (string/uuid, ref -> `groups.id`)
- `user_id` (string/uuid, ref -> `users.id`)
- `membership_role` (enum: `owner`, `manager`, `member`)
- `added_by_user_id` (string/uuid, ref -> `users.id`, nullable)
- `added_at` (timestamp)

Constraints:
- primary key (`group_id`, `user_id`)

Indexes:
- index on `user_id`

### `audit_events`
Immutable audit log for security and administrative activity.

Fields (draft):
- `id` (string/uuid, primary id)
- `actor_user_id` (string/uuid, ref -> `users.id`, nullable)
- `action` (string)
- `target_type` (string)
- `target_id` (string)
- `metadata_json` (json/jsonb)
- `correlation_id` (string, nullable)
- `created_at` (timestamp)

Indexes:
- index on `actor_user_id`
- index on (`target_type`, `target_id`)
- index on `created_at`

### `notifications`
Per-user notification records.

Fields (draft):
- `id` (string/uuid, primary id)
- `user_id` (string/uuid, ref -> `users.id`)
- `type` (string)
- `event_identity` (string; deterministic identity used for active dedupe/merge)
- `message` (string)
- `severity` (enum: `info`, `success`, `warning`, `error`)
- `requires_acknowledgement` (boolean)
- `clearance_mode` (enum: `manual`, `ack`, `task_gate`)
- `navigation` (json: `kind`, `target`, optional `params`)
- `delivery_options` (json: `in_app_enabled`, `email_fallback_enabled`, optional `email_template_id`)
- `merge_count` (int, default 1)
- `completion_check` (json, nullable: `function_key`, `arguments`, `retry_interval_seconds`, optional `timeout_seconds`)
- `status` (enum: `unread`, `read`, `acknowledged`, `cleared`)
- `read_at` (timestamp, nullable)
- `acknowledged_at` (timestamp, nullable)
- `cleared_at` (timestamp, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

Indexes:
- index on `user_id`
- index on (`user_id`, `status`)
- index on (`user_id`, `created_at`)
- unique partial index on (`user_id`, `event_identity`) where status is active (`unread|read|acknowledged`)

### `notification_deliveries`
Tracks in-app and fallback-email delivery lifecycle per notification.

Fields (draft):
- `id` (string/uuid, primary id)
- `notification_id` (string/uuid, ref -> `notifications.id`)
- `in_app_attempted_at` (timestamp, nullable)
- `in_app_delivered_at` (timestamp, nullable)
- `in_app_delivery_ack_at` (timestamp, nullable)
- `last_connection_seen_at` (timestamp, nullable)
- `email_fallback_eligible_at` (timestamp, nullable)
- `email_fallback_sent_at` (timestamp, nullable)
- `email_attempt_count` (int, default 0)
- `email_redelivery_max_attempts` (int, nullable override)
- `next_email_attempt_at` (timestamp, nullable)
- `next_completion_check_at` (timestamp, nullable)
- `last_error` (string, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

Indexes:
- unique index on `notification_id`
- index on `email_fallback_eligible_at`
- index on `email_fallback_sent_at`
- index on `next_email_attempt_at`
- index on `next_completion_check_at`

## 6) Repository Interface Contracts (Required)
- `UserRepository`
	- `getById`, `getByUsernameOrEmail`, `create`, `updateProfile`, `list`
- `RoleRepository`
	- `list`, `create`, `update`, `deleteIfAllowed`, `setUserRoles`, `getUserRoles`
- `GroupRepository`
	- `createOwnedGroup`, `listOwnedByUser`, `getById`, `updateIfOwnerOrAdmin`, `deleteIfOwnerOrAdmin`, `listAllForAdmin`
- `SessionRepository`
	- `create`, `getByRefreshTokenHash`, `revoke`, `revokeAllForUser`
- `AuditRepository`
	- `append`, `query`
- `NotificationRepository`
	- `create`, `createBulk`, `listForUser`, `getForUser`, `markRead`, `acknowledge`, `clearIfAllowed`, `updateCompletionState`
- `NotificationDeliveryRepository`
	- `recordInAppAttempt`, `recordInAppDelivery`, `markFallbackEligible`, `recordFallbackEmailSent`, `listFallbackDue`

## 7) Relationship Summary
- One `user` -> many `auth_identities`
- One `user` -> many `sessions`
- Many `users` <-> many `roles` via `user_roles`
- One `user` -> many owned `groups`
- Many `users` <-> many `groups` via `group_memberships`
- One `user` -> many `notifications`
- One `notification` -> one `notification_delivery`

## 8) Deletion/Retention Policies (Draft)
- Hard delete of user should be restricted by default in production; prefer soft-disable (`status=disabled`)
- Session rows may be purged after retention window
- Audit events should be append-only and retained per policy
- Role deletion blocked when assigned to any user
- Completed notifications are retained for 48 hours by default, then eligible for purge

## 9) Data Model Acceptance Criteria
- Schema supports all endpoints in `api.md`
- Role assignment is many-to-many
- Group ownership and membership can be represented independently
- Audit trail can capture admin role/group operations with before/after metadata
- MongoDB adapter supports all repository contracts for MVP
- Domain/application services remain unchanged when database adapter is swapped
