# Implementation Plan: Engineering Experts

**Epic**: `EPIC-047` · **Branch**: `epic/047-engineering-experts` · **Date**: 2026-10-09

**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md) ·
**SRS References**: PMI-DOC-004 v2.0 §6.11 (`BR-0101`, `BR-0102`, `BR-0105`, `BR-0106`), §6.16
(`BR-0152`); PMI-DOC-006 §4 (Delivery › Engineering Experts)

## Summary

An Engineering Expert is a governed AI role with a versioned, approved contract. Work is
dispatched to it only inside that contract; delegation keeps every session attributable and never
widens authority; limits are enforced where the provider can, and recorded honestly where it
cannot; tasks can be assigned to an Expert by capability and policy without that assignment running
anything.

The design adds **no second agent type and no second session record**. The Expert sits on
`EPIC-028`'s agent seam (`R-047-1`), each run **is** an `EPIC-037` execution with Expert facts kept
beside it (`R-047-3`), approval **is** an `EPIC-031` decision read on demand (`R-047-5`), and the
Evidence Contract and context policy are references to `EPIC-032` and `EPIC-038`.

The research surfaced one consequence worth stating up front (`R-047-7`): no current gateway can stop
a run on tokens or cost, so under the clarified default an Expert that sets those limits is
**refused dispatch** unless its contract chooses *proceed and record*. That is the clarification
working, not a defect.

## Technical Context

**Language/Version**: TypeScript 5.7, Node ≥ 22

**Primary Dependencies**: NestJS 10, Prisma 5.22. Consumes `EPIC-024` (access), `EPIC-028` (agent
contract), `EPIC-037` (execution registry), `EPIC-046` (task store), `EPIC-036` (shell) — on `main`;
and `EPIC-031` (decisions), `EPIC-032` (evidence contracts), `EPIC-038` (context) — **open PRs**,
consumed through ports bound refusing until merged (`R-047-13`).

**Storage**: PostgreSQL 16 via Prisma (`ADR-0003`). **6 new tables** ([data-model.md](./data-model.md)),
one immutability trigger (`R-047-14`). No payloads from other Epics are copied.

**Testing**: Vitest 2.1 — `backend-unit`, `backend-integration` (Testcontainers, gated by
`DOCKER_UNAVAILABLE=1`), `architecture`, `frontend`.

**Target Platform**: Linux server + browser. A journey is delivered (the Experts screen), so
Constitution XI Tier 2 applies.

**Project Type**: Backend module `experts` + one application-shell area (`/experts`, already declared
in `frontend/src/shell/areas.ts` as `declared-not-delivered`, owner to be corrected from `EPIC-028`).

**Performance Goals**: dispatch check p95 < 300 ms; delegation tree p95 < 500 ms at 156 sessions;
screen p95 < 1.2 s at 100 Experts (`R-047-15`).

**Constraints**: approval status is derived, never cached (`R-047-5`); delegation is not the
re-run parent (`R-047-3`); nothing is recorded as enforced that the provider could not enforce
(`R-047-7`, `R-047-8`); contract versions are immutable by trigger (`R-047-14`).

**Scale/Scope**: six functional groups, 6 tables, 2 additive contract-package fields, 1 screen.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes produced only via Spec Kit commands | **PASS** |
| II | Every requirement traces to a cited `SRS/` document | **PASS** — `BR-0101`, `0102`, `0105`, `0106`, `0152`; screen requirements cite PMI-DOC-006 |
| III | Epic → Feature → Task; `specs/047-engineering-experts/` exists | **PASS** |
| IV | `/speckit-converge` scheduled as the Epic exit gate | **PASS** — in the Exit Criteria |
| V | Every implementation task carries a failing-first unit test | **PASS** — planned in `/speckit-tasks` |
| VI | `specs/047-engineering-experts/defects/` is the sole defect intake | **PASS** — created with this plan |
| VII | local → dev → stage → prod, no environment skipped | **PASS** — promotion needs explicit authorisation |
| VIII | Session labelled with the working Epic | **PASS** |
| IX | Every stop ends with an executable next action | **PASS** |
| X | Decision questions batched | **PASS** — five asked at once on 2026-10-09, all answered in one reply |
| XI | Tier 1 always; Tier 2 for a journey | **PASS** — Tier 1 through the real routes (quickstart Q5–Q13); Tier 2 transcript planned (Q17) |
| XII | Governed commands registered before executing | **PASS for what this Epic causes** — every Expert dispatch registers with `EPIC-037` before the gateway is called (`FR-EXP-060`). **PARTIAL** for the commands producing this Epic's own artifacts — see Complexity Tracking |
| — | Repository synced from GitHub before work started | **PASS** — branched from `origin/main` 2026-10-09 |
| — | No other Claude session active on this checkout | **PASS** — dedicated worktree |

**Post-Phase 1 re-check**: unchanged. The two contract-package changes are additive and each is
asserted in its owner's suite.

## Project Structure

### Documentation (this feature)

```
specs/047-engineering-experts/
├── spec.md
├── plan.md              ← this file
├── research.md          R-047-1 … R-047-15
├── data-model.md        6 tables
├── contracts/
│   └── experts-api.md
├── quickstart.md        Q1 … Q17
├── checklists/
│   └── requirements.md
└── defects/             Constitution VI intake
```

### Source Code (repository root)

```
backend/src/modules/experts/
├── experts.module.ts            composition; ports bound, or bound refusing
├── experts.tokens.ts            the ports and what each absence does
├── expert.types.ts              Expert, ContractVersion, RiskBand (local until EPIC-031 merges)
├── contract.validation.ts       FR-EXP-010/011/020/022 — every missing element named
├── registry.service.ts          FR-EXP-001…008 — register, version, submit, retire
├── approval.ts                  R-047-5 — derived status from EPIC-031
├── dispatch.service.ts          FR-EXP-012…019, 024, 060…062 — the gate before a run
├── authority.ts                 FR-EXP-014, 034 — intersection, actor and chain
├── delegation.service.ts        FR-EXP-030…037 — depth, fan-out, cycles, stop-by-parent
├── limits.ts                    FR-EXP-040…046 — narrowing, enforceability, late breach
├── assignment.service.ts        FR-EXP-050…056 — capability match, risk gate, history
├── experts.controller.ts        the routes in contracts/experts-api.md
├── experts.store.ts             interface + in-memory (unit tests only)
└── experts.store.prisma.ts      PostgreSQL adapter

packages/agent-contract/src/index.ts             + enforceableLimits? (R-047-1)
packages/execution-registry-contract/src/events.ts + expert-governance-recorded (R-047-4)

backend/prisma/migrations/<ts>_epic047_experts/  6 tables + immutability trigger

frontend/src/pages/Experts.tsx                   the view-only registry screen
frontend/src/shell/areas.ts                      engineering-experts → EPIC-047, delivered
```

**Structure Decision**: one backend module plus one page, matching `EPIC-038`'s shape. Adapters for
the three unmerged Epics live in the module under `adapters/` and are a single, last task phase.

## Phase 0 — Research

Complete: [research.md](./research.md). No new external library, so no Context7 lookup was needed.

## Phase 1 — Design & Contracts

Complete: [data-model.md](./data-model.md), [contracts/experts-api.md](./contracts/experts-api.md),
[quickstart.md](./quickstart.md).

| Guarantee | The shape that carries it |
|---|---|
| Nothing runs under an unapproved contract | Approval status has no column — it is read from `EPIC-031` at dispatch |
| No limit reads *enforced* without a provider control | `enforcement` is set only from `enforceableLimits`; absent means `unenforceable` |
| Delegation never widens authority | `effectiveAuthority` is computed as an intersection over the chain and stored on the session |
| A refused dispatch is still a record | Refusals are events on a registered execution, returned with its id |

## Complexity Tracking

| Item | Why it is here | Disposition |
|---|---|---|
| **Three dependencies are open PRs** | `EPIC-031`, `EPIC-032`, `EPIC-038` | Ports bound refusing; adapters in a last phase blocked on merge (`R-047-13`) |
| **Two edits to other Epics' contract packages** | `enforceableLimits?`, one event type | Additive, asserted in the owners' suites (`R-047-1`, `R-047-4`) |
| **A gateway registry is introduced** | Nothing selects a gateway by model today | A port only; unbound refuses (`R-047-2`) |
| **Token/cost limits refuse on every current gateway** | No gateway can stop mid-run on them | Stated in the closing report; the contract's `proceed` posture is the escape (`R-047-7`) |
| **Gate XII is PARTIAL for authoring commands** | The commands producing these artifacts run outside a registered execution | The same programme-level gap `EPIC-038` recorded |
