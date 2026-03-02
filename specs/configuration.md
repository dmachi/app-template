# Configuration Specification

## 1) Goals
- Make template behavior environment-configurable
- Avoid code changes for provider enablement and operational defaults

## 2) Configuration Sources
Priority order:
1. Environment variables
2. Optional config file (YAML/JSON)
3. Built-in safe defaults

## 3) Core Settings

### Application
- `APP_NAME`
- `APP_ENV` (`development`, `test`, `production`)
- `APP_BASE_URL`

### API & Session
- `API_PREFIX` (default `/api/v1`)
- `AUTH_MODE` (`jwt` default)
- `JWT_ACCESS_TOKEN_SECRET`
- `JWT_ACCESS_TOKEN_TTL_SECONDS` (default `900`)
- `JWT_REFRESH_TOKEN_SECRET`
- `JWT_REFRESH_TOKEN_TTL_SECONDS` (default `604800`)
- `JWT_ISSUER` (optional)
- `JWT_AUDIENCE` (optional)
- `REFRESH_TOKEN_ROTATION_ENABLED` (bool, default true)
- `TOKEN_TRANSPORT_MODE` (`bearer-header` default; optional `cookie`)
- `COOKIE_SECURE` (required when `TOKEN_TRANSPORT_MODE=cookie`)
- `COOKIE_SAME_SITE` (required when `TOKEN_TRANSPORT_MODE=cookie`)
- `REFRESH_TOKEN_REQUEST_FIELD` (default `refreshToken` for `bearer-header` mode)

### Websocket / Events
- `WS_EVENTS_ENABLED` (bool, default true)
- `WS_EVENTS_PATH` (default `/api/v1/ws/events`)
- `WS_AUTH_MODE` (default `jwt-query`)
- `WS_CONNECTION_IDLE_TIMEOUT_SECONDS` (optional)
- `WS_MAX_CONNECTIONS_PER_USER` (optional)

### Database
- `DATABASE_PROVIDER` (`mongodb` default, configurable)
- `DATABASE_URL` (provider-agnostic canonical connection setting)
- `DATABASE_NAME` (provider-agnostic canonical database name)
- `DATABASE_AUTO_CREATE_INDEXES` (bool; env-specific)
- `DATABASE_LOG_LEVEL` (optional)

### MongoDB (Preferred Default)
- `MONGODB_URI` (MongoDB-specific override; preferred for mongodb provider)
- `MONGODB_DB_NAME` (MongoDB-specific override)
- `MONGODB_MIN_POOL_SIZE` (optional)
- `MONGODB_MAX_POOL_SIZE` (optional)

### SQL-Compatible Adapter (Optional/Future)
- `SQL_DATABASE_URL`
- `SQL_POOL_MIN` (optional)
- `SQL_POOL_MAX` (optional)

### Authentication
- `AUTH_PROVIDERS_ENABLED` (comma-separated; e.g., `local,uva-netbadge`)
- `AUTH_DEFAULT_PROVIDER` (optional)
- `AUTH_REGISTRATION_ENABLED` (bool)
- `AUTH_EMAIL_VERIFICATION_REQUIRED` (bool)

### External Auth Provider Mapping (Protocol-Agnostic)
- `AUTH_PROVIDER_ATTRIBUTE_MAP_JSON` (mapping provider fields -> normalized identity fields)
- `AUTH_PROVIDER_REQUIRED_ATTRIBUTES_JSON` (required attributes per provider)
- `AUTH_PROVIDER_METADATA_URLS_JSON` (metadata/discovery URLs per provider)
- `AUTH_PROVIDER_CLOCK_SKEW_SECONDS` (default tolerance for assertion/token time checks)

### Local Provider
- `LOCAL_AUTH_PASSWORD_MIN_LENGTH`
- `LOCAL_AUTH_REQUIRE_COMPLEXITY`
- `LOCAL_AUTH_LOGIN_RATE_LIMIT_PER_MINUTE`

### UVA NetBadge (Draft placeholders)
- `UVA_NETBADGE_ENABLED`
- `UVA_NETBADGE_PROTOCOL` (default `saml2`)
- `UVA_NETBADGE_IDP_METADATA_URL` (default `https://shibidp.its.virginia.edu/idp/shibboleth/uva-idp-metadata.xml`)
- `UVA_NETBADGE_SP_ENTITY_ID`
- `UVA_NETBADGE_ACS_URL`
- `UVA_NETBADGE_REQUIRED_ATTRIBUTES` (comma-separated required attributes)
- `UVA_NETBADGE_ATTRIBUTE_MAP` (mapping from provider attributes to normalized fields)

### Authorization / Admin
- `SUPERUSER_ROLE_NAME` (default `superuser`)
- `USER_MANAGEMENT_ROLES` (comma-separated; default `superuser`)

### Observability
- `LOG_LEVEL`
- `AUDIT_LOG_ENABLED`

### Notifications
- `NOTIFICATIONS_ENABLED` (bool, default true)
- `NOTIFICATIONS_EMAIL_FALLBACK_DELAY_SECONDS` (default `180`)
- `NOTIFICATIONS_FALLBACK_POLL_INTERVAL_SECONDS` (default `30`)
- `NOTIFICATIONS_DEFAULT_EMAIL_FALLBACK_ENABLED` (bool, default false)
- `NOTIFICATIONS_COMPLETION_CHECK_ENABLED` (bool, default true)
- `NOTIFICATIONS_COMPLETION_CHECK_MAX_RUNTIME_SECONDS` (optional)
- `NOTIFICATIONS_COMPLETION_CHECK_INITIAL_INTERVAL_SECONDS` (default `60`)
- `NOTIFICATIONS_COMPLETION_CHECK_MAX_INTERVAL_SECONDS` (default `86400`)
- `NOTIFICATIONS_COMPLETION_CHECK_DEPENDENCY_TRIGGER_ENABLED` (bool, default true)
- `NOTIFICATIONS_COMPLETION_CHECK_SKIP_UNCHANGED_DEPENDENCIES` (bool, default true)
- `NOTIFICATIONS_EMAIL_REDELIVERY_MAX_ATTEMPTS` (default `3`)
- `NOTIFICATIONS_EMAIL_REDELIVERY_BACKOFF_BASE_SECONDS` (default `86400`)
- `NOTIFICATIONS_EMAIL_REDELIVERY_BACKOFF_MULTIPLIER` (default `2`)
- `NOTIFICATIONS_EMAIL_REDELIVERY_MAX_INTERVAL_SECONDS` (default `1382400`)
- `NOTIFICATIONS_EMAIL_MIN_INTERVAL_PER_NOTIFICATION_SECONDS` (default `86400`)
- `NOTIFICATIONS_COMPLETED_RETENTION_HOURS` (default `48`)

### Profile Properties
- `PROFILE_PROPERTIES` (required semantics):
  - `*` enables all built-in non-core profile properties
  - comma-separated list enables only listed non-core keys
  - prefix a key with `!` (e.g., `!orcid`) to mark it required at registration
  - core properties are always enabled and may also be marked required with `!`

### Frontend CMS Routing
- `FRONTEND_CMS_RESOLVER_BLACKLIST_PATTERNS` (comma-separated wildcard patterns; paths that must never invoke alias resolver fallback)
  - Examples: `/api/*,/settings/*,/login,/register,/cms/*`
  - Applied by frontend default route handler before calling `/api/v1/cms/resolve`
  - Stored/managed with other frontend runtime config entries (frontend config module/settings files)

### Redis (Realtime Event Bus)
- `REDIS_URL`
- `REDIS_CHANNEL_NOTIFICATIONS` (default `notifications.events`)
- `REDIS_CHANNEL_SYSTEM_EVENTS` (optional)
- `REDIS_PUBLISH_RETRY_COUNT` (default `3`)
- `REDIS_PUBLISH_RETRY_DELAY_MS` (default `200`)

## 4) Validation Rules
- Startup must fail fast on missing required secrets/URLs in non-dev environments
- Unknown providers in `AUTH_PROVIDERS_ENABLED` must fail validation
- Timeout and rate-limit values must be bounded positive integers
- Unknown `DATABASE_PROVIDER` values must fail validation
- Provider-specific database settings must be validated based on selected `DATABASE_PROVIDER`
- JWT secrets and TTL values must be present/valid when `AUTH_MODE=jwt`
- Cookie settings must be validated when `TOKEN_TRANSPORT_MODE=cookie`
- For `DATABASE_PROVIDER=mongodb`, resolve connection settings with precedence: `MONGODB_URI`/`MONGODB_DB_NAME` then `DATABASE_URL`/`DATABASE_NAME`
- `USER_MANAGEMENT_ROLES` must always include configured superuser role value
- Notification fallback delay and poll interval must be bounded positive integers
- Notification completion-check initial/max intervals must be bounded positive integers, with max interval <= 86400 for MVP
- Dependency-trigger completion-check optimization flags must be valid booleans
- Notification redelivery attempt count and backoff settings must be bounded positive values
- Notification daily send cap per notification (`NOTIFICATIONS_EMAIL_MIN_INTERVAL_PER_NOTIFICATION_SECONDS`) must be >= 86400 for MVP
- When notifications/realtime events are enabled, `REDIS_URL` must be present
- `WS_AUTH_MODE` must be compatible with configured auth mode (JWT in MVP)
- `PROFILE_PROPERTIES` entries must map to known built-in property keys; unknown keys are ignored
- `FRONTEND_CMS_RESOLVER_BLACKLIST_PATTERNS` must parse as valid path wildcard patterns; invalid patterns fail frontend startup/config validation

## 5) Config Endpoint
- Provide read-only sanitized endpoint for frontend:
  - `GET /api/v1/meta/auth-providers`
  - Returns enabled provider metadata safe for client rendering
  - Must not expose secrets

## 6) Acceptance Criteria
- Switching enabled auth providers requires config change only
- Invalid configuration is reported at startup with actionable errors
- Frontend login options match backend-enabled providers
- Switching between supported database providers requires configuration changes only, not domain-layer code changes
