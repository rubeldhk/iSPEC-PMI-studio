# Closure record: EPIC-007 Requirement Intelligence

**Date**: 2026-08-20 · **Session**: `/speckit-implement EPIC-005 EPIC-006 EPIC-007` (Constitution
VIII label; branch `main`, stated here) · **Released by**: PMI-DOC-004 v1.0 (**BR-0020,
BR-0021**), scope ruling T-106, 2026-08-20.

The head of the traceability chain. AI-assisted analysis (the amendment's Requirement Intelligence
Engine) remains Phase 2 and out of scope — this epic keeps its identifier and its CRUD scope per
decision D-33; the name collision is recorded there, not here.

## `T185` — every implementation task has a passing unit test (Constitution V)

**20 of 20 tasks complete; tests observed RED first** (5 unit files, import-failure red, exit 1,
before any `requirements/*` source existed).

| Implementation task | Paired test | Result |
|---|---|---|
| T064 `Requirement` + `RequirementVersion` models + migration | T059/T062 + `schema-constraints.spec.ts` register block | pass |
| T065 validation rules | T059 `requirements.service.spec.ts` (10) | pass |
| T066 register service | T059 + T062 `requirement-filters.spec.ts` (9) | pass |
| T067 append-only history | T060 `requirement-versions.spec.ts` (7) | pass |
| T458 database trigger | **T457 `requirement-version-immutability.spec.ts` (6) — EXECUTED, see below** | pass |
| T068 retirement | T061 `requirement-retire.spec.ts` (5) | pass |
| T069 content hash | T068a `requirement-hash.spec.ts` (7) | pass |
| T070 controller | T069a `requirements.controller.spec.ts` (6) | pass |
| T071 register page | T070a `Requirements.spec.tsx` (5) | pass |
| T072 editor + history view | T071a `RequirementEditor.spec.tsx` (6) | pass |
| — contract | T063 `requirements.spec.ts` (13) | pass |

## `T457` ran against a real database — not merely written

The task was specified as "write failing integration test"; this session went further because a
Docker daemon is reachable on this machine (28.3.3, the same runtime EPIC-004's T649 retired RAID
R-04 with). All migrations applied in `prisma migrate deploy` order to PostgreSQL 16 via
Testcontainers:

```text
pnpm test:integration
✓ tests/integration/requirement-version-immutability.spec.ts (6 tests) 20801ms
Test Files  6 passed (6) · Tests  49 passed (49)
```

| Case | Result |
|---|---|
| migrations applied; probe version row held | pass |
| raw `UPDATE` rejected by the database | pass |
| raw `DELETE` rejected by the database | pass |
| prior text retrievable and UNALTERED after both | pass |
| `INSERT` still permitted — append-only, not read-only | pass |
| `requirements` CHECK rejects an empty description (FR-007 at the database) | pass |

`reject_mutation()` was **attached to, not redefined** (T458's constraint) — the trigger migration
contains no `CREATE FUNCTION`. The sixth case of EPIC-004's T453 promised the function would be
there for this epic to attach to; it was.

## `T186` — convergence

Performed within this run per the `speckit-converge` method. **No unbuilt work found in scope.**
Findings:

- **F1 — the FR-032 seam is delivered exactly as far as specified.** `requirementContentHash`
  normalises whitespace, preserves case, and length-delimits fields (no concatenation collisions).
  Nothing *consumes* it yet — that is EPIC-008 F-04.7 by design, recorded in plan.md as "the one
  function in this epic with no user-visible behaviour".
- **F2 — the 2026-08-03 analysis finding F1 (4 of 6 owned requirements cited by no task) is
  closed by delivery**: FR-004 (T066 create/edit/list + T068 retire), FR-005 (reference/type/
  priority on the model, T064–T066), FR-007 (T065 naming refusal, plus the database CHECK),
  FR-008 (T062/T064 filters + indexes). FR-006 (T068) and FR-009 (T067/T457/T458) were already
  cited.
- **F3 — composition seam**, identical to the sibling epics: stores default in-memory; Prisma
  stores built and exported; owner EPIC-014 F-11.2.

**Definition of done**: editing preserves prior text as retrievable history — T060 and T457 at
both layers; retiring keeps derived artifacts traceable — T061's link-target case; **Quickstart
V3 has not run end-to-end** (composed runtime) — deferred to EPIC-014 F-11.2 with V1/V2/V12.

## `T187` — defect triage

`specs/007-requirement-intelligence/defects/` contains no records (only `.gitkeep`). **0 open.**

## `T188` — closing report

### Work Completed

- `backend/prisma/schema.prisma` + migration `20260820000200_epic007_requirements` — three enums,
  two tables, FR-008 indexes, two CHECK constraints, the `requirement_versions_immutable` trigger
  (executed against PostgreSQL 16, see T457).
- `backend/src/modules/requirements/` — `requirement.validation.ts` (all failures named in one
  refusal, filter values validated like input), `requirements.service.ts` (create with generated
  `REQ-###` references, edit appending prior state FIRST, tenancy guard wired per EPIC-004 F2),
  `requirement-version.service.ts` (append-only by construction — no update/delete exists to
  call), `requirement-retire.service.ts` (mark, never delete; idempotent), `requirement-hash.ts`,
  `requirements.controller.ts`, `requirements.module.ts`.
- `frontend/src/pages/Requirements.tsx` (register with API-side filtering; retired flagged, never
  hidden), `frontend/src/components/RequirementEditor.tsx` (client and server refusals render the
  same named-field message; history newest-first, read-only).
- API client extended with the six requirement operations.

### Not verified

- Quickstart **V3** end-to-end — composed runtime; owner EPIC-014 F-11.2.
- No real HTTP request has hit `/v1/requirements` — same seam; every layer below verified,
  including the database's own refusals.

### Deferred (owners per D-6)

| Item | Owner | Awaiting |
|---|---|---|
| Composition-root swap: `REQUIREMENT_STORE` / `REQUIREMENT_VERSION_STORE` → Prisma; `onRefused` → audit | EPIC-014 F-11.2 | first composed environment |
| Quickstart V3 | EPIC-014 F-11.2 | same |
| Consuming `contentHash` for out-of-date flagging | EPIC-008 F-04.7 | by design |
| AI-assisted requirement analysis | Phase 2 (D-33) | out of scope by declaration |

### Epic Exit Criteria

- [x] Every implementation task has a passing unit test (T185)
- [x] Convergence reports no unbuilt work in scope (T186)
- [x] `defects/` contains no open records (T187)
- [x] Principle deltas hold (none declared); deferrals have valid owners (T188)
- [x] Closure recorded — this document; **EPIC-007 is CLOSED and release-eligible**
- [ ] Platform promotion — EPIC-014 F-11.2's

### Recommended Next Task

**`/speckit-implement EPIC-008`** — Specification Authoring & Generation. It is the direct
consumer of everything closed today: projects as the container, requirements as the input, the
content hash as its out-of-date signal, and the generation-job layer EPIC-001 already built.
