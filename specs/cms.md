# Content Management Specification (v1 Draft)

## 1) Purpose
Define a simple content management system (CMS) baseline that supports:
- Configurable content type definitions
- Content creation/editing for those types
- A built-in default `page` content type
- Markdown-based authoring with preview and image workflows

## 2) MVP Scope
- System-managed content type catalog with one required built-in type:
  - `page`
- Generic content item CRUD for enabled content types
- Shared base metadata for all content items
- Type-defined additional fields with basic data types and validation
- Public and role-based access control for content visibility and editing
- Image upload and retrieval using MongoDB GridFS
- Markdown editor with edit + preview and drag/drop image upload

Out of scope (MVP):
- Complex workflow engines (multi-step approvals)
- Full version compare/merge UI
- Multi-tenant isolation beyond current role model

## 3) Core Concepts

### 3.1 Content Type
A content type defines:
- `key` (stable identifier, e.g., `page`, `article`)
- `label` (display name)
- `description` (optional)
- `status` (`active`, `disabled`)
- `fieldDefinitions[]` (additional fields beyond shared base fields)
- `permissionsPolicy` (type-level defaults and optional role overrides)

### 3.2 Content Item
A content item is an instance of a content type.

Required user-provided fields (all types):
- `name` (string)
- `content` (markdown string)

Shared system metadata (all types):
- `id`
- `contentTypeKey`
- `aliasPath` (optional pretty URL path, e.g., `/about`)
- `status` (`draft`, `published`, `archived`)
- `createdAt`, `updatedAt`
- `createdByUserId`, `updatedByUserId`
- `publishedAt` (nullable)
- `publishedByUserId` (nullable)
- `visibility` (`public`, `authenticated`, `roles`)
- `allowedRoles[]` (used when `visibility=roles`)
- `layoutKey` (optional; selected layout variant)
- `linkRefs[]` (optional references to internal/external resources)

### 3.3 Built-in Type: `page`
The system must ship with an active, non-deletable `page` content type.

`page` minimal fields:
- shared `name`
- shared `content` (markdown)

`page` optional common fields (recommended defaults):
- `summary` (text)
- `layoutKey` (select)
- `linkRefs` (links)

### 3.4 Additional Type Example: `article`
Example custom type fields:
- `tagline` (text, optional)
- `summary` (textarea, optional)

## 4) Field Type System

### 4.1 Supported Field Types (MVP)
- `text` (single-line string)
- `textarea` (multi-line plain text)
- `markdown` (rich markdown source)
- `number`
- `boolean`
- `date`
- `datetime`
- `select` (single option)
- `multiselect` (multiple options)
- `url`
- `link` (single `{ label, url }`)
- `links` (array of `{ label, url }`)
- `imageRef` (single image asset id)
- `imageRefs` (array of image asset ids)

Notes:
- `url` is a plain URL string value.
- `link` is a structured single link object with display label and URL.
- `links` is a repeatable list of structured link objects.

### 4.2 Field Definition Metadata
Each custom field definition supports:
- `key` (stable machine key)
- `label`
- `description` (optional)
- `type`
- `required` (boolean)
- `defaultValue` (optional)
- `placeholder` (optional)
- `helpText` (optional)
- `validation` (type-specific constraints; e.g., min/max length, allowed values)

Validation is server-authoritative. UI validation is for early feedback only.

## 5) Permissions and Access Model

### 5.1 Visibility
Each content item has one visibility mode:
- `public`: visible without authentication
- `authenticated`: visible to any authenticated user
- `roles`: visible only to authenticated users with matching role(s)

### 5.2 Capability Model
Capabilities are role-based and enforced server-side:
- `contentType.manage` — create/update/disable content types
- `content.create` — create content items
- `content.edit.any` — edit any content item
- `content.edit.own` — edit content created by requester
- `content.publish` — publish/unpublish items
- `content.delete` — delete/archive items
- `media.upload` — upload images/assets
- `media.manage` — edit/delete assets and metadata

Default policy:
- `Superuser` has all capabilities
- `ContentEditor` can create/edit/publish content and upload/manage media
- `ContentEditor` cannot manage content type definitions
- Additional role mappings are deployment-configurable

### 5.3 Admin UI Visibility Rules
- Content list under admin pages is visible to:
  - `ContentEditor`
  - `Superuser`
- Content type administration under admin pages is visible to:
  - `Superuser` only

## 6) Publication and URL Behavior

### 6.1 Publication Defaults
- New content items default to `status=draft` (unpublished)
- Draft content is not publicly resolvable
- Only `published` items are available on public CMS routes

### 6.2 Public CMS Route
- Published content must be retrievable at:
  - `/cms/{contentId}`

### 6.3 Pretty URL Alias
- Content may define optional `aliasPath` for user-friendly URLs (e.g., `/about`)
- When both id route and alias exist:
  - `/cms/{contentId}` should resolve and then update browser history to alias URL
  - canonical public URL becomes the alias URL

### 6.4 Arbitrary URL Mounting and Resolver
- To support pages mounted at arbitrary URLs, backend must provide a resolver endpoint that maps incoming path/alias to content.
- Resolver is a final fallback and is only consulted after standard application routes fail to match.
- Resolver fallback is **never** used for `/cms/*` paths because `/cms/{contentId}` is explicitly routed.
- Frontend applies configured resolver blacklist patterns first; blocked paths never call resolver.
- Required matching order:
  1. Explicit application routes
  2. Explicit CMS id route (`/cms/{contentId}`)
  3. Resolver blacklist check for unmatched, non-`/cms` paths
  4. Resolver fallback for unmatched, non-blacklisted, non-`/cms` paths (e.g., `/foo/bar`)
- Resolver returns:
  - matched content JSON object
  - canonical URL
  - publication/visibility state
  - `404` not-found response when no alias matches
- Frontend default route handler sends unmatched URL path to resolver; when resolver returns `404`, frontend renders 404 page.
- Optional optimization: frontend may cache resolved paths/routes at runtime, but this is not required for MVP and is deferred.

### 6.5 Unpublished Preview on Normal Route
- `ContentEditor` and `Superuser` may view unpublished content via normal route handling (`/cms/{contentId}` or resolved alias route).
- When rendering unpublished content, UI must show a clear preview header/banner indicating the content is not published.

### 6.6 Alias Change Behavior (MVP)
- If an alias changes, old alias paths stop resolving immediately.
- Redirect maps from old alias to new alias are out of scope for MVP.

## 7) Markdown Authoring and Editor Requirements

### 7.1 Content Field Behavior
- `content` field uses markdown source-of-truth storage
- Editor provides:
  - authoring mode
  - rendered preview mode
  - split mode when supported

### 7.2 Image Workflows in Editor
- Drag/drop image files into editor triggers upload to backend media API
- Upload returns canonical media URL/reference (no base64 in markdown)
- Editor inserts markdown image syntax using stored media URL
- Editor supports selecting existing uploaded images from a media picker/library
- Editing existing image metadata (e.g., alt text/title) is supported without re-upload

### 7.3 Sanitization and Rendering
- Markdown rendering must sanitize unsafe HTML/script content
- Allowed markdown/html capabilities are centrally configurable
- Default implementation should render markdown client-side only when done safely.
- If safe client-side rendering is not acceptable for deployment policy, backend-rendered output may be requested.
- Future (post-MVP): support alternate response representations (e.g., HTML) from `/cms/{contentId}` and resolver endpoints.

## 8) Media and GridFS Storage

### 8.1 Storage Requirements
- All uploaded images are stored in MongoDB GridFS
- GridFS file metadata stores:
  - `id`
  - `filename`
  - `contentType`
  - `byteSize`
  - `sha256` (recommended)
  - `uploadedByUserId`
  - `createdAt`, `updatedAt`
  - `altText` (optional)
  - `title` (optional)
  - `tags[]` (optional)

### 8.2 Media API Behavior
- Upload endpoint accepts multipart file data
- Uploads are limited to image MIME types for MVP
- Retrieval endpoint streams file bytes with correct content type and cache headers
- Media listing endpoint supports search/filter for picker workflows
- Media updates support metadata-only edits
- Delete behavior must be policy-driven (hard delete or soft-delete flag)

## 9) API Additions (Summary)
Detailed routes are defined in `api.md`, but CMS must include:
- Content type management endpoints (admin/superuser)
- Content item CRUD + publish endpoints
- Public content read endpoint for `/cms/{contentId}`
- Alias/path resolver endpoint for arbitrary mount URLs
- Media upload/list/get/update/delete endpoints backed by GridFS

## 10) UI Additions (Summary)
Detailed route/page behavior is defined in `ui.md`, but CMS must include:
- Content list page with create/edit entry points
- Content editor page with typed field rendering by content type
- Content list/editor in admin section for `ContentEditor` and `Superuser`
- Markdown editor area with preview and drag/drop uploads
- Media library picker for existing images
- Content type management page (privileged role)
- Public CMS route rendering with id-to-alias history normalization

## 11) Recommended Markdown Editor (MVP)

Primary recommendation:
- **ByteMD** (`@bytemd/react`)

Why:
- Native React component option
- Built-in edit/preview capabilities
- Explicit `uploadImages` hook for custom upload API integration
- Supports returning URL-based references so markdown embeds links instead of base64 payloads

Fallback candidates:
- TOAST UI Editor (`@toast-ui/editor` + React wrapper)
- `@uiw/react-md-editor` with custom toolbar/command integration

Selection criteria:
- Must support async image upload callbacks
- Must support drop/paste image handling without forced base64 embedding
- Must allow sanitization controls and markdown preview configuration

## 12) Acceptance Criteria
- System contains built-in `page` content type at startup
- New content types can define additional typed fields and validations
- All content items require `name` and `content`
- `content` is persisted and rendered as markdown
- New content defaults to unpublished (`draft`)
- Public/role visibility rules are enforced for reads and writes
- Published content is publicly available at `/cms/{contentId}`
- Alias path can be defined and used as canonical pretty URL
- Visiting `/cms/{contentId}` rewrites browser URL to alias when alias exists
- Resolver endpoint supports alias/path-based content lookup for arbitrary URL mounts
- Alias resolver is used only as last-resort fallback when no other route matches
- Resolver fallback is never used for `/cms/*` routes
- Unmatched resolver results render frontend 404 page
- Image uploads are persisted in MongoDB GridFS and usable in markdown content
- Editor supports drag/drop upload and existing-image selection
