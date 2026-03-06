# LLM Agent Template Description

## Purpose
This codebase was generated from an **updateable system template** for new applications. It provides a working baseline for:
- authentication and authorization
- admin UX (users, groups, roles, invites)
- CMS/content + media management
- notifications and profile settings
- backend API + frontend app shell + tests + Docker/dev workflows

When extending this app, prefer adding new code in extension points and feature folders rather than modifying template core behavior.

---

## What the template already provides

### Backend (FastAPI)
- Auth flows (login, refresh, user context, role-aware capabilities)
- Role/group/invitation management
- CMS APIs for content, content types, media
- Notification plumbing and email hooks
- Config/env loading and app bootstrapping

Primary areas:
- `backend/app/main.py`
- `backend/app/api/routes/`
- `backend/app/auth/`
- `backend/app/cms/`
- `backend/app/notifications/`
- `backend/app/core/config.py`

### Frontend (React + TypeScript + Vite)
- App shell + route rendering context
- Auth bootstrap/session handling
- Settings/admin pages and role-based visibility
- CMS authoring and public rendering routes
- Shared components and UI primitives

Primary areas:
- `frontend/src/router.tsx`
- `frontend/src/app/`
- `frontend/src/layouts/`
- `frontend/src/settings/`
- `frontend/src/pages/`
- `frontend/src/lib/api.ts`

### Test + local dev support
- Backend pytest suite
- Frontend Playwright e2e tests
- Docker compose and local dev scripts

---

## Preferred extension model for new apps

### 1) Add app features in app-specific folders
Create new domain folders (frontend + backend) and keep logic there.
- Good: new routes/pages/services under focused feature directories.
- Avoid: spreading app-specific behavior into template-wide auth/core utilities.

### 2) Wire new features through stable integration points
Use minimal touchpoints to register features.

Frontend common touchpoints:
- `frontend/src/router.tsx` (add route declarations)
- `frontend/src/config/settings-navigation-menu.ts` (add nav entries)
- `frontend/src/settings/admin/admin-routes.tsx` (register new admin routes)
- `frontend/src/lib/api.ts` (add API client functions)

Backend common touchpoints:
- `backend/app/api/router.py` or route registration files (include new route modules)
- `backend/app/api/routes/` (new route modules for new app domains)
- `backend/app/core/config.py` (only if new env settings are truly needed)

### 3) Keep changes additive, not invasive
- Prefer composing existing components/hooks over rewriting them.
- Prefer adding new route handlers over altering shared auth semantics.
- Prefer opt-in feature flags/config for divergent behavior.

### 4) Extend auth scopes through extension hooks (not core rewrites)
When downstream apps need additional OAuth/PAT scopes, add them through the auth scope extension point.

Where to define new scopes:
- `backend/app/extensions/auth/auth_scopes.py`
- Export `AUTH_SCOPE_DEFINITIONS` (mapping) and/or `extend_auth_scopes(existing_scopes)`.
- Scope registration is additive-only; do not override built-in scope names.

Expected scope definition shape:
- `name`: scope string (mapping key)
- `description`: human-readable meaning (used in token creation/consent UX)
- `userinfo_claims` (optional): tuple/list of claims this scope unlocks in userinfo responses

Route-level enforcement (preferred / automated guard path):
- Use `require_auth_scopes({...})` from `backend/app/auth/dependencies.py` in route dependencies.
- Use `require_any_auth_scope({...})` when any one of several scopes is acceptable.
- Keep role checks (`require_*_role`) separate; role requirements and scope requirements are complementary.

Manual checks outside route guards (service/helper code):
- Use `get_authenticated_token_scopes(request)` to read scopes associated with the active scoped token.
- Use `get_scoped_auth_context(request)` when you need token metadata and only want context for scoped auth tokens.
- For ad-hoc checks, explicitly test set inclusion/intersection and raise `ApiError(status_code=403, code="INSUFFICIENT_SCOPE", ...)` when required scopes are missing.

Implementation notes:
- Unscoped internal JWT sessions are treated as trusted internal auth and should not be broken by scope-only checks.
- Scoped tokens (OAuth access tokens / personal access tokens) must satisfy declared scope checks.
- Add tests for both success and insufficient-scope denial on any new protected endpoint.

### 5) Extend external linked-account OAuth providers via extension config
When downstream apps need external integrations (for example GitHub/ORCID tokens for API calls), configure them through the linked-account provider extension point.

Where to define/enable providers:
- `backend/app/extensions/auth/external_oauth_providers.py`
- `EXTERNAL_OAUTH_PROVIDER_DEFINITIONS`: optional additive provider library entries.
- `ENABLED_EXTERNAL_OAUTH_PROVIDER_CONFIGS`: app-level enabled providers and credentials.

Provider enablement shape (`ENABLED_EXTERNAL_OAUTH_PROVIDER_CONFIGS[provider]`):
- `client_id`: OAuth client ID for that provider.
- `client_secret`: OAuth client secret for that provider.
- `required_scopes`: minimum scopes the app always requests (must be explicit).
- `optional_scopes` (optional): additional allowed scopes users may opt into.
- `redirect_uri` (optional but recommended): callback URI for link completion.
- `extra` (optional): provider-specific config values.

Behavior and policies:
- Keep provider registration additive; do not override built-in provider names.
- Keep providers disabled by default in template baseline unless app-specific testing/usage requires enabling.
- Linked external accounts are for downstream integration credentials, not primary app authentication.
- Enforce conflict policy: one external subject should not be linked to multiple local users.

Downstream helper methods (service-side use):
- `has_linked_external_account(auth_store, user_id, provider)`
- `get_linked_external_account_scopes(auth_store, user_id, provider)`
- `get_linked_external_access_token(auth_store=..., settings=..., user_id=..., provider=..., required_scopes=...)`

Security expectations:
- Never return decrypted external provider tokens to frontend clients.
- Store provider tokens encrypted at rest (see external-account encryption settings/helpers).
- Require server-side scope checks before using provider tokens for downstream API calls.
- Add tests for provider-enabled metadata exposure, link conflict handling, and insufficient external scope denial.

---

## Files that are commonly modified for a new app
These are expected to change frequently:
- `frontend/src/router.tsx`
- `frontend/src/config/settings-navigation-menu.ts`
- `frontend/src/settings/admin/admin-routes.tsx`
- `frontend/src/lib/api.ts`
- `backend/app/api/routes/<new_feature>.py`
- `backend/tests/test_<new_feature>.py`
- `frontend/tests/e2e/<new_feature>.spec.ts`

These are often touched lightly for integration, but should remain stable in design:
- `backend/app/api/router.py`
- `backend/app/main.py`

---

## Areas to avoid modifying unless absolutely necessary
Minimize edits to these template core zones to preserve upstream mergeability:

### Authentication/security core
- `backend/app/auth/security.py`
- `backend/app/auth/middleware.py`
- `backend/app/auth/dependencies.py`
- token and role evaluation internals unless requirement truly demands it

### Global app boot/config semantics
- `backend/app/core/config.py` structure
- startup wiring in `backend/app/main.py`
- shared environment variable contract unless introducing a clearly scoped new setting

### Frontend bootstrap/session internals
- global auth bootstrap flow in `frontend/src/app/hooks/`
- route context and layout shell internals unless adding a capability impossible via existing extension points

### Shared UI primitives
- base components in `frontend/src/components/ui/`
- theme primitives/tokens

If one of these must be changed, isolate and document the rationale in the PR/commit notes.

---

## Decision policy for LLM agents
When implementing a new app feature, follow this order:
1. **Try additive feature files first** (new route/page/service/module).
2. **Use integration touchpoints** (router/menu/api registration files).
3. **Only then modify core template internals** if there is no viable extension path.
4. **If core is changed, keep patch minimal** and maintain backward-compatible behavior where possible.

---

## Practical “Do / Avoid” checklist

### Do
- Add new routes instead of altering unrelated routes.
- Add new API clients/functions in dedicated sections.
- Keep app-specific logic in app-specific modules.
- Add/adjust tests for new behavior.
- Preserve existing naming/structure conventions.

### Avoid
- Renaming/moving template core files without strong reason.
- Rewriting auth/session lifecycle for feature-specific needs.
- Embedding app-specific assumptions into shared base components.
- Large refactors in unrelated areas while delivering a focused feature.

---

## Goal of this guidance
Use the template as a stable platform. New app work should primarily be **additions and registrations**, not deep rewrites. This keeps the project easy to maintain and makes pulling future updates from the template repository significantly easier.