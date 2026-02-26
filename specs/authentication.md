# Authentication Specification

## 1) Objectives
- Support multiple authentication providers in one deployment
- Allow provider enable/disable through configuration
- Present a consistent user session model to the rest of the app

## 2) Supported Provider Types (Initial)
1. `local`
   - Username/email + password managed internally
2. `uva-netbadge`
   - External institutional auth flow via UVA NetBadge
3. `future:*`
   - Reserved for additional providers (OIDC/SAML/LDAP/etc.)

## 3) Provider Abstraction Contract
Each provider must implement:
- `id`: stable provider key (e.g., `local`, `uva-netbadge`)
- `displayName`: UI label
- `enabled`: runtime state
- `initiateAuth(requestContext)` (for redirect-based flows)
- `handleCallback(requestContext)` (for external providers)
- `authenticate(credentials)` (for direct credential providers)
- `normalizeIdentity(rawClaims)` => `{ providerSubject, email, emailVerified?, username?, displayName? }`

## 4) Identity Linking Rules
- A successful provider authentication resolves to one user account by:
  1. Existing `AuthIdentity(provider, providerSubject)` link, else
  2. Case-insensitive match on canonicalized email (`trim + lowercase`), else
  3. Create new user (if registration policy allows), else deny with actionable error
- One provider subject may map to one user only
- Email is required for all users (local and external-provider users)
- Authentication should fail with actionable error if provider does not supply an email claim
- Preserve original email value for display/audit; use canonicalized email for matching and uniqueness checks

## 5) Session Model
- JWT-based session model is the default MVP model
- Token model:
  - Short-lived access token (JWT) for API authorization
  - Long-lived refresh token with rotation and server-side revocation tracking
- Access token transport:
  - Default: `Authorization: Bearer <access_token>` header (cross-domain friendly)
  - Cookie-based transport is optional and deployment-specific
- Refresh token transport:
  - `bearer-header` mode: refresh token sent in request body to `/auth/refresh`
  - `cookie` mode: refresh token is HttpOnly cookie and `/auth/refresh` uses cookie context
- Session/token lifetime:
  - Access token TTL: configurable (default 15 minutes)
  - Refresh token TTL: configurable (default 7 days)
- Client token storage guidance:
  - Access token should be held in memory and rotated frequently
  - Refresh token storage depends on transport mode (`cookie` preferred where feasible)
  - Avoid persistent browser storage for long-lived tokens unless explicitly required by deployment constraints
- Client refresh behavior:
  - UI should refresh tokens during active user sessions (proactive refresh before access token expiry)
  - UI should also handle `401`/token-expired responses by attempting one refresh/retry flow
  - If refresh fails (expired/revoked/invalid refresh token), UI must clear auth state and log out user
- Logout invalidates refresh token and prevents future token refresh
- Optional “logout all devices” endpoint in later phase

## 6) Local Auth Requirements
- Passwords stored using modern one-way hashing (`argon2id` preferred)
- Registration requires unique username and unique email (case-insensitive)
- Password policy is configurable (minimum length default: 12)
- Brute-force protections:
  - Per-IP and per-identifier throttling
  - Progressive delays or temporary lockouts

## 7) UVA NetBadge Requirements (Draft)
- NetBadge integration should be treated as external SAML 2.0 IdP flow
- Provider flow is redirect/callback based
- Callback must validate trusted source and expected request state
- Service Provider (SP) metadata exchange/registration with UVA IdP is required before production use
- IdP metadata URL should be configurable (default from UVA documentation)
- Returned identity attributes map into normalized user profile fields via configurable claim/attribute mapping
- NetBadge email attribute must be canonicalized (`trim + lowercase`) before identity linking
- Authentication should fail when required attributes for identity normalization are missing
- Attribute usage/storage must follow organizational policy; persist only fields required for account identity and authorization

## 8) UI Behavior Requirements
- Login page must show available auth methods from backend configuration
- If exactly one provider is enabled and is redirect-based, app may auto-initiate flow
- Auth errors return user-safe messages, internal details logged server-side
- Authenticated UI client must monitor token expiry and perform refresh while user activity occurs
- On unrecoverable token state (refresh fails or token revoked), UI must force logout and redirect to login

## 9) Security Requirements
- HTTPS only in deployed environments
- JWT signing key/secret must be strong and rotated per policy
- Secure, HttpOnly cookies required only when refresh/access tokens are cookie-transported
- CSRF defenses required when cookies are used for authenticated state
- Refresh token rotation and replay detection required
- Auth-related events written to audit log

## 10) Auth Acceptance Criteria
- Enabling/disabling a provider via config changes login options without code changes
- Users can authenticate through each enabled provider
- Unauthorized users cannot call protected endpoints
- Privileged endpoints reject users without required role policy with 403
