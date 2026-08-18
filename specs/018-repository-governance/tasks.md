---

description: "Task list for EPIC-018 — Repository Governance Process"
---

# Tasks: Repository Governance Process

**Epic**: `EPIC-018` | **Process, not product** | **Tasks**: 38

> 38 = the 31 originally planned (`T312`–`T336`, `T433`–`T434`, Phase Z `T407`–`T410`) + 3 from Phase 6 convergence + 3 from Phase 7 convergence (`DEF-018-001`) + `T667` (`D-39`, check `G-10`). Corrected by EPIC-026 `T529` on 2026-08-18 — **count it, do not quote it**.

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Shared design**: [../_shared/](../_shared/)

> ▶ **PROCEEDING** under decision D-10. Buildable now — nothing here is product surface, so nothing
> here waits on `PMI-DOC-004`.

**Session label**: `EPIC-018 Repository Governance` (Constitution VIII).

**Tests**: Constitution V requires a unit test for every task producing or changing **application
code**. This epic produces **governance documents, not application code** — so its verification is a
*conformance check* rather than a unit test. Each artifact task is paired with a check task that
fails when the artifact drifts from its governing standard. Those checks are executable
(`pnpm test:governance`), not manual review.

**Before finishing**: close with a Work Completed + Recommended Next Task report (Constitution IX).

---

# F-18.1 · Steering files

*FR-RGP-001 to FR-RGP-005. Ten named subjects. The rule that matters is FR-RGP-004: a steering file
**references** the constitution, templates, or SRS where content already exists — it never restates
it. A steering file that duplicates the constitution is a second source of truth, and the next
amendment silently forks them.*

- [X] T312 [P] Write failing conformance check asserting every steering subject named by the source document has a file, and that each states checkable standards rather than aspiration, in `tests/governance/steering-files.spec.ts`
- [X] T313 [P] Write failing conformance check asserting no steering file duplicates constitution or template text beyond a quoted reference (FR-RGP-004), in `tests/governance/steering-no-duplication.spec.ts`
- [X] T314 Create the steering file index and authoring convention in `governance/steering/README.md` (FR-RGP-001, FR-RGP-003; check: T312)
- [X] T315 [P] Author organization, workspace and product steering files in `governance/steering/{organization,workspace,product}.md` (FR-RGP-001, FR-RGP-002; check: T312)
- [X] T316 [P] Author architecture and technology-stack steering files in `governance/steering/{architecture,technology-stack}.md`, referencing `../_shared/system-design.md`, `tech-stack.md` and the ADRs rather than restating them (FR-RGP-004; check: T313)
- [X] T317 [P] Author coding-standards and UI-standards steering files in `governance/steering/{coding-standards,ui-standards}.md`, deferring UI specifics to SRS Volume 8 where it is not yet written (FR-RGP-002; check: T312)
- [X] T318 [P] Author security and AI-governance steering files in `governance/steering/{security,ai-governance}.md`, referencing ADR-0002 sandbox controls and PP-016/PP-017 (FR-RGP-004; check: T313)
- [X] T319 [P] Author business-rules steering file in `governance/steering/business-rules.md`, recording that content awaits `PMI-DOC-004` and naming the back-fill owner (FR-RGP-002; check: T312)
- [X] T320 Implement the constitution-wins precedence rule and record it in `governance/steering/README.md`, with a check that fails when a steering file contradicts a constitution principle (FR-RGP-005; check: T313)

### Currency *(added 2026-08-06 — FR-RGP-016, SC-RGP-009, clarified 2026-08-05)*

*Every other check in this epic verifies a steering file's **form**. None verifies its **accuracy**.
A file that says "we use X" a year after the team moved to Y passes all six checks and actively
misleads — worse than a missing file, because agent sessions load it as context.*

- [X] T433 [P] Write failing conformance check **G-07** asserting every steering file records a `last_reviewed` ISO date, and reporting — not failing — any file older than the configured interval, reading that interval from `governance/governance.config.json` rather than hard-coding it, in `tests/governance/steering-currency.spec.ts`
- [X] T434 Create `governance/governance.config.json` with `steeringReviewIntervalDays: 90`, and record in `governance/steering/README.md` that `last_reviewed` is required front matter, that the interval is configuration rather than a principle, and that a stale file is **reported, never a build failure** (FR-RGP-016; check: T433)

---

# F-18.2 · Repository layout and mapping

*FR-RGP-006 to FR-RGP-009. The constraint worth respecting is FR-RGP-008: this layout **must not
pre-empt D-13**, the deferred 18-module re-cut. Where the two touch the same paths, the layout
records the dependency instead of resolving it.*

- [X] T321 [P] Write failing conformance check asserting every artifact type named in the layout has exactly one documented location, and that no location contradicts the existing `specs/<epic>/` or `specs/_shared/` structure, in `tests/governance/layout.spec.ts`
- [X] T322 [P] Write failing conformance check asserting the layout records its D-13 dependency and proposes no module-path change while D-13 is open (FR-RGP-008), in `tests/governance/layout-d13-guard.spec.ts`
- [X] T323 Author the repository layout in `governance/repository-layout.md`, mapping each artifact type to its location and reconciling the source document's proposed tree with the structure this repository already uses (FR-RGP-006, FR-RGP-007; check: T321)
- [X] T324 Record the Spec Kit folder mapping and every path that would migrate, marked as *proposed, not applied*, in `governance/repository-layout.md` (FR-RGP-007; check: T321)
- [X] T325 Record the D-13 dependency and the paths both decisions touch in `governance/repository-layout.md` (FR-RGP-008; check: T322)
- [X] T326 Author the governance index naming every governance artifact, its purpose, path and version, in `governance/README.md` (FR-RGP-009; check: T321)

---

# F-18.3 · Internal templates and conventions

*FR-RGP-010 to FR-RGP-013. Per **D-16**, `PMI-DOC-000` governs — **not** the enhancement document's
twenty-one-section structure. Where a required section is genuinely absent, the deviation is recorded
with a reason rather than quietly omitted.*

- [X] T327 [P] Write failing conformance check asserting every repository template is measured against the 13 `PMI-DOC-000` §4 sections, with each absence carrying a recorded reason, in `tests/governance/template-conformance.spec.ts`
- [X] T328 [P] Write failing conformance check asserting no template follows the enhancement document's 21-section structure in place of `PMI-DOC-000` (FR-RGP-011, D-16), in `tests/governance/template-authority.spec.ts`
- [X] T329 Produce the template conformance record for `.specify/templates/{spec,plan,tasks,checklist}-template.md` in `governance/template-conformance.md`, listing present sections, absent sections, and the reason for each deviation (FR-RGP-010, FR-RGP-011; checks: T327, T328)
- [X] T330 Define the planning and task-document structure so a plan or task list is conformant by construction, in `governance/document-structure.md` (FR-RGP-012; check: T327)
- [X] T331 State the internal traceability convention — which artifact types link to which, and which links are mandatory — in `governance/traceability-convention.md`, recording that the full chain awaits decision **D-2** (FR-RGP-013; check: T327)

---

# F-18.4 · Constitutional process artifacts

*FR-RGP-014, FR-RGP-015. These encode Constitution VIII and IX as repository artifacts. FR-RGP-015
carries the honesty rule explicitly: an unrun check is never reported as passing — which is the
clause that makes a closing report worth reading.*

- [X] T332 [P] Write failing conformance check asserting the session-label format is defined and matches the branch-naming convention actually in use, in `tests/governance/session-label.spec.ts`
- [X] T333 [P] Write failing conformance check asserting the closing-report format defines both mandatory sections and states the honesty rule, in `tests/governance/closing-report.spec.ts`
- [X] T334 Define the session-labelling convention — label format, where it is applied (terminal, worktree, branch), and when to relabel — in `governance/session-labelling.md` (FR-RGP-014, Constitution VIII; check: T332)
- [X] T335 Define the closing-report format — Work Completed and Recommended Next Task, plus the rule that unrun checks are never reported as passing and deferred work is never reported as complete — in `governance/closing-report.md` (FR-RGP-015, Constitution IX; check: T333)

- [X] T667 Implement check `G-10` — the branch names the epic being worked — in `tests/governance/branch-epic-correspondence.spec.ts`, per decision **`D-39`** (taken 2026-08-17)

  > **`D-39` taken after eight occurrences.** `G-08` checks a branch name's *format* and cannot check
  > *correspondence*; every closing report that recorded the lapse said so in the same words. It was
  > recorded in six closing reports — EPIC-001, EPIC-018, EPIC-028, EPIC-003, EPIC-027 — and EPIC-027's
  > `plan.md` and `tasks.md` both predicted the eighth in prose before it happened. A prediction in
  > prose is not a control.
  >
  > **Reports rather than blocks.** Constitution VIII is deliberately SHOULD, not MUST: *"the naming
  > convention is mandatory, its mechanical application is best-effort."* Blocking CI on a SHOULD would
  > halt unrelated work for a convention breach, which `governance/README.md` names as the condition
  > that trains people to silence a check. What it does instead is print the specific mismatch —
  > *"the branch is epic/003-specification-engine (EPIC-003) but the epic being worked is EPIC-027"* —
  > which is the sentence no previous check could produce.

---

## Dependencies

**Depends on**: nothing. This epic has no product dependency and no BRS dependency — it governs the
repository, not the platform.

**Depended on by**: nothing blocks on it either. Its value is compounding rather than gating: every
epic planned after it inherits explicit standards instead of implicit ones.

## Build order

```text
F-18.1 steering files ──┐
F-18.2 layout ──────────┼──► Phase Z closure
F-18.3 templates ───────┤
F-18.4 process ─────────┘
```

F-18.1 to F-18.4 are **mutually independent** and can run in parallel. Only closure waits.

## Notes

- **Not application code.** Constitution V's unit-test rule is satisfied here by executable
  conformance checks — a governance document that no check reads is a document that silently rots.
- **FR-RGP-008 is the constraint most easily broken**: it is tempting to "tidy" module paths while
  writing a layout document. D-13 is deferred deliberately; this epic records the dependency and
  changes nothing.
- **G-07 reports, it does not block.** Per the 2026-08-05 severity split, only the duplication
  check (G-04) fails CI. A blocking staleness check would halt unrelated work across every held
  epic because a document turned 91 days old.
- **Requirement IDs are namespaced** `FR-RGP-###` to avoid collision C-01, and to keep process
  requirements visibly distinct from product ones.

---

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Deduplicated 2026-08-05: an `F-18.5 · Epic closure` section duplicated this block and wrote to a
different file. `T337`–`T339` were removed as exact duplicates of `T408`–`T410`; **`T336` survived**
and sits below, because wiring the checks into CI exists nowhere else.*

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/018-repository-governance/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [X] T336 Wire `pnpm test:governance` into `package.json` and `.github/workflows/ci.yml` so every conformance check runs on each commit — without this the checks exist but never run
- [X] T407 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/018-repository-governance/closure.md`
- [X] T408 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/018-repository-governance/closure.md`
- [X] T409 Triage `specs/018-repository-governance/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/018-repository-governance/closure.md`
- [X] T410 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/018-repository-governance/closure.md`

---

## Phase 6: Convergence

*Appended by `/speckit-converge` on 2026-08-07, after the 31 tasks above were implemented and
verified. No existing task was modified. IDs continue from the repository maximum (`T443`), so they
remain unique programme-wide per `DS-2`.*

- [X] T444 State in `governance/steering/README.md` that git retains the change history for steering files, and add a conformance check asserting a content change carries a `version` increment, in `tests/governance/steering-files.spec.ts` per FR-RGP-003 (partial)
- [X] T445 Perform the **V18-5** walkthrough in [quickstart.md](./quickstart.md) — the judgement half — and record the outcome in `specs/018-repository-governance/closure.md` per SC-RGP-006. **V18-6 split out to `T666`**: it requires a reader new to the programme, which an agent session cannot supply, and the scenario says so in its own text
- [X] T446 Review `tests/governance/tsconfig.json` and the `typecheck:governance` script — keep as owned by this epic, or transfer to EPIC-014 with the rest of CI (unrequested) — **DECIDED: keep here**, see [closure.md](./closure.md)

---

## Phase 7: Convergence — `DEF-018-001`

*Appended by `/speckit-implement` on 2026-08-17 while performing `T445`. IDs continue from the
**corpus** maximum (`T663`), enumerated across all 28 `tasks.md` files — not this epic's, which is
the mistake that produced conflict `C-27`.*

**What `V18-5` found.** The walkthrough asks whether the conformance record makes decision **D-4**
answerable. It does not: **ten cells claimed `Present` for a section the template does not contain**,
including "Related Documents" for all four templates. `spec-template.md` read as 9 of 13 conformant
and is 3. `G-06` could not catch it — it validates every *absent* cell and never compares a
`Present` claim to the template. See
[`DEF-018-001`](./defects/DEF-018-001-conformance-record-overstates-presence.md).

- [X] T664 [P] Extend check `G-06` to resolve every bare `Present` claim against the template's actual headings, accepting an explicitly qualified equivalence (`Present — as X`) and rejecting a bare `Present` for a section with no matching heading, in `tests/governance/template-conformance.spec.ts` per FR-RGP-010, FR-RGP-011, SC-RGP-006
- [X] T665 Correct the ten overstated cells in `governance/template-conformance.md`, add the measured-gap table D-4 actually turns on, and bump the record to version 2 (conformance check: T664)
- [ ] T666 **HUMAN** — perform the `V18-6` walkthrough: give someone unfamiliar with the programme the repository root and nothing else, ask them to name the coding, security and architecture standards and what governs this repository, and record the outcome in `closure.md` per SC-RGP-001, SC-RGP-007. **Owner: project-owner.** Deferred, not deprioritised: *"'Can someone new find this?' is answered by someone new, not by a script"*
