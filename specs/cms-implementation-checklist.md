# CMS Implementation Checklist (v1)

## 1) Scope and Readiness
- [x] Confirm role names in seed/config include `ContentEditor` and `Superuser`
- [x] Confirm built-in `page` content type bootstrap contract
- [x] Confirm canonical alias format policy (`/path`, lowercase, no trailing slash except root)
- [x] Confirm collision policy for aliases (global uniqueness)
- [x] Configure frontend resolver blacklist wildcard patterns (`FRONTEND_CMS_RESOLVER_BLACKLIST_PATTERNS`)

## 2) Backend — Data and Persistence

### 2.1 Schema/Collections
- [x] Add `content_types` collection fields from `data-model.md`
- [x] Add `content_items` collection with `alias_path` unique sparse index
- [x] Add `media_assets` collection and GridFS linkage (`gridfs_file_id`)
- [ ] Add indexes:
  - [x] `content_type_key`
  - [x] `alias_path` unique sparse
  - [x] `(status, visibility)`
  - [x] `created_by_user_id`
  - [x] `updated_at`

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
- [x] Implement `MediaRepository`
  - [x] `uploadToGridFS`
  - [x] `getFileStream`
  - [x] `list`
  - [x] `updateMetadata`
  - [x] `delete`

## 3) Backend — Authorization and Roles
- [x] Seed/ensure role `ContentEditor`
- [ ] Map capability policy:
  - [ ] `ContentEditor`: content CRUD/publish + media upload/manage
  - [ ] `Superuser`: all CMS capabilities including content type management
- [x] Enforce `superuser`-only checks for content type endpoints
- [x] Enforce public-read rules (`published` + visibility policy)

## 4) Backend — API Endpoints

### 4.1 Content Types (Admin)
- [x] `GET /api/v1/content/types`
- [x] `POST /api/v1/admin/content/types` (`superuser` only)
- [x] `PATCH /api/v1/admin/content/types/:key` (`superuser` only)

### 4.2 Content Items
- [x] `GET /api/v1/content` (role/visibility filtered)
- [x] `POST /api/v1/content` (default `draft`)
- [x] `GET /api/v1/content/:id`
- [x] `PATCH /api/v1/content/:id`
- [x] `POST /api/v1/content/:id/publish`
- [x] `POST /api/v1/content/:id/unpublish`
- [x] `DELETE /api/v1/content/:id`

### 4.3 Public CMS and Resolver
- [x] `GET /api/v1/cms/:contentId`
  - [x] Return canonical URL metadata when alias exists
  - [x] Return full content JSON dictionary by default
  - [x] Allow unpublished preview response for `ContentEditor`/`superuser`
- [x] `GET /api/v1/cms/resolve?path=/...`
  - [x] Return `{ matched, content, canonicalUrl, visibility }` on match
  - [x] Return `404` with standard error envelope on no match
  - [x] Return not-found for unmatched/unpublished aliases
  - [x] Ensure endpoint is called only for unmatched, non-blacklisted, non-`/cms` paths

### 4.4 Media (GridFS)
- [x] `POST /api/v1/media/images` (multipart upload)
- [x] Enforce image MIME type validation only (MVP scope)
- [x] `GET /api/v1/media/images`
- [x] `GET /api/v1/media/images/:id` (stream)
- [x] `PATCH /api/v1/media/images/:id` (metadata)
- [x] `DELETE /api/v1/media/images/:id`

## 5) Frontend — Admin and Editor UI

### 5.1 Routes and Guards
- [x] Add admin content list route: `/settings/admin/content`
- [x] Add admin content editor route: `/settings/admin/content/:id`
- [x] Guard admin content routes to `ContentEditor` or `superuser`
- [x] Guard `/settings/admin/content-types` to `superuser`

### 5.2 Admin Content List
- [x] Filter by type/status/search
- [x] Create/edit/open actions based on capability
- [x] Empty/loading/error states

### 5.3 Content Editor
- [x] Render required fields (`name`, `content`)
- [x] Render content-type additional fields dynamically
- [x] Save draft flow
- [x] Publish/unpublish actions
- [x] Alias path input with validation feedback

### 5.4 Markdown + Images
- [x] Integrate ByteMD (`@bytemd/react`) editor component
- [x] Implement `uploadImages` hook to call `/api/v1/media/images`
- [x] Insert URL-based markdown image references (no base64)
- [x] Existing-image picker from `/api/v1/media/images`
- [x] Image metadata edit (alt/title)
- [x] Create media selector dialog component for editor image toolbar
- [x] Override editor upload action to use media selector dialog
- [x] Support multi-select in media selector for batch insertions

### 5.5 Admin Media Library
- [x] Add admin media list route: `/settings/admin/media`
- [x] Guard `/settings/admin/media` to `ContentEditor` or `superuser`
- [x] List all uploaded media with thumbnails
- [x] Display media metadata (filename, size, upload date, alt text, title, tags)
- [x] Search/filter media by filename, alt text, or title
- [x] Delete media with confirmation
- [x] Add "Media" link to admin navigation menu

## 6) Frontend — Public CMS Experience
- [x] Add public route handler for `/cms/:contentId`
- [x] Fetch content by id endpoint
- [x] If response includes canonical alias URL, call history replace to alias
- [x] Add default route handler for unmatched, non-`/cms` paths that calls `/api/v1/cms/resolve`
- [x] Enforce route precedence: explicit app routes -> `/cms/:contentId` -> default handler resolver
- [x] Ensure resolver is never called for `/cms/*` routes
- [x] Ensure resolver is never called for blacklist-matched routes
- [x] Render 404 page when resolver returns `404`
- [x] Show preview header/banner when rendering unpublished content for authorized users
- [x] Add overlay edit button on CMS pages for authorized users that links to `/settings/admin/content/:id`

## 7) Validation, Security, and Observability
- [x] Alias normalization/sanitization and uniqueness checks
- [x] Markdown output sanitization policy enforced
- [x] Upload file type validation (image types only for MVP)
- [ ] Audit events for create/edit/publish/unpublish/delete and media operations
- [ ] Include correlation ids in CMS endpoint logs/errors

## 8) Testing Checklist

### 8.1 Backend Tests
- [x] Content type admin authorization (`superuser` only)
- [x] Content create defaults to `draft`
- [x] Publish/unpublish state transitions
- [x] Public endpoint denies draft content
- [x] `/cms/:contentId` returns canonical alias when available
- [x] `/cms/resolve` matched/unmatched cases
- [x] `/cms/resolve` is not invoked for blacklist-matched paths (frontend contract test/integration)
- [x] Alias uniqueness conflict behavior
- [x] Alias change invalidates old alias (old alias returns 404)
- [x] GridFS upload + stream roundtrip

### 8.2 Frontend Tests (Playwright)
- [x] ContentEditor can access admin content list/editor
- [x] Non-ContentEditor is blocked from admin content routes
- [x] Superuser can access content types admin page
- [x] Superuser can create and edit content type definitions
- [x] Draft save then publish flow
- [x] `/cms/:id` loads and rewrites URL to alias
- [x] Alias route resolves and renders correct page
- [x] Explicit app routes are never shadowed by alias resolver fallback
 - [x] Resolver is not called for `/cms/*` requests
 - [x] Resolver is not called for blacklist-matched paths
- [ ] Performance optimization for resolver/path routing (caching, dynamic route insertion)

## 9) Done Criteria
- [ ] All CMS acceptance criteria in `cms.md` are met
- [ ] Permissions matrix behavior matches `permissions-matrix.md`
- [ ] API behavior matches `api.md` CMS section
- [ ] UI behavior matches `ui.md` CMS sections
- [ ] Documentation updated for any implementation-specific decisions
