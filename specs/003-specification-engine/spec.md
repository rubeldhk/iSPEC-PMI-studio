# Epic Specification: Specification Engine & Sandbox

**Epic**: `EPIC-003` | **Module**: M-08 | **Tasks**: 29

**Parent product spec**: [../_shared/platform-spec.md](../_shared/platform-spec.md)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING.** Buildable now — nothing here depends on the Business Requirement
> Specification.

## Purpose

The architectural centre of the programme: one contract, two adapters, and a sandboxed runtime for executing an AI coding agent. This is where *"Treat Spec Kit as Engine V1, not the product"* is made true or false.

## SRS Traceability *(Constitution II)*

This epic **inherits** the SRS traceability table in the
[platform product specification](../_shared/platform-spec.md), which cites every source document
behind the requirements below. No requirement in this epic originates outside that table.

Authority is layered per decision **D-12**: the MPS governs product content, PMI-DOC-000 governs
documentation standards, PMI-DOC-003 governs principles.

## Requirements owned

Requirements are defined once in the [parent product spec](../_shared/platform-spec.md); this
epic **owns** the following and is where they are satisfied:

| Requirement |
|---|
| FR-016 define the engine capability contract |
| FR-017 invoke engines only through the contract |
| FR-018 Spec Kit adapter as the default engine |
| FR-021 refuse an engine missing a required capability |
| FR-022 record engine and model version on every artifact |
| FR-023 validation findings identify their location · *co-owned* |

## User stories owned

- US3 — generation, engine side
- US8 — prove the platform is not tied to Spec Kit

## Success criteria owned

- SC-008 a second engine with zero changes outside the adapter layer

## Depends on

- EPIC-001 — job orchestration and failure taxonomy

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register lives in the [parent product spec](../_shared/platform-spec.md).
This epic records only where it **differs** or is the place a principle is satisfied:

| Principle | Status in this epic |
|---|---|
| PP-006 Engine Independence | ✅ **Satisfied here for the whole platform.** Package boundary, build-failing architecture test, and a fixture adapter that proves the contract is engine-neutral |
| PP-017 Cost-Aware AI | ⚠️ Containment half satisfied here — hard CPU, memory, and wall-clock caps per sandboxed job (PC-2). Optimisation deferred to M-07 AI Platform |

## Notes

**Buildable with no product surface at all.** The contract takes plain data — `RequirementInput[]`, not database entities — which is what made the D-10 split possible.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/003-specification-engine/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
