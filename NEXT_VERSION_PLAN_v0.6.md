# v0.6 Optimization Plan (from v0.5.1)

## Goal
Build a production-ready "Judge Database + Trend Analysis" baseline on top of v0.5.1, with stable API contracts, stronger test depth, and lower operational risk.

## Current Baseline (v0.5.1)
- CI scripts (`lint`, `test:run`, `build`) are available and runnable.
- PostgreSQL-backed judicial routes are online.
- RAG supports session-based multi-turn context and citations.
- Unit tests pass, but several tests are smoke-level and do not validate core business behavior deeply.

## Key Gaps to Close in v0.6

### 1) Data Access and DB Reliability (P0)
- Problem:
  - Judicial routes create and close a new `Pool` per request, increasing connection overhead and failure surface under traffic.
- Actions:
  1. Add shared DB client module (`backend/src/db/pg.js`) with singleton pool.
  2. Move SQL from route layer into repository/service layer.
  3. Add request-level timeout and structured DB error mapping.
  4. Add migration scripts for indexes on query-heavy fields (`jdate`, `jtitle`, `jcase`).
- Done Criteria:
  - No per-request pool creation in routes.
  - API latency p95 improves for `/api/judicial/search` and `/api/judicial/cases`.
  - SQL timeout/error behavior is deterministic and tested.

### 2) API Contract Hardening (P0)
- Problem:
  - `/api/judicial/changelog` and `/api/judicial/auth` are temporary stubs.
  - Response envelope consistency is partially implemented, not centrally enforced.
- Actions:
  1. Define API response standard (`status`, `data`, `error`, `meta`) in one helper.
  2. Replace stub endpoints with either:
     - real implementation, or
     - explicit `501 Not Implemented` + roadmap message.
  3. Add request validation (query/body schema) using a validator (e.g. zod/joi).
- Done Criteria:
  - All judicial endpoints follow one response schema.
  - No silent stub behavior in production paths.
  - Invalid inputs always return 4xx with consistent error body.

### 3) Test Strategy Upgrade (P0)
- Problem:
  - `services.test.js` mostly checks module loading.
  - Unit/integration boundaries are unclear.
- Actions:
  1. Split tests into:
     - pure unit tests for service logic (mock DB),
     - integration tests for routes against test DB schema.
  2. Add deterministic fixtures and seed scripts for PostgreSQL tests.
  3. Enforce minimum coverage threshold for backend critical modules.
- Done Criteria:
  - Route tests validate business outputs (not only status code).
  - Coverage gate exists in CI for backend services/routes.
  - Failing DB conditions and edge cases are tested.

### 4) RAG Quality and State Persistence (P1)
- Problem:
  - Conversation memory is in-process `Map`; restart loses state.
  - Retrieval uses mixed data source (DB routes + mock legal sources) with weak ranking control.
- Actions:
  1. Persist conversation history into Redis or PostgreSQL table (`rag_sessions`, `rag_messages`).
  2. Add retrieval policy config:
     - top-k, rerank toggle, context token budget.
  3. Introduce prompt versioning and basic answer evaluation set.
- Done Criteria:
  - Session survives process restart.
  - Retrieval parameters are configurable by env.
  - Regression test exists for representative legal questions.

### 5) Observability and Ops Readiness (P1)
- Problem:
  - Current logs are debug-oriented and unstructured.
  - No clear runtime health signal beyond simple endpoint checks.
- Actions:
  1. Replace ad-hoc logs with structured logger (request id, route, duration, error code).
  2. Add `/health` + `/ready` separation.
  3. Add basic metrics (request count, error rate, p95 latency).
- Done Criteria:
  - Logs are queryable by key fields.
  - Readiness reflects DB reachability.
  - A simple dashboard/alert rule is defined.

### 6) Security and Config Hygiene (P1)
- Problem:
  - Sensitive behavior depends heavily on runtime env but lacks strict startup validation.
- Actions:
  1. Add environment schema validation at startup.
  2. Enforce redaction for secrets in logs.
  3. Add dependency vulnerability check in CI.
- Done Criteria:
  - Service fails fast on missing required env.
  - No secret value appears in logs.
  - Security scan runs in CI.

## Suggested Sprint Breakdown (7 Working Days)

### Day 1-2
- P0-1 DB singleton + repository extraction
- P0-2 API response helper and validation scaffold

### Day 3-4
- P0-3 Test split + fixtures + coverage gate
- Replace/retire stub endpoints (`changelog`, `auth`)

### Day 5
- P1-4 RAG session persistence MVP

### Day 6
- P1-5 Structured logging + `/ready`

### Day 7
- P1-6 Env validation + dependency scan
- Release prep (`CHANGELOG`, `RELEASE`, tag)

## Release Gate for v0.6
- CI green on `lint`, unit, integration, coverage gate.
- No stub endpoint exposed as production feature.
- DB connection handling refactored to singleton pool.
- RAG session data persistence enabled.
- Release notes and migration notes finalized.
