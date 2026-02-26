# Overview Specification

## 1) Goal
Create a reusable boilerplate system for future software projects with:
- Web UI + backend API
- Pluggable authentication methods
- Foundational user account lifecycle
- Administrative user and role management
- User-created group management with superuser global visibility

## 2) In Scope (MVP)
- User-facing pages for:
  - Login
  - Logout
  - Registration
  - Profile/settings
- Admin pages for:
  - User listing
  - User editing
  - Role listing/editing and role assignment
  - Global group listing/editing
- User pages for:
  - Group listing/creation/editing for groups owned by the current user
- API endpoints for authentication, user account, admin user/role management, and group management
- Authentication abstraction supporting multiple providers enabled via configuration

## 3) Out of Scope (MVP)
- Billing/subscriptions
- Complex organization/tenant management
- Fine-grained policy engine beyond role-based checks
- External identity providers not configured in deployment

## 4) Target Users
- End users who need account access and profile management
- Administrators who manage users and account metadata
- Developers who clone this template for new projects

## 5) High-Level Architecture
- Frontend:
  - Renders web pages and calls backend API
  - Maintains client session state and route guards
  - Implemented with React + TypeScript + Tailwind CSS
  - Uses shadcn-ui components when available; custom components follow the same composable pattern
- Backend API:
  - Implemented with FastAPI (Python)
  - Exposes REST endpoints under `/api/v1`
  - Issues/validates sessions or tokens
  - Stores users, credentials (if local auth), and audit events through a database abstraction layer
- Persistence Layer:
  - Repository/adapter abstraction with no hard dependency on a single database technology
  - MongoDB is the preferred default implementation for MVP
- Auth Provider Layer:
  - Normalized adapter interface for local + external auth providers
  - Runtime configuration decides which providers are active

## 6) Core Domain Entities
- User
  - id, username, email, display_name, status, created_at, updated_at
- Role
  - id, name, description, is_system, created_at, updated_at
- UserRole
  - user_id, role_id, assigned_by, assigned_at
- Group
  - id, name, description, owner_user_id, visibility, created_at, updated_at
- AuthIdentity
  - user_id, provider, provider_subject, linked_at
- Session
  - token/session family id, user_id, issued_at, expires_at, revoked_at
- AuditEvent
  - actor_user_id, action, target_type, target_id, metadata, created_at

## 7) Roles
- Roles are managed by administrators
- Users can have one or more roles assigned by administrators
- System default role that must always exist:
  - `superuser`: unrestricted access; can perform all administrative and role-management operations
- Additional project-specific roles may be added by superusers per policy
- User-management permissions must be configurable so selected non-superuser roles can manage users when desired

## 8) Non-Functional Baseline
- Security: secure password handling for local auth, JWT signing/validation hardening, refresh token rotation, CSRF protection when cookie token transport is used, basic rate limiting
- Reliability: clear error responses and deterministic auth behavior
- Quality: detailed automated API endpoint tests required; frontend automated browser tests required for critical user journeys
- Observability: auth and admin actions logged with correlation id
- Portability: environment-driven config, minimal deployment assumptions
- Maintainability: reusable frontend components and database adapter interfaces to support downstream project evolution

## 9) MVP Acceptance Summary
System is acceptable when:
- At least two auth methods can be configured (e.g., local + UVA NetBadge)
- Required user and admin pages exist and work end-to-end
- Users can create and manage groups they own
- Superuser can view and manage all groups
- Superuser can manage role definitions and protected role assignments
- Configured user-management roles (if any) can manage users according to configuration policy
- API supports all documented core operations
- Access control prevents non-privileged access to privileged operations
