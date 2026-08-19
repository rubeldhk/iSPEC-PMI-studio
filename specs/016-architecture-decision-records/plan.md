# Implementation Plan: Architecture Decision Records

**Epic**: `EPIC-016` | **Module**: M-13 | **Date**: 2026-08-04 | **Spec**: [spec.md](./spec.md)

**Tasks**: 12 · [tasks.md](./tasks.md) | **Posture**: ⏸ **HELD** (decision D-10)

**Shared design** — not duplicated here: [`../_shared/`](../_shared/)
([data-model](../_shared/data-model.md) · [schema](../_shared/schema.sql) ·
[platform-api](../_shared/contracts/platform-api.md) · [system-design](../_shared/system-design.md))

## Summary

ADRs as a **product feature**: decisions recorded against a project and linked to the specifications
they affect. The SRS mandates them twice — `PMI-DOC-000` §9 and the Product Charter both require
architecture decision records from day one — and FR-034 is where PMI Studio offers that to its users.

The smallest epic in the programme, and entirely designed already. Every artifact it needs exists in
`_shared/`: the entity, the enum, two tables, and four endpoints. **This plan adds no design.** What
it does add is a record of three gaps the existing task list does not cover.

## Scope

| Function | Tasks | What it delivers |
|---|---|---|
| F-13.2 Architecture Decision Records | 8 | ADR model, service, and endpoints; linking; the V14 quickstart scenario |
| Phase Z Epic closure | 4 | Per-epic gate (Constitution IV, V, VI, IX) |

**Out of scope**: the programme's **own** decision record in [`adr/`](../../adr/), which already
exists with ADR-0001 to ADR-0005 (decision D-11). That directory is how this programme governs
itself; this epic builds the feature PMI Studio offers its users. They share a format and nothing
else — see the design note below.

## Technical Context

Inherited wholesale from [`../_shared/plan.md`](../_shared/plan.md) — TypeScript on Node 22, NestJS,
Prisma, PostgreSQL 16, Vitest. Nothing about this epic is technically distinctive; it is standard CRUD
over a designed schema.

**The design is complete and already written**:

| Artifact | Where |
|---|---|
| `ArchitectureDecisionRecord` entity | [`_shared/data-model.md`](../_shared/data-model.md) §ArchitectureDecisionRecord |
| `architecture_decision_records` table, `adr_status` enum, `adr_specification_links` join table | [`_shared/schema.sql`](../_shared/schema.sql) |
| Four endpoints — list, create, patch, link | [`_shared/contracts/platform-api.md`](../_shared/contracts/platform-api.md) §Architecture Decision Records |

**Status model**: `proposed → accepted → superseded`, a database enum. Simpler than the six-state
specification lifecycle and deliberately unconnected to it.

**Constraint already specified**: `UNIQUE (project_id, reference)` — an ADR reference such as
`ADR-0001` is unique **within a project**, not globally.

**NEEDS CLARIFICATION**: none. Every open question this epic could raise was settled when the shared
data model and API contract were written.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes produced only via Spec Kit commands — no direct edits | PASS |
| II | Every requirement traces to a cited `SRS/` document | PASS — FR-034 cites `PMI_Studio_Reference_Documents_for_SpecKit.docx` "Maintain Architecture Decision Records from day one" and `PMI-DOC-002` Governance, via [`_shared/platform-spec.md`](../_shared/platform-spec.md) |
| III | Work decomposed Epic → Feature → Task; Epic ID assigned and directory exists | PASS — 1 function, 12 tasks |
| IV | `/speckit-converge` scheduled as the Epic exit gate | PASS — `Phase Z` present in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit-test task, written to fail first | PASS — 4 implementation tasks, 4 paired unit tests, plus a contract test. ✅ G-16.2 closed 2026-08-04 |
| VI | `specs/016-architecture-decision-records/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session/clone labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution` (its first command); the terminal title is not settable from inside the session, so the label is stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before this work started | PASS — 0 commits behind `origin/main`, verified 2026-08-04 |
| — | No other Claude session active on this checkout | PASS — single session; asserted by the operator, not independently verifiable |
| — | Principle register present, deferrals argued (D-6) | PASS — this epic declares *no deltas*; it inherits the platform baseline unchanged |

**Any FAIL blocks Phase 0.** No FAIL. Gate V's earlier qualification (G-16.2) was closed by the task regeneration of 2026-08-04.

**Post-design re-check**: **PASS.** No gate weakened — there was no new design to weaken one. The
review did surface three coverage gaps in the existing task list, recorded below; none is a
constitution violation, and all three are cheap to fix while the epic is held.

## Gaps this plan recorded — ✅ all three closed 2026-08-04

Writing this plan was the first time EPIC-016 had been reviewed against the shared design. Three
things did not line up. All three were closed by `/speckit-tasks` on 2026-08-04, taking the epic from
6 tasks to 12. They are kept here as the record of why the task list has the shape it does.

### G-16.1 · T143 is too coarse to be one task

`T143` reads *"Implement Architecture Decision Record model, service, and endpoints in
`backend/src/modules/decisions/`"* — a Prisma model, a service, and four endpoints, targeting a
**directory** rather than a file. Every comparable epic splits these: EPIC-006 uses T053 (model),
T054 (service), T055 (controller); EPIC-007 and EPIC-012 do the same.

One task covering three layers cannot fail informatively, and its single paired unit test cannot
cover all three.

✅ **Closed** — split into `T143` (model), `T143a` (service), `T143b` (controller), each with a
paired test: `T144`, `T144a`, `T144b`.

### G-16.2 · Four specified endpoints have no contract test

`platform-api.md` specifies `GET` and `POST /projects/{id}/decisions`, `PATCH /decisions/{id}`, and
`POST /decisions/{id}/links`. Every other endpoint-bearing epic carries a contract test task —
T051 (projects), T063 (requirements), T076 (generation jobs), T098 (tasks), T119 (validation),
T129 (traceability). **EPIC-016 had none.** This is the same class as finding **G1** in EPIC-012,
inverted: there, a contract test existed with no implementation; here, an implementation was planned
with no contract test.

✅ **Closed** — `T144c` adds contract tests for all four endpoints.

### G-16.3 · FR-034 has no quickstart scenario

`_shared/quickstart.md` contained no ADR validation. FR-034 was the only requirement in the platform
spec with no end-to-end scenario proving it, and EPIC-014's `T153` executed quickstart V1–V12 as a
release gate — so it would have passed without ever exercising ADRs.

✅ **Closed** — `T143c` writes scenario **V14**, and EPIC-014 `T153` was updated to execute
`V1–V12 and V14` so the release gate actually covers it.

### Ordering nit

`T144` (tests) is listed before `T143` (implementation) — correct execution order, but the IDs are
inverted. This is the only place in 375 tasks where a test's ID exceeds the implementation it covers,
recorded as finding **I6** on 2026-08-03. Cosmetic; leave it, or renumber at the D-1/D-9 pass.

## Build order

```text
T144  ─► T143  model
 T144a ─► T143a service
  T144b + T144c ─► T143b controller (4 endpoints)
                     └─► T143c quickstart V14
                          │
               (linking needs EPIC-008 specifications)
```

**Depends on EPIC-006** for `project_id` — `architecture_decision_records` carries a required foreign
key to `projects`. **Depends on EPIC-008** for `adr_specification_links`, which references
`specifications`. Both are held, which is why this epic is held: it is not blocked on design, it is
blocked on tables that do not exist yet.

## Design notes specific to this epic

**A reference is unique per project, not globally.** `UNIQUE (project_id, reference)` is already in
the schema. Two projects may each hold an `ADR-0001`, and that is correct — a decision record belongs
to the project that made the decision.

**⚠️ The reference format collides with the programme's own ADRs.** This repository holds
`adr/ADR-0001-spec-kit-behind-engine-adapter.md`; a user's project may hold an ADR whose reference is
also `ADR-0001`. They are unrelated. Anything that reports or exports ADRs should make clear which
population it is showing — a defect here would be a confusing report, not a data error, which makes
it the kind that survives review.

**Status is not a lifecycle.** `proposed → accepted → superseded` is a three-value enum with no
transition guards, no attribution table, and no versioning — deliberately unlike the specification
lifecycle (EPIC-009). An ADR is superseded by another ADR, not by a state machine. Resist reusing
`LifecycleTransition` here.

**Superseding is a link, not a deletion.** A superseded ADR stays readable, consistent with how the
platform treats retired requirements (FR-006) and archived specifications (FR-011b). The `superseded`
status marks it; nothing removes it.

## Phase 0 outputs

**None.** No unknowns to research — every technical question this epic could raise was answered when
`_shared/data-model.md`, `schema.sql`, and `platform-api.md` were written. Generating a `research.md`
recording "no decisions" would be an artifact pretending to be work.

## Phase 1 outputs

**One, added by the task regeneration**: quickstart scenario **V14** for FR-034, written into
`_shared/quickstart.md` by `T143c`. Otherwise this epic *implements* existing shared artifacts: This epic *implements* existing shared artifacts rather than adding to them:

- [`../_shared/data-model.md`](../_shared/data-model.md) — the `ArchitectureDecisionRecord` entity
- [`../_shared/schema.sql`](../_shared/schema.sql) — `architecture_decision_records`,
  `adr_specification_links`, `adr_status`
- [`../_shared/contracts/platform-api.md`](../_shared/contracts/platform-api.md) — the four endpoints

✅ The FR-034 quickstart gap (**G-16.3**) is now owned by `T143c`.

## Definition of done

- [ ] 12 tasks complete, every unit test passing (Constitution V)
- [ ] An ADR can be created against a project, moved `proposed → accepted → superseded`, and linked to
      the specifications it affects
- [ ] `UNIQUE (project_id, reference)` enforced — two projects may each hold `ADR-0001`
- [ ] A superseded ADR remains readable
- [ ] Cross-workspace access to an ADR returns **404, not 403** (EPIC-004 convention)
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records

## Complexity Tracking

> No Constitution Check violations, and no deliberate complexity — this is the simplest epic in the
> programme. The only entries worth recording are the three gaps above, which are *under*-specification
> rather than over-complexity.
