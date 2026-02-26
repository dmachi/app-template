# Development Environment and Workflow Specification

## 1) Purpose
Define local development patterns that are separate from production implementation details, including Docker Compose usage and local Conda workflow.

## 2) Local Development Principles
- Prefer fast local iteration for API and frontend code
- Run stateful dependencies in containers
- Run API/frontend processes directly in terminal for easier debugging and hot reload
- Keep local environment reproducible via documented commands

## 3) Required Docker Compose Files
Implementation must include these three Compose files:

### A) Complete System Compose
- File: `docker-compose.yml`
- Purpose: run the full stack in containers (backend API, frontend, MongoDB, Redis, and any required support services)
- Primary use: integrated smoke testing and full-stack local parity checks

### B) Backend Dependencies Compose
- File: `docker-compose.backend.yml`
- Purpose: run backend infrastructure only (at minimum MongoDB + Redis; add other backend support services as required)
- Primary use: day-to-day local development
- Expected workflow: start dependencies with Compose, then run FastAPI and frontend dev servers from terminal

### C) Development Full-Container Variant
- File: `docker-compose.dev.yml`
- Purpose: optional development-oriented full stack variant (debug-friendly config, mounts, dev env vars)
- Primary use: troubleshooting parity issues when terminal-run workflow differs from containerized runtime

## 4) Default Local Workflow (Required)
1. Start backend dependencies:
   - `docker compose -f docker-compose.backend.yml up -d`
2. Activate Conda environment (see section 5)
3. Run backend API in terminal (FastAPI dev server)
4. Run frontend dev server in terminal
5. Stop dependencies when done:
   - `docker compose -f docker-compose.backend.yml down`

## 5) Conda Environment Standard
- Local development uses a Conda environment as the default Python environment
- Repository should include either:
  - `environment.yml` (preferred), or
  - documented `conda create` command with pinned Python version
- FastAPI/backend Python tooling (pytest, linters, etc.) must run inside this Conda env

Recommended baseline metadata in environment definition:
- Environment name: project-scoped (e.g., `basic-system-template-dev`)
- Python version: project-pinned (e.g., `3.11`)
- Core packages: FastAPI stack, testing tooling, lint/type tooling used by CI

## 6) Compose and App Configuration Expectations
- Compose files must externalize credentials/secrets through `.env` or environment injection
- Service names and ports should be consistent across compose variants
- Backend app config should support connecting to containerized dependencies when running API in terminal
- Health checks should be defined for stateful services where practical

## 7) Documentation Expectations
The implementation repository should include concise developer commands for:
- Creating/updating Conda env
- Starting/stopping dependency containers
- Running backend API locally
- Running frontend locally
- Running backend tests and Playwright tests locally

## 8) Acceptance Criteria
- All three compose files exist and are functional for intended purpose
- Default local workflow works with `docker-compose.backend.yml` + terminal-run backend/frontend
- Conda environment setup is documented and reproducible
- Developers can bootstrap local dev environment with minimal manual configuration
