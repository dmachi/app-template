# API Specification (v1)

Base path: `/api/v1`
Response format: JSON

## 1) Conventions
- Success: 2xx with resource payload
- Client error: 4xx with error object `{ code, message, details? }`
- Server error: 5xx with generic message and correlation id

## 2) Auth & Session Endpoints

### `GET /meta/auth-providers`
Returns enabled auth providers for login UI.

Provider metadata should include protocol/type and any safe client hints needed to initiate flow (without exposing secrets).

Response example:
```json
{
  "providers": [
    { "id": "local", "displayName": "Local Account", "type": "credentials" },
    { "id": "uva-netbadge", "displayName": "UVA NetBadge", "type": "redirect" }
  ]
}
```

### `POST /auth/login` (local)
Authenticates local credentials and issues access token + refresh token.

Request:
```json
{ "usernameOrEmail": "user@example.org", "password": "..." }
```

Response:
```json
{
  "accessToken": "<jwt>",
  "accessTokenExpiresIn": 900,
  "refreshToken": "<opaque-or-jwt-refresh-token>",
  "refreshTokenExpiresIn": 604800
}
```

### `GET /auth/:provider/start`
Starts redirect-based login flow.

### `GET /auth/:provider/callback`
Completes redirect-based login and issues access token + refresh token.

### `POST /auth/refresh`
Validates refresh token, rotates it, and returns a new access token and rotated refresh token.

Request (bearer-header transport mode):
```json
{ "refreshToken": "<refresh-token>" }
```

Request (cookie transport mode):
- No body required; refresh token is read from secure HttpOnly cookie context.

Response:
```json
{
  "accessToken": "<jwt>",
  "accessTokenExpiresIn": 900,
  "refreshToken": "<refresh-token-if-body-transport>",
  "refreshTokenExpiresIn": 604800
}
```

Behavior notes:
- Returns `401` with stable error code (e.g., `TOKEN_EXPIRED`, `TOKEN_INVALID`, or `TOKEN_REVOKED`) when refresh cannot be completed.
- Clients should treat refresh failure as terminal for the current auth context and log out user.

### `POST /auth/logout`
Revokes refresh token/session family for current client context.

Request:
```json
{ "refreshToken": "<refresh-token-if-body-transport>" }
```

Response:
```json
{ "success": true }
```

### `GET /auth/me`
Returns authenticated user summary and assigned role(s).

Response example:
```json
{
  "id": "user-123",
  "email": "user@example.org",
  "displayName": "User Name",
  "roles": ["superuser"],
  "status": "active"
}
```

## 3) Registration & User Self-Service

### `POST /auth/register`
Creates a local account when registration is enabled.

Request:
```json
{
  "username": "newuser",
  "email": "newuser@example.org",
  "password": "<password>",
  "displayName": "New User"
}
```

Response:
```json
{
  "id": "user-123",
  "email": "newuser@example.org",
  "status": "active"
}
```

### `GET /users/me`
Returns full self profile/settings payload.

Response:
```json
{
  "id": "user-123",
  "username": "newuser",
  "email": "newuser@example.org",
  "displayName": "New User",
  "status": "active",
  "roles": ["Superuser", "InviteUsers"],
  "roleSources": {
    "direct": ["Superuser"],
    "inherited": [
      { "name": "InviteUsers", "groups": ["Operations Team"] }
    ]
  },
  "preferences": {}
}
```

### `PATCH /users/me`
Updates editable self profile/settings fields.

Request:
```json
{
  "displayName": "Updated Name",
  "preferences": {}
}
```

## 4) Group Endpoints (authenticated users)

### `GET /groups`
Lists groups owned by the current user.

### `POST /groups`
Creates a new group owned by the current user.

Request:
```json
{ "name": "Research Team", "description": "Group description" }
```

Response:
```json
{
  "id": "group-123",
  "name": "Research Team",
  "description": "Group description",
  "ownerUserId": "user-123"
}
```

### `GET /groups/:id`
Returns one group if requester is the group owner or `superuser`.

### `PATCH /groups/:id`
Updates editable group fields when requester is the group owner or has elevated privileged-role access.

### `DELETE /groups/:id`
Deletes group when requester is the group owner or has elevated privileged-role access.

## 5) Admin Endpoints (privileged role required)

### `GET /admin/users`
Lists users with optional paging/search/status filters.

Authorization: any role in `USER_MANAGEMENT_ROLES` (must include `superuser`)
Authorization source: configurable user-management role set (must include `superuser`)

Query params:
- `page`, `pageSize`, `q`, `status`, `role`

### `GET /admin/users/:id`
Returns details for one user.

Authorization: any role in `USER_MANAGEMENT_ROLES` (must include `superuser`)
Authorization source: configurable user-management role set (must include `superuser`)

### `PATCH /admin/users/:id`
Edits allowed user fields (status, profile fields).

Authorization: any role in `USER_MANAGEMENT_ROLES` (must include `superuser`)
Authorization source: configurable user-management role set (must include `superuser`)

### `PUT /admin/users/:id/roles`
Replaces assigned roles for the target user.

Authorization: `superuser` (default policy)

Request:
```json
{ "roles": ["user", "manager"] }
```

### `POST /admin/users/:id/reset-password` (local provider only)
Initiates password reset for local-auth users and returns reset operation status.

Authorization: any role in `USER_MANAGEMENT_ROLES` (must include `superuser`)
Authorization source: configurable user-management role set (must include `superuser`)

### `GET /admin/roles`
Lists all roles.

Authorization: `superuser` (default policy)

### `POST /admin/roles`
Creates a role.

Authorization: `superuser` (default policy)

### `GET /admin/roles/:id`
Returns details for one role.

Authorization: `superuser` (default policy)

### `PATCH /admin/roles/:id`
Updates editable role fields (e.g., name, description).

Authorization: `superuser` (default policy)

### `DELETE /admin/roles/:id`
Deletes a non-system role when not in active use.

Authorization: `superuser` (default policy)

### `GET /admin/groups`
Lists all groups across all users.

Authorization: `superuser`

Query params:
- `page`, `pageSize`, `q`, `ownerUserId`

### `GET /admin/groups/:id`
Returns details for one group.

Authorization: `superuser`

### `PATCH /admin/groups/:id`
Admin update for group fields (including reassignment of owner if policy allows).

Authorization: `superuser`

### `DELETE /admin/groups/:id`
Admin delete for any group.

Authorization: `superuser`

### `GET /admin/notifications`
Lists notifications across all users.

Authorization: `superuser`

Query params (draft):
- `page`, `pageSize`, `q`
- `recipientUserId`
- `status` (`unread|read|acknowledged|cleared|canceled`)
- `type`
- `from`, `to`

### `GET /admin/notifications/:id`
Returns full notification details including delivery attempts/history.

Authorization: `superuser`

### `POST /admin/notifications/:id/resend`
Triggers immediate re-delivery attempt for a notification.

Authorization: `superuser`

Behavior:
- Attempts in-app delivery first when actively connected.
- Otherwise follows configured email retry policy path.

### `POST /admin/notifications/:id/cancel`
Cancels an active notification so future delivery attempts stop.

Authorization: `superuser`

### `DELETE /admin/notifications/:id`
Hard deletes notification record.

Authorization: `superuser`

Behavior:
- Operation is audited.
- Recommended only for compliance/data-correction workflows.

## 6) Notification Endpoints

### `POST /notifications`
Creates notification(s) for one or more users.

Authorization:
- Internal/system workflow or `superuser` testing pathway.
- Normal end users do not directly send notifications.

Deduplication behavior:
- If an active notification for same recipient and same active event identity (`type` + source identity/dedupe key) exists, the notification is merged/updated instead of creating a duplicate active record.

Request example:
```json
{
  "recipientUserIds": ["user-123"],
  "type": "policy.notice",
  "message": "Policy update requires acknowledgement.",
  "requiresAcknowledgement": true,
  "clearanceMode": "ack",
  "navigation": { "kind": "route", "target": "/settings/profile" },
  "deliveryOptions": { "inAppEnabled": true, "emailFallbackEnabled": true }
}
```

For task/state-gated notifications, include completion check metadata:
```json
{
  "clearanceMode": "task_gate",
  "completionCheck": {
    "functionKey": "user.completed_profile",
    "arguments": { "userId": "user-123" },
    "retryIntervalSeconds": 60,
    "dependencies": ["user.profile.completed"]
  }
}
```

Notes:
- `completionCheck.dependencies` is defined per notification request payload.
- Dependency-trigger optimization applies only when dependencies are provided for that specific notification.

### `GET /notifications`
Returns notifications for the authenticated user.

Query params (draft):
- `status` (`unread|read|acknowledged|cleared`)
- `type`
- `unreadOnly`
- `page`, `pageSize`

### `POST /notifications/:id/read`
Marks notification as read.

### `POST /notifications/:id/acknowledge`
Marks notification as acknowledged when acknowledgement is required.

### `POST /notifications/:id/clear`
Attempts to clear notification.

Behavior:
- `ack` notifications require acknowledgement before clear.
- `task_gate` notifications require completion check success before clear.

### `POST /notifications/:id/check-completion`
Triggers completion check evaluation for task-gated notification.

Execution model:
- Scheduler periodically checks all outstanding task-gated notifications.
- Dependency-triggered checks should run immediately when declared dependencies change.
- Scheduler remains fallback when dependency-triggering is unavailable.

### `GET /notifications/:id/open`
Notification landing endpoint used by in-app links and email links.

Behavior:
- Marks notification displayed/read state.
- Redirects to application destination associated with notification.
- For ack-only notifications, successful display/open may complete acknowledgement and clear.

## 7) Realtime Events (Websocket)

### `GET /ws/events`
Websocket endpoint for notifications and related events.

Auth model:
- Follow existing API auth pattern; for MVP, use access JWT in websocket connect query.

Event envelope:
```json
{
  "eventType": "notification.created",
  "eventId": "evt_123",
  "timestamp": "2026-02-26T12:34:56Z",
  "payload": {}
}
```

Minimum event types:
- `notification.created`
- `notification.updated`
- `notification.cleared`
- `notification.check.completed`

Ordering:
- Strict per-user event ordering is not required.

Multi-process requirement:
- Use Redis pub/sub as backend message bus so API process publishing notification events can reach websocket session hosted by another process.

## 8) Authorization Rules
- Unauthenticated request to protected endpoint: `401`
- Authenticated but insufficient role: `403`
- Privileged endpoints require configured privileged roles according to endpoint policy
- Group endpoints require authentication
- Group owner can manage owned groups; superuser can manage all groups
- Role CRUD is superuser-only by default
- User management endpoints are available to roles listed in `USER_MANAGEMENT_ROLES` (must include `superuser`)
- Protected API requests use bearer access token validation
- Expired/invalid access tokens should return `401` with stable token error code so clients can trigger refresh/re-auth flows.
- Notifications endpoints must enforce recipient ownership for read/ack/clear operations.
- Notification producer endpoints must be protected by privileged role policy.

Stable auth/token error code set (minimum):
- `TOKEN_EXPIRED`
- `TOKEN_INVALID`
- `TOKEN_REVOKED`
- `AUTH_REQUIRED`
- `INSUFFICIENT_ROLE`

## 9) Audit Logging Rules
Audit events required for:
- login success/failure
- token refresh success/failure
- logout
- registration
- privileged user edits
- role create/update/delete
- role assignment changes
- group create/update/delete
- superuser group overrides
- notification create/read/ack/clear/fallback-email events

## 10) API Acceptance Criteria
- All required UI flows can be completed through documented endpoints
- Error responses are stable and predictable
- Privileged operations are role-protected and audited
- Authenticated users can create/manage their own groups
- Superuser can view/manage all groups and role definitions
- Configured user-management roles can manage users
- Notifications can be created and retrieved with clear/ack/task-gate semantics
- Connected users receive notification events in near real-time via websocket
- Eligible offline users receive fallback email after configured disconnect threshold
