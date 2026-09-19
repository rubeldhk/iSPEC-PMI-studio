# Epic Closure: EPIC-024 — Artifact Access Control

**Closed**: 2026-08-21 | **Session label**: `EPIC-024 Artifact Access Control` (Constitution VIII)

## T435 — every implementation task has a passing unit test (Constitution V)

**CONFIRMED.** All suites green on 2026-08-21 (`backend-unit` + `backend-contract` +
`frontend`: 1241 tests / 168 files; the three Testcontainers integration files: 7 tests, real
PostgreSQL):

| Implementation task | Unit test task | Test file |
|---|---|---|
| T376 models | T372, T373 | `tests/unit/access/{grants,refusal}.spec.ts` |
| T377 grant/revoke + audit | T372, T826 | `tests/unit/access/{grants,grant-audit}.spec.ts` |
| T378 refuse–hide–record | T373 | `tests/unit/access/refusal.spec.ts` |
| T379 restriction inheritance | T374 | `tests/unit/access/inheritance.spec.ts` |
| T380 last-editor guarantee | T375 | `tests/unit/access/last-editor.spec.ts` |
| T381/T813 run snapshot, narrowed | T811 | `tests/unit/access/snapshot-scope.spec.ts` |
| T814 open-time evaluation | T812 | `tests/unit/access/session-visibility.spec.ts` |
| T816 restricted-not-omitted | T812 | `tests/unit/access/session-visibility.spec.ts` |
| T420 access controller | T418 / T419 | `tests/unit/access/access.controller.spec.ts` · `tests/contract/access.spec.ts` |
| T427 real-DB enforcement | — (integration) | `tests/integration/access-enforcement.spec.ts` (SC-007) |
| T428 concurrent last-editor | — (integration) | `tests/integration/last-editor.spec.ts` (SC-008, FOR UPDATE serialisation, 5 rounds) |
| T815 real-DB session visibility | — (integration) | `tests/integration/session-visibility.spec.ts` (SC-018) |
| T400 grant control | T399 | `frontend/tests/unit/components/AccessGrants.spec.tsx` |

## T436 — convergence

Assessed 2026-08-21 against spec.md, plan.md, and tasks.md in this session (the
`/speckit-converge` command was executed as an in-session convergence assessment):

- FR-ACC-021–028 + FR-ACC-028a each have an implementation site and citing tests.
- The two-layer rule holds: layer 1 (EPIC-004 workspace scoping) untouched; layer 2 refuses
  identically — absent, never forbidden. Gap **G-02.4** (endpoints existed in no
  implementation task) is closed by T420.
- The run snapshot is produced here (T381) onto the `Run` EPIC-023 defined — the corrected
  build order (EPIC-023 → 024) held.
- **No unbuilt work found.** No tasks appended.

## T437 — defect triage

`specs/024-artifact-access-control/defects/` contains no records (only `.gitkeep`).
**Nothing to triage; nothing deferred.**

## T438 — principle deltas and the closing report

Deltas hold: the refusal path records every attempt in the same operation as the refusal
(PP-016 explainability of refusals; SC-007/SC-013), and absence-over-forbidden (FR-ACC-024)
is asserted at unit, contract, and real-database levels. No deferrals were taken.

### Work completed

- 2 new tables (migration `20260821010000_epic024_access_control`) — grants with
  no-delete trigger, append-only attempt records.
- `backend/src/modules/access/` — grant service (audited, last-editor-guarded), enforcement
  (refuse–hide–record + restricted-not-omitted questions), inheritance
  (most-restrictive-wins, transitive), snapshot (run-scoped, with the T813 narrowing),
  open-time evaluation, Prisma store (transactional audit + `FOR UPDATE` serialisation),
  controller + module.
- `frontend/src/components/AccessGrants.tsx` + API client methods.
- 8 unit test files, 1 contract file, 3 Testcontainers integration files, 1 frontend
  test file — all passing.

### Work deferred

None. The `DERIVATION_GRAPH` token defaults to the in-memory graph; the traceability module
can supply a live implementation on the same token when product composition needs it — a
wiring choice, not unbuilt scope.

### Recommended next task

`/speckit-implement EPIC-025` — External Storage Publishing, the last of the three D-19
children.
