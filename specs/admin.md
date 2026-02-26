# Administration Specification

## 1) Administrative Capabilities (MVP)
- View user list
- Inspect individual user details
- Edit user status and approved profile fields
- Edit approved profile fields
- Manage role catalog (create/update/delete with policy rules)
- View and manage all groups across users

Default role semantics:
- `superuser` can perform all administrative operations
- Additional non-superuser roles may be granted user-management capabilities via configuration

## 2) Admin Authorization
- Access determined by role policies for `superuser` and configured privileged roles
- Admin API and UI routes enforce authorization checks server-side
- Role management is restricted to `superuser` by default
- Group owners can manage their own groups; `superuser` retains global override for any group
- User-management access is controlled by configured role list (must include `superuser`)

## 3) User Data Model for Admin Editing
Editable fields (draft):
- `display_name`
- `status` (`active`, `disabled`, `pending`)
- `roles` (list of assigned role names/ids)
- Optional metadata fields as configured by implementation

Non-editable in MVP:
- Internal immutable IDs
- Provider subject IDs from external auth

## 4) User Listing Requirements
- Basic pagination and sort by creation date
- Search by username/email/display name
- Filter by status and role
- Show high-value columns: id, username, email, roles, status, created_at

## 5) Role Management Requirements
- Roles are created and managed by superusers by default policy
- Role object fields (draft): `id`, `name`, `description` (optional), `is_system`, `created_at`, `updated_at`
- System role `superuser` must always exist and be marked as non-deletable
- Role assignment to users is performed by superuser from user-edit flow and/or dedicated role assignment endpoint
- Role deletion behavior must prevent deletion when role is system-protected or still assigned (unless reassigned first)
- Admin UI should use a shared dialog component for role create/edit interactions
- Role description must be editable via the same dialog used for create/edit role operations

## 6) Group Management Requirements
- Any authenticated user can create a group and becomes the group owner
- Group owner can edit/delete owned groups
- Superuser can list, inspect, edit, and delete any group
- Group object fields (draft): `id`, `name`, `description`, `owner_user_id`, `created_at`, `updated_at`
- Privileged group list supports search/filter by group name and owner

## 7) Audit & Compliance Baseline
Admin actions must be audited with:
- actor admin id
- target object type/id (user, role, group)
- changed fields (before/after where feasible)
- timestamp and request correlation id

## 8) Error Handling
- Validation failures return field-level details where practical
- Concurrency conflicts (if optimistic locking used) return conflict response with retry guidance

## 9) Acceptance Criteria
- Non-privileged users cannot access privileged pages or endpoints
- Only superusers can create/edit/delete roles and perform protected role assignments by default policy
- Users can create/manage their own groups
- Superusers can view/manage all groups
- Configured user-management roles can manage users
- Admin updates persist correctly and appear in subsequent reads
- Privileged edits generate audit events
