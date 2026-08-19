---

description: "Task list for EPIC-014 — DevOps & Release"
---

# Tasks: DevOps & Release

**Epic**: `EPIC-014` | **Module**: M-11 | **Tasks**: 18

> **Counted, not quoted.** This number is recomputed by `/speckit-analyze`; the phase and function sections below are its composition. It drifted before because two documents restated it and neither was derived — EPIC-018 read 31 here, 32 in the index and 34 in its task list, and by the time `T529` came to reconcile them the real figures were 31 / 37 / 38. **The remediation went stale before it ran.** Corrected by `T686`.

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` Business Requirement Specification
> and approved business scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — these
> tasks are complete, reviewed, and Constitution V compliant. They await an input.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-11.1 · Developer enablement

- [ ] T149a [P] Unit tests asserting the seed script is idempotent and creates exactly one workspace and one user with a hashed password, in `backend/tests/unit/core/seed.spec.ts`
- [ ] T149 [P] Add seed script creating one workspace and user in `backend/prisma/seed.ts` (unit test: T149a)
- [ ] T452 [P] Conformance check asserting `README.md` exists at the repository root and covers every setup step in `specs/_shared/quickstart.md` — the executable check Constitution V (v1.2.0) requires for a document output, since manual review does not satisfy the gate — in `tests/governance/readme-conformance.spec.ts`
- [ ] T150 Create `README.md` at the repository root with developer setup documentation matching `specs/_shared/quickstart.md` — the repository currently holds only `readme.txt` (conformance check: T452)

## F-11.2 · Platform release gate

*MANDATORY — Constitution IV, VI, VII. The **platform-wide** gate: nothing promotes out of `local`
until all pass.*

**Restructured 2026-08-03** (`/speckit-analyze` finding **C1**). Per-epic closure work moved out of
here into a `Phase Z · Epic closure` in each epic's own `tasks.md`, so an epic can close **without
waiting on this held epic**. What remains is genuinely platform-wide: this gate **confirms** each
epic's `closure.md` record — it does not repeat the per-epic checks.

- [ ] T151 Confirm a `closure.md` exists for **all 15 epics** and each records every implementation task in that epic passing its unit test (Constitution V); consolidate into `specs/_shared/release-readiness-report.md` — do not re-run the per-epic checks
- [ ] T151a Review the Principle Conformance & Deferrals **baseline** register in `specs/_shared/platform-spec.md`: confirm all 20 principles are still correctly declared and every deferral retains a valid owner and discharging module (decision D-6); record in `specs/_shared/release-readiness-report.md`. Per-epic deltas are confirmed in each epic's own closure task
- [ ] T152 Run `pnpm test:arch` and confirm engine-independence (PC-1 transport separation and PC-2 engine independence) is intact; record in `specs/_shared/release-readiness-report.md`
- [ ] T152a Hold and record an **architecture review** against `specs/_shared/system-design.md`, the ADRs, and constraints PC-1 to PC-3 (MPS Volume 6 §8 quality gate; PMI-TASK-001 T-306) in `specs/_shared/release-readiness-report.md`
- [ ] T152b Hold and record a **security review** covering sandbox isolation, workspace scoping, credential handling, and audit immutability (MPS Volume 6 §8 quality gate) in `specs/_shared/release-readiness-report.md`
- [ ] T153 Execute quickstart V1–V12 **and V14** and record outcomes in `specs/_shared/release-readiness-report.md` (the SC-001 timing run is owned by EPIC-010 T124a; confirm its result here rather than re-running it)
- [ ] T154 Confirm every epic's `closure.md` records a clean `/speckit-converge` with no unbuilt work remaining; consolidate into `specs/_shared/release-readiness-report.md`
- [ ] T155 Confirm every epic's `closure.md` records an empty `defects/` folder, or remaining records deferred to a named epic; consolidate into `specs/_shared/release-readiness-report.md`
- [ ] T155a Confirm SRS back-fill completed for FR-024 and FR-025 (job cancellation and timeout), which have no SRS source (Constitution II); record in `specs/_shared/release-readiness-report.md`
- [ ] T156 Promote `local → dev` (then dev → stage → prod; no environment skipped)

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/014-devops-release/closure.md`, this epic's own closure record, which **F-11.2 above** then
confirms alongside the other fourteen. Keep the two separate: this phase closes EPIC-014 as an epic;
F-11.2 is the platform gate that closes the release.*

- [ ] T213 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/014-devops-release/closure.md`
- [ ] T214 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/014-devops-release/closure.md`
- [ ] T215 Triage `specs/014-devops-release/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/014-devops-release/closure.md`
- [ ] T216 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/014-devops-release/closure.md`
