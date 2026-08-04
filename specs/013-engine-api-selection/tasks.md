---

description: "Task list for EPIC-013 — Engine API & Selection"
---

# Tasks: Engine API & Selection

**Epic**: `EPIC-013` | **Module**: M-08 | **Tasks**: 4

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
