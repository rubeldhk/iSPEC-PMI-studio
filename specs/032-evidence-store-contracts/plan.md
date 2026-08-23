# Implementation Plan: Evidence Store & Evidence Contracts

**Branch**: `epic/032-evidence-store-contracts` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Epic**: `EPIC-032` | **SRS References**: `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` §6.15 (`BR-0140`–`BR-0142`, `BR-0144`, `BR-0146`), §7 (`RULE-05`), §2 (`BG-08`); `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` §6.1 (Room Evidence region), §9 (`UX-0060`)

**Input**: Feature specification from `/specs/032-evidence-store-contracts/spec.md`

## Summary

Build the evidence store, the Evidence Contract mechanism and the completion gate that enforces it —
the **Evidence** stage of the Governed Engineering Loop, and the substrate under the product's
stated differentiator: completion is evidence-driven rather than assertion-driven.

The technical approach, from Phase 0: **adopt the in-toto Attestation v1 envelope** rather than
invent one, taking no npm dependency (`R-032-1`); reuse `packages/storage-contract` for referenced
evidence and inherit its *"adapters RETURN failures; they never throw"* rule (`R-032-2`); publish
`packages/evidence-contract` as the sixth contract package; and derive met/unmet from evidence so
that satisfying an item by assignment is **not expressible** (`data-model.md` §3).

## Technical Context

**Language/Version**: TypeScript 5.7, Node ≥ 22

**Primary Dependencies**: NestJS `^10.4.15`, Prisma `^5`. **No new runtime dependency** —
`R-032-1` adopts a JSON schema, which is not adopting a package. `supertest` arrives via `EPIC-030`
`T916`/`T917`.

**Storage**: PostgreSQL via Prisma (`ADR-0003`) for attestations and Contract bindings; referenced
payloads via `EPIC-025`'s `StorageProvider`. **4 new tables.**

**Testing**: Vitest 2.1.8 — `backend-unit`, `backend-integration`, `architecture`, plus a new
`evidence-contract` project (`TS-004`).

**Target Platform**: Linux server. **No browser surface** — see `R-032-8`.

**Project Type**: Workspace package + backend module

**Performance Goals** *(resolved by `R-032-7`)*: evidence write **p95 < 60 ms**; Contract evaluation
at the gate **p95 < 150 ms at 50 items**; unmet-items query **p95 < 100 ms**; aggregate rollup
**p95 < 500 ms at 10,000 items**. Attestations are **append-only and never pruned**.

**Constraints**: an unmet Contract makes completion unreachable, enforced by a derived state with no
settable field; every unfilled port refuses (`FR-EVS-035`); evidence reads honour the attested
artifact's access rules (`BR-0062`) and never cross a workspace (`BR-0001`); the gate budget must
compose with `EPIC-030`'s 150 ms transition and `EPIC-031`'s 120 ms decide.

**Scale/Scope**: **34 functional requirements across six groups**, 9 success criteria, 5 user
stories, 4 new tables, 5 HTTP routes, 3 ports. Three Rooms, `EPIC-030` and `EPIC-031` consume this
contract.

> **Counted from the artifacts, not asserted.** `EPIC-030`'s analysis found this figure wrong in its
> own plan (`I1`), and `EPIC-031`'s first draft reproduced the error. Every number above is extracted
> — requirements from `spec.md`, tables from [data-model.md](./data-model.md), routes and ports from
> [contracts/evidence-contract.md](./contracts/evidence-contract.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes in this plan will be produced only via Spec Kit commands — no direct edits | **PASS** — the only directly edited file is `.specify/templates/plan-template.md`, on Constitution I's exempt list |
| II | Every requirement traces to a cited `SRS/` document; untraced items listed in Assumptions | **PASS** — every requirement traces to an approved `BR-` in §6.15 or to `ADR-0022`'s decided half |
| III | Work is decomposed Epic → Feature → Task; Epic ID assigned and `specs/<epic-id>/` exists | **PASS** — `EPIC-032`, `specs/032-evidence-store-contracts/` |
| IV | `/speckit-converge` is scheduled as the Epic exit gate before any promotion | **PASS** — Epic Exit Criteria |
| V | Every implementation task carries a mandatory unit-test task, written to fail first — or, for document/configuration outputs, an executable conformance check that can fail | **PASS** — the non-code outputs are the Evidence Contract definitions; their conformance check (`R-032-4`) fails on an item with no accepting `predicateType` and on a zero-item Contract without its policy reference |
| VI | `specs/<epic-id>/defects/` exists and is the sole intake for defects in this Epic | **PASS** — exists, carried in the git index via `.gitkeep` |
| VII | Changes land in the local Claude repo first; promotion follows local → dev → stage → prod | **PASS** — local branch only; nothing pushed |
| VIII | Session/clone is labelled with the working Epic (`EPIC-### <name>`), or the first command | **PASS** — branch `epic/032-evidence-store-contracts` matches the spec directory |
| IX | Every stop in this run ends with an executable next action; full stops close with a Work Completed + Recommended Next Task report, and the Delivery Board is refreshed (or declared stale) when displayed state changed | **PASS, with a declared staleness** — the board is **stale**: six Epics declared, `EPIC-030` `Ready`, `EPIC-031` `Analyzed`, `EPIC-032`–`035` moved. This session cannot reach the artifact, so Constitution IX's fallback applies and the delta is named |
| X | Decision-phase questions were batched into one questionnaire with recommended defaults; execution phases run without confirmation pauses | **PASS** — nine questions across five Epics in one questionnaire; this run paused for nothing |
| XI | **Tier 1 (always)** — every user-facing capability has a planned test driving it through its **real entry point** against the composed module graph, not a hand-assembled one; a mocked collaborator does not satisfy this. **Tier 2 (Epics delivering a journey)** — a **run-generated** transcript against a running application is planned as closure evidence. An Epic with no user-facing capability records that, rather than omitting the row | **PASS** — Tier 1 planned (quickstart 12), reusing `EPIC-030`'s pattern. **Tier 2 not applicable, by rule**: the *Evidence & Compliance* area needs the compliance half, which is `U-09` and unowned, and `UX-0060` forbids building an area before its Epic is declared (`R-032-8`) |
| — | Repository was synced from GitHub before this work started | **PASS** — `git fetch --all` this session; `main` level with `origin/main` |
| — | No other Claude session is active on this checkout (else: work in a separate clone) | **FAIL** — see Complexity Tracking |

Any FAIL blocks Phase 0. Record justified deviations in Complexity Tracking below.

> **Gate XI is present because this branch took it**, brought across byte-identical from `epic/030`.
> Wave 1 branches were each cut from `main`, so the template edit does not travel. `EPIC-033`–`035`
> need the same step before their plan runs.

**Post-Phase-1 re-check (2026-08-22)**: re-evaluated after all four Phase 1 artifacts. **No gate
changed status.** Gate V strengthened: Phase 1 moved three guarantees from service code into the
type system and the schema — `ContractItem` has no `met` field, `subject` is a non-empty tuple, and
`CompletionResult`'s failure branch carries a non-empty `unmet` list. Each is a check that cannot be
forgotten because there is nothing to forget.

## Project Structure

### Documentation (this feature)

```text
specs/032-evidence-store-contracts/
├── plan.md                    # This file
├── research.md                # Phase 0 — 8 decisions, Context7 IDs recorded
├── data-model.md              # Phase 1 — 4 tables, 1 embedded, 2 derived views
├── quickstart.md              # Phase 1 — 12 runnable scenarios
├── contracts/
│   └── evidence-contract.md   # Phase 1 — attestation envelope, Contract, gate, 3 ports
├── checklists/requirements.md
├── defects/
└── tasks.md                   # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/evidence-contract/           # NEW — the sixth *-contract package
├── src/
│   ├── attestation.ts                # in-toto Statement types — subject as a non-empty tuple
│   ├── predicates.ts                  # standard + PMI predicateType URIs
│   ├── contract.ts                    # EvidenceContract, ContractItem (no `met` field)
│   ├── gate.ts                        # ContractStatus, CompletionResult
│   ├── ports.ts                       # EvidenceStorage, AccessPolicy, AttestationSource
│   └── index.ts
├── contracts/                         # Evidence Contract definitions — the non-code output
│   └── *.json
├── tests/
├── package.json
└── tsconfig.json                      # TS-004

backend/src/modules/evidence/         # NEW
├── evidence.module.ts                 # registered in app.module.ts — the XI Tier 1 subject
├── evidence.controller.ts             # the 5 real entry points
├── attestation.store.ts               # append-only writes
├── contract.loader.ts                 # refuses a weakened or zero-item Contract at load
├── contract.status.ts                 # DERIVES met/unmet — FR-EVS-022, FR-EVS-027
├── completion.gate.ts                 # accepted | refused-with-unmet, as a Result
├── storage.adapter.ts                 # binds EvidenceStorage to EPIC-025's StorageProvider
└── evidence.tokens.ts

backend/prisma/
├── schema.prisma                      # + EvidenceItem, EvidenceContract,
│                                      #   WorkEvidenceBinding, CompletionAttempt
└── migrations/                        # + 1 migration

backend/tests/
├── integration/
│   ├── evidence-reachability.spec.ts      # XI Tier 1 — imports AppModule
│   ├── evidence-gate-refusal.spec.ts      # FR-EVS-030
│   └── evidence-fail-closed.spec.ts       # FR-EVS-035
└── architecture/
    ├── evidence-independence.spec.ts      # no Room vocabulary, NO VERDICT TYPE
    └── evidence-contract-conformance.spec.ts  # Constitution V, non-code output
```

**Structure Decision**: the `packages/<x>-contract` + `backend/src/modules/<x>` split, now used six
times. `storage.adapter.ts` is called out explicitly because `EPIC-031`'s analysis found the
equivalent binding missing there (`C2`) — the port existed, the adapter did not. Naming it in the
structure is the cheapest way not to repeat that.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **Constitution gate: "No other Claude session is active on this checkout" — FAIL** | Planning writes no application code, and the isolation rule's rationale binds implementation. This checkout still shows 10+ `claude.exe` processes and exclusivity cannot be asserted, so it is recorded as FAIL rather than assumed | Asserting the gate passes was rejected as unverifiable. **Discharge, before `/speckit-implement`**: a worktree at `.claude/worktrees/epic-032-evidence-store-contracts`. `EPIC-030` proved the step: the gate then moves FAIL → PASS and `DOR-06` clears |
| **A sixth `*-contract` package** | `packages/evidence-contract` | A shared barrel was rejected for `EPIC-030` and `EPIC-031` and is rejected again: `TS-004` requires independent typechecking, and a barrel couples six release cadences |
| **PMI-defined predicate types alongside standard ones** | in-toto has no approval, transcript or review-finding predicate, and `BR-0140` enumerates all three | Inventing a wholly bespoke envelope was rejected (`R-032-1`) — it would reinvent subject/digest badly and forgo `PP-015`. Waiting for standard predicates was rejected: three of the nine evidence kinds would have no representation. The split is **recorded in the contract** so a future standard predicate can replace a PMI one without the gate changing |
