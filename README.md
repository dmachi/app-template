# Basic System Template

This repository is a **template base application** for building internal or product-facing systems with a modern full-stack foundation.  
It provides a working auth/profile/admin/settings baseline so new apps can start from real capabilities instead of boilerplate.

## Purpose

Use this template when you want to:

- launch a new app quickly with authentication, user management, and settings already wired
- keep app-specific functionality separate from reusable platform/core functionality
- continue receiving improvements from the template over time

## Built-in capabilities

Out of the box, this template includes:

- **Authentication**: local auth, refresh/logout flows, provider metadata, invitation acceptance, email verification
- **User profile**: editable profile with configurable profile-property catalog
- **Groups + roles**: group memberships, owner/member semantics, role assignment patterns
- **Admin surfaces**: users, invitations, notifications, roles, user detail views
- **Notifications**: app notifications plus client-side toast acknowledgements
- **Extensible settings UI**: pluggable settings pages via frontend settings registry
- **Backend + frontend scaffolding**: FastAPI backend, React/TypeScript frontend, Docker and test setup

---

## Create a new app from this template

### Recommended workflow: GitHub template flow

1. In GitHub, click **Use this template** on this repository.
2. Create your new repository (for example `my-app`).
3. Clone your new repository locally.

---

## Local development quick start

1. Create/update Conda env:
   - `conda env create -f environment.yml` (first time)
   - `conda env update -f environment.yml --prune` (updates)
2. Activate env:
   - `conda activate template-framework`
3. Start backend dependencies:
   - `docker compose -f docker-compose.backend.yml up -d`
4. Run backend API:
   - `cd backend`
   - `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
5. Run frontend:
   - `cd frontend && npm install && npm run dev`

Run tests:

- `pytest backend/tests -q`

---

## Configuration parameters (complete reference)

Configuration is primarily loaded from `backend/.env` via `backend/app/core/config.py`.

- Env mapping follows Pydantic Settings conventions (`field_name` → `FIELD_NAME`).
- Most app runtime settings are backend-controlled.
- Frontend API target is configured separately via `VITE_API_BASE`.

### Application metadata and API

| Parameter | Default | Description |
|---|---|---|
| `APP_NAME` | `Basic System Template` | Display name returned in metadata and used in UI contexts. |
| `APP_ICON` | `/app-icon.svg` | App icon value. Supports emoji/text or a frontend-served asset path/URL (for example `/app-icon.svg` from `frontend/public/`). |
| `APP_ENV` | `development` | Runtime mode (`development`, `test`, `production`). |
| `API_PREFIX` | `/api/v1` | API base path prefix. |
| `CORS_ALLOW_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174` | Comma-separated allowed CORS origins. |

### Authentication and token behavior

| Parameter | Default | Description |
|---|---|---|
| `AUTH_MODE` | `jwt` | Auth mode (currently JWT). |
| `JWT_ACCESS_TOKEN_SECRET` | _(unset)_ | Secret for access token signing. Required in `test`/`production`. |
| `JWT_ACCESS_TOKEN_TTL_SECONDS` | `900` | Access token TTL in seconds. Must be positive. |
| `JWT_REFRESH_TOKEN_SECRET` | _(unset)_ | Secret for refresh token signing. Required in `test`/`production`. |
| `JWT_REFRESH_TOKEN_TTL_SECONDS` | `604800` | Refresh token TTL in seconds. Must be positive. |
| `JWT_ISSUER` | _(unset)_ | Optional JWT issuer claim. |
| `JWT_AUDIENCE` | _(unset)_ | Optional JWT audience claim. |
| `REFRESH_TOKEN_ROTATION_ENABLED` | `true` | Enables refresh token rotation semantics. |
| `TOKEN_TRANSPORT_MODE` | `bearer-header` | Token transport (`bearer-header` or `cookie`). |
| `REFRESH_TOKEN_REQUEST_FIELD` | `refreshToken` | Request body field used for refresh token. |
| `COOKIE_SECURE` | _(unset)_ | Required if `TOKEN_TRANSPORT_MODE=cookie`. |
| `COOKIE_SAME_SITE` | _(unset)_ | Required if `TOKEN_TRANSPORT_MODE=cookie`; one of `lax`, `strict`, `none`. |

### OAuth and personal access token configuration

| Parameter | Default | Description |
|---|---|---|
| `OAUTH_ENABLED` | `true` | Enables/disables OAuth provider endpoints. |
| `OAUTH_ISSUER` | `http://localhost:8000` | OAuth/OIDC issuer base URL used in metadata and token claims. |
| `OAUTH_DEFAULT_SCOPES` | `openid,profile,email` | Comma-separated default scopes when OAuth `scope` is omitted. |
| `PERSONAL_ACCESS_TOKENS_ENABLED` | `true` | Enables/disables user personal access token creation/list/revocation and PAT bearer authentication. |
| `PERSONAL_ACCESS_TOKEN_ENCRYPTION_KEY` | _(unset)_ | Optional key source for PAT ciphertext encryption at rest. If unset, runtime derives from JWT access-token secret (or development fallback secret). |
| `EXTERNAL_ACCOUNT_TOKEN_ENCRYPTION_KEY` | _(unset)_ | Optional key source for encrypted external-account OAuth tokens at rest. If unset, runtime derives from PAT/JWT encryption key fallback chain. |

### Database configuration

| Parameter | Default | Description |
|---|---|---|
| `DATABASE_PROVIDER` | `mongodb` | Persistence provider (`mongodb` or `sql`). |
| `DATABASE_URL` | _(unset)_ | Generic DB URL (primarily for non-mongodb providers). |
| `DATABASE_NAME` | _(unset)_ | Generic DB name (primarily for non-mongodb providers). |
| `DATABASE_AUTO_CREATE_INDEXES` | `true` | Whether DB indexes are auto-created at startup. |
| `DATABASE_LOG_LEVEL` | _(unset)_ | Optional DB log verbosity override. |
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection URL (used when provider is mongodb). |
| `MONGODB_DB_NAME` | `basic_system_template` | MongoDB database name (used when provider is mongodb). |

### Redis and notification retention

| Parameter | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL for event/notification infrastructure. |
| `REDIS_NOTIFICATION_CHANNEL` | `notifications` | Pub/sub channel name used for notification fan-out. |
| `NOTIFICATIONS_COMPLETED_RETENTION_HOURS` | `24` | Retention window for completed notifications. Must be positive. |

### Profile property configuration

| Parameter | Default | Description |
|---|---|---|
| `PROFILE_PROPERTIES` | `*` | Primary profile-property selector string. Supports `*`, key lists, and `!required` markers. |
| `PROFILE_PROPERTIES_ENABLED` | _(empty)_ | Optional override. If set, it takes precedence over `PROFILE_PROPERTIES`. |

### Auth providers and registration policy

| Parameter | Default | Description |
|---|---|---|
| `AUTH_PROVIDERS_ENABLED` | `local,uva-netbadge` | Comma-separated enabled providers. Unknown providers fail validation. |
| `LOCAL_REGISTRATION_ENABLED` | `true` | Enables/disables local signup flow. |
| `EMAIL_VERIFICATION_REQUIRED_FOR_LOGIN` | `false` | If true, login requires verified email. |

### External integration OAuth providers (linked accounts)

External account linking is configured through extension hooks in:

- `backend/app/extensions/auth/external_oauth_providers.py`

Built-in provider library entries currently include `github` and `orcid`, but none are enabled by default. To enable a provider for an app, define it in `ENABLED_EXTERNAL_OAUTH_PROVIDER_CONFIGS` with:

- `client_id`
- `client_secret`
- `required_scopes` (must be explicitly enumerated)
- optional `optional_scopes`, `redirect_uri`, and `extra`

The backend exposes shared helper methods in `backend/app/auth/external_accounts.py` for downstream integrations to:

- check whether a user has a linked account,
- retrieve granted scopes,
- retrieve decrypted access tokens for required scope sets.

### Testing-only helpers

| Parameter | Default | Description |
|---|---|---|
| `TESTING_ID` | _(unset)_ | Optional testing/admin helper identifier. |
| `TESTING_KEY` | _(unset)_ | Optional testing/admin helper key. |

### Email delivery and templates

| Parameter | Default | Description |
|---|---|---|
| `EMAIL_DELIVERY_MODE` | `local` | `local` or `external` SMTP mode. |
| `EMAIL_LOCAL_SENDMAIL` | `false` | Enables local sendmail behavior in local mode. |
| `EMAIL_DEBUG` | `false` | Enables email debug behavior/logging controls. |
| `EMAIL_LOGGER` | `false` | Enables mail logging adapter behavior. |
| `EMAIL_FROM_ADDRESS` | `noreply@basic-system-template.local` | Sender address. |
| `EMAIL_FROM_NAME` | `Basic System Template` | Sender display name. |
| `EMAIL_VERIFICATION_LINK_BASE_URL` | `http://localhost:5173/verify-email` | Frontend route base for verification links. |
| `EMAIL_VERIFICATION_TOKEN_SECRET` | _(unset)_ | Optional dedicated secret for verification tokens. |
| `EMAIL_VERIFICATION_TOKEN_TTL_SECONDS` | `86400` | Verification token TTL in seconds. Must be positive. |
| `EMAIL_INVITATION_LINK_BASE_URL` | `http://localhost:5173/accept-invite` | Frontend route base for invitation links. |
| `EMAIL_INVITATION_TTL_SECONDS` | `604800` | Invitation token TTL in seconds. Must be positive. |

### Local SMTP settings

| Parameter | Default | Description |
|---|---|---|
| `LOCAL_SMTP_HOST` | `localhost` | Local SMTP host. |
| `LOCAL_SMTP_PORT` | `1025` | Local SMTP port. Must be positive. |
| `LOCAL_SMTP_USE_STARTTLS` | `false` | Enables STARTTLS for local SMTP. |
| `LOCAL_SMTP_USE_SSL` | `false` | Enables implicit SSL for local SMTP. |

### External SMTP settings

| Parameter | Default | Description |
|---|---|---|
| `EXTERNAL_SMTP_HOST` | _(unset)_ | External SMTP host. Required when `EMAIL_DELIVERY_MODE=external`. |
| `EXTERNAL_SMTP_PORT` | `587` | External SMTP port. Must be positive. |
| `EXTERNAL_SMTP_USE_STARTTLS` | `true` | Enables STARTTLS for external SMTP. |
| `EXTERNAL_SMTP_USE_SSL` | `false` | Enables implicit SSL for external SMTP. |
| `EXTERNAL_SMTP_USERNAME` | _(unset)_ | Optional SMTP username. |
| `EXTERNAL_SMTP_PASSWORD` | _(unset)_ | Optional SMTP password. |
| `EMAIL_SMTP_TIMEOUT_SECONDS` | `10` | SMTP timeout in seconds. Must be positive. |

### DKIM signing settings

| Parameter | Default | Description |
|---|---|---|
| `EMAIL_DKIM_ENABLED` | `false` | Enables DKIM signing for outbound email. |
| `EMAIL_DKIM_DOMAIN_NAME` | _(unset)_ | DKIM domain. Required when DKIM is enabled. |
| `EMAIL_DKIM_KEY_SELECTOR` | _(unset)_ | DKIM selector. Required when DKIM is enabled. |
| `EMAIL_DKIM_PRIVATE_KEY` | _(unset)_ | Inline private key PEM content. |
| `EMAIL_DKIM_PRIVATE_KEY_PATH` | _(unset)_ | File path to private key PEM. |

### Frontend configuration

| Parameter | Default | Description |
|---|---|---|
| `VITE_API_BASE` | `http://localhost:8000/api/v1` | Frontend API base URL (configured in frontend env). |

### Validation/constraint notes

- In `APP_ENV=test` or `APP_ENV=production`, both JWT secrets must be set.
- If `TOKEN_TRANSPORT_MODE=cookie`, both `COOKIE_SECURE` and `COOKIE_SAME_SITE` are required.
- If `DATABASE_PROVIDER=mongodb`, resolved Mongo URL and DB name must be present.
- Unknown entries in `AUTH_PROVIDERS_ENABLED` fail startup validation.
- `LOCAL_SMTP_USE_SSL` and `LOCAL_SMTP_USE_STARTTLS` cannot both be true.
- `EXTERNAL_SMTP_USE_SSL` and `EXTERNAL_SMTP_USE_STARTTLS` cannot both be true.
- If `EMAIL_DKIM_ENABLED=true`, DKIM domain + selector + key material (inline or path) are required.

## Extend user profile properties

Profile properties are **server-defined built-ins** that can be enabled/required per app.

### 1) Configure enabled properties in backend env

Set `PROFILE_PROPERTIES` in `backend/.env`.

Semantics:

- `*` → enable all non-core built-in profile properties
- comma-separated keys (for example `organization,orcid`) → enable only those
- prefix with `!` (for example `!orcid`) → property is required at registration
- empty value (`PROFILE_PROPERTIES=`) → no extended profile properties enabled

Current built-in property keys:

- `orcid`
- `googleScholarUrl`
- `githubProfileUrl`
- `linkedInUrl`
- `researchGateUrl`
- `xUrl`
- `personalWebsiteUrl`
- `organization`
- `externalLinks`

Examples:

- Enable all: `PROFILE_PROPERTIES=*`
- Only org + ORCID required: `PROFILE_PROPERTIES=organization,!orcid`
- None: `PROFILE_PROPERTIES=`

### 2) Add a new built-in property type (optional)

To introduce a new profile property definition:

1. Add a `ProfilePropertyDefinition` entry in `backend/app/profile/catalog.py`.
2. Implement validation behavior there if it needs custom rules.
3. Enable it via `PROFILE_PROPERTIES`.

The frontend profile/admin pages consume the backend `profilePropertyCatalog`, so enabled properties render automatically.

---

## Extend settings pages (app-specific settings)

Use the settings extension registry in [frontend/src/extensions/settings-registry.tsx](frontend/src/extensions/settings-registry.tsx).

1. Create a new page component in `frontend/src/extensions/` (or your app module).
2. Add an item to `SETTINGS_EXTENSIONS` with:
   - `id`
   - `label`
   - `section` (`"settings"` or `"administration"`)
   - optional `isVisible(context)` guard
   - `render({ accessToken })`
3. Your page appears in the settings navigation automatically when visible.

This is the preferred place for app-specific settings so core settings routes stay clean and updatable.

---

## Pull template updates without overwriting local work

Use a dedicated upstream remote and sync branch strategy.

Best results are when your repo is created using the template workflow above and preserves shared ancestry expectations for sync.

### 1) Add template remote once

```bash
git remote add template <template-repo-url>
git fetch template
```

### 2) Sync in an integration branch

```bash
git checkout -b chore/template-sync-YYYYMMDD
git merge template/main
```

Resolve conflicts, run tests/build, then merge into your app branch.

### 3) Minimize future conflicts

- keep app-specific settings in `frontend/src/extensions/`
- prefer env/config toggles (for example `PROFILE_PROPERTIES`) over core rewrites
- isolate custom feature modules instead of editing shared base flows when possible

### 4) Alternative: cherry-pick selected core updates

If you only want specific upstream changes, cherry-pick commits from `template/main` instead of merging the full branch.

---

## Suggested workflow for downstream apps

1. Treat this repo as your baseline platform layer.
2. Add app features in clearly separated modules/extensions.
3. Periodically sync template updates into a dedicated branch.
4. Validate (`pytest`, frontend build), then merge.

This keeps your app moving fast while still benefiting from ongoing template improvements.
