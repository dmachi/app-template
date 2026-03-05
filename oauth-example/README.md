# oauth-example

Standalone external-app demo for verifying the template OAuth/OIDC provider.

## What it demonstrates

- OpenID discovery lookup
- Authorization Code + PKCE browser redirect flow
- Token exchange at `/oauth/token`
- UserInfo call
- Refresh token flow
- Introspection and revocation
- OIDC end-session redirect

## Default ports

- Template frontend: `5173`
- oauth-example (this app): `5174`
- Template backend/API: `8000`

## Prerequisites

1. Start backend API (`http://localhost:8000`).
2. Create an OAuth client in admin:
   - Navigate to `Settings -> Administration -> OAuth Clients`
   - Add redirect URI: `http://localhost:5174/callback.html`
   - Include scopes: `openid profile email`
   - Use auth method: `none` (public PKCE client)
3. Copy generated `clientId`.

If you want to test refresh tokens, additionally allow `offline_access` in the client and add it to the demo scope field.

Scope input in the demo accepts commas or spaces and is normalized before authorization (for example `openid,profile,email` and `openid profile email` are equivalent).

## Run locally (no docker)

From `oauth-example`, serve static files on `5174` using any static file server. Example with Python:

```bash
cd oauth-example
python -m http.server 5174
```

Then open:

`http://localhost:5174/index.html`

## Run with docker compose

From repo root:

```bash
docker compose -f docker-compose.oauth-example.yml up --build
```

Then open:

`http://localhost:5174/index.html`

## OAuth flow notes

- The provider now supports redirecting unauthenticated `/oauth/authorize` requests to `/oauth/login`.
- Successful provider login sets a secure HttpOnly session cookie for authorize continuation.
- End-session clears the provider OAuth session cookie.