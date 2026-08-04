# Epic Specification: Platform Foundation

**Epic**: `EPIC-001` | **Module**: M-00 | **Tasks**: 31

**Parent product spec**: [../_shared/platform-spec.md](../_shared/platform-spec.md)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING.** Buildable now — nothing here depends on the Business Requirement
> Specification.

## Purpose

The machinery every other epic runs on: monorepo, CI, the error and failure taxonomy, generation job orchestration, and observability. Nothing here is user-facing; everything here is depended upon.

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
| FR-024 cancel an in-progress job, no partial artifact |
| FR-025 wall-clock timeout enforcement |
| FR-026 distinct, named failure reasons — no generic error |
| FR-027 platform left in its pre-request state on failure |
| FR-028 users continue working while a job runs · *co-owned* |

## User stories owned

*None* — no user-facing behaviour originates here.

## Success criteria owned

- SC-005 every failure reports a named reason
- SC-006 zero partial or malformed artifacts stored

## Depends on

- None — this is the root of the dependency graph

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register lives in the [parent product spec](../_shared/platform-spec.md).
This epic records only where it **differs** or is the place a principle is satisfied:

| Principle | Status in this epic |
|---|---|
| PP-010 Observability by Default | ✅ **Satisfied here for the whole platform.** Function F-00.5 delivers structured logging, metrics, and tracing with one correlation identifier spanning API → queue → worker → sandbox (D-7, R-011, PC-3) |

## Notes

The failure taxonomy is deliberately an enum with no `unknown` member. A generic failure is a defect, not a fallback.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/001-platform-foundation/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
