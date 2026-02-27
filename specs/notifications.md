# Notifications Specification (MVP)

## 1) Purpose
Define the baseline in-app notification system for delivery, acknowledgement, task-gated clearing, real-time transport, and offline fallback.

## 2) Scope (MVP)
- Create notifications for one or more users as a result of system/business actions
- Optional superuser/testing producer APIs for diagnostics and controlled test workflows
- Deliver notifications in-app over websocket when user is actively connected
- Persist notifications for reliable retrieval and state tracking
- Support notification clearing rules:
  - simple acknowledge-required notifications
  - task/state-gated notifications that cannot be cleared until completion criteria are satisfied
- Send email fallback for eligible notifications when a user remains disconnected beyond configurable threshold (default 3 minutes)
- Use Redis pub/sub as backend process bus for websocket fanout across multi-process deployments

## 3) Notification Model

### 3.1 Core fields
- `id` (string/uuid)
- `user_id` (recipient)
- `type` (string, app-defined)
- `message` (string)
- `severity` (enum: `info`, `success`, `warning`, `error`)
- `requires_acknowledgement` (bool)
- `clearance_mode` (enum: `manual`, `ack`, `task_gate`)
- `source` (object)
  - `entity_type` (optional)
  - `entity_id` (optional)
  - `event_id` (optional)
  - `dedupe_key` (optional, producer-provided)
- `open_endpoint` (string, notification endpoint URL)
- `delivery_options` (object)
  - `in_app_enabled` (bool, default true)
  - `email_fallback_enabled` (bool, default false)
  - `email_template_id` (optional)
  - `email_redelivery_max_attempts` (optional override)
- `status` (enum: `unread`, `read`, `acknowledged`, `cleared`)
- `merge_count` (int, default 1)
- `created_at`, `updated_at`, `read_at`, `acknowledged_at`, `cleared_at`

### 3.2 Task-gated clearing
For `clearance_mode=task_gate`, notifications include a completion-check definition:
- `completion_check.function_key` (string)
- `completion_check.arguments` (object)
- `completion_check.retry_interval_seconds` (int)
- `completion_check.timeout_seconds` (optional int)
- `completion_check.dependencies` (optional list of dependency keys or entity references)

Dependency trigger scope:
- `completion_check.dependencies` is notification-specific metadata.
- Dependencies must be provided as part of that notification's create payload when dependency-trigger optimization is desired.
- No global dependency registry is required for this behavior in MVP.

Semantics:
- Notification cannot be cleared until the completion check reports success.
- Completion checks are backend-evaluated and must map to server-registered functions (never arbitrary executable user input).
- Completion checks are scheduler-driven for all outstanding task-gated notifications.
- When a specific dependency is declared, the system should also trigger an immediate check when that dependency changes.
- If dependency-triggered checks are not possible for a specific notification/check, scheduler-only behavior is used.

### 3.3 Source metadata (optional)
- `source` object with contextual identifiers (e.g., `entity_type`, `entity_id`, `event_id`) for traceability and deduplication logic.

### 3.4 Active deduplication/merge
- The same event must not create multiple active notifications for the same user.
- If a new notification arrives with the same active event identity (derived from `type` + `source` and/or `source.dedupe_key`), the existing active notification is updated/merged rather than duplicated.
- Merge behavior increments `merge_count` and updates message metadata as configured.

## 4) API Surface (MVP)

### 4.1 Producer/admin APIs
- `POST /api/v1/notifications`
  - create one notification for one or more users (superuser/testing/internal use)
- `POST /api/v1/notifications/bulk`
  - optional batch endpoint for high-volume internal/system use cases

### 4.3 Superuser notification administration APIs
- `GET /api/v1/admin/notifications`
  - list notifications across all users with filters (status/type/recipient/date window)
- `GET /api/v1/admin/notifications/{id}`
  - view full notification detail and delivery history
- `POST /api/v1/admin/notifications/{id}/resend`
  - trigger immediate re-delivery attempt (in-app if connected, otherwise email policy path)
- `POST /api/v1/admin/notifications/{id}/cancel`
  - cancel active notification (prevents further delivery attempts; retains audit/history)
- `DELETE /api/v1/admin/notifications/{id}`
  - hard delete notification record (superuser-only operation; must be audited)

Producer authorization policy:
- Outside superuser/testing, users do not directly send notifications.
- Normal application notification creation is expected to be service/internal-event driven.

### 4.2 Recipient APIs
- `GET /api/v1/notifications`
  - list recipient notifications (filters: status, type, unread only, pagination)
- `GET /api/v1/notifications/{id}`
- `POST /api/v1/notifications/{id}/read`
- `POST /api/v1/notifications/{id}/acknowledge`
- `POST /api/v1/notifications/{id}/clear`
  - returns validation error when clear preconditions are not met
- `POST /api/v1/notifications/{id}/check-completion`
  - explicit trigger; automatic checks also run in background scheduler
- `GET /api/v1/notifications/{id}/open`
  - notification landing endpoint that marks display/read state and redirects to in-app destination

Open endpoint semantics:
- Links in emails/notifications must point to the notification open endpoint.
- For acknowledge-required-only notifications (`clearance_mode=ack`), successful open/display is sufficient to acknowledge and clear.

## 5) Realtime Delivery

### 5.1 Websocket endpoint
- `GET /api/v1/ws/events`
- Authentication pattern follows existing API auth model; use JWT access token in connection query for MVP.

### 5.2 Event envelope
Each websocket message uses a stable envelope:
```json
{
  "eventType": "notification.created",
  "eventId": "evt_...",
  "timestamp": "2026-02-26T12:34:56Z",
  "payload": {}
}
```

Minimum event types:
- `notification.created`
- `notification.updated`
- `notification.cleared`
- `notification.check.completed`

### 5.3 Multi-process fanout with Redis
- Backend instances publish notification events to Redis channels/topics.
- The instance holding user websocket session subscribes and forwards matching user events.
- Delivery path must avoid duplicate in-app events to same websocket session.

## 6) Delivery Strategy

### 6.1 Primary path
1. Persist notification record
2. Attempt in-app websocket delivery if user has active connection
3. Mark `delivery_state.in_app_attempted=true` and `in_app_delivered_at` on success

### 6.2 Offline email fallback
- If recipient has no active websocket connection continuously for `NOTIFICATIONS_EMAIL_FALLBACK_DELAY_SECONDS` (default `180`), send email only when:
  - `delivery_options.email_fallback_enabled=true`, and
  - notification not already cleared
- Eligible notification classes for fallback include both acknowledge-required and task-gated notifications.
- Email may be re-delivered up to configurable max attempts using day-scale exponential delay (e.g., 1 day, 2 days, 4 days, 8 days, 16 days), capped by `N`.
- The same notification must not be sent by email more than once per 24-hour period.
- After max email attempts are reached, no further emails are sent for that notification.
- Active notifications must continue to render in the UI until cleared, regardless of email retry exhaustion.

### 6.3 Reliability expectations
- Persist-before-publish ordering
- Retry transient Redis publish failures
- Idempotent email-fallback scheduling/dispatch per notification
- Strict inter-event ordering is not required.

### 6.5 Completion-check execution strategy
- Baseline: periodic scheduler evaluates all outstanding task-gated notifications.
- Optimization/shortcut: when dependency change signals are available, trigger targeted checks immediately for affected notifications.
- Implementations should avoid redundant checks when upstream dependency state is known unchanged.
- Scheduler remains the correctness fallback when dependency-trigger optimization is unavailable.

### 6.4 Active connection semantics
- "Actively connected" means websocket is connected and delivery to that websocket is confirmed.
- If in-app delivery is not confirmed, notification remains eligible for later fallback flow.

## 7) Security and Authorization
- Users may only read/ack/clear their own notifications.
- Producer APIs require privileged role(s) to be defined by policy.
- Completion function keys must be allow-listed server-side.
- Notification content must not include secrets or sensitive credentials.

## 8) UI/UX Requirements (MVP)
- Header notification indicator with unread count
- Notification list panel/page with filtering and item state transitions
- Visual distinction for:
  - unread/read
  - requires acknowledgement
  - task-gated/pending completion
- Click behavior goes through notification open endpoint, which then redirects in-app
- Attempting to clear task-gated notification before completion shows clear error reason

Superuser admin UI:
- A superuser-only notifications admin page in settings to view notifications across all users
- Filter/search controls for recipient, type, status, and date
- Row/detail actions for `Resend`, `Cancel`, and `Delete`
- Delivery-attempt history visible for troubleshooting

## 9) Configuration Dependencies
- Redis connectivity + channel settings for websocket fanout
- Websocket auth/token settings
- Email fallback threshold and polling/retry intervals
- Email fallback redelivery max attempts and exponential-backoff settings
- Day-scale exponential redelivery schedule defaults (1d base, x2 multiplier)
- Notification completion-check scheduler tuning
- Completed-notification retention window (default 48 hours)

## 10) Testing Requirements
- API tests for create/list/read/ack/clear and authorization boundaries
- Task-gated completion-check behavior tests (success/failure/retry)
- Websocket integration tests for real-time event receipt
- Multi-process simulation tests validating Redis fanout behavior
- Offline threshold tests validating delayed email fallback and deduplication
- Active-event dedupe/merge tests (no duplicate active notifications)
- Redelivery tests (max attempts, day-scale exponential delay: 1d/2d/4d..., and daily send cap)
- UI tests verifying active notifications remain visible after email retries are exhausted
- Open endpoint tests for redirect and ack-clear behavior for ack-only notifications
- Dependency-trigger tests for immediate completion-check execution on declared dependency changes
- Scheduler fallback tests for notifications without dependency-trigger support
- Optimization tests validating checks are skipped when dependency state is known unchanged
- Superuser admin notification tests for list/detail/resend/cancel/delete and non-superuser denial paths

## 11) Acceptance Criteria
- Notification can be created and observed in recipient UI in near real-time when connected.
- User receives email fallback after configured offline threshold when eligible.
- Task-gated notifications cannot clear until completion checks pass.
- System works correctly when websocket connections and API requests are served by different backend processes.
- Duplicate active events do not create duplicate active notifications for same recipient.
- Completed notifications are retained for 48 hours, then eligible for purge.
- Email redelivery follows day-scale exponential schedule capped by configurable max attempts.
- Active notifications remain visible in-app even after email redelivery attempts are exhausted.
- Superuser can view all notifications and perform resend/cancel/delete from admin UI and API.

## 12) Resolved Decisions and Remaining Notes
Resolved from current planning:
- Notification creation is internal/action-driven; direct user-send is not available beyond superuser/testing pathways.
- Active duplicate events are merged into one active notification per recipient.
- Completion checks should run on scheduler for all outstanding task-gated items, with dependency-change triggers as an optimization when definable.
- Email fallback applies to both ack-required and task-gated notifications with day-scale exponential re-delivery (1d, 2d, 4d, ...) up to configurable max attempts.
- Notification emails link to notification open endpoint for redirect handling.
- Strict ordering is not required.
- Completed-notification retention target is 48 hours.

Remaining implementation note:
- Define exact default decay function for completion checks and email retries (documented in config defaults).
