---

description: "Task list for EPIC-014 — DevOps & Release"
---

# Tasks: DevOps & Release

**Epic**: `EPIC-014` | **Module**: M-11 | **Tasks**: 12

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

- [ ] T149 [P] Add seed script creating one workspace and user in `backend/prisma/seed.ts`
- [ ] T150 Write developer setup documentation in `README.md` matching `quickstart.md`

## F-11.2 · Epic closure and promotion

*MANDATORY — Constitution IV, VI, VII. Nothing promotes out of `local` until all pass.*

- [ ] T151 Confirm every implementation task **across all 15 epics** has a passing unit test; record the result in `specs/_shared/release-readiness-report.md`
- [ ] T151a Review the Principle Conformance & Deferrals register in `specs/_shared/platform-spec.md` plus every epic's deltas: confirm all 20 principles are still correctly declared and every deferral retains a valid owner and discharging module (decision D-6); record in `specs/_shared/release-readiness-report.md`
- [ ] T152 Run `pnpm test:arch` and confirm engine-independence (PC-1 transport separation and PC-2 engine independence) is intact; record in `specs/_shared/release-readiness-report.md`
- [ ] T152a Hold and record an **architecture review** against `specs/_shared/system-design.md`, the ADRs, and constraints PC-1 to PC-3 (MPS Volume 6 §8 quality gate; PMI-TASK-001 T-306) in `specs/_shared/release-readiness-report.md`
- [ ] T152b Hold and record a **security review** covering sandbox isolation, workspace scoping, credential handling, and audit immutability (MPS Volume 6 §8 quality gate) in `specs/_shared/release-readiness-report.md`
- [ ] T153 Execute quickstart V1–V12 and record outcomes, including the SC-001 timing run, in `specs/_shared/release-readiness-report.md`
- [ ] T154 Run `/speckit-converge` **per epic**; append and complete any remaining unbuilt work
- [ ] T155 Triage **every** `specs/*/defects/` folder across all 15 epics; every record closed or deferred to a named Epic
- [ ] T155a Confirm SRS back-fill completed for FR-024 and FR-025 (job cancellation and timeout), which have no SRS source (Constitution II); record in `specs/_shared/release-readiness-report.md`
- [ ] T156 Promote `local → dev` (then dev → stage → prod; no environment skipped)
