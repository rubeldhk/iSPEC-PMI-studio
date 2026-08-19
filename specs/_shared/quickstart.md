# Quickstart & Validation Guide: PMI Studio Phase 1

**Epic**: `EPIC-001` | **Date**: 2026-08-02 | **Plan**: [plan.md](./plan.md)

How to run the platform and prove Phase 1 works end to end. This is a validation guide — the code
behind it is produced by `/speckit-implement`, never by hand (Constitution I).

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js 22 LTS + pnpm | Monorepo tooling |
| Docker | PostgreSQL, Redis, and the engine sandbox (research R-006) |
| PostgreSQL 16 + Redis | Via `docker compose`; not installed on the host |
| AI provider credentials | **Only** for the real-engine smoke test. Every other check runs against the fixture adapter |

Nothing here requires a Spec Kit installation on your machine — the `specify` CLI and AI agent CLI
live inside the engine container image.

## Setup

```bash
pnpm install
docker compose up -d postgres redis
pnpm --filter backend prisma migrate dev
pnpm --filter backend seed          # one workspace, one user
pnpm dev                             # api :3000, worker, web :5173
```

## Test suite

```bash
pnpm test:unit          # Vitest — MANDATORY per Constitution V, must be green
pnpm test:contract      # API contract (contracts/platform-api.md)
pnpm test:engine        # Engine contract suite, run against EVERY adapter
pnpm test:integration   # Testcontainers: real PostgreSQL + Redis
pnpm test:arch          # FAILS if backend/ references Spec Kit (research R-009)
pnpm test:e2e           # Playwright end-to-end journey
```

`pnpm test:arch` deserves attention: it is the mechanism that keeps the SRS's central architectural
claim true. If it fails, engine-independence has been broken, regardless of whether anything else
still passes.

---

## Validation scenarios

Each maps to a user story and its acceptance scenarios in [spec.md](./platform-spec.md).

### V1 — Workspace and project (US1)

1. Sign in as the seeded user.
2. Create a project with a name and description.
3. Sign out, sign back in — the project is present, attributed to the correct owner and workspace.
4. Create a second project; confirm neither shows the other's content.

**Expected**: Project persists with correct attribution. No cross-project leakage.
**Proves**: FR-001, FR-002, FR-003

### V2 — Workspace isolation (US1, negative)

1. Note a project id from workspace A.
2. Sign in as a user of workspace B; request that id directly.

**Expected**: **404, not 403** — existence is not disclosed. The refusal appears in `/audit`.
**Proves**: FR-002, FR-023, SC-004

### V3 — Requirement register (US2)

1. Add requirements of differing types and priorities.
2. Edit one; view its version history.
3. Retire another.
4. Attempt to save one with an empty description.
5. Filter by type, then by priority.

**Expected**: Prior text retrievable after edit. Retired requirement still present, marked retired.
Empty description refused **naming `description`**. Filters return only matches.
**Proves**: FR-004 to FR-009

### V4 — Generate a specification (US3) 🎯 core loop

1. Select several requirements; start generation.
2. Confirm the response is `202` with a job, and the UI stays usable while it runs.
3. Poll the job to completion.
4. Open the resulting specification.

**Expected**: Specification created and linked to **every** selected requirement. Engine name and
version recorded. No orphan.
**Proves**: FR-010, FR-022, FR-028, FR-029, SC-002

> **Time this run.** V1 → V3 → V4 performed by someone who has not used the platform before, with no
> assistance, is the measurement for **SC-001** (sign-in to a generated specification in under 15
> minutes). Record the elapsed time; a run over 15 minutes is a failed acceptance criterion, not a
> slow tester.

### V5 — Generation failure handling (US3, negative)

Run each against the fixture adapter configured to fail:

| Trigger | Expected `failureReason` |
|---------|--------------------------|
| Engine unreachable | `engine_unavailable` |
| Engine errors mid-run | `engine_error` |
| Unparseable output | `malformed_output` |
| Empty output | `empty_output` — **not** an empty specification |
| Exceeds time limit | `timeout` |
| Cancelled by user | `cancelled` |
| Zero requirements selected | `empty_selection` |

**Expected**: Every failure names a specific reason. **No partial specification stored in any case.**
Platform state unchanged from before the request.
**Proves**: FR-024 to FR-027, SC-005, SC-006

### V6 — Lifecycle and versioning (US5)

Six states per SRS M08 §8 (decision D-14).

1. Take a specification `draft → review → approved → baselined → implemented`.
2. Reject one from `review` back to `draft`.
3. Edit the approved specification; retrieve the previously approved version; diff the two.
4. Attempt `approved → draft`.
5. **Edit a baselined specification.**
6. Archive from `baselined`; then attempt to archive from `draft`.

**Expected**: Each transition recorded with actor and time. Approved version retrievable
**unchanged** after the edit. `approved → draft` refused, naming the permitted set
(`baselined`, `archived`). **Editing a baseline forks a new version in `draft` and leaves the
baseline unchanged.** Archiving retains the specification and its traceability links; archiving from
`draft` is refused.
**Proves**: FR-011, FR-011a, FR-011b, FR-013, FR-014, FR-015, SC-007

### V7 — Validation before approval (US6)

1. Validate a deliberately incomplete specification.
2. Attempt approval with findings outstanding.

**Expected**: Findings returned, **each carrying a location**. Outstanding findings shown before
approval proceeds.
**Proves**: FR-023

### V8 — Generate tasks (US4)

1. Attempt task generation on a `draft` specification.
2. Approve it, then generate tasks.
3. Update a task's status; check project progress.
4. Regenerate tasks.

**Expected**: Draft attempt refused stating approval is required. Tasks linked to the specification.
Regeneration warns before replacing anything.
**Proves**: FR-020, FR-012, SC-003

### V9 — Traceability both ways (US7)

1. From a task, navigate to its specification and originating requirements.
2. From a requirement, list everything derived from it.
3. View project coverage.
4. Retire a requirement that has derived artifacts; view traceability again.

**Expected**: Both directions resolve. Requirements with no specification appear as uncovered. Links
from retired requirements are **shown and flagged**, not omitted.
**Proves**: FR-029 to FR-031, SC-010

### V10 — Requirement change flags the specification (US3 scenario 6)

1. Edit a requirement that a specification was generated from.
2. View that specification.

**Expected**: Flagged **out of date**. Content **not** altered, nothing regenerated automatically.
**Proves**: FR-032

### V11 — Engine independence (US8) 🎯 the architectural proof

1. Confirm the fixture adapter is registered alongside Spec Kit.
2. Switch a project to the fixture engine.
3. Generate a specification; confirm it succeeds and records the fixture as producer.
4. Run `pnpm test:arch`.
5. Register an adapter declaring only two of the three required capabilities.

**Expected**: Generation succeeds against either engine with no behavioural difference outside the
adapter layer. `test:arch` passes, proving `backend/` contains no Spec Kit reference. The incomplete
adapter is **refused, naming the missing capability**.
**Proves**: FR-016 to FR-019, FR-021, SC-008

### V11a — Observability across the sandbox boundary (PP-010, D-7)

1. Trigger a generation job and note its correlation identifier from the API response.
2. Find that identifier in the API log, the worker log, and the job's trace.
3. Inspect logs for the run.

**Expected**: One correlation identifier spans API → queue → worker → sandbox. Job metrics record
duration and terminal state. **No engine output and no credential appears in any log.** The sandbox
itself emits nothing — the worker records on its behalf, so the egress allow-list is unchanged.
**Proves**: PP-010, research R-011, `system-design.md` PC-3

### V12 — Audit completeness (FR-033)

1. Perform a create, an edit, a lifecycle transition, a generation, and a refused cross-workspace access.
2. Read `/audit`.

**Expected**: All five present with actor, target, outcome, timestamp. **No write or delete path to
audit exists.**
**Proves**: FR-033, SC-012

### V13 — Real engine smoke test (nightly, not per-commit)

Requires AI provider credentials.

1. Switch a project to the Spec Kit engine.
2. Generate a specification from real requirements.

**Expected**: The sandbox scaffolds a workspace, runs the AI agent headlessly, returns parseable
output, and destroys the workspace. **No container, process, or temp directory survives.**
**Proves**: research R-001 and R-006 hold against the real engine.

> Kept out of the per-commit suite deliberately: it is slow, costs money, and is non-deterministic.
> Everything else runs against the fixture adapter (research R-010).

---

## Definition of done for this Epic

Per [spec.md](./platform-spec.md) Epic Exit Criteria and Constitution IV–VII:

- [ ] V1–V12 pass; V13 passes on at least one nightly run
- [ ] `pnpm test:unit` green — every implementation task has a passing unit test (Constitution V)
- [ ] `pnpm test:arch` green — engine-independence intact
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] **Every** `specs/*/defects/` folder has no open records (all 15 epics)
- [ ] Promotion follows `local → dev → stage → prod`, no environment skipped
