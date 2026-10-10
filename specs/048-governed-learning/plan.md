# Implementation Plan: Governed Learning

**Epic**: `EPIC-048` · **Branch**: `epic/048-governed-learning` · **Date**: 2026-10-09

**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md) ·
**SRS References**: PMI-DOC-004 v2.0 §6.12 (`BR-0114`–`BR-0118`), §6.10 (`BR-0094`, `BR-0095`),
§6.11 (`BR-0102`, `BR-0104`), `BR-0173`, §7 (`RULE-03`, `-04`, `-07`, `-11`); PMI-DOC-004A `G-11`,
§8 Amendment D; PMI-DOC-006 §4.1, `UX-0003`, `-0031`, `-0032`, `-0040`; `ADR-0021`, `ADR-0025`

## Summary

An agent's observation enters as an untrusted **Learning Candidate**. It becomes **approved
knowledge** only through an `EPIC-031` decision: automatic for a category the workspace has
explicitly declared low-risk, at project scope, with clean evidence; otherwise a human. Approved
knowledge is immutable and versioned. It reaches sessions only through `EPIC-038`'s context assembly,
only within its approved scope and classification, and never outside its workspace.

The design adds **no second decision record, evidence store, context assembler or Expert memory**.
The candidate cites `EPIC-032` evidence by id and digest (`R-048-8`). The decision is a
`DecisionRequest` on an opaque `learning-candidate` target (`R-048-5`). Knowledge is one more
approved source type to `EPIC-038`, judged by one admission port this Epic implements (`R-048-11`).
The Expert's permission to learn is `EPIC-047`'s contract field (`R-048-10`).

Verifying the sibling Epics against their **code**, not their documents, surfaced five things stated
up front:

1. **`EPIC-031` cannot refuse a pending decision.** Without that, nothing can be rejected, withdrawn
   or expired without a second record. This is **hard prerequisite `A-031-1`** (`R-048-5`).
2. **`EPIC-031` cannot tell an AI from a person.** Its HTTP service labels every session principal
   `human`. So "an AI never approves" is enforced **here**, in three layers, and mutation-proven
   (`R-048-6`, `MP-3`).
3. **`EPIC-047`'s `FR-EXP-020` amendment is a hard prerequisite with no workaround.** The spec's exit
   clause allowing `FR-LRN-055`/`-056` to be deferred **is not used** (`R-048-10`).
4. **`EPIC-038`'s approved set is closed by its own requirement `FR-CTX-015`.** Admitting knowledge
   needs that text amended (`A-038-1`) and one additive seam (`A-038-2`).
5. **No embedding provider exists in the programme.** So every approved entry reads *not yet
   retrievable* in the composed application until one is bound. That is `FR-LRN-053` working
   (`R-048-13`).

## Technical Context

**Language/Version**: TypeScript 5.7, Node ≥ 22

**Primary Dependencies**: NestJS 10, Prisma 5.22.
- Consumed from `main`: `EPIC-004` (audit), `EPIC-019` (steering), `EPIC-024` (access), `EPIC-028`
  (principals), `EPIC-036` (shell), `EPIC-037` (execution registry), `EPIC-041` (connector guard).
- **Open branches**: `EPIC-031` (decisions, Decision Inbox), `EPIC-032` (evidence), `EPIC-038`
  (context, Context area), `EPIC-047` (Experts). Consumed through ports bound **refusing** until
  merged (`R-048-20`).

**Storage**: PostgreSQL 16 via Prisma (`ADR-0003`).
- **10 new tables**, all append-only ([data-model.md](./data-model.md)).
- One insert trigger proving a decision stands behind every knowledge version.
- One `EPIC-019` enum value and one CHECK on an `EPIC-038` table.
- No payload from another Epic is copied.

**Testing**: Vitest 2.1:
- `backend-unit`
- `backend-integration` (Testcontainers, gated by `DOCKER_UNAVAILABLE=1`)
- `architecture`
- `frontend`
- a new `learning-contract` project

Playwright under `e2e/` for Tier 2.

**Target Platform**: Linux server + browser. Two user-facing views are delivered, hosted in other
Epics' areas, so Constitution XI Tier 2 applies.

**Project Type**:
- backend module `learning`;
- contract package `packages/learning-contract`;
- one detail renderer inside `EPIC-031`'s Decision Inbox and one sub-view inside `EPIC-038`'s
  Context area;
- **no new navigation area** (`FR-LRN-070`).

**Performance Goals** (`R-048-22`):

| Operation | Target (p95) |
|---|---|
| Submission | < 400 ms (< 800 ms including the decision request) |
| Candidate detail | < 500 ms |
| Review → materialised | < 600 ms (≤ 60 s when approved in 031's own Inbox) |
| Admission inside assembly | < 25 ms for 200 knowledge candidates |
| Knowledge browser | < 1 s at 5,000 entries |
| History | < 300 ms at 50 versions |

**Constraints**:
- Candidate and knowledge never share a table (`R-048-1`).
- One write path into knowledge, fenced by module, trigger and mutation proof (`R-048-4`).
- An AI never approves, whatever 031 records (`R-048-6`).
- Every absent port fails closed (`learning-contract.md` §5).
- Approved versions are immutable by trigger.

**Scale/Scope**: 62 FR-LRN in eight groups, 9 SC-LRN, 10 tables, 1 contract package, 12 cross-Epic
amendments (5 made by their owners, 1 proposal to `EPIC-032`, 6 additive and made here), 2 hosted views, 5 jobs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes produced only via Spec Kit commands | **PASS**. The cross-Epic amendments owned by others (`A-031-1`, `A-038-1`, `A-047-1`) go through **their** Epics' Spec Kit flow. Additive edits in other Epics' code are tasks of this Epic, each with a test in the owner's suite |
| II | Every requirement traces to a cited `SRS/` document | **PASS**. `BR-0114`–`0118` owned; `BR-0094`, `0095`, `0102`, `0104`, `0173` consumed. The screens are recorded in spec Assumptions for the PMI-DOC-006 §9 back-fill |
| III | Epic → Feature → Task; `specs/048-governed-learning/` exists | **PASS** |
| IV | `/speckit-converge` scheduled as the Epic exit gate | **PASS**: in the Exit Criteria |
| V | Every implementation task carries a failing-first unit test | **PASS**: planned in `/speckit-tasks`. Migrations get integration tests of each trigger. The steering document and the `FR-CTX-015` text get executable conformance checks |
| VI | `specs/048-governed-learning/defects/` is the sole defect intake | **PASS**: created with this plan, none recorded. Gaps found in sibling Epics are amendments or follow-ups on **their** Epics, not defects here |
| VII | local → dev → stage → prod, no environment skipped | **PASS**: promotion needs explicit authorisation |
| VIII | Session labelled with the working Epic | **PASS**: worktree `epic-048-governed-learning` |
| IX | Every stop ends with an executable next action | **PASS**: see the closing report. The Delivery Board is not changed by a plan |
| X | Decision questions batched | **PASS**. No questions in this phase: the 2026-10-09 clarifications settled all three, and none is reopened. Inconsistencies found are fixed in the plan and flagged (below). Prerequisites are routed to their owners, not asked here |
| XI | Tier 1 always; Tier 2 for a journey | **PASS**. Tier 1 through the real routes, connector route and job handlers (quickstart Q1–Q27). Tier 2 through primary navigation into both host areas (Q6, Q15, Q19, Q28, Q29). See *Reachability plan* |
| XII | Governed commands registered before executing | **PASS for what this Epic causes**: <ul><li>rule 2: submissions, refusals and corroborations are events on the source execution (`FR-LRN-060`)</li><li>rule 7: agents use a versioned, idempotent contract and never the database (`FR-LRN-061`)</li><li>rule 1: provisional executions cannot reach a decision (`FR-LRN-063`)</li><li>rule 6: see the next row</li></ul>**PARTIAL** for the commands producing this Epic's own artifacts, the programme-level gap `EPIC-038` and `EPIC-047` recorded |
| XII·6 / PP-003 | **Human-in-the-loop: an AI never approves** | **PASS by three independent layers** (`R-048-6`): <ul><li>the review route refuses non-human principals and the candidate's AI source identities;</li><li>the materialiser's approver guard accepts only a `human`-kind resolution whose approver resolves to a `User`, or `EPIC-031`'s policy automation on the eligibility-checked automatic path. This layer holds even when approval happens in 031's own Inbox, and even though 031 labels every session `human`;</li><li>the database refuses a version whose `approvedBy` is the candidate's source or whose kind is not `human`/`policy`.</li></ul>Proven by `MP-3`. People's self-approval follows 031's `selfApprovalAllowed` (`FR-LRN-027`) |
| — | Repository synced from GitHub before work started | **PASS**: worktree branched from `main` at `e47e96e` |
| — | No other Claude session active on this checkout | **PASS**: dedicated worktree. No Docker and no whole-repo suite were run by this phase |

**Post-Phase 1 re-check**: unchanged.
- The additive changes to other Epics' code (`A-031-3`, `A-032-1`, `A-038-2`, `A-037-1`,
  `A-037-2`, `A-019-1`) are each asserted in the owner's suite.
- The five owned by other Epics (`A-031-1`, `A-031-2`, `A-038-1`, `A-047-1`, `A-047-2`) are prerequisites, not edits made here.

## Required merge order

1. **`EPIC-032`**: Evidence Store.
2. **`EPIC-031`**, **with `A-031-1`** (refuse a pending decision) — **hard prerequisite, no workaround** — and `A-031-2` (Inbox detail-renderer registry).
3. **`EPIC-038`**, **with `A-038-1`** (`FR-CTX-015` admits `knowledge-entry`).
4. **`EPIC-047`**, **with `A-047-1`** (`FR-EXP-020` admits `governed-knowledge`; its `CHECK` replaced)
   and **`A-047-2`** (provenance read). **Hard prerequisite, no workaround.**
5. **`EPIC-048`**.

Steps 1–3 may land in any order among themselves. Step 4 needs all three, because `EPIC-047` consumes
them. Step 5 needs step 4 for three reasons:
- this Epic's migration has a foreign key to `EPIC-031`'s `policy_decisions`;
- it alters `EPIC-038`'s `context_reusable_authorisations`;
- its event type is the 31st after `EPIC-047`'s 30th (`R-048-17`, `R-048-21`).

## Project Structure

### Documentation (this feature)

```
specs/048-governed-learning/
├── spec.md
├── plan.md              ← this file
├── research.md          R-048-1 … R-048-22, and the verification of preliminary findings 1–8
├── data-model.md        10 tables, 1 insert trigger, changes outside this Epic
├── contracts/
│   ├── learning-api.md        routes, connector route, jobs
│   └── learning-contract.md   the package, ports, cross-Epic amendments A-0xx
├── quickstart.md        Q1 … Q29
├── checklists/
│   └── requirements.md
└── defects/             Constitution VI intake
```

### Source Code (repository root)

```
packages/learning-contract/src/
├── index.ts
├── states.ts                 CANDIDATE_STATES (exactly six), kinds, VERSION_STATUSES, APPROVER_KINDS
├── scope.ts                  ClaimedScope; isNarrowerOrEqual (FR-LRN-028)
├── submission.ts             LearningSubmissionV1, parseSubmission — every missing element named
├── supply.ts                 KnowledgeSourceReader, KnowledgeAdmission, AdmissionVerdict
└── events.ts                 LEARNING_EVENT_KINDS

backend/src/modules/learning/
├── learning.module.ts        composition; ports bound, or bound refusing
├── learning.tokens.ts        the eleven ports and what each absence does
├── learning-policy.ts        R-048-3 — parse the steering document; malformed refuses
├── submission.service.ts     FR-LRN-001…008, 010…014, 017, 060…063 — the only intake
├── secret.screen.ts          FR-LRN-018 — via EPIC-037 secretRuleMatching
├── evidence.view.ts          FR-LRN-015, 016 — state per citation, withheld per reader
├── eligibility.ts            FR-LRN-022, 026, 034, 036 — the automatic-path test (MP-2's target)
├── decision.requester.ts     FR-LRN-020…025 — DecisionRequest, action type, actor
├── approver.guard.ts         FR-LRN-027 — accept or refuse a resolution (MP-3's target)
├── review.service.ts         FR-LRN-028, 029 — terms, approve, refuse
├── materialiser.ts           FR-LRN-031, 032, 038 — THE ONLY knowledge write (MP-1's target)
├── knowledge.service.ts      FR-LRN-033, 035, 039, 073 — browse, history, provenance
├── supply.ts                 FR-LRN-040…047, 052, 055 — KnowledgeSourceReader + KnowledgeAdmission
├── retrievability.ts         FR-LRN-051, 053 — reindex and record the outcome
├── attestation.ts            FR-LRN-025 — approval/v1 contribution
├── learning.jobs.ts          resolve-decisions, request-pending, expire, flags, retrievability
├── learning.controller.ts    session routes
├── learning-connector.controller.ts   POST /projects/:projectId/learning/candidates
├── learning.store.ts         interface + in-memory (unit tests only); no insertVersion on it
├── knowledge.writer.ts       the insert the materialiser alone receives
├── learning.store.prisma.ts  PostgreSQL adapter
└── adapters/                 decisions, evidence, context, experts — LAST phase, after merge

backend/prisma/migrations/
├── <ts>_epic048_steering_subject/   ALTER TYPE "SteeringSubject" ADD VALUE 'learning_policy'
└── <ts>_epic048_governed_learning/  10 tables, CHECKs, triggers, views, 038 CHECK

frontend/src/pages/inbox-details/LearningCandidateDetail.tsx   registered by objectRef.type
frontend/src/pages/KnowledgeBrowser.tsx                         /context/knowledge
frontend/src/shell/routes.tsx                                   + SUB_VIEW '/context/knowledge'
frontend/src/services/api.ts                                    + learning client functions

Edited in other Epics, additively, each asserted in the owner's suite:
backend/src/modules/executions/sanitisation.ts           A-037-1 named rules, secretRuleMatching
packages/execution-registry-contract/src/events.ts       A-037-2 learning-candidate-recorded
backend/src/modules/decision/evaluator.ts (export only)  A-031-3 resolutionOf
frontend/src/pages/DecisionInbox.tsx                     registration only — the registry is A-031-2, EPIC-031's
backend/src/modules/evidence/evidence.service.ts         A-032-1 resolve(workspaceId, ids)
backend/src/modules/context/{retrieval/index.service.ts, sources.adapter.ts,
  provenance.service.ts, assembly.service.ts}            A-038-2 knowledge-entry + admission port
```

**Structure Decision**: one backend module, one contract package, two views hosted in other Epics'
areas. This is `EPIC-047`'s shape, plus a package, because `EPIC-038` and connectors consume this
Epic's types (`R-048-2`). Adapters for the four unmerged Epics are a single last task phase
(`R-048-20`).

## Phase 0 — Research

Complete: [research.md](./research.md). It holds 22 decisions and verifies all eight preliminary
findings against code. No new external library is introduced, so no Context7 lookup was needed.

## Phase 1 — Design & Contracts

Complete:
- [data-model.md](./data-model.md)
- [contracts/learning-api.md](./contracts/learning-api.md)
- [contracts/learning-contract.md](./contracts/learning-contract.md)
- [quickstart.md](./quickstart.md)

| Guarantee | The shape that carries it |
|---|---|
| A candidate is never knowledge (`FR-LRN-002`) | Separate tables; `EPIC-038` reads only `knowledge-entry` via `KnowledgeSourceReader`, which reads only versions |
| No knowledge without a decision (`SC-LRN-001`) | One writer, `knowledge.writer.ts`, received only by `materialiser.ts`; an insert trigger checks the `policy_decisions` row |
| No AI approves (`FR-LRN-027`) | Approver guard + review-route guard + `approvedByKind IN ('human','policy')` and source-exclusion trigger |
| Auto-approval only for an explicit category (`SC-LRN-003`) | `eligibility.ts` chooses `learning.approve.*` only when `lowRisk: true`; 031 then assigns the band |
| History is never lost (`FR-LRN-031`, `-035`, `-039`) | Every table append-only; status and flags are rows, never updates |
| Scope never widened by editing (`FR-LRN-042`) | No `PUT`/`PATCH`; widening is a `widen-scope` candidate reviewed by a human; terms ⊆ claimed by trigger |
| Reuse stays in the workspace (`FR-LRN-043`) | 038's partitioned index + admission `workspace:` + CHECK on `context_reusable_authorisations` |

## Prisma migration plan

Two migrations, both ordered after `20261008120000_epic031_decision_engine`,
`20261008220000_epic038_*` and `20261009090000_epic047_experts`. They are generated by
`prisma migrate dev --create-only`, then hand-completed with SQL Prisma cannot express, the
house practice (`EPIC-031`, `EPIC-032`, `EPIC-047`).

1. **`<ts>_epic048_steering_subject`**: `ALTER TYPE "SteeringSubject" ADD VALUE 'learning_policy'`.
   It is a separate migration because a new enum value cannot be used in the transaction that adds
   it.
2. **`<ts>_epic048_governed_learning`**:
   1. **Tables**: the ten tables in [data-model.md](./data-model.md), with:
      - `workspaceId` FK `ON DELETE RESTRICT` and an index on each table;
      - CHECKs wrapped in `COALESCE(…, false)`;
      - unique `(workspaceId, idempotencyKey)` on candidates and on corroborations;
      - unique `(candidateId, seq)` on transitions, `(entryId, version)` on versions, and
        `candidateId` on versions;
      - FKs `knowledge_entry_versions.decisionId` and `.resolvingDecisionId` → `policy_decisions.id`.
   2. **Append-only**: `CREATE TRIGGER "<table>_immutable" BEFORE UPDATE OR DELETE … EXECUTE
      FUNCTION reject_mutation()` on **all ten tables**. The shared function is attached and never
      redefined (`migrations/20260814000000_init/migration.sql:158-162`). This is the immutability
      of approved knowledge history: versions, status events, flags and retrievability can only be
      appended (`FR-LRN-031`, `-035`, `-039`).
   3. **`knowledge_versions_require_decision`**: a `BEFORE INSERT` trigger on
      `knowledge_entry_versions` (`R-048-4`, `R-048-6`). It checks:
      - the decision exists, is in the same workspace and targets this candidate;
      - the resolving outcome is `approved` or `auto-executed`;
      - a `human` approval is a `human`-kind `approved` row;
      - `approvedBy` is not the candidate's source principal or Expert.
   4. **`learning_transitions_guard`**: a `BEFORE INSERT` trigger on
      `learning_candidate_transitions`. It refuses:
      - any row after a terminal state;
      - `approved` unless a `knowledge_entry_versions` row for the candidate exists in the same
        transaction, so the two are inserted together, version first.
   5. **`learning_review_terms_within_claim`**: a `BEFORE INSERT` trigger refusing an
      `approvedScope` wider than the candidate's `claimedScope` (`FR-LRN-028`).
   6. **`learning_candidates_have_evidence`**: a `DEFERRABLE INITIALLY DEFERRED` constraint trigger
      requiring at least one citation at commit (`FR-LRN-012`).
   7. **Views**: `learning_candidate_current` and `knowledge_current_versions`, each the latest
      transition or status row.
   8. **`EPIC-038`**: `ALTER TABLE "context_reusable_authorisations" ADD CONSTRAINT
      "no_cross_workspace_knowledge" CHECK ("sourceType" <> 'knowledge-entry') NOT VALID`, then
      `VALIDATE` (no rows can match today). This is `FR-LRN-043`, removed only by the Epic that
      discharges `DEFER-048-01`.

   Each trigger and CHECK gets an integration test that attempts the forbidden write and observes the
   refusal (quickstart Q24, Q27).

## Reachability plan (Constitution XI) — two views hosted in other Epics' areas

| View | Host area (owner) | Reached from primary navigation by | Tier 1 | Tier 2 |
|---|---|---|---|---|
| Candidate review | **Decision Inbox**, `/decisions`, group *overview* (`EPIC-031`, `areas.ts:131-141` on its branch) | Inbox entry for target type `learning-candidate` → `LearningCandidateDetail`, registered into `EPIC-031`'s `A-031-2` registry | `GET /inbox` lists the candidate; `GET /learning/candidates/:id` and `POST /learning/candidates/:id/review` against the composed `AppModule`; `POST /decisions/:id/approve` (031's own route), then the `learning.resolve-decisions` job through the job runner | Playwright: sign in → **Decision Inbox** in the nav → open the candidate → see evidence, scope and the superseded entry side by side → approve narrowed. Repeated at 360px |
| Knowledge browser | **Context**, `/context`, group *platform* (`EPIC-038`, `areas.ts:254-265` on its branch) | Link from the Context page to `/context/knowledge`, a `SUB_VIEWS` entry (`routes.tsx:44-77`) | `GET /learning/knowledge`, `/:entryId`, `/:entryId/history` against the composed module; `POST /context/packages` showing the knowledge item and the exclusions | Playwright: **Context** in the nav → **Knowledge** → filter by status → open history |

The tests asserting the host-area placement are:
- architecture: `areas.ts` gains **no** entry from this Epic (`FR-LRN-070`), and `learning` declares
  no workflow type;
- frontend: `routes.spec.tsx` resolves `/context/knowledge` to one owner;
- frontend: the Inbox renders the registered detail for `learning-candidate` and the plain row for
  every other type.

The Tier 2 transcript is written by the run to `docs/uat/EPIC-048-transcript.md`, never by hand.

## Mutation proofs (`SC-LRN-001`, `SC-LRN-003`, and `FR-LRN-027`)

Each proof is recorded at the moment of observation in `specs/048-governed-learning/mutation-proofs.md`
(`EPIC-035`'s precedent):
- the file is copied aside;
- the mutation is applied;
- the failing tests are named with counts;
- the file is restored and `cmp` confirms it identical.

The tests that must catch each mutation are written **before** the code, in `/speckit-tasks`.

| Id | Requirement | Mutation | Must be caught by |
|---|---|---|---|
| **MP-1a** | `SC-LRN-001`, `FR-LRN-001` | **Add a direct write path**: a `POST /learning/knowledge` route that calls `knowledge.writer.insertVersion` with a fabricated version | <ul><li>architecture test `learning-single-write-path.spec.ts`: only `materialiser.ts` imports the writer, and no route in the composed app maps to a knowledge write</li><li>Tier 1 route test asserting no route creates knowledge</li><li>at runtime, the insert trigger refuses the fabricated row (no resolved decision)</li></ul> |
| **MP-1b** | `SC-LRN-001` | In `materialiser.ts`, skip the approver guard's verdict (`if (!verdict.accepted) return` → removed) | Unit tests of the materialiser: a pending, refused or unaccepted resolution writes no version. Integration: the trigger refuses a pending decision (Q27). The DB fence is shown to stand when the code fence is removed |
| **MP-2** | `SC-LRN-003`, `FR-LRN-022` | **Remove the explicit-category check**: delete the `category.lowRisk` term from `eligibility.ts` | Unit and route tests (Q11, Q12). They use the **real** `EPIC-031` `DecisionEngine` over its in-memory repository, with steering deliberately **permissive** (`learning.approve.*` → `low`, low = auto-execute, automation permitted). This Epic's check is then the only fence, so removing it must turn "waits for a human" into "auto-executed" and fail the test |
| **MP-3** | `FR-LRN-027`, `SC-LRN-003` second clause | **Remove the principal-kind check** in `approver.guard.ts` | Unit + Q14: a decision approved through `DecisionEngine.approve` with `{kind: 'human', id: <agent principal id>}` (exactly what 031's HTTP service records for any session) must not be accepted. With the check removed, a version is written and the test fails. The DB source-exclusion check still refuses when the approver is the candidate's own source, so a second test uses a *different* agent to isolate the guard |

## Risks

| Id | Risk | Mitigation / disposition |
|---|---|---|
| **RK-1** | Four dependencies are unmerged, and two hard prerequisites (`A-031-1`, `A-047-1`) belong to other Epics' owners | Ports bound refusing; adapters last; merge order stated. The closing report names any prerequisite not landed. **No workaround is planned for either** |
| **RK-2** | No embedding provider (`FR-CTX-013` port unowned), and no write path for `EPIC-038` source classes (`DEF-038-007`) | Every approved entry reads *not yet retrievable* with the reason. Reuse is proven with in-test bindings at Tier 1; in the running stack, Tier 2 shows the honest *not yet retrievable* |
| **RK-3** | `DEF-047-001`: an Expert run cannot be registered with `EPIC-037` in the composed app | No Expert-sourced candidate exists in production until it closes. `FR-LRN-055` is proven at Tier 1 with in-test Expert sessions |
| **RK-4** | `EPIC-031`'s record may say "approved by human X" where X is an agent principal, and this Epic refuses to accept it | The divergence is visible: flag `decision-not-accepted` with the reason, and an audit record. Raised to `EPIC-031` as a follow-up (`ActorRef` has no *agent*) |
| **RK-5** | A workspace that classifies `learning.review.*` as `low` gets an auto-executed review that this Epic will not accept, and the decision is then closed in 031 | Fail closed: flag `policy-auto-executed-review`, no knowledge written. The spec's follow-up asks 031 to put `learning.review.*` in `IRREDUCIBLY_HIGH` |
| **RK-6** | `EPIC-032` has no retirement | `retired` is reserved and never produced. The `FR-LRN-037` *retired* trigger is unreachable until 032 adds it; stated in the closing report |
| **RK-7** | "Marked invalid" is not an `EPIC-037` concept, and "work reverted" is undetectable | Defined from governance events (`R-048-17`). Reverted work is recorded as a limitation |
| **RK-8** | No milestone Tier 2 transcript has yet been collectable in this programme (`EPIC-046` closure) | The Playwright spec is planned early; if the stack cannot run, the gate stays open and the closing report says so rather than substituting evidence |
| **RK-9** | Enabling anything beyond human review needs three policy documents per workspace (learning policy, classification rule, tenant `automatedActions`) | Documented in the quickstart. Safe by default: with none, everything waits for a human (`SC-LRN-008`) |
| **RK-10** | `EPIC-047`'s code was read from an **uncommitted** working tree | `A-047-1`/`A-047-2` are stated as behaviour, not line edits. Re-verify at merge |
| **RK-11** | A category classified `medium` is refused by 031 (no gates named) | Documented: classify learning actions `low` or `high` |
| **RK-12** | `EPIC-032` and `EPIC-038` govern access only for `specification`/`project` targets (`DEF-032-003`, `DEF-038-001`) | Consumed as-is; withholding is exactly as strong as `EPIC-024`'s rule there |

## Spec inconsistencies found and fixed in the plan (flagged, not reopened)

1. **`FR-LRN-045`** asks for an exclusion naming *scope*. `EPIC-038` has no `scope` reason code.
   **Fix**: `boundary`, with `detail` beginning `scope:` (`R-048-11`).
2. **Epic Exit Criteria** allow `FR-LRN-055`/`-056` to be deferred. **Fix**: not used. `A-047-1` is a
   hard prerequisite (`R-048-10`).
3. **US3-4, `FR-LRN-029`** presume a rejection path that `EPIC-031` lacks. **Fix**: prerequisite
   `A-031-1`, with no workaround, because a local rejection record would violate `FR-LRN-021`.
4. **`FR-LRN-037`** names *retired* evidence. `EPIC-032` has no retirement. **Fix**: the state is
   reserved and never produced (`RK-6`).
5. **Edge Case** *"source execution marked invalid"* has no `EPIC-037` meaning. **Fix**: defined from
   governance events (`R-048-17`).
6. **`FR-LRN-050`** places knowledge in `EPIC-038`'s approved set, which `FR-CTX-015` closes.
   **Fix**: prerequisite `A-038-1`.
7. **`FR-LRN-018`** cites `EPIC-037` for `BR-0173`, while `specs/brs-v2-reconciliation.md:133`
   traces it to `EPIC-028`. The code is `EPIC-037`'s, so the citation is kept and the discrepancy is
   noted for the register (`R-048-18`).

## Complexity Tracking

| Item | Why it is here | Disposition |
|---|---|---|
| **Four dependencies are open branches** | `EPIC-031`, `-032`, `-038`, `-047` | Ports bound refusing. Adapters are one last phase, blocked on merge (`R-048-20`) |
| **Five amendments made by other Epics** | `A-031-1`, `A-031-2`, `A-038-1`, `A-047-1`, `A-047-2` | Prerequisites in the merge order. Not made here; not worked around |
| **Six additive edits to other Epics' code, plus one CHECK on an `EPIC-038` table** | `A-031-3`, `A-032-1`, `A-038-2`, `A-037-1`, `A-037-2`, `A-019-1` | Each is asserted in the owner's suite, the pattern `EPIC-038` and `EPIC-047` established |
| **A new contract package** | `EPIC-038` and connectors consume this Epic's types | `R-048-2`. It exists so `EPIC-038` never imports from `modules/learning` |
| **Two declarations to opt a category into automatic approval** | The explicit category (`FR-LRN-022`) is learning policy; the band (`FR-LRN-023`) is 031's | Deliberate. Each is a versioned, attributed steering document. Fewer would merge two owners' rules (`R-048-12`) |
| **A foreign key into another Epic's table** | `knowledge_entry_versions.decisionId` → `policy_decisions.id` | The table is append-only by 031's own trigger. This is the fence `SC-LRN-001` rests on |
| **Gate XII is PARTIAL for authoring commands** | The commands producing these artifacts run outside a registered execution | The same programme-level gap `EPIC-038` and `EPIC-047` recorded |
