# Epic Specification: Review Gates & Roles

**Epic**: `EPIC-021` | **Module**: M-04 | **Tasks**: 23

**Parent design**: [../017-enhancement-model/](../017-enhancement-model/) — spec, plan, research,
data model, contracts, quickstart. Requirements are defined **once** there; this epic declares which
it *owns*.

**Shared design**: [../_shared/](../_shared/) — platform architecture, schema, engine contract

**Created**: 2026-08-04 — split from EPIC-017 by ruling **D-18**

**Delivery posture** (decision D-10):

> ⏸ **HELD** pending `PMI-DOC-004` Business Requirement Specification and approved business scope
> (PMI-TASK-001 T-101, T-106). Product capability. Held is not cancelled — it awaits an input.

## Purpose

Designated roles examine a specification and record findings; a human then decides with those findings in front of them. The roles advise; the human decides. This is where human approval for governed actions becomes mechanism rather than intention.

## SRS Traceability *(Constitution II)*

This epic **inherits** the SRS traceability table in the
[parent spec](../017-enhancement-model/spec.md), which cites `SRS/enhancement_module/` behind every
requirement below. No requirement in this epic originates outside that table.

Authority is layered per **D-16**: the enhancement document governs the structure and traceability of
specifications PMI Studio *produces*; `PMI-DOC-000` governs this repository's own documents.

## Requirements owned

| Requirement |
|---|
| FR-ENH-012 review gates configurable on lifecycle transitions |
| FR-ENH-013 findings identify their location and the role that raised them |
| FR-ENH-014 an explicit human decision is required to advance |
| FR-ENH-015 every gate outcome recorded, including overrides |
| FR-ENH-016 an unavailable or malformed role fails the gate |
| FR-ENH-023 the twelve reviewing and authoring roles |
| FR-ENH-024 record which role produced or reviewed every artifact |

## User stories owned

- US4 — gate a specification behind review

## Success criteria owned

- SC-ENH-004 100% of gated transitions carry a recorded human decision
- SC-ENH-005 every finding attributed to a role and a location

## Depends on

- EPIC-019 — the organization tier
- EPIC-009 — the six-state lifecycle these gates bind to
- EPIC-003 — the engine contract this epic extends with `reviewSpecification`

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform baseline is in [`_shared/platform-spec.md`](../_shared/platform-spec.md); the
enhancement-family register is in the [parent spec](../017-enhancement-model/spec.md). This epic
records only where it differs:

| Principle | Status in this epic |
|---|---|
| PP-003 Human-in-the-Loop | ✅ **Satisfied here for the platform** — no automated verdict advances a specification |
| PP-016 Explainable AI | ✅ **Satisfied here** — gate outcomes record what each role said and what a human overrode |
| PP-017 Cost-Aware AI | 🔶 Deferred to M-07, **and this epic increases the exposure**. Twelve roles per gate, optimisation deferred, containment limited to per-job caps. T291 re-scores RAID R-02. Owner: tech lead |

## Notes

⚠️ **This epic carries the whole PP-017 cost exposure of the family.** Twelve roles per gate is twelve model invocations, with M-07's optimisation controls deferred by the 2026-08-04 ruling. **Gates should be configured with the roles a transition actually needs — twelve is the maximum, not the default.**

⚠️ **Open dependency, finding A1.** FR-011 requires refusing transitions outside the permitted set and naming the permitted ones, but that set is enumerated nowhere — EPIC-009 `T106` says eight, `T108` implements six. `/speckit-clarify` on EPIC-009 resolves it; T277 will need revisiting if the answer is eight.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/021-review-gates-roles/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] RAID **R-02** re-scored against the twelve-role profile (T291)
- [ ] Conformance cases **C-17** to **C-20** green
- [ ] A closing report was published: work completed, work deferred, and the recommended next task
      named as a concrete Spec Kit command (Constitution IX)
- [ ] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
