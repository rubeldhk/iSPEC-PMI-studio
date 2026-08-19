# Epic Specification: External Storage Publishing

**Epic**: `EPIC-025` | **Module**: M-11 DevOps | **Tasks**: 37

**Parent design**: [../002-team-review-access-storage/](../002-team-review-access-storage/)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ⏸ **HELD** pending `PMI-DOC-004` Business Requirement Specification and approved business
> scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — the tasks are complete, reviewed,
> and Constitution V compliant. They await an input, not more design.

## Purpose

Publish project artifacts one-way to Google Drive, Dropbox or S3, behind an interchangeable
provider boundary.

**One-way is permanent** (ADR-0004), not a staged simplification. The platform holds lifecycle
state, approvals and version history that a Drive or S3 file cannot carry; letting external edits
return would create two competing truths with no way to reconcile approval state.

## SRS Traceability *(Constitution II)*

This epic **inherits** the SRS traceability table in the
[parent design](../002-team-review-access-storage/spec.md), which cites every source behind the
requirements below. Authority is layered per decision **D-12**.

> ⚠️ **SRS debt.** third-party storage integration (FR-029–FR-040) has **no SRS source**, re-verified against the MPS drop.
> Constitution II requires the back-fill before this epic is **approved** — not merely
> before it closes. Back-fill owner: project owner.

## Requirements owned

Requirements are defined once in the [parent design](../002-team-review-access-storage/spec.md);
this epic **owns** the following and is where they are satisfied:

| Requirement |
|---|
| FR-029, FR-031 — connect a provider and report connection health distinctly |
| FR-029a, FR-029b — refresh an expired token without user interaction; never expose a stored token |
| FR-030, FR-039 — more than one provider type, behind one boundary, new types without change elsewhere |
| FR-032, FR-034 — publish artifacts organised by project, and record what landed where |
| FR-033 — exclude artifacts the publisher cannot access, and report the exclusion |
| FR-035 — publish failures report a specific named reason |
| FR-036, FR-040 — republish preview; no two concurrent publishes of one project |
| FR-037, FR-038 — platform artifacts survive any provider change, deletion or disconnection |

## User stories owned

- US5 — connect an external storage provider
- US6 — publish project files to it
- US7 — swap providers without losing anything

## Success criteria owned

- SC-009 — every publish failure reports a specific named reason
- SC-010 — provider switch with zero loss of artifacts or publish history
- SC-011 — a new provider type with zero change outside the storage boundary
- SC-012 — provider-side deletion has zero effect on platform artifacts
- SC-014 — zero provider passwords accepted or stored; zero stored tokens in any response, log or error

## Depends on

- EPIC-008 — artifacts to publish
- EPIC-024 — access control, because publish must exclude what the publisher cannot see (FR-033)

## Clarifications

### Session 2026-08-19

- No questions required.

Scanned against the twenty-category ambiguity taxonomy. **12** categories are not answered in this document, of which **9** — *Out of Scope*, *Domain & Data*, *Scale assumptions*, *UX Flow*, *Accessibility / i18n*, *Reliability*, *Edge cases*, *Constraints*, *Tradeoffs* — are answered up the chain from the [parent](../002-team-review-access-storage/spec.md) and inherited here under Constitution II. Asking those again per Epic would require this document to restate what the parent owns, which is the duplication `T686` removed from the task counts.

**3** are answered nowhere in that chain:

- *Error / empty states* — **Outstanding** — a plan-level concern that changes no requirement this Epic owns, recorded rather than asked
- *Performance* — **Outstanding** — recorded, not asked
- *Terminology* — **Outstanding** — no canonical glossary exists programme-wide; naming has held without one so far

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register is in [`_shared/platform-spec.md`](../_shared/platform-spec.md); the
epic-level register is in the [parent design](../002-team-review-access-storage/spec.md). This
epic records only where it **differs** or is the place a principle is satisfied:

| Principle | Status in this epic |
|---|---|
| PP-015 Open Standards / no lock-in | ✅✅ **Satisfied here.** FR-030 and FR-038 require provider interchangeability and loss-free switching — the same adapter pattern ADR-0001 applies to engines |
| PP-002 Single Source of Truth | ✅ One-way publishing keeps the platform authoritative; a published copy can never compete with it |

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] **SRS back-fill complete** — this epic must not be *approved* without it (Constitution II)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/025-external-storage-publishing/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
- [ ] A closing report was published (Constitution IX)
