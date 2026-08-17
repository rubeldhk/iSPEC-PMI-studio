# Epic Specification: Platform Foundation

**Epic**: `EPIC-001` | **Module**: M-00 | **Tasks**: 35

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

> **This claim was false from 2026-08-03 until 2026-08-17.** The modules were built and tested; for
> most of that period nothing called them, and after `T657` only the API did. It became true with
> `T663`. Recorded rather than silently corrected, because the interesting fact is not that the gap
> existed but that a specification asserted a principle for two years' worth of downstream planning
> while the system did not honour it — see
> [`DEF-001-001`](./defects/DEF-001-001-worker-observability-not-installed.md) and
> [`DEF-001-002`](./defects/DEF-001-002-api-request-metrics-never-emitted.md).

## Notes

The failure taxonomy is deliberately an enum with no `unknown` member. A generic failure is a defect, not a fallback.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

- [x] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [x] `/speckit-converge` reports no unbuilt work for this epic
- [x] `specs/001-platform-foundation/defects/` contains no open defect records
- [x] Principle deltas above still hold; any deferral retains a valid owner
- [x] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge

**Closed 2026-08-17.** See [`closure.md`](./closure.md). The first epic in this programme to close.
