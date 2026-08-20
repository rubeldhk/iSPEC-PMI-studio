# Closure record: EPIC-011 Traceability

**Date**: 2026-08-20 · **Session**: `/speckit-implement EPIC-011` (Constitution VIII label) ·
**Released by**: PMI-DOC-004 v1.0, scope ruling T-106, 2026-08-20.

**Delivered in two stages by two sessions.**

| Stage | Where | What |
|---|---|---|
| 1 | `epic/009-011-016-lifecycle-wave`, commit `cd81d70` | The model, migration, writer, both traversals, retired flagging, coverage, the API and the page — with their tests |
| 2 | this line, `Phase 1: Convergence` | Connecting them |

Stage 1 built every artifact the task list names and every one of its tests passed. Stage 2 exists
because **passing tests and a working feature turned out to be different claims**: four of the six
things stage 1 delivered were reachable from nothing.

## `T201` — every implementation task has a passing unit test (Constitution V)

**27 of 27 tasks complete** (19 planned + `T857`–`T864` from `T202`).

| Implementation task | Paired test | Stage | Result |
|---|---|---|---|
| T078 `TraceabilityLink` model + migration | T077a `link-constraints.spec.ts` | 1 | pass |
| T081 link creation on generation | T077a + **T857 `generation-link-integration.spec.ts`** | 1 + 2 | pass |
| T130 forward and reverse traversal | T125 `forward-trace.spec.ts`, T126 `reverse-trace.spec.ts` | 1 | pass |
| T131 retired-requirement flagging | T127 `retired-links.spec.ts` | 1 | pass |
| T132 coverage gap reporting | T128 `coverage.spec.ts` | 1 | pass |
| T133 trace and coverage endpoints | T132a `traceability.controller.spec.ts`; contract T129 `traceability.spec.ts` | 1 | pass |
| T134 traceability and coverage views | T133a `Traceability.spec.tsx` | 1 | pass |
| **T858** one writer, one store | T857 (7) | 2 | pass |
| **T860** live requirement status source | T859 `retired-status-source.spec.ts` (6) | 2 | pass |
| **T862** live artifact id source | T861 `artifact-id-source.spec.ts` (5) | 2 | pass |
| **T864** the shell reaches the view | T863 `shell-traceability-route.spec.tsx` (5) | 2 | pass |

Stage 2's four test files were observed RED first — 7, 11 and 5 failures respectively.

**`G-26-14` caught a shortcut.** T859 and T861 were written into one file for brevity; both tasks
name a file of their own, and the ticked tasks then pointed at paths that did not exist. The check
that exists for `DEF-001-003` failed, and the file was split rather than the task text amended —
the task list is the contract, and rewriting it to match what was built is how `DEF-001-003`
happened in the first place.

```text
backend-unit + backend-contract + architecture + frontend + worker-unit   923 tests
packages + contracts + adapters + scripts                                 501 tests
governance                                                                768 tests
backend-integration (real PostgreSQL 16)                                   65 tests
                                                                        -----------
                                                                        2,257 tests · 0 failures
```

`tsc --noEmit` clean on `backend/` and `frontend/`; `eslint` clean; the stage register regenerates
to `Ready`.

**A note on `T081`'s pairing.** Its unit test is recorded as `T073`, which is defined in EPIC-008
and tests EPIC-008's code. `LinkWriterService` was genuinely exercised — through
`tests/unit/traceability/helpers.ts` and the contract test — so Constitution V was satisfied. But
that cross-epic pairing is precisely why nobody noticed the service had no production caller: the
test named as its pair was testing something else entirely. Recorded here because the convention
that made it possible (`T687`'s invariant IDs, cross-referencing between epics) is still in force.

## `T202` — convergence

`/speckit-converge EPIC-011` ran before this implementation and found **four gaps, all `partial`,
none `missing`**. Every artifact existed; the wiring did not.

- **F1 (HIGH) — link creation was implemented twice and connected once.** `LinkWriterService`,
  `T081`'s whole deliverable, had no caller anywhere in `backend/src` or `worker/src`. EPIC-008's
  generation path built links itself into `SpecificationStore`, a different object. Both were
  correct, both were tested, and a specification generated through the API produced links the trace
  and coverage endpoints could not see — US7 scenarios 1 and 2 returned nothing for real data.
  Closed by `T858`: EPIC-008 declares a link port, EPIC-011 implements it over `LinkWriterService`,
  and the module wires one store. Neither module imports the other's service. Generation now also
  inherits the writer's permitted-edge rule and its idempotent re-write.
- **F2 (MEDIUM) — a retired requirement could never be flagged.** `AllActiveRequirementStatusSource`
  answered `active` for every id, so US7 scenario 4 was unreachable in the composed application
  however well `T127` passed. Closed by `T860`, reading the live register. An id from another
  workspace, or one that does not exist, is now **omitted** rather than reported active — the two
  are the same answer to a caller (FR-002), and neither is a claim about a requirement's status.
- **F3 (MEDIUM) — coverage reported an empty universe.** `EmptyArtifactIdSource` returned `[]` from
  both methods, so SC-010's "single view" was a blank one. Closed by `T862` for the **requirement**
  half. The **specification** half stays empty deliberately: `specificationsWithoutTasks` counts
  specifications no task traces back to, tasks arrive with EPIC-012, and until they do every
  specification is trivially without tasks — listing them would report the whole project as a
  coverage gap. Empty is the truthful answer to a question that cannot yet be asked, and it is
  named as such in the module.
- **F4 (MEDIUM) — the traceability view was unreachable.** `main.tsx`'s `View` union had no route to
  the page. Closed by `T864`; `App` is now exported so the shell's own routing is testable, which it
  was not before.

**No further gaps.** All four US7 scenarios are covered end to end: AC1 and AC2 by `T857` through
real generation, AC3 by `T857`'s coverage case and `T863`'s view, AC4 by `T859`.

## `T203` — defect triage

`specs/011-traceability/defects/` contains no records. **0 open.**

## `T204` — closing report

### Work Completed (stage 2)

- **`backend/src/modules/traceability/link-writer.service.ts`** — `TraceabilityLinkAdapter`, the
  seam that makes generation and traversal share one store.
- **`backend/src/modules/traceability/retired-flag.ts`** — `LookupRequirementStatusSource`.
- **`backend/src/modules/traceability/coverage.service.ts`** — `LookupArtifactIdSource`.
- **`backend/src/modules/traceability/traceability.module.ts`** — imports `RequirementsModule`; both
  live sources wired.
- **`backend/src/modules/specifications/specifications-read.service.ts`** — declares
  `SpecificationLinkPort`; the in-memory store writes and reads links through it when supplied, and
  keeps its own array when not (which is what every EPIC-008 unit test relies on).
- **`backend/src/modules/specifications/specifications.module.ts`** — imports `TraceabilityModule`;
  the specification store now writes through `LinkWriterService`.
- **`frontend/src/main.tsx`** — the `traceability` view, its route in and its route back.

### Not verified

- **No real HTTP request has reached `/v1/requirements/{id}/trace` or `/v1/projects/{id}/coverage`** —
  the composed request path is the seam every product-surface epic has left open.
- **The Prisma-backed link store is not wired.** `TRACEABILITY_LINK_STORE` defaults to in-memory;
  `PrismaSpecificationStore.commitGeneration` still refuses without a `traceabilityLink` delegate,
  which is correct — it will not silently drop links — but means the database path is untested end
  to end. Owner EPIC-014 F-11.2.
- **Reverse trace from a task returns nothing**, because tasks do not exist. US7 scenario 1 is
  verified structurally and against generated data as far as `specification → requirement`; the
  `task → specification` half needs EPIC-012.

### Deferred (owners per D-6)

| Item | Owner | Awaiting |
|---|---|---|
| Bind `TRACEABILITY_LINK_STORE` → `traceability_links`; supply the Prisma link delegate to the specification store | EPIC-014 F-11.2 | first composed environment |
| The specification half of `ARTIFACT_ID_SOURCE`, and `specificationsWithoutTasks` becoming meaningful | EPIC-012 | tasks existing |
| `task → specification` links (`linkTasksToSpecification` is built and untested against real tasks) | EPIC-012 | same |
| A router, replacing the shell's state-based navigation | EPIC-010 | by design |

### Epic Exit Criteria

- [x] Every implementation task has a passing unit test (`T201`) — 11 of 11, red observed first on stage 2
- [x] Convergence reports no unbuilt work in scope (`T202`) — four gaps found, `T857`–`T864` appended and completed
- [x] `defects/` contains no open defect record (`T203`)
- [x] Principle deltas hold; deferrals have valid owners (`T204`)
- [x] Closure recorded — this document; **EPIC-011 is CLOSED and release-eligible**
- [ ] Platform promotion — EPIC-014 F-11.2's, not this Epic's

### The pattern worth naming

This Epic is the fourth time the programme has produced code that was built, tested, and reachable
from nothing — after `T462` (engines), `T651` (jobs) and `DEF-001-005` (controllers), and alongside
EPIC-008's FR-032 flag with no producer. In every case the unit tests passed, because a unit test
constructs its own collaborators and therefore cannot notice that nobody else does.

What caught all four was asking a different question: *who calls this in production?* That question
now has three tests that ask it structurally — `T857` (generation and traversal share a store),
`T863` (the shell can reach the page), and `controller-composition.spec.ts` (`T847`, every
controller receives what it declares). Those are the shape worth repeating.

### Recommended Next Task

**`/speckit-converge EPIC-016`** — Architecture Decision Records arrived in the same merge as this
Epic's stage 1, with an unmarked task list and no closure, which is exactly the state EPIC-011 was
in before this run. It is the last unaccounted-for part of that merge.

Then **`/speckit-implement EPIC-010`** — Specification Interface, which owns the router this Epic's
`T864` works around, and is uncontested.
