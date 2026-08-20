---

description: "Task list for EPIC-011 — Traceability"
---

# Tasks: Traceability

**Epic**: `EPIC-011` | **Module**: M-04 | **Tasks**: 19

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (Business Requirement
> Specification, APPROVED; scope ruling T-106). The prior hold under decision D-10 is
> discharged; resumption went through the Definition-of-Ready gate (EPIC-026).
>
> Delivered in **two stages**. Stage 1 arrived with the lifecycle wave
> (`epic/009-011-016-lifecycle-wave`, commit `cd81d70`): the model, the writer, both
> traversals, retired flagging, coverage, the API and the page. Stage 2 — `Phase 1:
> Convergence` below — connected them: everything in stage 1 was built, tested, and
> reachable from nothing.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-04.12 · Traceability link model and writing

*Satisfies **FR-029**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

*Catalog epic: Specification Management → **Traceability**. Absorbed from the former M-07.*

- [X] T077a [P] [US3] Unit tests asserting `TraceabilityLink` permits only the two Phase 1 edge types and rejects duplicates, in `backend/tests/unit/traceability/link-constraints.spec.ts`
- [X] T078 [US3] Define `TraceabilityLink` model with indexes on both traversal directions in `backend/prisma/schema.prisma` (unit test: T077a)
- [X] T081 [US3] Implement traceability link creation on successful generation in `backend/src/modules/traceability/link-writer.service.ts` (unit test: T073 — **defined in EPIC-008**)

## F-04.13 · Bidirectional traversal

*Satisfies **FR-030**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

- [X] T125 [P] [US7] Unit tests for forward traversal from a requirement to all derived artifacts in `backend/tests/unit/traceability/forward-trace.spec.ts`
- [X] T126 [P] [US7] Unit tests for reverse traversal from a task to originating requirements in `backend/tests/unit/traceability/reverse-trace.spec.ts`
- [X] T130 [US7] Implement forward and reverse traversal in `backend/src/modules/traceability/traceability.service.ts` (unit tests: T125, T126)

## F-04.14 · Retired-requirement flagging

*Satisfies **FR-029**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

- [X] T127 [P] [US7] Unit tests asserting links from retired requirements are returned and flagged, never omitted, in `backend/tests/unit/traceability/retired-links.spec.ts`
- [X] T131 [US7] Implement retired-requirement flagging on returned links in `backend/src/modules/traceability/retired-flag.ts` (unit test: T127)

## F-04.15 · Coverage reporting

*Satisfies **FR-031**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

- [X] T128 [P] [US7] Unit tests for coverage gap detection in `backend/tests/unit/traceability/coverage.spec.ts`
- [X] T132 [US7] Implement coverage gap reporting in `backend/src/modules/traceability/coverage.service.ts` (unit test: T128)

## F-04.16 · Traceability API

*Satisfies **FR-029**, **FR-030** and **FR-031**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

- [X] T129 [P] [US7] Contract tests for trace and coverage endpoints in `backend/tests/contract/traceability.spec.ts`
- [X] T132a [P] [US7] Unit tests for trace and coverage endpoints with a mocked service in `backend/tests/unit/traceability/traceability.controller.spec.ts`
- [X] T133 [US7] Implement trace and coverage endpoints in `backend/src/modules/traceability/traceability.controller.ts` (unit test: T132a; contract test: T129)

## F-04.17 · Traceability interface

*Satisfies **FR-029**, **FR-030** and **FR-031**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

- [X] T133a [P] [US7] Component unit tests asserting both traversal directions render and retired links are flagged in `frontend/tests/unit/pages/Traceability.spec.tsx`
- [X] T134 [P] [US7] Implement traceability and coverage views in `frontend/src/pages/Traceability.tsx` (unit test: T133a)

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/011-traceability/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [X] T201 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/011-traceability/closure.md`
- [X] T202 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/011-traceability/closure.md`
- [X] T203 Triage `specs/011-traceability/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/011-traceability/closure.md`
- [X] T204 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/011-traceability/closure.md`

## Phase 1: Convergence

*Appended 2026-08-20 by `/speckit-converge EPIC-011`, after the lifecycle wave delivered this Epic's
code and before its `Phase Z` ran. `T202` is the task that calls for this run; it stays unchecked
until the work below is done and recorded.*

**Numbering**: IDs continue from `T856`, not from this file's `T204`. Task IDs are unique
repository-wide, and `T828`–`T856` were allocated to EPIC-001, EPIC-005, EPIC-008 and EPIC-009 on
2026-08-20.

*The header count at the top of this file still reads 19. It is deliberately not updated: converge
is append-only and may not rewrite an existing line. The true count is 27.*

### F1 · Link creation is implemented twice and connected once — HIGH

*`T081` calls for traceability link creation **on successful generation**. `LinkWriterService`
implements it and nothing calls it — `grep` across `backend/src` and `worker/src` finds only its own
module wiring. EPIC-008's `GenerateSpecificationService.run()` builds links itself and passes them to
`SpecificationStore.commitGeneration`, a different store object entirely. So a specification
generated through the API leaves links the trace and coverage endpoints cannot see, and US7
scenarios 1 and 2 return nothing for real data. Two implementations of one requirement, agreeing
with each other and connected to different halves of the system — the `T648` shape.*

- [X] T857 [P] [US7] Unit tests asserting a successful generation produces links READABLE through `TraceabilityService` — forward from the requirement and reverse from the specification — and that generation and the trace endpoints observe ONE link store, in `backend/tests/unit/traceability/generation-link-integration.spec.ts` per T081, FR-029, SC-002 (partial)
- [X] T858 [US7] Route generation's link creation through `LinkWriterService` — one writer, one store — in `backend/src/modules/traceability/link-writer.service.ts` and the specifications module's commit path, per T081 and US7/AC1–AC2 (partial; unit test: T857)

### F2 · A retired requirement can never be flagged — MEDIUM

*`REQUIREMENT_STATUS_SOURCE` defaults to `AllActiveRequirementStatusSource`, which answers `active`
for every id it is given. US7 scenario 4 — "the link is still shown and marked as originating from a
retired requirement" — therefore cannot pass in the composed application, however well `T127` passes
in isolation. EPIC-008 set the precedent for closing this inside the module rather than deferring
it: `LookupRequirementSelection` reads the live register through `REQUIREMENT_STORE`.*

- [X] T859 [P] [US7] Unit tests asserting the status source reads the LIVE requirement register, that a retired requirement's link is returned AND flagged rather than omitted, and that the default source is no longer one that claims everything is active, in `backend/tests/unit/traceability/retired-status-source.spec.ts` per US7/AC4 (partial)
- [X] T860 [US7] Wire `REQUIREMENT_STATUS_SOURCE` to the requirement register through a narrow read port in `backend/src/modules/traceability/traceability.module.ts`, per US7/AC4 and FR-029 (partial; unit test: T859)

### F3 · Coverage reports an empty universe — MEDIUM

*`ARTIFACT_ID_SOURCE` defaults to `EmptyArtifactIdSource`, whose two methods both return `[]`.
`CoverageService` is correct and `T128` passes; given nothing to iterate it reports no requirements
and no specifications, so `GET /projects/{id}/coverage` answers an empty report in the running
application. SC-010 requires every uncovered requirement to be identifiable in a single view, and
an empty view satisfies it only in the sense that a blank page contains no errors.*

- [X] T861 [P] [US7] Unit tests asserting the artifact id source lists the project's real requirements and specifications, that an uncovered requirement appears in the report, and that a project with no artifacts is distinguishable from an unwired source, in `backend/tests/unit/traceability/artifact-id-source.spec.ts` per SC-010, FR-031 (partial)
- [X] T862 [US7] Wire `ARTIFACT_ID_SOURCE` to the requirement and specification stores in `backend/src/modules/traceability/traceability.module.ts`, per FR-031 and SC-010 (partial; unit test: T861)

### F4 · The traceability view is unreachable — MEDIUM

*`frontend/src/pages/Traceability.tsx` is built and `T133a` tests it. `main.tsx` cannot reach it:
its `View` union is `loading | sign-in | projects | project`, and the shell's own comment defers a
router to EPIC-010. Every US7 scenario opens with "the user views…", so the Epic's whole user story
is unreachable from the product. Recorded here rather than assumed to be EPIC-010's: if EPIC-010's
router lands first this task is discharged by it, and the check below is what proves that.*

- [X] T863 [P] [US7] Component test asserting the web shell can navigate to the traceability view and that it renders both traversal directions and the coverage report, in `frontend/tests/unit/shell-traceability-route.spec.tsx` per US7 (partial)
- [X] T864 [US7] Make the traceability view reachable from the web shell in `frontend/src/main.tsx`, per US7 and T134 — discharged by EPIC-010's router if that lands first (partial; unit test: T863)
