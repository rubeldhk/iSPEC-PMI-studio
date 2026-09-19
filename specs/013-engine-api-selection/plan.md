# Implementation Plan: Engine API & Selection

**Epic**: `EPIC-013` | **Module**: M-08 | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Tasks**: see [tasks.md](./tasks.md) — counted there, never restated here (`T686`, PP-002) · [tasks.md](./tasks.md) | **Posture**: ▶ **PROCEEDING** (released 2026-08-20 by PMI-DOC-004 v1.0; see [spec.md](./spec.md))

**Shared design** — not duplicated here: [`../_shared/`](../_shared/)
([platform-spec](../_shared/platform-spec.md) · [system-design](../_shared/system-design.md) · [data-model](../_shared/data-model.md) · [schema](../_shared/schema.sql) · [platform-api](../_shared/contracts/platform-api.md)))

> ## ⚠️ Retroactive plan
>
> `tasks.md` predates this plan — these tasks were generated in the 2026-08-03 decomposition and
> never passed a Constitution Check. This plan records the technical context they assumed and
> **reviews the existing task list**. It is one of eleven written on 2026-08-07 to close finding
> **C3**, and it adds no design: everything this epic needs already exists in `_shared/`.

## Summary

The surface through which a project chooses its engine: the engines listing endpoint and the
selection control. Split from EPIC-003 because it touches `projects.controller.ts` and therefore the
held product surface, while the engine itself proceeds.

## Scope

| Function | Tasks | What it delivers |
|---|---|---|
| F-08.9 Engine API and interface | 4 | `/engines` listing endpoint, engine selection control |
| Phase Z Epic closure | 4 | Per-epic gate (Constitution IV, V, VI, IX) |

## Technical Context

Inherited wholesale from [`../_shared/plan.md`](../_shared/plan.md) — TypeScript on Node 22, NestJS,
Prisma, PostgreSQL 16, BullMQ + Valkey, React + Vite, Vitest, Testcontainers. Specific to this epic:

**This epic exists because of a file path.** EPIC-003 proceeds; this does not, purely because
`projects.controller.ts` belongs to the held product surface. It is the smallest epic in the
programme and the clearest illustration of the D-10 proceed/hold line.

**The listing endpoint returns capabilities** (`T139a`), not just names. A project choosing an engine
needs to know what that engine can do — `FR-021` refuses registration of an engine missing a Phase 1
capability, and this surface is where that becomes visible.

**NEEDS CLARIFICATION**: none.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | PASS — FR-019 cites the High-Level Architecture engine-adapter section |
| III | Epic → Feature → Task decomposition | PASS — 1 functions, 8 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `Phase Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first — or, for document/configuration outputs, an executable conformance check | PASS — 0 gaps; 2 implementation tasks, 2 paired tests |
| VI | `specs/013-engine-api-selection/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution` (its first command); stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 behind `origin/epic/001-platform-foundation`, 2026-08-07 |
| — | No other Claude session on this checkout | ⚠️ **Cannot assert** — files authored outside this session appeared in the tree on 2026-08-05 |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md); platform baseline in [`_shared/platform-spec.md`](../_shared/platform-spec.md) |

**Any FAIL blocks Phase 0.** No FAIL.

**Post-design re-check**: PASS. No new design was produced, so no gate could be weakened by it.

## Review of the existing task list

### G-13.1 · The split criterion is applied inconsistently ⚠️ open — **inherited from EPIC-003**

This epic's own Notes say it was split out *"because it touches `projects.controller.ts` and
therefore the held product surface"*. But **EPIC-003 `T138` also implements an endpoint in
`projects.controller.ts`** and remains in the *proceeding* slice.

Either `T135`/`T138` belong here, or EPIC-003's "nothing here depends on the BRS" claim is
overstated. Recorded as **I8** in the 2026-08-03 analysis and still open — it is a scope decision,
not a defect this plan can resolve.

**Nothing else.** Two implementation tasks, two paired tests, complete for its size.

## Build order

```text
F-08.9  T139a test ──► T140 /engines endpoint
        T140a test ──► T141 engine selection control
```

## Design notes specific to this epic

**Selection is per project, not per workspace** (`FR-019`). Two projects in one workspace may use
different engines — which is what makes `SC-008` ("a second engine with zero changes outside the
adapter layer") demonstrable rather than theoretical.

## Phase 0 / Phase 1 outputs

**None.** Every technical question this epic raises was answered when `_shared/research.md`,
`data-model.md`, `schema.sql`, and `contracts/` were written. Generating a per-epic `research.md`
recording "no decisions" would be an artifact pretending to be work — the same judgement EPIC-016's
plan made.

## Definition of done

- [ ] 8 tasks complete, every unit test passing (Constitution V)
- [ ] `/engines` returns each engine's capabilities, not only its name
- [ ] **G-13.1 decided** — `T135`/`T138` either move here or EPIC-003's posture is restated
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
