---

description: "Task list for EPIC-027 — AI-Native Amendment Reconciliation"
---

# Tasks: AI-Native Amendment Reconciliation

**Epic**: `EPIC-027` | **Module**: programme reconciliation (no product module) | **Tasks**: 51

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Register schema**: [contracts/reconciliation-register.md](./contracts/reconciliation-register.md)

> ▶ **PROCEEDING** under decision D-10. Analysis of held work is not held work.

**Session label**: `EPIC-027 AI-Native Amendment` (Constitution VIII).
⚠️ Current branch is `epic/003-specification-engine`, which does not match. Recorded in
[plan.md](./plan.md) Complexity Tracking rather than hidden; `D-39` proposes the check that would
catch it.

**Tests**: MANDATORY (Constitution V, v1.2.0). **Almost every task here produces a document**, so
each pairs with an **executable conformance check** rather than a unit test. Two tasks produce
executable code — `T600` and `T604`, the projection generator — and carry conventional unit tests.
A check that cannot fail is decoration.

**Blocking policy** *(confirmed 2026-08-14)*: of the fourteen checks, **`G-27-09` and `G-27-14`
block CI**; the other twelve report. Those two guard `FR-AMD-016` (analysis only) and `FR-AMD-017`
(do not disturb work in flight) — the two constraints the project owner named as the scope-creep
concern.

**Task IDs**: `T597`–`T645`, plus `T658`/`T659` added 2026-08-14 when the Augment/Cosmos
amendment widened this epic from four source documents to five. No routed IDs.

**Register grain** *(clarified 2026-08-14)*: **one row per clause, duplicates cross-linked** —
roughly 470 rows across five documents, not one row per distinct capability. The collapsed form cannot prove `SC-AMD-001`,
because a clause nobody noticed is indistinguishable from one that is not there.

**Before starting**: sync from GitHub, confirm no other Claude session is on this checkout.

---

## Phase 1: Setup — the register and its harness

**Purpose**: make the register machine-readable before anything is written into it.

**Why the generator comes first**: `R-027-1` decided humans read markdown and checks read a JSON
projection. Writing 470 rows and *then* discovering the projection cannot parse them is the expensive
order.

- [X] T597 [P] Write a failing conformance check asserting every `register/*.md` file exists and carries the required table header, in `tests/governance/register-structure.spec.ts`
- [X] T598 Create the register scaffold — `register/{clauses,verdicts,capabilities,capability-areas,premises,decisions,research,adrs,preserved-elements}.md`, headers only — under `specs/027-ai-native-amendment/` (conformance check: T597)
- [X] T599 [P] Write a failing conformance check asserting `register.json` validates against the schema in `contracts/reconciliation-register.md`, in `tests/governance/register-schema.spec.ts`
- [X] T600 [P] Write failing unit tests for the projection generator — table parsing, field extraction, malformed-row rejection — in `scripts/tests/build-register.spec.mjs`
- [X] T601 Implement the markdown → `register.json` projection generator in `scripts/build-register.mjs` (unit test: T600; conformance check: T599)
- [X] T602 Add the `register:build` script and register the governance test entries in `package.json` (conformance check: T597)

**Checkpoint**: an empty register generates a valid, empty projection, and the checks fail loudly on a malformed row.

---

## Phase 2: Foundational — the projection cannot drift

**Purpose**: the one property every later check depends on. **Blocks all six stories.**

- [X] T603 [P] Write the failing `G-27-11` check asserting each `generated_from` digest matches its source file, in `tests/governance/register-digest.spec.ts`
- [X] T604 Implement SHA-256 digest emission per source file in `scripts/build-register.mjs` (unit test: T600; conformance check: T603)
- [X] T605 [P] Write a failing check asserting a hand-edited `register.json` is detected — regenerate, diff, fail on any change — in `tests/governance/register-digest.spec.ts`
- [X] T606 Wire all register checks into `pnpm test:governance` and confirm the governance project collects them (conformance check: T597)

  > **Regeneration is the step people skip.** A stale projection makes every check below test a
  > fiction while staying green — which is worse than no check, because it manufactures confidence.

**Checkpoint**: the projection provably reflects the markdown. No story work has started.

---

## Phase 3: User Story 1 — every clause carries exactly one verdict (P1) 🎯 MVP

**Goal**: for each clause, a recorded verdict naming the existing requirement or epic that covers it,
or an explicit statement that none was found.

**Independent Test**: pick ten clauses spanning all five documents; each carries a verdict and a named
artifact or `NO-EXISTING-COVERAGE`.

### Checks for User Story 1 (MANDATORY — Constitution V) ⚠️

- [X] T607 [P] [US1] Write the failing `G-27-01`, `G-27-02` and `G-27-03` checks — exactly one verdict per clause, non-empty owner or the sentinel, `necessity` present whenever `new_identifier` is set — in `tests/governance/g27-clauses.spec.ts`

### Implementation for User Story 1

- [X] T608 [US1] Extract every substantive clause from `PMI Studio Plan Amendment` (§1–§19, ~150 rows) with document, section, quoted text and normativity, into `register/clauses.md` (conformance check: T607)
- [X] T609 [US1] Extract every substantive clause from `Native Spec-Kit Execution Environment` (§1–§30, ~120 rows) into `register/clauses.md` (conformance check: T607)
- [X] T610 [US1] Extract every substantive clause from `Recommended PMI Studio lifecycle` (§1–§13, ~45 rows) into `register/clauses.md` (conformance check: T607)
- [X] T611 [US1] Extract every substantive clause from `Defect Management governed intelligence workflow` (§1–§12, ~25 rows) into `register/clauses.md` (conformance check: T607)
- [X] T658 [US1] Extract every substantive clause from `SRS/AUg142026/PMI_Studio_Augment_Cosmos_Learnings_Amendment.docx` (§1–§13, ~130 rows) into `register/clauses.md` (conformance check: T607)

  > **Added 2026-08-14.** A fifth document, and explicitly a *refinement* of the August-11 set rather
  > than a competing direction (§1, §11). Six of its eight architectural refinements enhance capability
  > areas this register already tracks; **two are genuinely new** — Governed Learning (§3.4) and the
  > Specification Compliance Agent (§3.5) — and neither appears anywhere in the first four documents.
  > It was folded here rather than given its own epic because it demands the *same* reconciliation, and
  > §9 warns in its own words: *"Do not duplicate existing requirements or create replacement IDs
  > unnecessarily."* Two registers would have been exactly that.
- [X] T612 [US1] Cross-link `duplicates` across all five documents in `register/clauses.md` — the three Rooms appear in four of the five (conformance check: T607)
- [ ] T613 [US1] Record one verdict per clause — one of the five values, with owner, reasoning and resulting action — in `register/verdicts.md` (conformance check: T607)

  > **Quote, never paraphrase** (`data-model.md`). Paraphrase is where premises get lost, and Finding
  > A exists because the amendment's own paraphrase of the corpus was wrong.

**Checkpoint**: `SC-AMD-001`, `SC-AMD-002` and `SC-AMD-003` provable. **This is the MVP** — everything else summarises it.

---

## Phase 4: User Story 2 — the false premise is settled before anyone plans against it (P1)

**Goal**: every "existing capability" claim verified against the corpus, with the evidence recorded.

**Independent Test**: re-run each search and confirm the register records the same count and locations.

- [ ] T614 [P] [US2] Write the failing `G-27-05` check — every premise row carries a reproducible query, a count, and locations when the count is non-zero — in `tests/governance/g27-premises.spec.ts`
- [ ] T615 [US2] Record a premise check for every capability the amendment calls *existing*, with the query as run, the occurrence count and the locations, in `register/premises.md` (conformance check: T614)
- [ ] T616 [US2] Record the distinction between the product **Defect Room** and the Constitution VI **`defects/`** convention wherever either is referenced (`FR-AMD-007`), in `register/premises.md` (conformance check: T614)
- [ ] T617 [US2] Record the EPIC-007 name collision with both scopes quoted from source, and `D-33`'s resolution, in `register/premises.md` (conformance check: T614)

  > Eight terms returned **zero** across all 26 other epic specs on 2026-08-13 and again on
  > 2026-08-14. The register records the evidence, not the conclusion — a claim that resizes a
  > programme should be checkable in ten seconds by anyone who doubts it.

---

## Phase 5: User Story 3 — every capability is native, integrated or hybrid (P1)

**Goal**: an ownership verdict for every capability, with the reason referencing §2's test.

**Independent Test**: source control, CI/CD, AI coding engines, requirement approval and traceability
each carry a verdict consistent with §2.

- [ ] T618 [P] [US3] Write the failing `G-27-04` and `G-27-13` checks — ownership present, boundary named for every `integrated`/`hybrid`, `removed_because_external` false throughout, and exactly **twenty** capability areas — in `tests/governance/g27-capabilities.spec.ts`
- [ ] T619 [US3] Classify every capability as native / integrated / hybrid with the reason and, where integrated, the abstraction boundary, in `register/capabilities.md` (conformance check: T618)
- [ ] T620 [US3] Record the **twenty** capability areas with verdict, owning epic and posture in `register/capability-areas.md` (conformance check: T618)
- [ ] T621 [US3] Record every existing requirement that should change from native implementation to integration (§18.9, `FR-AMD-010`) in `register/capabilities.md` (conformance check: T618)

---

## Phase 6: User Story 4 — the §18 impact report exists (P1)

**Goal**: the twenty-five-part report, ending in a sequence separating immediate, near-term and later.

**⚠️ Depends on US1, US2 and US3.** The report summarises their registers; writing it first would
mean writing it twice.

- [ ] T622 [P] [US4] Write the failing `G-27-06` check — exactly 25 sections, zero placeholders, every empty section flagged `explicitly_empty` with a reason — in `tests/governance/g27-impact-report.spec.ts`
- [ ] T623 [US4] Write §18 sections 1–12 (executive summary through Integration Hub impact) in `impact-report.md` (conformance check: T622)
- [ ] T624 [US4] Write §18 sections 13–25 (AI Gateway through open decisions) in `impact-report.md` (conformance check: T622)
- [ ] T625 [US4] Write the proposed implementation sequence separating immediate architectural corrections, near-term implementation and later platform capability (§17.11, `FR-AMD-011`) in `impact-report.md` (conformance check: T622)

---

## Phase 7: User Story 5 — decisions and research registered, not answered prematurely (P2)

**Goal**: twelve ADRs, twenty-two research items, and every open decision with options and owner.

**Independent Test**: each of the twelve §27 subjects has a record; every `open` one names what it awaits.

- [ ] T626 [P] [US5] Write the failing `G-27-07`, `G-27-08` and `G-27-10` checks — twelve ADR subjects present, `supersedes` carrying reasoning, every research item naming what it blocks, **no decision `decided` while its blocking research is unanswered**, every decision carrying ≥2 options and an owner — in `tests/governance/g27-decisions.spec.ts`
- [ ] T627 [US5] Create the twelve Native §27 ADRs as `adr/ADR-0006` … `adr/ADR-0017` — seven decided from the 2026-08-13 session, five `open` naming what each awaits (`D-35`) (conformance check: T626)
- [ ] T659 [US5] Create the five ADRs Cosmos §9 names — Governed Engineering Loops, Context Engine composition, Engineering Expert definition, Governed Learning, Specification Compliance/Evidence — as `adr/ADR-0018` … `adr/ADR-0022`, each decided or `open` naming what it awaits (conformance check: T626)
- [ ] T628 [US5] Record all twelve ADR subjects, status and `awaits` in `register/adrs.md`, and confirm `ADR-0001`–`ADR-0005` are preserved with `ADR-0002` marked **extended, not superseded** (`D-36`) (conformance check: T626)
- [ ] T629 [US5] Register `R-AI-001`–`R-AI-014` and `R-027-1`–`R-027-8` with what each blocks and its owner, in `register/research.md` (conformance check: T626)
- [ ] T630 [US5] Record every open decision with question, ≥2 options, the consequence of each, owner, status and blocking research, in `register/decisions.md` — citing `srs-alignment.md` Part 8 rather than restating it (conformance check: T626)
- [ ] T631 [US5] Record every conflict as a decision for a human — false premise, both name collisions, and any disagreement between two amendment documents (`FR-AMD-008`) (conformance check: T626)

  > **Nine of the fourteen `R-AI-*` items are uninvestigated**, and the register records that rather
  > than filling them. §26: *"Do not make unsupported assumptions where research is required."*

---

## Phase 8: User Story 6 — current work is not disturbed without cause (P2)

**Goal**: the analysis-only boundary and the do-not-disturb rule, as assertions rather than promises.

**Independent Test**: `git diff` touches no product source and no other epic's delivery posture.

- [ ] T632 [P] [US6] Write the failing `G-27-09`, `G-27-12` and `G-27-14` checks — zero files changed under `backend/`, `worker/`, `packages/`, `engine-adapters/`, `frontend/`; every preserved-element row carrying all five §28 fields; no other epic's **Delivery posture** line modified without a matching `epic_status_changes` row — in `tests/governance/g27-boundary.spec.ts`

  > **`G-27-09` and `G-27-14` block CI.** They are the two constraints the project owner named as
  > the scope-creep concern, and a reporting-only check on either would leave the boundary defended
  > by good intentions.

- [ ] T633 [US6] Record every preserved-element change with reason, affected requirement, migration impact, compatibility impact and alternative considered, in `register/preserved-elements.md` (conformance check: T632)
- [ ] T634 [US6] Record `epic_status_changes` as empty with the `FR-AMD-017` justification, or with a row per change citing the responsible clause, in `register/decisions.md` (conformance check: T632)
- [ ] T635 [US6] Confirm every verdict names the affected epic, module and requirement or states explicitly that none was found (`FR-AMD-005`) — depends on US1 (conformance check: T607)
- [ ] T636 [US6] Record any `srs-alignment.md` decision reopened by the amendment with the architectural conflict stated, or state that none was reopened (`FR-AMD-018`), in `register/decisions.md` (conformance check: T626)

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T637 [P] **Mutation-test the register checks** — delete one verdict row from `register/verdicts.md`, confirm `G-27-01` names the orphaned `CLA-###` and turns red, restore it, and record the result
- [ ] T638 [P] Cross-check the register against `specs/srs-alignment.md` Part 8 so `C-19`–`C-26` and `D-20`–`D-41` are **cited, not restated** (PP-002)
- [ ] T639 Run quickstart `V1`–`V14` and record every result, distinguishing passes from unrun
- [ ] T640 [P] Fold the report's conclusions into `specs/_shared/ai-native-architecture.md` and `specs/srs-alignment.md` — links only, no duplication

  > **No conformance check, deliberately** — the same ruling EPIC-028 `T590` records. No
  > `specs/_shared/*.md` or `specs/srs-alignment.md` in this corpus has one; EPIC-018's suite covers
  > `governance/**` only. Adding a standard here would leave eight sibling documents failing it.
  > Recorded as a **corpus-wide gap** for an EPIC-018 follow-up alongside `D-39`, not fixed locally
  > where it would look like compliance.

---

## Phase Z: Epic Closure (MANDATORY — Constitution IV, VI, VII, IX)

- [ ] T641 Confirm every task's conformance check passes, **and** that the governance project collects a non-zero test count
- [ ] T642 Run `/speckit-converge`; append and complete any remaining unbuilt work
- [ ] T643 Triage `specs/027-ai-native-amendment/defects/`; every record closed or deferred to a named Epic
- [ ] T644 **Sample ten clauses spanning all five documents and confirm each verdict survives reading** — the one thing the checks cannot check
- [ ] T645 Publish the Epic closing report: work completed, work deferred, and the recommended next command (Constitution IX)

  > `T644` exists because the checks verify the register is **complete and internally consistent**,
  > never that a clause marked *already covered* is genuinely covered. If nine of ten hold, the
  > register is trustworthy. If three of ten are wrong, it is **worse than nothing** — its
  > completeness checks will all still be green.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 Setup** — no dependencies
- **Phase 2 Foundational** — depends on Phase 1. **Blocks all six stories**
- **US1 (Phase 3)** — depends on Phase 2. Blocks US4 and `T635`
- **US2 (Phase 4)**, **US3 (Phase 5)** — depend on Phase 2 only. Independent of US1 and of each other
- **US4 (Phase 6)** — depends on **US1, US2 and US3**
- **US5 (Phase 7)** — depends on Phase 2 only
- **US6 (Phase 8)** — depends on Phase 2; `T635` additionally on US1
- **Phase 9 / Phase Z** — depend on all stories

### Cross-story edges

```text
US1 ──┐
US2 ──┼──► US4 (the §18 report summarises all three registers)
US3 ──┘
US1 ──────► T635 (verdicts must exist before they can be checked for named owners)
```

US2, US3 and US5 can run fully in parallel with US1.

### Parallel opportunities

- **Phase 1**: T597, T599, T600 in parallel
- **Phase 2**: T603, T605 in parallel
- **US1**: T608–T611 are four different documents — **fully parallel**, and the largest block of work in the epic
- **All six story-opening check tasks** (T607, T614, T618, T622, T626, T632) can be written in parallel before any register content exists

---

## Parallel Example: User Story 1

```bash
# The four extraction tasks are independent — one document each:
Task: "Plan Amendment §1-§19 (~150 rows) into register/clauses.md"
Task: "Native Spec-Kit §1-§30 (~120 rows) into register/clauses.md"
Task: "Recommended lifecycle §1-§13 (~45 rows) into register/clauses.md"
Task: "Defect Management §1-§12 (~25 rows) into register/clauses.md"
# Then T612 cross-links duplicates across all four.
```

---

## Implementation Strategy

### MVP first — User Story 1 only

Phase 1 → Phase 2 → US1 → **STOP and validate**: run `V1`, `V2`, `V3`, `V11`.

At that point every amendment clause has a verdict and a named owner. That alone is what §17 makes
the precondition for new implementation tasks — the rest of this epic explains and packages it.

### Incremental delivery

1. Setup + Foundational → the register is machine-checkable
2. **US1** → every clause verdicted (MVP)
3. **US2 + US3 + US5** in parallel → premises, classifications, decisions
4. **US4** → the §18 report, which needs 1–3
5. **US6** → the boundary assertions
6. Polish → mutation test, quickstart, fold-back

**US6 is scheduled late but `G-27-09` should be wired early.** It is the check that proves this epic
touched no product code, and it is most useful running from the first commit — not discovered at the
end to have been violated in the middle.

---

## Notes

- `[P]` = different files, no dependencies on incomplete tasks
- **Every document task pairs with an executable conformance check** (Constitution V v1.2.0); the two
  script tasks (`T600`, `T601`) carry conventional unit tests
- Twelve checks report, **two block** — `G-27-09`, `G-27-14`
- Never edit code outside a Spec Kit command (Constitution I) — and this epic edits **no** code at all
  (`FR-AMD-016`), which `G-27-09` enforces rather than promises
- Unrun checks are never reported as passing (Constitution IX)
- Commit after each task or logical group; regenerate `register.json` before every commit or `G-27-11`
  will fail
