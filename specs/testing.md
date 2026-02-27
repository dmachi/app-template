# Testing Specification (MVP)

## 1) Purpose
Define required automated testing standards for backend API quality and frontend browser behavior in this template.

## 2) Testing Principles
- Tests must validate behavior, authorization, and error handling from the specification documents
- API endpoint coverage is required before merge for security-sensitive and role-protected routes
- Frontend browser tests are required for critical user journeys
- Test suites should be deterministic, isolated, and runnable in CI

## 3) Tooling Standards

### Backend (required)
- Framework: `pytest`
- API testing: FastAPI `TestClient` and/or `httpx`
- Mocking/fixtures: pytest fixtures and dependency overrides

### Frontend (required)
- Preferred framework: Playwright
- Playwright is the default browser automation standard for this project
- Alternative frameworks are not preferred and require explicit team decision to adopt

## 4) Backend Test Requirements

### 4.1 API Endpoint Tests (required)
Must include detailed tests for:
- Authentication endpoints (`/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `/auth/me`)
- Role-protected endpoints (`/admin/*`) for both allowed and denied cases
- Group ownership endpoints (`/groups/*`) for owner and non-owner behavior
- Notification endpoints (`/notifications/*`) for create/list/read/ack/clear/check-completion
- Validation and error-envelope behavior (malformed payloads, conflicts, missing fields)
- Token lifecycle behavior (expired access token, refresh rotation, revoked/invalid refresh)
- Websocket event endpoint behavior for connected recipients
- Fallback email timing/eligibility behavior for disconnected recipients
- Active-event dedupe/merge behavior (no duplicate active notifications)
- Notification open endpoint redirect/read/ack-clear behavior

### 4.2 Authorization Matrix Validation (required)
- Endpoint tests must align with `permissions-matrix.md`
- Must verify `401` for unauthenticated and `403` for insufficient privileges
- Must verify configured user-management role behavior and `superuser` behavior matches policy expectations

### 4.3 Unit/Service Tests (required)
- Authorization policy/guard logic
- Identity linking logic and canonical email handling
- Role assignment and group ownership policy checks
- Repository/service behavior for token revocation and audit events
- Notification completion-check allow-list and state transition rules
- Redis event fanout publisher/subscriber behavior
- Completion-check decaying scheduler behavior up to max interval (1 day)
- Email redelivery retry behavior (max attempts, day-based exponential backoff, once-per-day cap)

## 5) Frontend Test Requirements (Playwright)

### 5.1 Required Browser Flows
- Login/logout flow
- Protected-route redirect flow
- Token refresh flow during active session
- Forced logout flow when refresh fails/refresh token is invalid or expired
- Header/menu behavior by auth state:
  - Unauthenticated: Login button visible
  - Authenticated: user icon dropdown visible
  - Role-based menu visibility for admin/superuser links
- Notification flows:
  - receive realtime notification while connected
  - acknowledge/clear behavior in UI for acknowledge-required notifications
  - task-gated notification clear blocked until completion condition is met
  - active notification remains visible even when email redelivery budget is exhausted
  - superuser notifications admin flow (list/filter/resend/cancel/delete)

### 5.2 Cross-Browser Baseline
- Chromium is required for MVP CI
- Firefox/WebKit coverage is recommended for phase 2 unless project policy requires earlier

### 5.3 Playwright Implementation Guidance
- Use stable selectors via `data-testid` for critical controls
- Keep tests independent and avoid state coupling between scenarios
- Prefer API/setup fixtures for deterministic auth/session setup where appropriate

## 6) Coverage and Quality Gates
- Backend API endpoint test coverage should include all implemented route handlers before MVP release
- Any new endpoint must include tests for success path and at least one failure/authorization path
- Critical Playwright flows must pass in CI before merge to protected branches
- Security-sensitive auth changes require regression test updates
- Notification delivery changes require regression tests for websocket + fallback-email behavior
- Notification producer endpoint tests must verify only internal/superuser testing pathways are allowed
- Superuser notification admin endpoints must verify `403` for non-superuser and success for superuser

## 7) CI/CD Expectations
- Run backend tests on every pull request
- Run Playwright critical-flow suite on every pull request
- Run extended browser suite on main branch or nightly pipeline
- Block merges when required suites fail

## 8) Test Data and Environments
- Use isolated test databases/collections for backend tests
- Use deterministic fixtures for users, required `superuser` role, optional configured user-management role(s), and groups
- Do not depend on external identity provider availability in core CI; mock/stub provider integration points

## 9) Acceptance Criteria
- Backend endpoint behavior is covered with detailed automated tests
- Playwright covers critical authenticated and authorization-sensitive browser flows
- CI enforces required backend + Playwright suites
- Test artifacts and failure reports are sufficient for debugging regressions
