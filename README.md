# Basic System Template

Milestone 1 foundation implementation aligned to `specs/`.

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
5. (Frontend implementation phase) run frontend dev server from terminal.

## Full-Stack Compose
- `docker compose up --build`

## Development Full-Container Variant
- `docker compose -f docker-compose.dev.yml up --build`

## Tests
- `pytest backend/tests -q`
