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
  "roles": ["superuser"],
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

## 6) Authorization Rules
- Unauthenticated request to protected endpoint: `401`
- Authenticated but insufficient role: `403`
- Privileged endpoints require configured privileged roles according to endpoint policy
- Group endpoints require authentication
- Group owner can manage owned groups; superuser can manage all groups
- Role CRUD is superuser-only by default
- User management endpoints are available to roles listed in `USER_MANAGEMENT_ROLES` (must include `superuser`)
- Protected API requests use bearer access token validation
- Expired/invalid access tokens should return `401` with stable token error code so clients can trigger refresh/re-auth flows.

Stable auth/token error code set (minimum):
- `TOKEN_EXPIRED`
- `TOKEN_INVALID`
- `TOKEN_REVOKED`
- `AUTH_REQUIRED`
- `INSUFFICIENT_ROLE`

## 7) Audit Logging Rules
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

## 8) API Acceptance Criteria
- All required UI flows can be completed through documented endpoints
- Error responses are stable and predictable
- Privileged operations are role-protected and audited
- Authenticated users can create/manage their own groups
- Superuser can view/manage all groups and role definitions
- Configured user-management roles can manage users
