# UI Specification (Web)

## 0) Frontend Stack and Component Standards
- Frontend implementation uses React + TypeScript
- Styling uses Tailwind CSS
- Use shadcn-ui components when a matching component exists
- If no matching shadcn-ui component exists, create a reusable component following similar composition and styling patterns
- Prefer reusable shared components over page-specific one-off implementations when the same UI pattern appears in multiple flows
- Components should expose clear props and composition points so downstream/template-derived applications can adapt layouts and presentation
- Visual styling should remain basic/minimal by default
- Theme supports light and dark mode, following system preference by default

## 0.1) Default Application Layout
- Global shell uses a header + content area layout
- Header includes generic logo and generic application title on the left
- Header includes auth/user menu area on the right
	- Unauthenticated state: shows `Login` button
	- Authenticated state: shows user icon/avatar trigger with dropdown menu
	- Dropdown includes link to settings/profile
	- Dropdown includes contextual actions (e.g., Invite Users) only when user has appropriate privileges
- Application settings sidebar is the single navigation hub for both user settings and any admin-capability pages available to that user

## 1) Required Screens

### A) Login
- Displays available auth methods from backend metadata endpoint
- Supports local credential form when `local` provider enabled
- Supports redirect buttons for external providers (e.g., UVA NetBadge)
- Shows user-safe auth errors

### B) Logout
- Explicit user action (button/menu item)
- Available from authenticated user dropdown menu
- Calls logout endpoint and returns to login or public landing view

### C) Registration
- Present only when local registration is enabled
- Fields: username, email, password, optional display name
- Validation errors shown inline

### D) User Profile / Settings
- Displays current user data
- Allows editing permitted fields (e.g., display name, preferences)
- Renders configurable built-in profile properties provided by backend catalog metadata
- Supports typed profile-property inputs:
	- fixed fields (e.g., ORCID)
	- specific URL types with host guidance (e.g., Google Scholar)
	- arbitrary external link list entries (`label + url`)
- Displays role badges with role-source distinction:
	- direct user-assigned roles
	- group-inherited roles
- Hovering inherited role badge shows source group(s)
- Save action uses API patch endpoint with success/error feedback

### E) User — My Groups
- Shows groups owned by the current user
- Provides actions to create, open, edit, and delete owned groups
- Group create/edit uses API with validation feedback

### F) Admin — User List
- Shows paginated table/list of users
- Supports basic search/filter by status/role (MVP-level)
- Entry action to open user edit view
- Visible to `superuser` and configured user-management roles

### K) Notifications
- User can view in-app notifications list/panel
- Notification item supports click navigation target semantics
- Acknowledge-required notifications present explicit acknowledge action
- Task-gated notifications cannot clear until backend completion check succeeds
- UI updates in realtime when connected websocket event stream is active

### L) Admin — Notifications (Superuser)
- Superuser-only page to view all notifications across users
- Supports filtering by recipient, status, type, and date range
- Supports actions: resend, cancel, delete
- Shows delivery history metadata per notification

### G) Admin — User Edit
- Displays user details and linked auth identities
- Allows configured user-management roles to edit status and allowed profile fields
- Role assignment controls are visible to superuser only
- Confirms successful save or shows validation errors
- Visible to `superuser` and configured user-management roles

### H) Admin — Roles
- Shows list of roles
- Allows creating and editing role definitions
- Allows deleting non-system roles

### I) Admin — Groups (All)
- Shows all groups across users
- Supports search/filter by group name and owner
- Entry action to open admin group detail/edit view

### J) Admin — Group Edit
- Displays group details including owner
- Allows superuser edits and delete

### M) CMS — Content List
- Shows content items user is allowed to view/manage
- Supports filters by type, status, and text query
- Provides create/edit/open actions based on role capabilities
- Visible from admin navigation to `ContentEditor` and `superuser`
- Route: `/settings/admin/content`

### N) CMS — Content Editor
- Supports required shared fields: `name` and `content`
- Renders additional typed fields from selected content type definition
- `content` field uses markdown editor with edit + preview
- Supports drag/drop image uploads to backend media API (no base64 embedding)
- Supports selecting existing images from media library and inserting references
- Supports editing existing image metadata (e.g., alt text/title)

### O) Admin — Content Types
- Lists configured content types including built-in `page`
- Allows `superuser` to create/edit/disable custom content types
- Built-in `page` type is visible and protected from deletion

### P) CMS — Public Content Route
- Published content renders at `/cms/:contentId`
- If the content has a defined alias/pretty URL, loading via id route updates browser history to canonical alias URL
- Draft/unpublished content is not publicly viewable but is visible to superuser and ContentEditor.
- When superuser/ContentEditor views unpublished content through normal route handling, show a clear preview header/banner (`Preview — Not Published`).
- When a content editor or user is on a page, include an overlay edit button that they can click to bring them to the editor for that page.

## 2) Routing
- `/login`
- `/register`
- `/settings/profile`
- `/settings/security`
- `/settings/theme`
- `/settings/groups`
- `/settings/group/:id`
- `/settings/admin/users`
- `/settings/admin/users/:id`
- `/settings/admin/roles`
- `/settings/admin/invitations`
- `/settings/admin/notifications`
- `/settings/admin/content`
- `/settings/admin/content/:id`
- `/settings/admin/content-types`
- `/cms/:contentId`
- default route handler resolves unmatched, non-`/cms` paths via backend resolver for arbitrary alias mounts
- frontend resolver blacklist config is applied before resolver calls
- `/notifications` (optional dedicated page or panel route)

### 2.1 Route Resolution Order (Required)
For any incoming frontend URL, route resolution order must be:
1. Static and explicitly registered application routes (e.g., `/login`, `/settings/*`, `/notifications`)
2. Explicit CMS id route (`/cms/:contentId`)
3. Resolver blacklist check for unmatched, non-`/cms` paths
4. Final default handler for unmatched, non-blacklisted, non-`/cms` paths that calls backend resolver (`/api/v1/cms/resolve`)
5. Render 404 page when resolver returns `404`

The resolver fallback must never override a matched explicit application route.
The resolver fallback must never be used for `/cms/*` routes.

## 3) Route Protection Rules
- `/settings/*` requires authenticated user
- `/settings/admin/*` requires authenticated privileged role per page policy
- `/settings/admin/content*` requires `ContentEditor` or `superuser`
- `/settings/admin/content-types` requires `superuser`
- Unauthorized/forbidden routes redirect to login or show access denied state
- UI auth layer must attempt token refresh on access-token expiration before redirecting to login
- If refresh fails, clear local auth state and redirect to `/login`

## 4) UX and Accessibility Baseline
- Keyboard-navigable forms and actions
- Labels and validation messages for required fields
- Visible loading and error states on async actions
- Reusable form, table/list, and dialog primitives should be used consistently across user/admin pages
- Session expiration and forced logout should present a clear, user-safe message (e.g., session expired, please sign in again)
- Theme toggle (if provided) should not override the default behavior of following system theme on first load

## 5) UI Acceptance Criteria
- User can complete login/logout/registration/profile update flows end-to-end
- User can create and manage owned groups end-to-end
- Superuser and configured user-management roles can list users and edit a selected user
- Superuser can manage roles and can view/edit all groups
- Disabled features (e.g., registration off, provider off) are hidden/blocked appropriately
- Shared UI components are reusable across multiple pages and follow shadcn-ui-first selection guidance
- During active use, UI refreshes tokens without interrupting user flow until refresh token becomes invalid/expired
- Default shell/header behavior matches authenticated vs unauthenticated requirements
- Notifications display and state updates are near real-time while websocket is connected
- Content type-driven forms render correctly for built-in `page` and at least one custom type
- Markdown editor supports preview and drag/drop image upload with URL-based insertion
- Content list appears in admin pages for `ContentEditor` and `superuser`
- Public route `/cms/:contentId` resolves published content and normalizes URL to pretty alias when available
- Unmatched non-`/cms` paths use resolver; resolver `404` results show 404 page
- Unpublished content viewed by superuser/ContentEditor shows preview header/banner
