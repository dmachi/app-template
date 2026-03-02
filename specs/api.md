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
  "displayName": "New User",
  "profileProperties": {
    "orcid": "0000-0002-1825-0097"
  }
}
```

Behavior notes:
- `profileProperties` only accepts enabled profile property keys.
- Properties configured as required (via `!property` in `PROFILE_PROPERTIES`) must be present and valid at registration.

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
  "preferences": {},
  "profileProperties": {
    "orcid": "0000-0002-1825-0097",
    "googleScholarUrl": "https://scholar.google.com/citations?user=abc123",
    "externalLinks": [
      { "label": "Lab Website", "url": "https://example.org/lab" }
    ]
  },
  "profilePropertyCatalog": [
    {
      "key": "orcid",
      "label": "ORCID",
      "description": "ORCID researcher identifier in 0000-0000-0000-0000 format.",
      "valueType": "text",
      "required": false,
      "placeholder": "0000-0000-0000-0000"
    },
    {
      "key": "googleScholarUrl",
      "label": "Google Scholar URL",
      "description": "Link to your Google Scholar profile.",
      "valueType": "url",
      "required": false,
      "allowedHosts": ["scholar.google.com"]
    },
    {
      "key": "externalLinks",
      "label": "Additional Links",
      "description": "Arbitrary external links.",
      "valueType": "links",
      "required": false,
      "maxItems": 10
    }
  ]
}
```

### `PATCH /users/me`
Updates editable self profile/settings fields.

Request:
```json
{
  "displayName": "Updated Name",
  "preferences": {},
  "profileProperties": {
    "orcid": "0000-0002-1825-0097",
    "googleScholarUrl": "https://scholar.google.com/citations?user=abc123",
    "externalLinks": [
      { "label": "Lab Website", "url": "https://example.org/lab" }
    ]
  }
}
```

Behavior notes:
- `profilePropertyCatalog` is filtered by server-side app configuration.
- `profileProperties` only accepts enabled built-in keys.
- `profilePropertyCatalog[].required=true` indicates fields that must be collected on registration.
- URL-type properties validate protocol (`http`/`https`) and, when configured, host constraints.
- `externalLinks` validates an array of `{ label, url }` objects.

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

## 11) CMS Endpoints

CMS details are defined in `cms.md`; this section defines required API surface.

### `GET /content/types`
Returns active content type catalog and field definitions usable by editor UI.

### `POST /admin/content/types`
Creates a content type.

Authorization: `superuser` only.

Request example:
```json
{
  "key": "article",
  "label": "Article",
  "fieldDefinitions": [
    { "key": "tagline", "label": "Tagline", "type": "text", "required": false },
    { "key": "summary", "label": "Summary", "type": "textarea", "required": false }
  ]
}
```

### `PATCH /admin/content/types/:key`
Updates content type metadata and field definitions.

Authorization: `superuser` only.

### `GET /content`
Lists content visible to requester according to visibility + role policy.

Query params (draft):
- `type`, `status`, `q`, `page`, `pageSize`

### `POST /content`
Creates content item.

Authorization: authenticated user with `content.create` capability.

Behavior:
- New content defaults to `status=draft` when status is not explicitly provided.

Request example:
```json
{
  "contentTypeKey": "page",
  "name": "About",
  "content": "# About\nThis is markdown.",
  "aliasPath": "/about",
  "fields": {
    "summary": "About this site",
    "layoutKey": "default"
  },
  "visibility": "public",
  "allowedRoles": []
}
```

### `GET /content/:id`
Returns content item if requester has read access.

### `PATCH /content/:id`
Updates content item (name/content/custom fields/visibility/layout/links).

Authorization:
- `content.edit.any`, or
- `content.edit.own` when requester is creator

### `POST /content/:id/publish`
Sets content status to `published`.

Authorization: `content.publish`.

### `POST /content/:id/unpublish`
Sets content status from `published` to `draft`.

Authorization: `content.publish`.

### `DELETE /content/:id`
Deletes or archives content per deployment policy.

Authorization: `content.delete`.

### `GET /content/public/:aliasPath`
Public read endpoint for published content with `visibility=public` using alias path.

### `GET /cms/:contentId`
Public content endpoint by id.

Behavior:
- Returns content only when item is `published` and visibility permits public access.
- If requester is `ContentEditor` or `superuser`, unpublished content may be returned for preview.
- If item has `aliasPath`, response includes canonical URL metadata for client-side URL normalization.
- Default response returns full content JSON dictionary for client rendering.
- Future (post-MVP): support optional response representations (e.g., pre-rendered HTML).

### `GET /cms/resolve`
Resolves arbitrary path/alias to published content.

Invocation rule:
- This endpoint is intended for final fallback resolution only, after explicit frontend/app routes do not match.
- This endpoint should not be used for `/cms/*` paths, which are handled by explicit CMS route handlers.
- Frontend should apply configured resolver blacklist patterns before calling this endpoint.

Query params:
- `path` (required; e.g., `/about`)

Response example:
```json
{
  "matched": true,
  "content": {
    "id": "content-123",
    "contentTypeKey": "page",
    "name": "About",
    "content": "# About\nThis is markdown.",
    "aliasPath": "/about",
    "status": "published"
  },
  "canonicalUrl": "/about",
  "visibility": "public"
}
```

Behavior:
- Returns `404` when no published content matches alias path, using standard error envelope `{ code, message, details? }`.
- Used when frontend supports pages mounted at arbitrary URLs.
- Default response returns full matched content JSON dictionary for client rendering.
- Future (post-MVP): support optional response representations (e.g., pre-rendered HTML).

No-match response example:
```json
{
  "code": "CONTENT_NOT_FOUND",
  "message": "No published content matches the requested path."
}
```

CMS error code guidance:
- Use `CONTENT_NOT_FOUND` for resolver/content-route not-found cases with `404` status and standard error envelope.

### `POST /media/images`
Uploads image file via multipart and stores file in GridFS.

Authorization: authenticated user with `media.upload`.

Validation scope (MVP):
- Only image MIME types are accepted.

Response example:
```json
{
  "id": "media-123",
  "url": "/api/v1/media/images/media-123",
  "filename": "hero.png",
  "contentType": "image/png"
}
```

### `GET /media/images`
Lists uploaded image assets for media picker/search.

Query params (draft):
- `q`, `tag`, `page`, `pageSize`

### `GET /media/images/:id`
Streams image bytes from GridFS with correct `Content-Type`.

### `PATCH /media/images/:id`
Updates image metadata (`altText`, `title`, `tags`).

Authorization: `media.manage` or uploader-owner policy.

### `DELETE /media/images/:id`
Deletes image asset according to retention policy.

Authorization: `media.manage`.
