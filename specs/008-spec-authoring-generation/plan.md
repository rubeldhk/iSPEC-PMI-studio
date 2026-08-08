# Implementation Plan: Specification Authoring & Generation

**Epic**: `EPIC-008` | **Module**: M-04 | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Tasks**: 23 · [tasks.md](./tasks.md) | **Posture**: ⏸ **HELD** (decision D-10)

**Shared design** — not duplicated here: [`../_shared/`](../_shared/)
([platform-spec](../_shared/platform-spec.md) · [system-design](../_shared/system-design.md) · [data-model](../_shared/data-model.md) · [schema](../_shared/schema.sql) · [platform-api](../_shared/contracts/platform-api.md)))

> ## ⚠️ Retroactive plan
>
> `tasks.md` predates this plan — these tasks were generated in the 2026-08-03 decomposition and
> never passed a Constitution Check. This plan records the technical context they assumed and
> **reviews the existing task list**. It is one of eleven written on 2026-08-07 to close finding
> **C3**, and it adds no design: everything this epic needs already exists in `_shared/`.

## Summary

Turning selected requirements into a stored, traceable specification through the engine contract —
including the read surface, specification search, and out-of-date detection.

The epic's centre of gravity: specification, versions, traceability links, and the job's terminal
state are written in **one transaction**, which is what makes `SC-002` structurally true rather than
defended by cleanup jobs.

## Scope

| Function | Tasks | What it delivers |
|---|---|---|
| F-04.1 Specification data model | 2 | `Specification` + `SpecificationVersion`, raw and parsed content |
| F-04.2 Engine output parsing | 2 | Unparseable and empty output are failures, never a specification |
| F-04.3 Generation orchestration | 2 | Invoke the engine through the contract |
| F-04.4 Engine provenance stamping | 2 | Engine name and version on every artifact, never null |
| F-04.5 Generation job API | 3 | 202-with-job endpoints |
| F-04.6 Specification read surface | 6 | List, detail, edit, plus specification search |
| F-04.7 Out-of-date detection | 2 | Flag on source-requirement change, never regenerate |
| Phase Z Epic closure | 4 | Per-epic gate (Constitution IV, V, VI, IX) |

## Technical Context

Inherited wholesale from [`../_shared/plan.md`](../_shared/plan.md) — TypeScript on Node 22, NestJS,
Prisma, PostgreSQL 16, BullMQ + Valkey, React + Vite, Vitest, Testcontainers. Specific to this epic:

**Both raw and parsed engine output are stored** (`T077`). An AI agent's output is prose against a
template, not a guaranteed schema — storing only the parsed form makes any future parser bug
permanent data loss. This is recorded as deliberate complexity in `_shared/plan.md`.

**Empty output is a failure, not an empty specification** (`T075`, `FR-026`). Note that EPIC-021's
review capability deliberately **inverts** this rule — a review finding nothing is a pass. Same
contract, opposite meaning, because generation and review answer different questions.

**Out-of-date flagging never regenerates** (`T094`, `FR-032`). The specification is marked; a human
decides.

**NEEDS CLARIFICATION**: none.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | PASS — FR-010, FR-012, FR-029, FR-032 cite the Specification Manager and Traceability Model sections |
| III | Epic → Feature → Task decomposition | PASS — 7 functions, 23 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `Phase Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first — or, for document/configuration outputs, an executable conformance check | PASS — 0 gaps; 9 implementation tasks, 9 paired tests |
| VI | `specs/008-spec-authoring-generation/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution` (its first command); stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 behind `origin/epic/001-platform-foundation`, 2026-08-07 |
| — | No other Claude session on this checkout | ⚠️ **Cannot assert** — files authored outside this session appeared in the tree on 2026-08-05 |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md); platform baseline in [`_shared/platform-spec.md`](../_shared/platform-spec.md) |

**Any FAIL blocks Phase 0.** No FAIL.

**Post-design re-check**: PASS. No new design was produced, so no gate could be weakened by it.

## Review of the existing task list

**No open gaps.** Two were found and closed earlier:

- **I-02** (2026-08-03) — `FR-012` (view, edit, list specifications) had zero task coverage. Closed
  by `F-04.6`, six tasks including specification search (`T083f`/`T083g`, MPS Volume 2).
- Provenance stamping (`T081a`/`T082`) asserts engine name and version are **never left null**, which
  is what makes `FR-022` checkable rather than assumed.

One cross-epic note: `T081` in EPIC-011 pairs with `T073` **here**. That is the documented
invariant-ID convention working as intended, but it means EPIC-011 cannot verify its own
Constitution V compliance in isolation — recorded as **C5** in the 2026-08-03 analysis.

## Build order

```text
F-04.1 model ──► F-04.2 parsing ──► F-04.3 orchestration ──► F-04.4 provenance
                                                          └─► F-04.5 job API
F-04.6 read surface + search   (independent of the generate path)
F-04.7 out-of-date detection   (needs EPIC-007 F-03.6 content hashing)
```

## Design notes specific to this epic

**One transaction, or nothing.** Specification, versions, traceability links, and the job's terminal
state commit together. `SC-002` ("zero orphaned specifications") is then a property of the schema
rather than something a cleanup job repairs.

**Search is scoped before it is matched** (`T083f`). Workspace and project scoping apply first; a
search that filters after matching is a leak with a ranking algorithm.

## Phase 0 / Phase 1 outputs

**None.** Every technical question this epic raises was answered when `_shared/research.md`,
`data-model.md`, `schema.sql`, and `contracts/` were written. Generating a per-epic `research.md`
recording "no decisions" would be an artifact pretending to be work — the same judgement EPIC-016's
plan made.

## Definition of done

- [ ] 23 tasks complete, every unit test passing (Constitution V)
- [ ] A failed, cancelled, or timed-out job leaves **no** artifact behind (`SC-006`)
- [ ] Every generated specification links to at least one originating requirement (`SC-002`)
- [ ] Quickstart **V4** (generate a specification) and **V5** (failure handling) pass
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
