# CI/CD Specification (MVP)

## 1) Purpose
Define the minimum continuous integration and delivery requirements for this template, with quality gates aligned to backend API and Playwright frontend test standards.

## 2) CI Platform
- Primary CI platform: GitHub Actions
- Pipelines run on pull requests and main branch pushes

## 3) Required Workflows

### 3.1 Pull Request Validation (required)
Trigger:
- Pull requests targeting protected branches (e.g., `main`)

Required jobs:
1. **Static checks**
   - Python lint/type checks for FastAPI backend
   - Frontend lint/type checks for React/TypeScript
2. **Backend tests**
   - Run `pytest` suite
   - Must include API endpoint and privileged-role authorization tests
3. **Playwright critical browser suite**
   - Run critical end-to-end/browser flows:
     - login/logout
     - protected-route handling
     - token refresh + forced logout behavior
     - header/menu auth-state rendering

Quality gate:
- All required jobs must pass before merge

### 3.2 Main Branch Validation (required)
Trigger:
- Pushes to `main`

Required jobs:
- Re-run PR validation suite
- Publish test artifacts and summaries

### 3.3 Nightly/Extended Validation (recommended)
Trigger:
- Scheduled run (nightly)

Recommended jobs:
- Extended Playwright suite (cross-browser where configured)
- Longer-running integration checks

## 4) Environment and Secrets Policy
- CI must use environment-specific secrets storage (GitHub encrypted secrets)
- No plaintext secrets in repository or workflow files
- Test secrets must be non-production and scoped to CI usage only

## 5) Data and Isolation Requirements
- Backend tests run against isolated test database/collections
- Tests must create and tear down deterministic fixtures
- CI runs must not depend on shared mutable state

## 6) Artifacts and Reporting
- Always upload backend test results (e.g., JUnit XML) on failure
- Always upload Playwright artifacts (trace, screenshots/video where enabled) on failure
- Provide job summary with:
  - total tests
  - passed/failed counts
  - duration

## 7) Merge Protection Requirements
Protected branch rules should require:
- `ci/static-checks`
- `ci/backend-tests`
- `ci/playwright-critical`

Optional additional required status (phase 2):
- `ci/nightly-extended` (advisory in MVP)

## 8) Deployment Guardrails (MVP)
- Deployment jobs must only run after required CI jobs pass
- Production deployments require manual approval gate
- Tag or release metadata must reference commit SHA and CI run id

## 9) Failure and Retry Policy
- Flaky tests should be tracked and remediated; avoid masking with blanket retries
- Limited targeted retry is acceptable for known transient infrastructure/network failures
- Persistent failures block merge until resolved

## 10) Acceptance Criteria
- Pull requests are blocked when backend or Playwright critical tests fail
- CI artifacts are sufficient to debug failing tests
- Branch protection enforces required CI status checks
- Main branch remains releasable after each successful merge
