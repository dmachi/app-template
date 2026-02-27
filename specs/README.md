# Basic System Template — Specifications

_Last updated: 2026-02-27_

## Purpose
This `specs/` package defines the baseline requirements for a reusable software system template that includes:
- A web interface (frontend)
- A backend API
- FastAPI backend implementation
- React + TypeScript frontend with Tailwind CSS
- shadcn-ui-first component usage with reusable custom component patterns
- Configurable multi-authentication support (e.g., local auth, UVA NetBadge)
- Database abstraction that is non-committal to a single technology
- MongoDB as the preferred default database adapter
- Core end-user flows (login/logout, registration, profile/settings)
- Administrative user management (list/edit users)
- Administrative role management and role assignment to users
- Group management where users create/manage their own groups and superusers can view/manage all groups
- In-app notifications with realtime websocket delivery (offline fallback email is post-MVP)

## Document Map
- `overview.md` — Product goals, architecture, scope, and assumptions
- `authentication.md` — Authentication and session requirements (multi-provider)
- `configuration.md` — Configuration model and environment settings
- `api.md` — Backend API contract (v1 baseline)
- `ui.md` — UI routes, pages, behavior, and acceptance criteria
- `admin.md` — Admin authorization, role/user/group administration, and audit requirements
- `data-model.md` — Database-agnostic persistence model with MongoDB-first mapping and adapter contracts
- `notifications.md` — In-app notifications, websocket/Redis delivery architecture, and fallback email policy
- `permissions-matrix.md` — Role-to-capability matrix for endpoint and UI authorization
- `implementation-plan.md` — Milestones and delivery plan from specs to MVP
- `testing.md` — Detailed backend/API and Playwright frontend testing standards
- `ci-cd.md` — GitHub Actions CI/CD requirements, quality gates, and merge protections
- `development.md` — Local development patterns for Docker Compose and Conda workflow

## Project Status
These are draft baseline specs intended to be refined before implementation.

Milestone sequencing note:
- Milestone 7 is now dedicated to template extension architecture and downstream update safety.
- Audit/hardening/template packaging work is Milestone 8.

## Suggested Next Refinement Steps
1. Confirm non-Mongo database adapters needed for phase 1 vs phase 2
2. Confirm first-release auth providers to enable (`local`, `uva-netbadge`)
3. Decide additional custom roles beyond required `superuser`
4. Lock API response envelope and error format
5. Add sequence diagrams for auth flows
6. Finalize data retention window for sessions/audit events
