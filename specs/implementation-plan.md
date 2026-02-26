# Implementation Plan (MVP)

## 1) Purpose
Translate specifications into a phased implementation plan for a reusable template release.

Local development environment patterns are defined in `development.md`.

## 2) Proposed Baseline Stack (Draft)
- Frontend: React + TypeScript
- Styling/UI: Tailwind CSS + shadcn-ui (shadcn-first; custom reusable components when needed)
- Backend API: FastAPI (Python)
- Database: MongoDB preferred default via pluggable persistence adapter
- Auth: JWT access tokens + rotating refresh tokens (bearer-header default transport)

Testing tooling defaults:
- Backend: `pytest` + FastAPI `TestClient`/`httpx` for endpoint-level test coverage
- Frontend: Playwright as preferred default; alternatives require explicit project decision

Note: persistence technology is configurable; domain and service layers must remain stable across database adapters.

## 3) Milestones

### Milestone 1 — Foundation & Configuration
Deliverables:
- Project structure and environment configuration loader
- Config validation with fail-fast behavior
- Database provider selection and adapter wiring (`mongodb` default)
- Health endpoint and baseline error envelope
- Docker Compose definitions:
  - `docker-compose.yml` (complete system)
  - `docker-compose.backend.yml` (backend dependencies for local dev)
  - `docker-compose.dev.yml` (development full-container variant)
- Conda-based local Python environment setup documentation

Exit criteria:
- App boots with validated config
- Misconfiguration produces actionable startup errors

### Milestone 2 — Authentication Core
Deliverables:
- Local auth provider (register/login/logout)
- Email verification flow for local registration (pending user until verified)
- Configurable email delivery for registration workflows:
  - local SMTP relay mode (no SMTP auth)
  - external SMTP mode (authenticated)
- Frontend verification landing route (`/verify-email`) for token validation success/failure UX
- Provider abstraction and provider metadata endpoint
- Session storage and middleware
- Detailed endpoint tests for auth flows and error cases

Exit criteria:
- User can register, receive verification email link, verify email, and then login/logout via local auth
- Protected endpoint auth works with 401/403 behavior
- Endpoint tests cover success, validation failures, auth failures, and token lifecycle behavior

### Milestone 3 — External Provider Integration (UVA NetBadge)
Deliverables:
- Redirect/callback provider adapter
- Identity normalization and account linking
- Login UI provider selection integration

Scaffold status (2026-02-26):
- Backend routing scaffolding is implemented for `GET /auth/{provider}/start` and `GET /auth/{provider}/callback`.
- Provider adapter scaffolding exists for `uva-netbadge`, with explicit placeholder responses (`501 PROVIDER_NOT_IMPLEMENTED`).
- Provider enable/disable behavior is scaffolded and test-covered.
- NetBadge protocol implementation, identity normalization/linking logic, and frontend login-selection integration are intentionally deferred.

Exit criteria:
- Auth works with enabled external provider in configured environment
- Provider enable/disable works without code changes

### Milestone 4 — User/Profile and Groups
Deliverables:
- Profile read/update endpoints and UI
- Group CRUD for owner scope
- Group pages under user routes
- Reusable frontend component primitives for forms, tables, and dialogs

Exit criteria:
- Authenticated user can create/manage owned groups end-to-end

### Milestone 5 — Admin Users, Roles, and Global Group Management
Deliverables:
- Admin user list/edit endpoints and pages
- Role CRUD (including optional role description) + user role assignment
- Admin all-groups list/edit/delete
- Endpoint authorization tests for role-protected operations

Exit criteria:
- Superuser can manage users
- Configured user-management roles can manage users when enabled by configuration
- Superuser can manage roles and all groups
- `superuser` role is protected and cannot be deleted
- Non-privileged access is denied for privileged operations
- Role/permission endpoint tests verify allowed and denied paths

### Milestone 6 — Audit, Hardening, and Template Packaging
Deliverables:
- Audit events for auth/admin/group operations
- Rate limiting, CSRF protections, and secure cookie defaults
- Seed scripts for required default role (`superuser`)
- Developer onboarding docs and template usage instructions
- UI component usage guidance (shadcn-first, reusable custom component pattern)
- Frontend browser automation baseline for critical user journeys

Exit criteria:
- Required audit trails available
- Security controls verified in integration testing
- Template is reusable with environment-only customization
- Frontend browser tests pass for critical flows (login, token refresh handling, profile navigation)

## 4) Recommended Build Order by Component
1. Config + infrastructure
2. Data model + adapter interfaces
3. MongoDB adapter implementation (default)
4. Auth/session middleware
5. User/profile APIs and UI
6. Group APIs and UI
7. Admin APIs and UI
8. Audit/observability

## 5) Testing Strategy (MVP)
Detailed testing standards are defined in `testing.md`.
CI/CD quality gates and branch protection requirements are defined in `ci-cd.md`.

- API endpoint tests (required, detailed):
  - framework: `pytest` with FastAPI `TestClient`/`httpx`
  - auth endpoints: login/logout/register/refresh/me (success + failure + edge cases)
  - user/group endpoints: owner-allowed vs non-owner-denied behaviors
  - admin/superuser endpoints: permission matrix validation (`401`/`403` + allowed paths)
  - token lifecycle: expiration handling, refresh rotation, revoked/invalid token behavior
  - validation and error envelope checks for malformed payloads and domain conflicts
- Service/unit tests:
  - auth provider adapters
  - authorization guards/policy checks
  - role assignment and group ownership checks
- Frontend tests (required):
  - framework: Playwright (preferred default); alternatives require explicit project decision
  - browser-flow tests for login/logout, protected-route redirects, token refresh/re-auth behavior
  - UI navigation tests for header dropdown states (logged out vs authenticated) and role-based menu visibility

## 6) Open Decisions
- Exact UVA NetBadge protocol details and local dev mocking strategy
- Final password and lockout policy thresholds
- Whether group membership management beyond ownership is in MVP or phase 2
- Whether role-permission granularity beyond role names is in MVP or phase 2
- Timing and priority for non-Mongo database adapter implementation
