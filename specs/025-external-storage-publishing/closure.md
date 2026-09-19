# Epic Closure: EPIC-025 — External Storage Publishing

**Closed**: 2026-08-21 | **Session label**: `EPIC-025 External Storage Publishing` (Constitution VIII)

## T439 — SRS back-fill confirmation (Constitution II)

**CONFIRMED.** `SRS/PMI-DOC-004_Business_Requirement_Specification_v1.0.md` **BR-0063**
("Approved artifacts MUST be publishable to external storage under the same access rules that
governed them internally" → EPIC-025, approved 2026-08-20) is the business source for
`FR-PUB-029`–`FR-PUB-040`. The approval gate was honoured before implementation.

## T440 — every implementation task has a passing unit test (Constitution V)

**CONFIRMED.** All suites green on 2026-08-21 (`backend-unit` + `backend-contract` +
`architecture` + `storage-adapters` + `frontend`: 1366 tests / 190 files; the two new
integration files: 3 tests):

| Implementation task | Unit test task | Test file |
|---|---|---|
| T388 models | T382, T387, T817 | `tests/unit/storage/{connection,provider-switch,publish-record}.spec.ts` |
| T389 storage contract | T383 | `packages/storage-contract` + `tests/unit/storage/capability-refusal.spec.ts` |
| T390 connection lifecycle | T382 | `tests/unit/storage/connection.spec.ts` |
| T391/T392/T819 publish pipeline | T817, T818, T385 | `tests/unit/storage/{publish-record,publish-scope,publish-access}.spec.ts` |
| T393 failure taxonomy | T384 | `tests/unit/storage/publish-failures.spec.ts` |
| T394 preview + prevention | T386, T424 / T429 | `tests/unit/storage/{republish,publish.controller}.spec.ts` · `tests/integration/publish-concurrency.spec.ts` |
| T395 provider switch | T387, T451 | `tests/unit/storage/{provider-switch,disconnect-retention}.spec.ts` |
| T448 token refresh | T447 | `tests/unit/storage/token-refresh.spec.ts` |
| T450 token non-exposure | T449 | `tests/unit/storage/token-exposure.spec.ts` |
| T396 fixture provider | T382, T384, T431 | `packages/storage-adapters/fixture/tests/conformance.spec.ts` |
| T423 connections controller | T421 / T422 | `tests/unit/storage/connections.controller.spec.ts` · `tests/contract/storage-connections.spec.ts` |
| T426 publish controller | T424 / T425 | `tests/unit/storage/publish.controller.spec.ts` · `tests/contract/publish.spec.ts` |
| T430 conformance suite | T431 | `packages/storage-contract/tests/conformance/storage-conformance.suite.ts` (SC-01..SC-08) |
| T432 architecture test | — (is itself the test) | `tests/architecture/storage-independence.spec.ts` |
| T820 500-artifact publish | — (integration) | `tests/integration/publish-scale.spec.ts` (SC-017) |
| T821 external deletion | — | `tests/unit/storage/external-deletion.spec.ts` (SC-012) |
| T402 connections page | T401 | `frontend/tests/unit/pages/StorageConnections.spec.tsx` |

## T441 — convergence

Assessed 2026-08-21 against spec.md, plan.md, and tasks.md in this session (the
`/speckit-converge` command was executed as an in-session convergence assessment):

- FR-PUB-029–040 + 029a/029b each have an implementation site and citing tests; SC-009,
  SC-010, SC-011, SC-012, SC-014, and the publish half of SC-017 are asserted by name.
- Gaps **G-02.2** (contract), **G-02.4** (endpoints), and **G-02.5** (fixture + conformance)
  are closed: the storage contract exists, the endpoints are implemented and
  contract-tested, and the fixture provider passes the full conformance suite.
- One design correction made during implementation: the republish preview takes PRESENCE
  from `listDestination` but VERSIONS from the platform's own `PublishedFileReference`
  rows — asking the provider what a version means would be the read-back S4 forbids.
- **No unbuilt work found.** No tasks appended.

## T442 — defect triage

`specs/025-external-storage-publishing/defects/` contains no records (only `.gitkeep`).
**Nothing to triage; nothing deferred.**

## T443 — principle deltas and the closing report

PP-015 (provider interchangeability) is now enforced by a build-failing architecture test
(T432) exactly as engine independence is; SC-011 is testable because a second provider (the
fixture) passes the same conformance suite any real provider must. No deferrals were taken.

### Work completed

- `packages/storage-contract` — the provider contract (T389) + the 8-case conformance
  suite (T430); `packages/storage-adapters/fixture` — the fixture provider with injectable
  failures (T396), conformant (T431).
- 3 new tables (migration `20260821020000_epic025_storage_publishing`) with no-delete
  triggers on publish records and file references.
- `backend/src/modules/storage/` — connection lifecycle + health, token refresh +
  encryption-at-rest + discard-on-disconnect, whole-project publish pipeline with
  access-aware exclusion and the closed failure taxonomy, republish preview, advisory-lock
  concurrency prevention (in-memory + PostgreSQL), provider switch + external-change
  staleness, two controllers, module wiring.
- `frontend/src/pages/StorageConnections.tsx` + API client methods.
- 14 backend unit test files, 2 contract files, 2 integration files, 1 architecture file,
  1 adapter conformance file, 1 frontend test file — all passing.

### Work deferred

None. Real provider adapters (beyond the fixture) are future integrations by design — the
contract, conformance suite, and registry token are the landing pad (SC-011).

### Recommended next task

`/speckit-implement EPIC-026` — Epic Stage Kanban, per the register's delivery order —
after committing this batch.
