---

description: "Task list for EPIC-013 — Engine API & Selection"
---

# Tasks: Engine API & Selection

**Epic**: `EPIC-013` | **Module**: M-08 | **Tasks**: 8

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` Business Requirement Specification
> and approved business scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — these
> tasks are complete, reviewed, and Constitution V compliant. They await an input.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-08.9 · Engine API and interface

- [ ] T139a [P] [US8] Unit tests for the `/engines` listing endpoint asserting capabilities are returned in `backend/tests/unit/engines/engines.controller.spec.ts`
- [ ] T140 [US8] Implement `/engines` listing endpoint in `backend/src/modules/engines/engines.controller.ts` (unit test: T139a)
- [ ] T140a [P] [US8] Component unit tests for the engine selection control in `frontend/tests/unit/components/EngineSelector.spec.tsx`
- [ ] T141 [P] [US8] Implement engine selection control in `frontend/src/components/EngineSelector.tsx` (unit test: T140a)

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/013-engine-api-selection/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [ ] T209 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/013-engine-api-selection/closure.md`
- [ ] T210 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/013-engine-api-selection/closure.md`
- [ ] T211 Triage `specs/013-engine-api-selection/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/013-engine-api-selection/closure.md`
- [ ] T212 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/013-engine-api-selection/closure.md`
