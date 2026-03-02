# Permissions Matrix (v1 Draft)

## 1) Roles
Default system roles (must always exist):
- `Superuser`
- `AdminUsers`
- `AdminGroups`
- `GroupManager`
- `InviteUsers`
- `ContentEditor`

Baseline authenticated users may have no explicit elevated role.

## 2) Scope Definitions
- **Own Group**: requester is `owner_user_id` for the target group
- **Any Group**: any group in the system
- **Protected Endpoint**: endpoint requiring authentication

## 2.1 Capability Groups
- **Profile scope**: self-service operations for currently authenticated user
- **Admin-user scope**: user listing/editing operations guarded by `AdminUsers`/`Superuser`
- **Admin-group scope**: global group operations guarded by `AdminGroups`/`Superuser`
- **Invite scope**: invitation operations guarded by `InviteUsers`/`Superuser`
- **Notification producer scope**: app/admin/system actor APIs that create notifications for recipients
- **Notification recipient scope**: read/ack/clear/check operations for own notifications only
- **CMS scope**: content type administration, content authoring/publishing, and media upload/management

## 3) Capability Matrix

| Capability | Unauth | Auth User | GroupManager | InviteUsers | ContentEditor | AdminUsers | AdminGroups | Superuser |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Login/Logout | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Register (if enabled) | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |
| View/Update own profile | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View own notifications | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Read/Ack/Clear own notifications | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Check completion for own task-gated notification | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Receive realtime websocket notification events | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View own/member groups | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create group | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Edit/Delete own group | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| View all groups | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Edit/Delete any group | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Assign roles to groups | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| List users | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Edit user status/profile | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Assign roles to users | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Create/Edit role definitions | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Delete non-core role definitions | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Send/manage invitations | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| List/read public content | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| List/read authenticated content | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View admin content list | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Create content | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Edit own content | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Edit any content | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Publish/unpublish content | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Delete/archive content | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Upload media/images | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Manage media metadata/delete | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Manage content types | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Create notifications for other users | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅* |
| List all notifications (admin scope) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Resend/cancel/delete any notification | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

Legend: ✅ allowed, ❌ not allowed, ➖ not applicable in typical session state.

`*` Direct notification creation is limited to superuser/testing/internal workflows; normal user/admin role actions produce notifications indirectly via business events.

## 4) Enforcement Rules
- Every protected request resolves authenticated user and assigned roles before route handler logic
- Privileged capability checks are server-side and not dependent on frontend route guards
- Group owner checks compare requester id with `groups.owner_user_id`
- For endpoints where elevated-role and owner are both valid, authorization passes if either condition is true
- Notification recipient endpoints must enforce `notification.user_id == requester.id`
- Notification producer endpoints must enforce privileged producer role policy and be audited
- CMS write operations must enforce capability checks (`content.*`, `media.*`, `contentType.manage`) server-side
- Public content reads must still enforce `published` status and visibility policy

## 5) Audited Authorization Events
Must record at minimum:
- denied access for privileged-only endpoints
- successful role assignment changes
- superuser group overrides on non-owned groups
- notification create events (including actor and recipient scope)
- notification clear-denied events for unmet ack/task-gate preconditions

## 6) Matrix Acceptance Criteria
- Matrix has a one-to-one mapping with route protection in `ui.md` and endpoint protection in `api.md`
- No privileged-only action is available to non-privileged users
- Group owner actions are correctly scoped to owned groups
- Notification recipient actions are correctly scoped to own notifications only
