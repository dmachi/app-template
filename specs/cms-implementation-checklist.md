# CMS Implementation Checklist (v1)

## 1) Scope and Readiness
- [ ] Confirm role names in seed/config include `ContentEditor` and `Superuser`
- [ ] Confirm built-in `page` content type bootstrap contract
- [ ] Confirm canonical alias format policy (`/path`, lowercase, no trailing slash except root)
- [ ] Confirm collision policy for aliases (global uniqueness)
- [ ] Configure frontend resolver blacklist wildcard patterns (`FRONTEND_CMS_RESOLVER_BLACKLIST_PATTERNS`)

## 2) Backend — Data and Persistence

### 2.1 Schema/Collections
- [ ] Add `content_types` collection fields from `data-model.md`
- [ ] Add `content_items` collection with `alias_path` unique sparse index
- [ ] Add `media_assets` collection and GridFS linkage (`gridfs_file_id`)
- [ ] Add indexes:
  - [ ] `content_type_key`
  - [ ] `alias_path` unique sparse
  - [ ] `(status, visibility)`
  - [ ] `created_by_user_id`
  - [ ] `updated_at`

### 2.2 Repository Contracts
- [ ] Implement `ContentTypeRepository`
  - [ ] `listActive`
  - [ ] `getByKey`
  - [ ] `create`
  - [ ] `update`
  - [ ] `disableIfAllowed`
- [ ] Implement `ContentRepository`
  - [ ] `create` (default `draft`)
  - [ ] `getById`
  - [ ] `getByAliasPath`
  - [ ] `listVisible`
  - [ ] `update`
  - [ ] `publish` / `unpublish`
  - [ ] `deleteOrArchive`
- [ ] Implement `MediaRepository`
  - [ ] `uploadToGridFS`
  - [ ] `getFileStream`
  - [ ] `list`
  - [ ] `updateMetadata`
  - [ ] `delete`

## 3) Backend — Authorization and Roles
- [ ] Seed/ensure role `ContentEditor`
- [ ] Map capability policy:
  - [ ] `ContentEditor`: content CRUD/publish + media upload/manage
  - [ ] `Superuser`: all CMS capabilities including content type management
- [ ] Enforce `superuser`-only checks for content type endpoints
- [ ] Enforce public-read rules (`published` + visibility policy)

## 4) Backend — API Endpoints

### 4.1 Content Types (Admin)
- [ ] `GET /api/v1/content/types`
- [ ] `POST /api/v1/admin/content/types` (`superuser` only)
- [ ] `PATCH /api/v1/admin/content/types/:key` (`superuser` only)

### 4.2 Content Items
- [ ] `GET /api/v1/content` (role/visibility filtered)
- [ ] `POST /api/v1/content` (default `draft`)
- [ ] `GET /api/v1/content/:id`
- [ ] `PATCH /api/v1/content/:id`
- [ ] `POST /api/v1/content/:id/publish`
- [ ] `POST /api/v1/content/:id/unpublish`
- [ ] `DELETE /api/v1/content/:id`

### 4.3 Public CMS and Resolver
- [ ] `GET /api/v1/cms/:contentId`
  - [ ] Return canonical URL metadata when alias exists
  - [ ] Return full content JSON dictionary by default
  - [ ] Allow unpublished preview response for `ContentEditor`/`superuser`
- [ ] `GET /api/v1/cms/resolve?path=/...`
  - [ ] Return `{ matched, content, canonicalUrl, visibility }` on match
  - [ ] Return `404` with standard error envelope on no match
  - [ ] Return not-found for unmatched/unpublished aliases
  - [ ] Ensure endpoint is called only for unmatched, non-blacklisted, non-`/cms` paths

### 4.4 Media (GridFS)
- [ ] `POST /api/v1/media/images` (multipart upload)
- [ ] Enforce image MIME type validation only (MVP scope)
- [ ] `GET /api/v1/media/images`
- [ ] `GET /api/v1/media/images/:id` (stream)
- [ ] `PATCH /api/v1/media/images/:id` (metadata)
- [ ] `DELETE /api/v1/media/images/:id`

## 5) Frontend — Admin and Editor UI

### 5.1 Routes and Guards
- [ ] Add admin content list route: `/settings/admin/content`
- [ ] Add admin content editor route: `/settings/admin/content/:id`
- [ ] Guard admin content routes to `ContentEditor` or `superuser`
- [ ] Guard `/settings/admin/content-types` to `superuser`

### 5.2 Admin Content List
- [ ] Filter by type/status/search
- [ ] Create/edit/open actions based on capability
- [ ] Empty/loading/error states

### 5.3 Content Editor
- [ ] Render required fields (`name`, `content`)
- [ ] Render content-type additional fields dynamically
- [ ] Save draft flow
- [ ] Publish/unpublish actions
- [ ] Alias path input with validation feedback

### 5.4 Markdown + Images
- [ ] Integrate ByteMD (`@bytemd/react`) editor component
- [ ] Implement `uploadImages` hook to call `/api/v1/media/images`
- [ ] Insert URL-based markdown image references (no base64)
- [ ] Existing-image picker from `/api/v1/media/images`
- [ ] Image metadata edit (alt/title)

## 6) Frontend — Public CMS Experience
- [ ] Add public route handler for `/cms/:contentId`
- [ ] Fetch content by id endpoint
- [ ] If response includes canonical alias URL, call history replace to alias
- [ ] Add default route handler for unmatched, non-`/cms` paths that calls `/api/v1/cms/resolve`
- [ ] Enforce route precedence: explicit app routes -> `/cms/:contentId` -> default handler resolver
- [ ] Ensure resolver is never called for `/cms/*` routes
- [ ] Ensure resolver is never called for blacklist-matched routes
- [ ] Render 404 page when resolver returns `404`
- [ ] Show preview header/banner when rendering unpublished content for authorized users
- [ ] Add overlay edit button on CMS pages for authorized users that links to `/settings/admin/content/:id`

## 7) Validation, Security, and Observability
- [ ] Alias normalization/sanitization and uniqueness checks
- [ ] Markdown output sanitization policy enforced
- [ ] Upload file type validation (image types only for MVP)
- [ ] Audit events for create/edit/publish/unpublish/delete and media operations
- [ ] Include correlation ids in CMS endpoint logs/errors

## 8) Testing Checklist

### 8.1 Backend Tests
- [ ] Content type admin authorization (`superuser` only)
- [ ] Content create defaults to `draft`
- [ ] Publish/unpublish state transitions
- [ ] Public endpoint denies draft content
- [ ] `/cms/:contentId` returns canonical alias when available
- [ ] `/cms/resolve` matched/unmatched cases
- [ ] `/cms/resolve` is not invoked for blacklist-matched paths (frontend contract test/integration)
- [ ] Alias uniqueness conflict behavior
- [ ] Alias change invalidates old alias (old alias returns 404)
- [ ] GridFS upload + stream roundtrip

### 8.2 Frontend Tests (Playwright)
- [ ] ContentEditor can access admin content list/editor
- [ ] Non-ContentEditor is blocked from admin content routes
- [ ] Superuser can access content types admin page
- [ ] Draft save then publish flow
- [ ] `/cms/:id` loads and rewrites URL to alias
- [ ] Alias route resolves and renders correct page
- [ ] Explicit app routes are never shadowed by alias resolver fallback
- [ ] Resolver is not called for `/cms/*` requests
- [ ] Resolver is not called for blacklist-matched paths
- [ ] Unmatched non-`/cms` route with resolver `404` shows 404 page
- [ ] Unpublished content view for ContentEditor/superuser shows preview header/banner
- [ ] Drag/drop image upload inserts URL markdown
- [ ] Overlay edit button appears only for authorized users

## 10) Deferred (Post-MVP)
- [ ] Alias redirect map support when alias changes
- [ ] Resolver/content response representation negotiation (e.g., HTML rendering)
- [ ] Performance optimization for resolver/path routing (caching, dynamic route insertion)

## 9) Done Criteria
- [ ] All CMS acceptance criteria in `cms.md` are met
- [ ] Permissions matrix behavior matches `permissions-matrix.md`
- [ ] API behavior matches `api.md` CMS section
- [ ] UI behavior matches `ui.md` CMS sections
- [ ] Documentation updated for any implementation-specific decisions
