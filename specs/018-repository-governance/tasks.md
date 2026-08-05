---

description: "Task list for EPIC-018 — Repository Governance Process"
---

# Tasks: Repository Governance Process

**Epic**: `EPIC-018` | **Process, not product** | **Tasks**: 32

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

- [ ] T312 [P] Write failing conformance check asserting every steering subject named by the source document has a file, and that each states checkable standards rather than aspiration, in `tests/governance/steering-files.spec.ts`
- [ ] T313 [P] Write failing conformance check asserting no steering file duplicates constitution or template text beyond a quoted reference (FR-RGP-004), in `tests/governance/steering-no-duplication.spec.ts`
- [ ] T314 Create the steering file index and authoring convention in `governance/steering/README.md` (FR-RGP-001, FR-RGP-003; check: T312)
- [ ] T315 [P] Author organization, workspace and product steering files in `governance/steering/{organization,workspace,product}.md` (FR-RGP-001, FR-RGP-002; check: T312)
- [ ] T316 [P] Author architecture and technology-stack steering files in `governance/steering/{architecture,technology-stack}.md`, referencing `../_shared/system-design.md`, `tech-stack.md` and the ADRs rather than restating them (FR-RGP-004; check: T313)
- [ ] T317 [P] Author coding-standards and UI-standards steering files in `governance/steering/{coding-standards,ui-standards}.md`, deferring UI specifics to SRS Volume 8 where it is not yet written (FR-RGP-002; check: T312)
- [ ] T318 [P] Author security and AI-governance steering files in `governance/steering/{security,ai-governance}.md`, referencing ADR-0002 sandbox controls and PP-016/PP-017 (FR-RGP-004; check: T313)
- [ ] T319 [P] Author business-rules steering file in `governance/steering/business-rules.md`, recording that content awaits `PMI-DOC-004` and naming the back-fill owner (FR-RGP-002; check: T312)
- [ ] T320 Implement the constitution-wins precedence rule and record it in `governance/steering/README.md`, with a check that fails when a steering file contradicts a constitution principle (FR-RGP-005; check: T313)

---

# F-18.2 · Repository layout and mapping

*FR-RGP-006 to FR-RGP-009. The constraint worth respecting is FR-RGP-008: this layout **must not
pre-empt D-13**, the deferred 18-module re-cut. Where the two touch the same paths, the layout
records the dependency instead of resolving it.*

- [ ] T321 [P] Write failing conformance check asserting every artifact type named in the layout has exactly one documented location, and that no location contradicts the existing `specs/<epic>/` or `specs/_shared/` structure, in `tests/governance/layout.spec.ts`
- [ ] T322 [P] Write failing conformance check asserting the layout records its D-13 dependency and proposes no module-path change while D-13 is open (FR-RGP-008), in `tests/governance/layout-d13-guard.spec.ts`
- [ ] T323 Author the repository layout in `governance/repository-layout.md`, mapping each artifact type to its location and reconciling the source document's proposed tree with the structure this repository already uses (FR-RGP-006, FR-RGP-007; check: T321)
- [ ] T324 Record the Spec Kit folder mapping and every path that would migrate, marked as *proposed, not applied*, in `governance/repository-layout.md` (FR-RGP-007; check: T321)
- [ ] T325 Record the D-13 dependency and the paths both decisions touch in `governance/repository-layout.md` (FR-RGP-008; check: T322)
- [ ] T326 Author the governance index naming every governance artifact, its purpose, path and version, in `governance/README.md` (FR-RGP-009; check: T321)

---

# F-18.3 · Internal templates and conventions

*FR-RGP-010 to FR-RGP-013. Per **D-16**, `PMI-DOC-000` governs — **not** the enhancement document's
twenty-one-section structure. Where a required section is genuinely absent, the deviation is recorded
with a reason rather than quietly omitted.*

- [ ] T327 [P] Write failing conformance check asserting every repository template is measured against the 13 `PMI-DOC-000` §4 sections, with each absence carrying a recorded reason, in `tests/governance/template-conformance.spec.ts`
- [ ] T328 [P] Write failing conformance check asserting no template follows the enhancement document's 21-section structure in place of `PMI-DOC-000` (FR-RGP-011, D-16), in `tests/governance/template-authority.spec.ts`
- [ ] T329 Produce the template conformance record for `.specify/templates/{spec,plan,tasks,checklist}-template.md` in `governance/template-conformance.md`, listing present sections, absent sections, and the reason for each deviation (FR-RGP-010, FR-RGP-011; checks: T327, T328)
- [ ] T330 Define the planning and task-document structure so a plan or task list is conformant by construction, in `governance/document-structure.md` (FR-RGP-012; check: T327)
- [ ] T331 State the internal traceability convention — which artifact types link to which, and which links are mandatory — in `governance/traceability-convention.md`, recording that the full chain awaits decision **D-2** (FR-RGP-013; check: T327)

---

# F-18.4 · Constitutional process artifacts

*FR-RGP-014, FR-RGP-015. These encode Constitution VIII and IX as repository artifacts. FR-RGP-015
carries the honesty rule explicitly: an unrun check is never reported as passing — which is the
clause that makes a closing report worth reading.*

- [ ] T332 [P] Write failing conformance check asserting the session-label format is defined and matches the branch-naming convention actually in use, in `tests/governance/session-label.spec.ts`
- [ ] T333 [P] Write failing conformance check asserting the closing-report format defines both mandatory sections and states the honesty rule, in `tests/governance/closing-report.spec.ts`
- [ ] T334 Define the session-labelling convention — label format, where it is applied (terminal, worktree, branch), and when to relabel — in `governance/session-labelling.md` (FR-RGP-014, Constitution VIII; check: T332)
- [ ] T335 Define the closing-report format — Work Completed and Recommended Next Task, plus the rule that unrun checks are never reported as passing and deferred work is never reported as complete — in `governance/closing-report.md` (FR-RGP-015, Constitution IX; check: T333)

---

# F-18.5 · Epic closure

*MANDATORY — Constitution IV, VI, VII, IX.*

- [ ] T336 Wire `pnpm test:governance` into `package.json` and `.github/workflows/ci.yml` so every conformance check runs on each commit
- [ ] T337 Confirm every artifact task in this epic has a passing conformance check; record in `specs/018-repository-governance/epic-closure-report.md`
- [ ] T338 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/018-repository-governance/epic-closure-report.md`
- [ ] T339 Triage `specs/018-repository-governance/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/018-repository-governance/epic-closure-report.md`

---

## Dependencies

**Depends on**: nothing. This epic has no product dependency and no BRS dependency — it governs the
repository, not the platform.

**Depended on by**: nothing blocks on it either. Its value is compounding rather than gating: every
epic planned after it inherits explicit standards instead of implicit ones.

## Build order

```text
F-18.1 steering files ──┐
F-18.2 layout ──────────┼──► F-18.5 closure
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
- **Requirement IDs are namespaced** `FR-RGP-###` to avoid collision C-01, and to keep process
  requirements visibly distinct from product ones.

---

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/018-repository-governance/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [ ] T407 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/018-repository-governance/closure.md`
- [ ] T408 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/018-repository-governance/closure.md`
- [ ] T409 Triage `specs/018-repository-governance/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/018-repository-governance/closure.md`
- [ ] T410 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/018-repository-governance/closure.md`
