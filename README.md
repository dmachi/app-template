# Basic System Template

Milestone 4 partial implementation (backend profile/groups + frontend scaffold) aligned to `specs/`.

## Local Development (Default)

1. Create/update Conda environment:
   - `conda env create -f environment.yml` (first time)
   - `conda env update -f environment.yml --prune` (updates)
2. Activate env:
   - `conda activate template-framework`
3. Start backend dependencies:
   - `docker compose -f docker-compose.backend.yml up -d`
4. Run API from terminal:
   - `uvicorn app.main:app --app-dir backend --reload --host 0.0.0.0 --port 8000`
5. Run frontend dev server (Milestone 4 scaffold, React+TS+Tailwind):
   - `cd frontend`
   - `npm install`
   - `npm run dev`

## Superuser Initialization (Local Command)
- To initialize a brand-new system with a default superuser, run a local command that uses backend MongoDB configuration:
   - `cd backend`
   - `seed-superuser --username <username> --email <email> --password <strong-password> --display-name "System Superuser"`
- The command reads `MONGODB_URI`, `MONGODB_DB_NAME`, and `SUPERUSER_ROLE_NAME` via backend settings.
- Behavior is idempotent by username/email: existing user is updated and guaranteed to include the superuser role.
- Runtime API authentication and group endpoints use MongoDB-backed persistence in non-test environments.

## Full-Stack Compose
- `docker compose up --build`
- If `docker-compose.backend.yml` is already running, stop it first to avoid host port conflicts:
   - `docker compose -f docker-compose.backend.yml down`

## Development Full-Container Variant
- `docker compose -f docker-compose.dev.yml up --build`
- This variant keeps MongoDB/Redis internal-only (no host port binding) to reduce local port collisions.

## Tests
- `pytest backend/tests -q`
- Frontend Playwright flows are specified in `specs/testing.md` and are planned for implementation in a later milestone.
- Playwright scaffold commands:
   - `cd frontend && npx playwright install`
   - `cd frontend && npm run test:e2e`
