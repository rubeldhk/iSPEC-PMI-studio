---

description: "Task list for EPIC-025 — External Storage Publishing"
---

# Tasks: External Storage Publishing

**Epic**: `EPIC-025` | **Module**: M-11 DevOps | **Tasks**: 32

**Parent design**: [../002-team-review-access-storage/](../002-team-review-access-storage/) — requirements, clarifications, SRS traceability and the principle register live there
**Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` and approved business scope. Held is not cancelled — these tasks await an input, not more design.

**Requirements owned**: FR-029 – FR-040

**Session label**: `EPIC-025 External Storage Publishing` (Constitution VIII).

**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a paired unit-test task, written to fail first.

**⚠️ SRS back-fill owed before approval**: this capability has **no SRS source**, re-verified against the MPS drop. Constitution II requires the back-fill before this epic is approved — it gates *approval*, not merely closure.

**Task IDs are invariant** — unchanged by the D-19 split of EPIC-002. A `(unit test: T0nn)` reference may point at a task in a sibling epic; that is expected.

**Before finishing**: close with a Work Completed + Recommended Next Task report (Constitution IX).

---

## F-02.6 · External storage integration

- [ ] T382 [P] [US5] Unit tests asserting a connection reports healthy, needs-reauthorisation and unavailable as distinct states, in `backend/tests/unit/storage/connection.spec.ts`
- [ ] T383 [P] [US5] Unit tests asserting a provider missing a required capability is refused, naming it, in `backend/tests/unit/storage/capability-refusal.spec.ts`
- [ ] T384 [P] [US6] Unit tests asserting every publish failure reports a distinct named reason — unavailable, expired, quota, size, destination missing, in `backend/tests/unit/storage/publish-failures.spec.ts`
- [ ] T385 [P] [US6] Unit tests asserting artifacts the publisher cannot access are excluded and the exclusion reported, in `backend/tests/unit/storage/publish-access.spec.ts`
- [ ] T386 [P] [US6] Unit tests asserting republish states what will be added, replaced or left alone BEFORE changing anything, in `backend/tests/unit/storage/republish.spec.ts`
- [ ] T387 [P] [US7] Unit tests asserting provider switching loses no platform artifact and no publish history, in `backend/tests/unit/storage/provider-switch.spec.ts`
- [ ] T388 [US5] Define `StorageConnection`, `PublishRecord` and `PublishedFileReference` models in `backend/prisma/schema.prisma` (unit tests: T382, T387)
- [ ] T389 [US5] Define the storage provider contract in `packages/storage-contract/src/index.ts` — one boundary, interchangeable providers (FR-030, FR-039; unit test: T383)
- [ ] T390 [US5] Implement connection lifecycle and health reporting in `backend/src/modules/storage/connection.service.ts` (FR-029, FR-031; unit test: T382)
- [ ] T391 [US6] Implement the publish pipeline with per-project organisation in `backend/src/modules/storage/publish.service.ts` (FR-032, FR-034; unit test: T384)
- [ ] T392 [US6] Implement access-aware exclusion during publish in `backend/src/modules/storage/publish.service.ts` (FR-033; unit test: T385)
- [ ] T393 [US6] Implement the publish failure taxonomy in `backend/src/modules/storage/publish-failures.ts` (FR-035; unit test: T384)
- [ ] T394 [US6] Implement republish preview and concurrent-publish prevention in `backend/src/modules/storage/republish.service.ts` (FR-036, FR-040; unit test: T386)
- [ ] T395 [US7] Implement provider switching and disconnection with artifact preservation in `backend/src/modules/storage/provider-switch.service.ts` (FR-037, FR-038; unit test: T387)
- [ ] T396 [P] [US5] Implement a fixture storage provider with injectable failures, mirroring the engine fixture pattern, in `packages/storage-adapters/fixture/src/index.ts` (unit tests: T382, T384)
- [ ] T421 [P] [US5] Write failing unit tests for the storage connections controller with mocked services, asserting an unreachable provider reports `unavailable` and never `healthy`, in `backend/tests/unit/storage/connections.controller.spec.ts`
- [ ] T422 [P] [US5] Contract tests for connection endpoints against `contracts/platform-api-epic-002.md` in `backend/tests/contract/storage-connections.spec.ts`
- [ ] T423 [US5] Implement the storage connections controller in `backend/src/modules/storage/connections.controller.ts` (unit test: T421; contract test: T422)
- [ ] T424 [P] [US6] Write failing unit tests for the publish controller, asserting the republish preview is computed **before any write** and that a second concurrent publish returns 409, in `backend/tests/unit/storage/publish.controller.spec.ts`
- [ ] T425 [P] [US6] Contract tests for publish and preview endpoints, asserting every failure carries a reason from the closed taxonomy with no `unknown` member, in `backend/tests/contract/publish.spec.ts`
- [ ] T426 [US6] Implement the publish controller in `backend/src/modules/storage/publish.controller.ts` (unit test: T424; contract test: T425)
- [ ] T429 [P] [US6] Integration test asserting two concurrent publishes of one project are **prevented** by an advisory lock on `project_id`, not queued (FR-040), in `backend/tests/integration/publish-concurrency.spec.ts`
- [ ] T430 [US5] Implement the shared storage conformance suite — the 8 cases SC-01 to SC-08 from `contracts/storage-provider-contract.md` — in `packages/storage-contract/tests/conformance/storage-conformance.suite.ts`
- [ ] T431 [US5] Run the conformance suite against the fixture provider in `packages/storage-adapters/fixture/tests/conformance.spec.ts` (suite: T430)
- [ ] T432 [US7] Implement the architecture test failing the build if `backend/src/**` names any storage provider SDK, package, or provider string — the guarantee behind SC-011, mirroring T047 for engines — in `backend/tests/architecture/storage-independence.spec.ts`

## F-025.UI · Interface

- [ ] T401 [P] [US5] Component unit tests for storage connection and publish status in `frontend/tests/unit/pages/StorageConnections.spec.tsx`
- [ ] T402 [P] [US5] Implement the storage connections page in `frontend/src/pages/StorageConnections.tsx` (unit test: T401)

## F-025.Z · Epic closure

- [ ] T439 **Confirm the SRS back-fill is complete** for third-party storage integration (FR-029–FR-040), which has no SRS source (Constitution II) — this epic must not be **approved** without it; record in `specs/025-external-storage-publishing/closure.md`
- [ ] T440 Confirm every implementation task in this epic has a passing unit test (Constitution V); record in `specs/025-external-storage-publishing/closure.md`
- [ ] T441 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/025-external-storage-publishing/closure.md`
- [ ] T442 Triage `specs/025-external-storage-publishing/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/025-external-storage-publishing/closure.md`
- [ ] T443 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the closing report in `specs/025-external-storage-publishing/closure.md`

---

## Depends on

- EPIC-008 — artifacts to publish
- EPIC-024 — access control, because publish must exclude what the publisher cannot see (FR-033)

## User stories owned

- US5 — connect a provider
- US6 — publish to it
- US7 — swap providers without loss
