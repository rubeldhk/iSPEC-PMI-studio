---

description: "Task list for EPIC-031 Decision & Policy Engine"
---

# Tasks: Decision & Policy Engine

**Epic**: `EPIC-031`

**Input**: Design documents from `/specs/031-decision-policy-engine/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/decision-contract.md](./contracts/decision-contract.md),
[quickstart.md](./quickstart.md)

**Tests**: MANDATORY (Constitution V). Every task producing or changing application code names its
test. Unit tests are written FIRST and MUST fail before the implementing code. The `/speckit-tasks`
skill describes tests as optional; **the constitution overrides it**.

**Non-code outputs count too** (Constitution V, v1.2.0). This Epic's non-code outputs are the
**classification-rule steering documents**; their executable conformance check is `T733`, written
failing-first, and `T734` makes the rules pass it.

**Organization**: grouped by the six user stories of [spec.md](./spec.md).

**Task ID range**: `T716`–`T799`, 84 tasks. **Chosen, not continued.** `EPIC-030` occupies
`T913`–`T993`, and continuing from there would have reached `T1000` after six tasks — a four-digit
id the governance regex `T\d{3}[a-z]?\b` does not match, making the task **invisible** to `G-26-15`
and `DOR-08` rather than rejected. `T716`–`T799` is the largest contiguous free run in the corpus,
computed across `main` and every Wave 1 branch.

> **The uniqueness check cannot see the collision it would prevent.** `G-26-15` reads `specs/` in
> the current checkout, and `EPIC-030`'s tasks live on another branch — so `T913`+ *looks* free here
> and would collide on merge. The block above was allocated against the union of all branches
> deliberately.

**Before starting**: sync from GitHub, and **work in a dedicated worktree** at
`.claude/worktrees/epic-031-decision-policy-engine` — the plan's Constitution Check records the
concurrent-session gate as **FAIL** and `T716` is its discharge. Label the session
`EPIC-031 Decision & Policy Engine` (Constitution VIII).

**Before finishing**: close with a report (Constitution IX). The Delivery Board is **stale**;
refresh it or restate the staleness.

**Interaction budget** (Constitution X): implementation is an execution phase — run without pausing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US6
- Exact file paths in every description

## Path Conventions

Per [plan.md](./plan.md) Structure Decision:

- Contract package: `packages/decision-contract/`
- Engine: `backend/src/modules/decision/` — **singular**; `decisions/` is `EPIC-016`'s ADR store
- Inbox page: `frontend/src/pages/DecisionInbox.tsx`
- Tests: `packages/decision-contract/tests/`, `backend/tests/{unit,integration,architecture}/`

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T716 Create the worktree `git worktree add .claude/worktrees/epic-031-decision-policy-engine epic/031-decision-policy-engine` and work there — discharges the plan's one failing Constitution gate, the `EPIC-030` precedent
- [ ] T717 [P] Scaffold `packages/decision-contract/package.json` and `packages/decision-contract/tsconfig.json` so the package typechecks independently (`TS-004`)
- [ ] T718 [P] Register a `decision-contract` project in `vitest.workspace.ts` without `passWithNoTests` (`TS-005`)
- [ ] T719 [P] Add `packages/decision-contract` to the `## Paths that must not break` list in `governance/repository-layout.md` (`G-05d`)
- [ ] T720 Confirm `supertest` is present from `EPIC-030` `T916`/`T917`; if that branch has not merged, add it with its `TS-001` register entry in `specs/_shared/dependencies.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: no user story phase may start until this completes

### The contract package

- [ ] T721 [P] Write failing unit tests for the band set in `packages/decision-contract/tests/bands.spec.ts` — asserts exactly three members and **no `unknown`**
- [ ] T722 Implement `RISK_BANDS` and `RiskBand` in `packages/decision-contract/src/bands.ts` (unit test: T721) — `FR-DPE-010`
- [ ] T723 [P] Write failing unit tests for the authority record in `packages/decision-contract/tests/authority.spec.ts` — asserts the five `BR-0005` elements, all required
- [ ] T724 Implement `DecisionAuthorityRecord` in `packages/decision-contract/src/authority.ts` (unit test: T723) — `FR-DPE-014`, published for `U-02`
- [ ] T725 [P] Write failing unit tests for the decide types in `packages/decision-contract/tests/types.spec.ts` — asserts `explanation` is **non-optional** on `DecisionResult`, and `proposedClass` is separate from `effectiveClass`
- [ ] T726 Implement `DecisionRequest`, `DecisionResult`, `Explanation` and `GateResult` in `packages/decision-contract/src/types.ts` (unit test: T725) — `FR-DPE-003`, `FR-DPE-040`
- [ ] T727 [P] Write failing unit tests for the four ports in `packages/decision-contract/tests/ports.spec.ts` — asserts each has a declared absent-behaviour of refuse
- [ ] T728 Implement `SteeringSource`, `GateProvider`, `EvidenceContractSource` and `AuditSink` in `packages/decision-contract/src/ports.ts` (unit test: T727) — `FR-DPE-050`
- [ ] T729 Implement the export barrel `packages/decision-contract/src/index.ts` (unit test: T721)

### Persistence

- [ ] T730 Add `Decision`, `Explanation`, `Exception` and `TenantPolicy` models to `backend/prisma/schema.prisma` per [data-model.md](./data-model.md) §2–§5
- [ ] T731 Generate the migration under `backend/prisma/migrations/` including the **`explanationId NOT NULL`** foreign key and the **`effectiveClass = 'high' ⇒ actorKind = 'human'`** check constraint — both are fences, not conveniences (`FR-DPE-012`, `FR-DPE-040`)
- [ ] T732 [P] Write failing integration test asserting both constraints reject at the database level in `backend/tests/integration/decision-constraints.spec.ts` — an unexplained decision and an auto-approved high-band decision must both be unrepresentable

### Classification rules as steering — the non-code output

- [ ] T733 [P] Write the failing conformance check in `backend/tests/architecture/classification-rules-conformance.spec.ts` — fails on a `risk-classification` steering document naming no band, no action pattern, or a band outside `RISK_BANDS`
- [ ] T734 Author the initial `risk-classification` steering documents and make them pass (conformance: T733) — Constitution V for a non-code output
- [ ] T735 [P] Write the failing architecture test in `backend/tests/architecture/decision-independence.spec.ts` — no Room vocabulary, no loop stage names, and `RISK_BANDS.length === 3` — `FR-DPE-051`

### Module skeleton and wiring

- [ ] T736 [P] Write the failing reachability test in `backend/tests/integration/decision-reachability.spec.ts` importing the real `AppModule` — Constitution XI Tier 1, `R-031-7`
- [ ] T737 Implement `backend/src/modules/decision/decision.module.ts` and `backend/src/modules/decision/decision.tokens.ts` (integration test: T736)
- [ ] T738 Register `DecisionModule` in `backend/src/app.module.ts` (integration test: T736) — the wiring T736 exists to prove

**Checkpoint**: contract, schema and checks exist and fail for the right reasons

---

## Phase 3: User Story 1 - The high band stays human-approved (Priority: P1) 🎯 MVP

**Goal**: no tenant configuration reaches the high band

**Independent test**: [quickstart.md](./quickstart.md) Scenario 1

- [ ] T739 [P] [US1] Write failing unit tests for the classifier in `backend/tests/unit/decision-classifier.spec.ts` — action + target → band; **unclassified type yields the most restrictive band** — `FR-DPE-002`, `FR-DPE-004`
- [ ] T740 [US1] Implement `backend/src/modules/decision/classifier.ts` reading steering-resolved rules (unit test: T739) — `FR-DPE-001`, `FR-DPE-005`, `R-031-1`
- [ ] T741 [P] [US1] Write failing unit tests for policy load-time refusal in `backend/tests/unit/decision-policy-loader.spec.ts` — a policy lowering baseline change, release promotion or **loop configuration change** is refused, naming the action
- [ ] T742 [US1] Implement `backend/src/modules/decision/policy.loader.ts` (unit test: T741) — `FR-DPE-011`, `FR-DPE-012`
- [ ] T743 [P] [US1] Write the config-surface enumeration test in `backend/tests/integration/decision-high-band-fence.spec.ts` — enumerates every tenant-reachable setting and asserts none reaches the high band (`SC-DPE-001`)
- [ ] T744 [US1] Implement `POST /decisions` in `backend/src/modules/decision/decision.controller.ts` (integration test: T736) — `403` missing authority, `409` policy refusal, both carrying the decision id

**Checkpoint**: US1 demonstrable — the fence holds under enumeration

---

## Phase 4: User Story 2 - Low-risk work stops waiting, and still leaves a record (Priority: P1)

**Goal**: `RULE-04` collected, without losing the record

**Independent test**: [quickstart.md](./quickstart.md) Scenario 2

- [ ] T745 [P] [US2] Write failing unit tests for band treatment in `backend/tests/unit/decision-evaluator.spec.ts` — low MAY auto-execute, medium requires gates, high requires human — `FR-DPE-010`
- [ ] T746 [US2] Implement `backend/src/modules/decision/evaluator.ts` with Cedar's default-deny and forbid-overrides-permit, and **without skip-on-error** (unit test: T745) — `R-031-2`
- [ ] T747 [P] [US2] Write failing unit tests asserting an auto-executed action still produces an audit record and evidence reference in `backend/tests/unit/decision-auto-execute-record.spec.ts` — `FR-DPE-016`
- [ ] T748 [US2] Implement audit emission on every outcome in `backend/src/modules/decision/evaluator.ts` (unit test: T747) — constraint 4: *low risk means no human in the loop, not no record*
- [ ] T749 [P] [US2] Write failing unit tests for self-approval refusal in `backend/tests/unit/decision-self-approval.spec.ts` — refused unless policy permits for that action class, and the permission appears in the explanation — `FR-DPE-015`
- [ ] T750 [US2] Implement self-approval evaluation in `backend/src/modules/decision/evaluator.ts` (unit test: T749)
- [ ] T751 [US2] Implement `POST /decisions/:id/approve` in `backend/src/modules/decision/decision.controller.ts` (integration test: T736) — `FR-DPE-014`

**Checkpoint**: US2 demonstrable — the productivity half of `BG-02`

---

## Phase 5: User Story 3 - Everything awaiting me is in one place (Priority: P1)

**Goal**: `BR-0192` — visible without searching individual artifacts. **This is the Tier 2 journey.**

**Independent test**: [quickstart.md](./quickstart.md) Scenario 10, plus the Tier 2 transcript

- [ ] T752 [P] [US3] Write failing unit tests for the inbox projection in `backend/tests/unit/decision-inbox-projection.spec.ts` — role-scoped, derived at read time, decided items absent — `FR-DPE-020`, `FR-DPE-022`, `FR-DPE-024`
- [ ] T753 [US3] Implement `backend/src/modules/decision/inbox.projection.ts` (unit test: T752) — derived, no queue table (`R-031-4`)
- [ ] T754 [P] [US3] Write failing unit tests for blocker naming in `backend/tests/unit/decision-inbox-blockers.spec.ts` — the missing evidence, pending approver or refusing policy is named, never a generic not-ready — `FR-DPE-025`
- [ ] T755 [US3] Implement blocker resolution in `backend/src/modules/decision/inbox.projection.ts` (unit test: T754)
- [ ] T756 [US3] Implement `GET /inbox` in `backend/src/modules/decision/decision.controller.ts` (integration test: T736) — `FR-DPE-021`, `FR-DPE-023`
- [ ] T757 [P] [US3] Write failing component tests for the Inbox page in `frontend/src/pages/DecisionInbox.test.tsx` — loading, empty, populated and error states, and an empty state that says so rather than rendering blank — `UX-0051`
- [ ] T758 [US3] Implement `frontend/src/pages/DecisionInbox.tsx` (unit test: T757) — `UX-0021`, styled against the `EPIC-029` system
- [ ] T759 [US3] Wire the Inbox into primary navigation so it is reachable in one action from every screen (unit test: T757) — `UX-0021`, `UX-0003`
- [ ] T760 [P] [US3] Write failing accessibility tests for the Inbox in `frontend/src/pages/DecisionInbox.a11y.test.tsx` — keyboard-only operation with visible focus (`BR-0193`)
- [ ] T761 [US3] Implement keyboard operation and focus management in `frontend/src/pages/DecisionInbox.tsx` (unit test: T760)
- [ ] T762 [P] [US3] Write the role-change integration test in `backend/tests/integration/decision-inbox-role.spec.ts` — the visible set follows the new role; no entry persists because it was once visible (`SC-DPE-004`)
- [ ] T763 [US3] Implement `GET /decisions/metrics` in `backend/src/modules/decision/decision.controller.ts` (integration test: T736) — band distribution and auto-execution rate, `FR-DPE-033`, `SC-DPE-008`

**Checkpoint**: US3 demonstrable — and the Tier 2 journey exists to be transcribed

---

## Phase 6: User Story 4 - A blocked or allowed action explains itself (Priority: P2)

**Goal**: `BR-0174` — *an unexplainable allow is a defect*

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 3 and 6

- [ ] T764 [P] [US4] Write failing unit tests for the explanation builder in `backend/tests/unit/decision-explanation.spec.ts` — policy version, matched rule, risk class, authority; present for **allowed as well as blocked** — `FR-DPE-040`, `FR-DPE-041`
- [ ] T765 [US4] Implement `backend/src/modules/decision/explanation.builder.ts` (unit test: T764)
- [ ] T766 [P] [US4] Write failing unit tests for precedence quoting in `backend/tests/unit/decision-precedence.spec.ts` — `precedenceResolution` **quotes** `resolveSteering()`'s `SteeringOverride` rather than restating it — `FR-DPE-042`, `R-031-1`
- [ ] T767 [US4] Implement precedence pass-through in `backend/src/modules/decision/explanation.builder.ts` (unit test: T766)
- [ ] T768 [P] [US4] Write failing unit tests for explanation immutability in `backend/tests/unit/decision-explanation-immutable.spec.ts` — a later policy change does not rewrite a past explanation — `FR-DPE-044`, `R-031-8`
- [ ] T769 [US4] Implement stored-explanation persistence in `backend/src/modules/decision/explanation.builder.ts` (unit test: T768) — stored, never recomputed
- [ ] T770 [US4] Implement `GET /decisions/:id/explanation` in `backend/src/modules/decision/decision.controller.ts` (integration test: T736) — `FR-DPE-043`, renderable by a Room without a second lookup

**Checkpoint**: US4 demonstrable — every decision answers for itself

---

## Phase 7: User Story 5 - An AI may propose a class and may never assign one (Priority: P2)

**Goal**: `ADR-0025` — *policy-declared, not model-inferred*

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 4 and 5

- [ ] T771 [P] [US5] Write failing unit tests for proposal handling in `backend/tests/unit/decision-proposed-class.spec.ts` — `effectiveClass` comes from policy; `proposedClass` is retained separately and never merged — `FR-DPE-003`
- [ ] T772 [US5] Implement proposal retention in `backend/src/modules/decision/classifier.ts` (unit test: T771)
- [ ] T773 [P] [US5] Write failing unit tests for visible disagreement in `backend/tests/unit/decision-proposal-disagreement.spec.ts` — a proposal differing from policy is visible, not reconciled silently
- [ ] T774 [US5] Implement disagreement surfacing in `backend/src/modules/decision/explanation.builder.ts` (unit test: T773)
- [ ] T775 [US5] Implement rule immutability for taken decisions in `backend/src/modules/decision/classifier.ts` (unit test: T771) — `FR-DPE-006`: a rule change does not alter a decision already taken

**Checkpoint**: US5 demonstrable — no model-assigned class reaches a decision

---

## Phase 8: User Story 6 - A skipped gate is a violation or an exception, never a pass (Priority: P3)

**Goal**: `ADR-0025` constraint 2, carried from `BR-0060`

**Independent test**: [quickstart.md](./quickstart.md) Scenario 8

- [ ] T776 [P] [US6] Write failing unit tests for gate resolution in `backend/tests/unit/decision-gates.spec.ts` — an unsatisfied required gate yields refuse or recorded-exception; **`satisfied` is unreachable by omission** — `FR-DPE-013`
- [ ] T777 [US6] Implement gate evaluation in `backend/src/modules/decision/evaluator.ts` (unit test: T776)
- [ ] T778 [P] [US6] Write failing unit tests for exception recording in `backend/tests/unit/decision-exception.spec.ts` — authorizer, reason and expiry all required; an expired exception is not a pass
- [ ] T779 [US6] Implement exception recording in `backend/src/modules/decision/evaluator.ts` (unit test: T778)
- [ ] T780 [US6] Implement the fail-closed path for unfilled ports in `backend/src/modules/decision/evaluator.ts` (integration test: T781) — `FR-DPE-050`, `R-031-5`: unreadable steering refuses, it does not permit

**Checkpoint**: all six user stories demonstrable

---

## Phase N: Polish & Cross-Cutting Concerns

- [ ] T781 [P] Write the fail-closed integration test in `backend/tests/integration/decision-fail-closed.spec.ts` — steering source failing, decision refused with reason recorded (`SC-DPE-007`)
- [ ] T782 **Mutation proof — `FR-DPE-012`**: remove the load-time refusal from `backend/src/modules/decision/policy.loader.ts`, revert (integration test: T743 — it must fail while the mutation stands). Record the observation (`SC-DPE-001`)
- [ ] T783 **Mutation proof — `FR-DPE-040`**: make `explanation` optional in `packages/decision-contract/src/types.ts` and drop the `NOT NULL`, revert (unit test: T764 — it must fail while the mutation stands). Record the observation (`SC-DPE-002`)
- [ ] T784 **Mutation proof — `FR-DPE-013`**: add a `satisfied`-by-default branch to `backend/src/modules/decision/evaluator.ts`, revert (unit test: T776 — it must fail while the mutation stands). Record the observation (`SC-DPE-006`)
- [ ] T785 **Mutation proof — Constitution XI Tier 1**: remove `DecisionModule` from `backend/src/app.module.ts`, revert (integration test: T736 — it must fail while the mutation stands). Record the observation
- [ ] T786 [P] Verify the `R-031-6` targets — decide p95 < 40 ms excluding gate providers, end-to-end p95 < 120 ms, Inbox read p95 < 250 ms **at 500 open items**, ≥ 50 decisions/second per workspace — and record the measured figures
- [ ] T787 [P] Confirm the decide budget composes inside `EPIC-030`'s 50 ms transition budget, and record the combined measurement
- [ ] T788 Run every scenario in [quickstart.md](./quickstart.md) end to end and record the results

---

## Phase Z: Epic Closure (MANDATORY - Constitution IV, VI, VII, IX, XI)

Ordered as the constitution's *"Quality gates in order"* states them.

- [ ] T789 Confirm every implementation task has a passing unit test or conformance check
- [ ] T790 **Constitution XI Tier 1 (ALWAYS)** — `T736` drives a decision through the real HTTP route against the composed module graph via the real `AppModule`, and `T785` proved it fails when the module is unregistered. **Not satisfied by a mocked collaborator**
- [ ] T791 **Constitution XI Tier 2 (Epics delivering a journey)** — **APPLIES**. The Decision Inbox journey is exercised against a **running application** and a **run-generated** transcript is committed, passing its conformance check. Hand-written evidence is a constitution violation of the first order (`SC-AGT-001`, `EPIC-029` `T900a`/`T900b`)
- [ ] T792 [P] Write the transcript conformance check in `backend/tests/architecture/decision-inbox-transcript.spec.ts` — asserts the transcript exists, names the run, and was generated rather than authored
- [ ] T793 Update `ADR-0025` to record that classification rules live in the `BR-0070` steering hierarchy and close its `Open` line — decided 2026-08-22, and the ADR still says otherwise
- [ ] T794 Confirm the `BR-0005` contract is **published** in `packages/decision-contract/` with `U-02` named as its eventual owner and the adoption path stated
- [ ] T795 Record the `SCOPE_ORDER` divergence for `EPIC-019` — steering has organization/workspace/project/product; `BR-0070` names repository and path. Not this Epic's to fix; its to hand over
- [ ] T796 Run `/speckit-converge`; append and complete any remaining unbuilt work
- [ ] T797 Triage `specs/031-decision-policy-engine/defects/`; every record closed or deferred to a named Epic
- [ ] T798 Re-run the full suite green — `pnpm lint && pnpm typecheck && pnpm test && pnpm test:governance`
- [ ] T799 Promote `local → dev` (no environment skipped) and publish the Epic closing report: work completed, work deferred, the four mutation observations, the measured performance figures, and the recommended next command (Constitution IX). Refresh the Delivery Board or restate its staleness

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: `T716` first — it discharges the failing gate
- **Foundational (Phase 2)**: blocks every user story
- **US1 (Phase 3)**: Phase 2 only. **MVP**
- **US2 (Phase 4)**: Phase 2, plus US1's classifier (`T740`)
- **US3 (Phase 5)**: Phase 2, plus US2's evaluator (`T746`) — the largest phase, and the only one touching the frontend
- **US4 (Phase 6)**: Phase 2, plus US1's classifier
- **US5 (Phase 7)**: US1's classifier and US4's explanation builder
- **US6 (Phase 8)**: US2's evaluator
- **Polish, Closure**: last

### Cross-Epic dependencies

Consumes `EPIC-019` steering (`R-031-1`) — a **real coupling**, recorded in Complexity Tracking, and
one that fails safe: `FR-DPE-050` makes an unreadable ruleset refuse. Fills `EPIC-030`'s
`PolicyProvider` seam; buildable with `EPIC-030` absent because the contract is this Epic's side of
it. `EPIC-021` gates and `EPIC-032` evidence are ports that **refuse when unfilled**, so neither
blocks.

### Parallel Example: Phase 2

```text
T721, T723, T725, T727  — four contract test files
T732, T733, T735, T736  — schema, rules, independence, reachability
```

---

## Implementation Strategy

**MVP is User Story 1** — the high band holding under enumeration of every tenant-reachable setting.
It is `ADR-0025` constraint 1, the fence the rest of the model rests on, and it is demonstrable with
no Room and no Inbox.

**US3 is the largest phase and the only one with a browser surface.** It carries the Tier 2
obligation, and Tier 2 needs a running application — so it cannot be deferred to the end and then
hurried.

**Four mutation proofs (`T782`–`T785`) each require a deliberate break, an observed failure, and a
revert.** Three of them target guarantees this plan deliberately moved into the type system and the
schema; the mutation is what proves the fence is load-bearing rather than decorative.

---

## Notes

- **The task id block was allocated, not continued.** `EPIC-030` holds `T913`–`T993`; continuing
  would have hit `T1000`, which the governance regex does not match — the task would be **invisible**
  to `G-26-15`, not rejected by it. `T716`–`T799` was computed as the largest contiguous free run
  across `main` and every Wave 1 branch, because `G-26-15` reads only the current checkout and
  therefore cannot see a cross-branch collision until it has already merged.
- **`T793` and `T795` are handovers, not work.** One updates an ADR that still reads *Open* on a
  question settled in this Epic's spec; the other hands `EPIC-019` a `BR-0070` scope gap this Epic
  found and does not need. Both exist so closure cannot be claimed while a record disagrees.
- **Constitution V over the skill default**: `/speckit-tasks` calls tests optional; the constitution
  overrides every template, skill and tool default.
