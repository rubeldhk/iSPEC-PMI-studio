# Implementation Plan: External Storage Publishing

**Epic**: `EPIC-025` | **Module**: M-11 DevOps | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)

**Tasks**: see [tasks.md](./tasks.md) — counted there, never restated here (`T686`, PP-002) · [tasks.md](./tasks.md) | **Posture**: ⏸ **HELD** (decision D-10)

**Parent design** — not duplicated here: [`../002-team-review-access-storage/`](../002-team-review-access-storage/)
([plan](../002-team-review-access-storage/plan.md) ·
[research](../002-team-review-access-storage/research.md) ·
[data-model](../002-team-review-access-storage/data-model.md) ·
[contracts](../002-team-review-access-storage/contracts/) ·
[quickstart](../002-team-review-access-storage/quickstart.md))

**Shared design**: [`../_shared/`](../_shared/)

**Created by ruling D-19** (2026-08-07), which split EPIC-002 into three delivery epics along the
seam its own build order already described: the run/review chain, access control, and storage were
independent of each other, and of everything else.

## Summary

One-way publishing of project artifacts to Google Drive, Dropbox, or S3, behind an interchangeable
provider boundary that mirrors the engine adapter pattern ADR-0001 established.

Publishing is **permanently one-way** (ADR-0004) — confirmed by clarification as a boundary, not a
staged simplification. Nothing at a provider can alter a platform artifact.

## Scope

| Function | What it delivers |
|---|---|
| F-02.6 External storage integration | Provider contract, fixture, connections, publish, failure taxonomy, switching, conformance suite, architecture test |
| F-025.UI Interface | Storage connections page |
| F-025.Z Epic closure | Per-epic gate **including the SRS back-fill approval gate** (`T439`) |

Task counts live in [tasks.md](./tasks.md) and are not restated here (`T686`, PP-002).

## Technical Context

Inherited from [`../_shared/plan.md`](../_shared/plan.md) and the
[parent plan](../002-team-review-access-storage/plan.md). The research decisions that bear on this
epic:

**Storage providers reuse the engine adapter pattern** (**R-002-3**). `packages/storage-contract`
mirrors `packages/engine-contract`: plain-data contract, capability refusal, a deliberately trivial
fixture, and a build-failing architecture test (`T432`) asserting `backend/src/**` names no provider
SDK.

Without the fixture, `SC-011` — "an additional provider with zero changes outside the storage layer"
— is a claim nobody can test. That is exactly where `SC-008` stood before the fixture engine existed.

**Publish failure reasons are a closed enum with no `unknown` member** (**R-002-7**), matching
`job_failure_reason` in `_shared/schema.sql`. Provider-specific errors are **mapped into** the
taxonomy by the adapter; a Dropbox error code must never reach `backend/`.

**Concurrent publishes are prevented, not queued** (`FR-040`, **R-002-6**) — an advisory lock on
`project_id`. Two simultaneous publishes is a race with no informational value, unlike answer
conflicts, which are surfaced.

**NEEDS CLARIFICATION**: none.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | ⚠️ **PASS WITH DEBT** — third-party storage (`FR-029`–`FR-040`) has **no SRS source**; no cloud file-storage provider appears in any of the 24 modules or 20 volumes. `T439` gates **approval** |
| III | Epic → Feature → Task decomposition | PASS — 3 functions: F-02.6, F-025.UI, F-025.Z; tasks counted in [tasks.md](./tasks.md), never restated here (`T686`, PP-002) |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `F-025.Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first — or, for document/configuration outputs, an executable conformance check | ⚠️ **PASS WITH GAP** — `/speckit-analyze` finding **A1** (2026-08-19) found `T391` paired to `T384`, which asserts the failure taxonomy and nothing about `FR-034`'s publish record. The pairing existed; the assertion did not. Closed by `T817` |
| VI | `specs/025-external-storage-publishing/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution` (its first command); stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 behind upstream, 2026-08-08 |
| — | No other Claude session on this checkout | ⚠️ **Cannot assert** — this epic was itself authored outside this session on 2026-08-07 |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md); parent register in [EPIC-002](../002-team-review-access-storage/spec.md) |
| — | **C-01 identifier collision** | ⚠️ **Unresolved and now wider** — see G-02F.1 |

**Any FAIL blocks Phase 0.** No FAIL. Gate II carries the second of the family's two Constitution II debts.

**Post-design re-check**: PASS. No new design was produced — this epic implements the parent's.

## Review of the existing task list

### G-025.1 · Credential and token handling — ✅ resolved 2026-08-08

`FR-029` required an administrator to authorise a connection with **no mechanism chosen**, and the
parent's data model explicitly excluded it. It was the only genuine unknown left in the family, and
`T390` could not be written without it.

✅ **Resolved**: delegated OAuth-style authorisation. The platform stores a **refresh token
encrypted at rest** and never accepts a password (`FR-029`, `FR-029a`, `FR-029b`, `SC-014`). The
token never reaches the adapter — which receives a short-lived access token per call and nothing
more, preserving contract rule **S7** and the ADR-0002 sandbox posture. `T390` is now writable.

### G-025.2 · Publish depends on EPIC-024's grants ⚠️ open, sequencing

`T392` excludes artifacts the publishing user cannot access (`FR-033`). Without EPIC-024 there is
nothing to exclude *by*, and the task silently becomes a no-op **that passes its test** — the
dangerous shape, because a green suite reads as coverage.

**Restated 2026-08-19** by `/speckit-analyze` finding **A7**. The original entry closed on "Not
recorded in this epic's `Depends on`", which both [spec.md](./spec.md) and [tasks.md](./tasks.md)
now do. That half is discharged. What remains is the sequencing risk itself, which the dependency
edge records but does not remove: EPIC-024 is also ⏸ HELD under D-10, so `T392` must not be marked
complete on a passing test alone while there are no grants to exclude by.

**Otherwise complete.** The storage API (`T421`–`T426`), conformance suite (`T430`, `T431`),
architecture test (`T432`), and concurrency integration test (`T429`) were added on 2026-08-05 and
migrated intact.

### G-02F.1 · The identifier collision extends to success criteria ⚠️ new finding, family-wide

**C-01** was recorded as a *requirement* collision: EPIC-002's `FR-001`–`FR-040` clash with the
platform's `FR-001`–`FR-034`. Checking the split surfaced that **the success criteria collide too**,
and that was never recorded:

```text
EPIC-002 family:  SC-001 … SC-018   (SC-013 before 2026-08-19)
platform:         SC-001 … SC-012
```

**Widened 2026-08-19** by `/speckit-analyze` finding **A9**: the parent's third clarification
session added `SC-015`–`SC-018`, so the family range now extends five past the platform's rather
than one. The overlap is unchanged in kind and larger in extent.

Every identifier overlaps. `SC-001` here means one thing; `SC-001` in `_shared/platform-spec.md`
means another, and EPIC-010 owns that one. Before the split this was contained in a single spec.
**Now three separate epic specs each cite bare `SC-00n`**, so a reader cannot tell which population
is meant without checking the parent.

Decision **D-1** owns the fix for requirement identifiers; it should be widened to cover success
criteria. Recorded here rather than silently renumbered — renumbering is D-1's pass to make.

## Build order

```text
F-02.6  storage contract ──► fixture provider ──► conformance suite (T430, T431)
                 ├─► connections + health ──► storage API (T421–T423)
                 ├─► publish pipeline ──► failure taxonomy ──► publish API (T424–T426)
                 │        └─► access-aware exclusion  ⚠️ needs EPIC-024 grants
                 ├─► republish preview + concurrency lock (T429)
                 └─► provider switching ──► T432 architecture test
        └─► F-025.UI ──► F-025.Z closure
```

## Design notes specific to this epic

**The fixture provider precedes the real ones**, exactly as EPIC-003 sequenced its fixture engine.
It makes everything above the adapter provably correct before a provider SDK — the slowest and least
certain component — exists, and it keeps CI free of network calls to Google Drive.

**The republish preview is computed before anything is written** (`FR-036`). "Tell the user what will
change, then change it" is only true if the preview is not itself the first write.

**A file exceeding the provider's size limit is skipped and reported; the rest continue.** Failing
the whole publish for one oversized file would make large projects unpublishable.

**Deleting a published file at the provider has zero effect on the platform artifact** (`SC-012`).
The reference simply becomes stale — which is what one-way means.

## Phase 0 / Phase 1 outputs

**None new.** This epic implements the parent's design:
- [`research.md`](../002-team-review-access-storage/research.md) — R-002-3 (provider abstraction),
  R-002-6 (concurrency guards), R-002-7 (failure taxonomy)
- [`data-model.md`](../002-team-review-access-storage/data-model.md) — `StorageConnection`,
  `StorageProviderType`, `PublishRecord`, `PublishedFileReference`
- [`contracts/storage-provider-contract.md`](../002-team-review-access-storage/contracts/storage-provider-contract.md)
  — the provider boundary, capability set, closed failure taxonomy, and 8-case conformance suite
- [`contracts/platform-api-epic-002.md`](../002-team-review-access-storage/contracts/platform-api-epic-002.md)
  — the Storage Connections and Publishing endpoint groups
- [`quickstart.md`](../002-team-review-access-storage/quickstart.md) — V02-8, V02-9

Generating a per-epic `research.md` restating decisions already made in
[EPIC-002](../002-team-review-access-storage/research.md) would duplicate the one thing the parent
exists to hold once.

## Definition of done

- [ ] Every task in [tasks.md](./tasks.md) complete, every unit test passing (Constitution V)
- [ ] **SRS back-fill complete** for `FR-029`–`FR-040` (`T439`) — gates approval
- [ ] Zero passwords accepted or stored; zero tokens in any response, log, or error (`SC-014`)
- [ ] `pnpm test:arch` green — no provider SDK named outside the adapter layer (`T432`)
- [ ] Conformance suite green against the fixture and at least one real provider
- [ ] Quickstart **V02-8** and **V02-9** pass
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
