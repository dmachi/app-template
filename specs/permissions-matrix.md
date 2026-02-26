# Permissions Matrix (v1 Draft)

## 1) Roles
Default system roles (must always exist):
- `superuser`

Common user role:
- `user` (standard authenticated role; may be represented explicitly or as default non-privileged access)

Additional roles may be defined by superusers and assigned to users.
Some additional roles may be configured as user-management roles.

## 2) Scope Definitions
- **Own Group**: requester is `owner_user_id` for the target group
- **Any Group**: any group in the system
- **Protected Endpoint**: endpoint requiring authentication

## 3) Capability Matrix

| Capability | Unauthenticated | User | Configured User-Management Role | Superuser |
|---|---:|---:|---:|---:|
| Login/Logout | ✅ | ✅ | ✅ | ✅ |
| Register (if enabled) | ✅ | ➖ | ➖ | ➖ |
| View/Update own profile | ❌ | ✅ | ✅ | ✅ |
| View own groups | ❌ | ✅ | ✅ | ✅ |
| Create group | ❌ | ✅ | ✅ | ✅ |
| Edit/Delete own group | ❌ | ✅ | ✅ | ✅ |
| List users | ❌ | ❌ | ✅ | ✅ |
| Edit user status/profile (user-management scope) | ❌ | ❌ | ✅ | ✅ |
| Assign roles to users | ❌ | ❌ | ❌ | ✅ |
| Create/Edit/Delete roles | ❌ | ❌ | ❌ | ✅ |
| View all groups | ❌ | ❌ | ❌ | ✅ |
| Edit/Delete any group | ❌ | ❌ | ❌ | ✅ |

Legend: ✅ allowed, ❌ not allowed, ➖ not applicable in typical session state.

## 4) Enforcement Rules
- Every protected request resolves authenticated user and assigned roles before route handler logic
- Privileged capability checks are server-side and not dependent on frontend route guards
- Group owner checks compare requester id with `groups.owner_user_id`
- For endpoints where elevated-role and owner are both valid, authorization passes if either condition is true

## 5) Audited Authorization Events
Must record at minimum:
- denied access for privileged-only endpoints
- successful role assignment changes
- superuser group overrides on non-owned groups

## 6) Matrix Acceptance Criteria
- Matrix has a one-to-one mapping with route protection in `ui.md` and endpoint protection in `api.md`
- No privileged-only action is available to non-privileged users
- Group owner actions are correctly scoped to owned groups
