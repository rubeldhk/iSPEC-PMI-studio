# Implementation Plan: Decision & Policy Engine

**Branch**: `epic/031-decision-policy-engine` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Epic**: `EPIC-031` | **SRS References**: `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` §6.7 (`BR-0066`–`BR-0069`), §6.18 (`BR-0174`), §6.20 (`BR-0192`), §7 (`RULE-03`, `RULE-04`, `RULE-11`); `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` §5 (`UX-0021`), §6.2 (`UX-0032`, `UX-0033`)

**Input**: Feature specification from `/specs/031-decision-policy-engine/spec.md`

## Summary

Build the risk-adaptive decision engine and the Decision Inbox it feeds — the **Decide** stage of the
Governed Engineering Loop, shared by all three Rooms rather than reimplemented in each.

The technical approach, from Phase 0: classification rules become a **steering subject** in
`EPIC-019`'s existing system, which already supplies versioning, scope composition and `BR-0071`
precedence (`R-031-1`); a **small evaluator** is built rather than a policy engine adopted, taking
Cedar's default-deny and forbid-overrides-permit while explicitly rejecting its skip-on-error
(`R-031-2`); the `BR-0005` authority record is **published** as `packages/decision-contract` for
`U-02` to adopt (`R-031-3`); and the Inbox is **derived at read time**, never stored (`R-031-4`).

Two guarantees are structural rather than procedural: `explanation` is non-optional in the contract
*and* `NOT NULL` in the schema, so an unexplained decision is unrepresentable; and
`effectiveClass = 'high' ⇒ actorKind = 'human'` is a database check constraint, not a service branch.

## Technical Context

**Language/Version**: TypeScript 5.7, Node ≥ 22

**Primary Dependencies**: NestJS `^10.4.15`, Prisma `^5`, React 18 (the Inbox page). **No new
runtime dependency** — `R-031-2` rejects a policy engine, with reasons. `supertest` arrives via
`EPIC-030` `T993d`/`T993e`; if that has not merged when this Epic implements, its `TS-001` register
entry becomes this Epic's task.

**Storage**: PostgreSQL via Prisma (`ADR-0003`). Four new tables. **Classification rules are not
among them** — they are steering documents (`R-031-1`).

**Testing**: Vitest 2.1.8. Projects touched: `backend-unit`, `backend-integration`, `architecture`,
`frontend`, plus a new `decision-contract` project (`TS-004`).

**Target Platform**: Linux server, plus a browser page for the Inbox

**Project Type**: Workspace package + backend module + one frontend page

**Performance Goals** *(resolved by `R-031-6`)*: decision evaluation **p95 < 40 ms** excluding gate
providers; end-to-end decide including steering resolution and audit **p95 < 120 ms**; Inbox read
**p95 < 250 ms at 500 open items per reader**; **≥ 50 decisions/second** per workspace.

**Constraints**: the high band is not reachable by any tenant configuration (`FR-DPE-012`); every
decision carries an explanation, enforced by type and by schema; every unfilled port refuses
(`FR-DPE-050`); no Room vocabulary in the contract package; the decide budget must compose inside
`EPIC-030`'s 50 ms transition budget, which is why it is tighter.

**Scale/Scope**: **32 functional requirements across six groups**, 8 success criteria, 4 new tables,
5 HTTP routes, 4 ports, 1 new page. Three Rooms (`EPIC-033`–`035`) and `EPIC-030` consume this
contract.

> **Counted, not asserted.** The first draft of this line said *"30 across seven groups"* — the same
> `I1` defect `EPIC-030`'s analysis found in its own plan hours earlier, reproduced while writing the
> next one. Every figure above is now extracted from the artifacts: requirement identifiers from
> `spec.md`, tables from [data-model.md](./data-model.md), routes and ports from
> [contracts/decision-contract.md](./contracts/decision-contract.md). A count that agrees with
> nothing but itself is the `G-36` class PMI-DOC-004 §0.3 closed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes in this plan will be produced only via Spec Kit commands — no direct edits | **PASS** — the only file edited directly is `.specify/templates/plan-template.md`, on Constitution I's exempt list |
| II | Every requirement traces to a cited `SRS/` document; untraced items listed in Assumptions | **PASS** — every requirement traces to an approved `BR-` or to the Accepted `ADR-0025` |
| III | Work is decomposed Epic → Feature → Task; Epic ID assigned and `specs/<epic-id>/` exists | **PASS** — `EPIC-031`, `specs/031-decision-policy-engine/` |
| IV | `/speckit-converge` is scheduled as the Epic exit gate before any promotion | **PASS** — Epic Exit Criteria |
| V | Every implementation task carries a mandatory unit-test task, written to fail first — or, for document/configuration outputs, an executable conformance check that can fail | **PASS** — the non-code output is the classification-rule steering documents; their conformance check reads them and fails on a rule that names no band or no action pattern. Four mutation checks are Epic Exit Criteria |
| VI | `specs/<epic-id>/defects/` exists and is the sole intake for defects in this Epic | **PASS** — exists, carried in the git index via `.gitkeep` |
| VII | Changes land in the local Claude repo first; promotion follows local → dev → stage → prod | **PASS** — local branch only; nothing pushed |
| VIII | Session/clone is labelled with the working Epic (`EPIC-### <name>`), or the first command | **PASS** — branch `epic/031-decision-policy-engine` matches `specs/031-decision-policy-engine` |
| IX | Every stop in this run ends with an executable next action; full stops close with a Work Completed + Recommended Next Task report, and the Delivery Board is refreshed (or declared stale) when displayed state changed | **PASS, with a declared staleness** — the board is **stale**: six Epics declared, `EPIC-030` now `Ready`, and `EPIC-031`–`035` moved to `Checklisted`. This session cannot reach the artifact, so Constitution IX's stated fallback applies and the delta is named here |
| X | Decision-phase questions were batched into one questionnaire with recommended defaults; execution phases run without confirmation pauses | **PASS** — the clarification round asked nine questions across five Epics in **one** questionnaire; this plan has paused for nothing |
| XI | **Tier 1 (always)** — every user-facing capability has a planned test driving it through its **real entry point** against the composed module graph, not a hand-assembled one; a mocked collaborator does not satisfy this. **Tier 2 (Epics delivering a journey)** — a **run-generated** transcript against a running application is planned as closure evidence. An Epic with no user-facing capability records that, rather than omitting the row | **PASS** — Tier 1 planned (`R-031-7`, quickstart 11), reusing `EPIC-030`'s pattern. **Tier 2 applies in full**: the Decision Inbox is a journey, and quickstart 12 requires a run-generated transcript |
| — | Repository was synced from GitHub before this work started | **PASS** — `git fetch --all` this session; `main` level with `origin/main` |
| — | No other Claude session is active on this checkout (else: work in a separate clone) | **PASS** — **discharged 2026-08-23**. Implementation runs in the dedicated worktree `.claude/worktrees/epic-031-decision-policy-engine`, created this date; the primary checkout returned to `main`. Discharged by **isolation, not exclusivity** — the reading `EPIC-029` recorded on 2026-08-21 and `EPIC-030` on 2026-08-22. See Complexity Tracking |

Any FAIL blocks Phase 0. Record justified deviations in Complexity Tracking below.

> **Gate XI is present because this branch took it.** The row lives in
> `.specify/templates/plan-template.md`, added on `epic/030` under the constitution's v1.5.0
> follow-up. Because Wave 1 branches were each cut from `main`, that edit did not travel — it was
> brought across as **byte-identical content** from `epic/030` so the two branches merge cleanly.
> Every remaining Wave 1 Epic needs the same step before its `/speckit-plan` run, until `epic/030`
> merges.

**Post-Phase-1 re-check (2026-08-22)**: re-evaluated after `research.md`, `data-model.md`,
`contracts/` and `quickstart.md`. **No gate changed status.** Gate V strengthened: Phase 1 turned
three mutation checks into concrete quickstart scenarios (1, 3, 8) with the inversion each must
survive, and moved two guarantees from service code into the type system and the schema, where a
test cannot forget to check them.

**Post-discharge re-check (2026-08-23)**: the concurrent-session gate moved **FAIL → PASS**
when the worktree `.claude/worktrees/epic-031-decision-policy-engine` was created and the primary checkout returned to
`main`. **It is the only status that changed.** `DOR-06` reads the leading word of each status
cell and now finds no `FAIL`, so this plan no longer holds the Epic out of `Ready`.

The gate was never asserted to pass. It was **discharged**, and the difference matters: this
checkout still shows 10+ `claude.exe` processes and exclusivity is still unverifiable. What
changed is that this Epic's implementation no longer shares a working tree with anything else —
which is what the rule protects, and the only part of it this session could establish.

## Project Structure

### Documentation (this feature)

```text
specs/031-decision-policy-engine/
├── plan.md                    # This file
├── research.md                # Phase 0 — 8 decisions, Context7 IDs recorded
├── data-model.md              # Phase 1 — 4 entities, 1 derived view, 1 deliberately elsewhere
├── quickstart.md              # Phase 1 — 12 runnable scenarios
├── contracts/
│   └── decision-contract.md   # Phase 1 — bands, authority record, decide call, ports
├── checklists/requirements.md
├── defects/
└── tasks.md                   # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/decision-contract/          # NEW — the fifth *-contract package (R-031-3)
├── src/
│   ├── bands.ts                     # RISK_BANDS — three members, no fourth
│   ├── authority.ts                 # DecisionAuthorityRecord — published for U-02
│   ├── ports.ts                     # SteeringSource, GateProvider,
│   │                                #   EvidenceContractSource, AuditSink
│   ├── types.ts                     # DecisionRequest/Result, Explanation, GateResult
│   └── index.ts
├── tests/
├── package.json
└── tsconfig.json                    # TS-004 — typechecks independently

backend/src/modules/decision/        # NEW — note: NOT `decisions/`, which is EPIC-016's ADR store
├── decision.module.ts               # registered in app.module.ts — the XI Tier 1 subject
├── decision.controller.ts           # the 5 real entry points
├── classifier.ts                    # steering-resolved rules → RiskBand (FR-DPE-001..006)
├── evaluator.ts                     # band + policy + gates → DecisionResult (R-031-2)
├── policy.loader.ts                 # load-time refusal of a policy lowering the high band
├── explanation.builder.ts           # FR-DPE-041, FR-DPE-042
├── inbox.projection.ts              # derived at read time (R-031-4)
└── decision.tokens.ts

backend/prisma/
├── schema.prisma                    # + Decision, Explanation, Exception, TenantPolicy
└── migrations/                      # + 1 migration

frontend/src/pages/
└── DecisionInbox.tsx                # NEW — the Tier 2 journey (UX-0021)

backend/tests/
├── integration/
│   ├── decision-reachability.spec.ts    # XI Tier 1 — imports AppModule
│   ├── decision-high-band-fence.spec.ts # FR-DPE-012, enumerates the config surface
│   └── decision-fail-closed.spec.ts     # FR-DPE-050
└── architecture/
    ├── decision-independence.spec.ts    # no Room vocabulary; RISK_BANDS.length === 3
    └── classification-rules-conformance.spec.ts  # Constitution V, non-code output
```

**Structure Decision**: the `packages/<x>-contract` + `backend/src/modules/<x>` split, now used five
times. **The module is `decision/`, singular** — `backend/src/modules/decisions/` already exists and
is `EPIC-016`'s ADR store (`AdrRecord`), a different thing sharing a word. Naming the new module
`decisions/` would have been the `D-33` collision repeated in a directory name.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **Constitution gate: "No other Claude session is active on this checkout" — was FAIL, ✅ discharged 2026-08-23** | Planning writes no application code, and the isolation rule's rationale binds implementation. This checkout still shows 10+ `claude.exe` processes and exclusivity cannot be asserted, so it is recorded as FAIL rather than assumed — the same honest reading `EPIC-029` and `EPIC-030` took | Asserting the gate passes was rejected as unverifiable. **Discharge, before `/speckit-implement`**: a dedicated worktree at `.claude/worktrees/epic-031-decision-policy-engine`, the convention `EPIC-030` established and four siblings already follow. `EPIC-030` proved the step: the gate then moves FAIL → PASS and `DOR-06` clears |
| **A fifth `*-contract` package** | `packages/decision-contract` is the fifth | A shared `packages/contracts` barrel was rejected for `EPIC-030` and is rejected again for the same reason: `TS-004` requires each package to typecheck independently, and a barrel couples five release cadences |
| **Classification rules stored outside this Epic's schema** | `R-031-1` puts them in `EPIC-019` steering, so this Epic's correctness depends on another Epic's store | Owning them here was rejected: it would mean a second precedence implementation beside `BR-0071`'s working one. The cost is a real coupling, recorded rather than hidden — and `FR-DPE-050` makes an unreadable ruleset **refuse**, so the coupling fails safe |
