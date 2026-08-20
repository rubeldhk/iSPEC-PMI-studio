---

description: "Task list for EPIC-025 — External Storage Publishing"
---

# Tasks: External Storage Publishing

**Epic**: `EPIC-025` | **Module**: M-11 DevOps | **Tasks**: 42

> **Counted, not quoted.** This number is recomputed by `/speckit-analyze`; the phase and function sections below are its composition. It drifted before because two documents restated it and neither was derived — EPIC-018 read 31 here, 32 in the index and 34 in its task list, and by the time `T529` came to reconcile them the real figures were 31 / 37 / 38. **The remediation went stale before it ran.** Corrected by `T686`.

**Parent design**: [../002-team-review-access-storage/](../002-team-review-access-storage/) — requirements, clarifications, SRS traceability and the principle register live there
**Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` and approved business scope. Held is not cancelled — these tasks await an input, not more design.

**Requirements owned**: FR-029 – FR-040, FR-029a, FR-029b

**Session label**: `EPIC-025 External Storage Publishing` (Constitution VIII).

**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a paired unit-test task, written to fail first.

**⚠️ SRS back-fill owed before approval**: this capability has **no SRS source**, re-verified against the MPS drop. Constitution II requires the back-fill before this epic is approved — it gates *approval*, not merely closure.

**Task IDs are invariant** — unchanged by the D-19 split of EPIC-002. A `(unit test: T0nn)` reference may point at a task in a sibling epic; that is expected.

**Before finishing**: close with a Work Completed + Recommended Next Task report (Constitution IX).

---

## F-02.6 · External storage integration

*Satisfies **FR-029**, **FR-029a**, **FR-029b**, **FR-030**, **FR-031**, **FR-032**, **FR-033**, **FR-034**, **FR-035**, **FR-036**, **FR-037**, **FR-038**, **FR-039** and **FR-040**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note. This Epic carries one delivery feature, so it satisfies the whole owned set; the interface half is F-025.UI.*

- [ ] T382 [P] [US5] Unit tests asserting a workspace can be connected to a provider **with a destination selected within it** (**FR-029**), and that the connection reports healthy, needs-reauthorisation and unavailable as distinct states (FR-031), in `backend/tests/unit/storage/connection.spec.ts`
- [ ] T383 [P] [US5] Unit tests asserting a provider missing a required capability is refused, naming it, in `backend/tests/unit/storage/capability-refusal.spec.ts`
- [ ] T384 [P] [US6] Unit tests asserting every publish failure reports a distinct named reason — unavailable, expired, quota, size, destination missing, with zero generic failures reaching the user (**SC-009**), in `backend/tests/unit/storage/publish-failures.spec.ts`
- [ ] T385 [P] [US6] Unit tests asserting artifacts the publisher cannot access are excluded and the exclusion reported, in `backend/tests/unit/storage/publish-access.spec.ts`
- [ ] T386 [P] [US6] Unit tests asserting republish states what will be added, replaced or left alone BEFORE changing anything, in `backend/tests/unit/storage/republish.spec.ts`
- [ ] T387 [P] [US7] Unit tests asserting provider switching loses no platform artifact and no publish history (**SC-010**), in `backend/tests/unit/storage/provider-switch.spec.ts`
- [ ] T388 [US5] Define `StorageConnection`, `PublishRecord` and `PublishedFileReference` models in `backend/prisma/schema.prisma` (unit tests: T382, T387, T817)
- [ ] T389 [US5] Define the storage provider contract in `packages/storage-contract/src/index.ts` — one boundary, interchangeable providers (FR-030, FR-039; unit test: T383)
- [ ] T390 [US5] Implement connection lifecycle and health reporting in `backend/src/modules/storage/connection.service.ts` (FR-029, FR-031; unit test: T382)
- [ ] T391 [US6] Implement the publish pipeline with per-project organisation in `backend/src/modules/storage/publish.service.ts` (FR-032, FR-034; unit tests: T817, T818)
- [ ] T392 [US6] Implement access-aware exclusion during publish in `backend/src/modules/storage/publish.service.ts` (FR-033; unit test: T385)
- [ ] T393 [US6] Implement the publish failure taxonomy in `backend/src/modules/storage/publish-failures.ts` (FR-035, **SC-009**; unit test: T384)
- [ ] T394 [US6] Implement republish preview and concurrent-publish prevention in `backend/src/modules/storage/republish.service.ts` (FR-036, FR-040; unit tests: T386 for the preview, T424 for the 409 on a second concurrent publish; integration test: T429 for the advisory lock)
- [ ] T395 [US7] Implement provider switching and disconnection with artifact preservation in `backend/src/modules/storage/provider-switch.service.ts` (FR-037, FR-038, **SC-010**; unit tests: T387, T451)

### Credentials and disconnection *(added 2026-08-08 — FR-029a, FR-029b, FR-038, SC-014, clarified that day)*

*Authorisation is **delegated OAuth-style**: the platform stores a refresh token encrypted at rest and
never accepts a password. The token never reaches the adapter, which gets a short-lived access token
per call — preserving contract rule **S7** and the ADR-0002 sandbox posture.*

- [ ] T447 [P] [US5] Write failing unit tests asserting an expired access token is refreshed without user interaction where the provider permits it, and that a connection whose refresh fails reports `needs_reauthorisation` rather than `unavailable` (**FR-029a**, FR-031), in `backend/tests/unit/storage/token-refresh.spec.ts`
- [ ] T448 [US5] Implement token refresh and re-authorisation reporting in `backend/src/modules/storage/token-refresh.service.ts` (**FR-029a**; unit test: T447)
- [ ] T449 [P] [US5] Write failing unit tests asserting a stored refresh token never appears in any endpoint response, log entry, or error message, that no provider account password is ever accepted, and that the token is discarded on disconnection (**FR-029b**, **SC-014**), in `backend/tests/unit/storage/token-exposure.spec.ts`
- [ ] T450 [US5] Implement refresh-token encryption at rest, non-exposure, and discard-on-disconnect in `backend/src/modules/storage/connection.service.ts` (**FR-029b**, **SC-014**; unit test: T449)
- [ ] T451 [P] [US7] Write failing unit tests asserting disconnection **leaves already-published files untouched at the provider** and marks their publish records no longer tracked — the platform never deletes at the provider (**FR-038**), in `backend/tests/unit/storage/disconnect-retention.spec.ts`
### API surface, fixture and conformance *(added 2026-08-05 — closing G-02.2, G-02.4 and G-02.5)*

*Regrouped 2026-08-19 by `/speckit-analyze` finding **A8**. These eleven sat under the credentials
heading above because they were appended after it, not because they belong to it — none concerns a
token or a disconnection.*

- [ ] T396 [P] [US5] Implement a fixture storage provider with injectable failures, mirroring the engine fixture pattern, in `packages/storage-adapters/fixture/src/index.ts` (unit tests: T382, T384)
- [ ] T421 [P] [US5] Write failing unit tests for the storage connections controller with mocked services, asserting an unreachable provider reports `unavailable` and never `healthy`, in `backend/tests/unit/storage/connections.controller.spec.ts`
- [ ] T422 [P] [US5] Contract tests for connection endpoints against `contracts/platform-api-epic-002.md` in `backend/tests/contract/storage-connections.spec.ts`
- [ ] T423 [US5] Implement the storage connections controller in `backend/src/modules/storage/connections.controller.ts` (unit test: T421; contract test: T422)
- [ ] T424 [P] [US6] Write failing unit tests for the publish controller, asserting the republish preview is computed **before any write** and that a second concurrent publish returns 409, in `backend/tests/unit/storage/publish.controller.spec.ts`
- [ ] T425 [P] [US6] Contract tests for publish and preview endpoints, asserting every failure carries a reason from the closed taxonomy with no `unknown` member, and that the publish endpoint accepts **no artifact-subset parameter** (FR-032), in `backend/tests/contract/publish.spec.ts`
- [ ] T426 [US6] Implement the publish controller in `backend/src/modules/storage/publish.controller.ts` (unit test: T424; contract test: T425)
- [ ] T429 [P] [US6] Integration test asserting two concurrent publishes of one project are **prevented** by an advisory lock on `project_id`, not queued (FR-040), in `backend/tests/integration/publish-concurrency.spec.ts`
- [ ] T430 [US5] Implement the shared storage conformance suite — the 8 cases SC-01 to SC-08 from `contracts/storage-provider-contract.md` — in `packages/storage-contract/tests/conformance/storage-conformance.suite.ts`
- [ ] T431 [US5] Run the conformance suite against the fixture provider in `packages/storage-adapters/fixture/tests/conformance.spec.ts` (suite: T430)
- [ ] T432 [US7] Implement the architecture test failing the build if `backend/src/**` names any storage provider SDK, package, or provider string — the guarantee behind SC-011, mirroring T047 for engines — in `backend/tests/architecture/storage-independence.spec.ts`

### Publish record, scope and external change *(added 2026-08-19 — FR-032, FR-034, SC-012, SC-017, from `/speckit-analyze` findings A1–A4)*

*`T391` implemented `FR-034` against a unit test that asserted the failure taxonomy instead of the
publish record, so the record shipped unverified — the pairing existed, the assertion did not. The
parent's third clarification session then narrowed `FR-032` to whole-project publishing and set the
publish half of `SC-017`, and `SC-012` had been owned since the split with no task at all.*

- [ ] T817 [P] [US6] Unit tests asserting each publish writes a record naming what was published, when, by whom, and where it landed, and that the record survives a failed publish stating what did and did not land (**FR-034**), in `backend/tests/unit/storage/publish-record.spec.ts`
- [ ] T818 [P] [US6] Unit tests asserting a publish covers the whole project and that no artifact-subset selection is offered, so FR-036's added / replaced / left-alone preview always compares against a whole-project baseline — a deselected file must not be expressible, because it cannot be told apart from a deleted one (**FR-032**), in `backend/tests/unit/storage/publish-scope.spec.ts`
- [ ] T819 [US6] Enforce whole-project publish scope in `backend/src/modules/storage/publish.service.ts` (**FR-032**; unit test: T818) — the only artifacts omitted are those `FR-033` excludes for access reasons, and those are reported
- [ ] T820 [P] [US6] Integration test asserting a publish of **500 artifacts** completes without failure and without degrading the publish flow, against the fixture provider (**SC-017**), in `backend/tests/integration/publish-scale.spec.ts` — the counterpart of `T810`, which took the 200-question review half
- [ ] T821 [P] [US6] Unit tests asserting deletion or alteration of a published file at the provider leaves the platform artifact intact and merely marks its `PublishedFileReference` stale — the platform never reads back from the provider (**SC-012**, FR-037), in `backend/tests/unit/storage/external-deletion.spec.ts`

## F-025.UI · Interface

*Satisfies **FR-031** and **FR-036**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

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
