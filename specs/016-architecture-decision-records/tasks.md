---

description: "Task list for EPIC-016 — Architecture Decision Records"
---

# Tasks: Architecture Decision Records

**Epic**: `EPIC-016` | **Module**: M-13 | **Tasks**: 2

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` Business Requirement Specification
> and approved business scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — these
> tasks are complete, reviewed, and Constitution V compliant. They await an input.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-13.2 · Architecture Decision Records

*SRS PMI-DOC-000 §9 and the Charter both mandate ADRs from day one.*

- [ ] T144 [P] Unit tests for ADR creation, status changes, and linking to specifications in `backend/tests/unit/decisions/decisions.spec.ts`
- [ ] T143 [P] Implement Architecture Decision Record model, service, and endpoints in `backend/src/modules/decisions/` (unit test: T144)
