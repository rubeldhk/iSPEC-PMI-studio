# Epic Specification: External Storage Publishing

**Epic**: `EPIC-025` | **Module**: M-11 DevOps | **Tasks**: 42

**Parent design**: [../002-team-review-access-storage/](../002-team-review-access-storage/)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (Business Requirement
> Specification, APPROVED; scope ruling T-106). This Epic implements **BR-0063**. The prior
> hold (decision D-10, PMI-TASK-001 T-101/T-106) is discharged; resumption goes through the
> Definition-of-Ready gate, not by declaration (EPIC-026).

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

> ⚠️ **SRS debt.** third-party storage integration (FR-PUB-029–FR-PUB-040) has **no SRS source**, re-verified against the MPS drop.
> Constitution II requires the back-fill before this epic is **approved** — not merely
> before it closes. Back-fill owner: project owner.

## Requirements owned

Requirements are defined once in the [parent design](../002-team-review-access-storage/spec.md);
this epic **owns** the following and is where they are satisfied:

| Requirement |
|---|
| FR-PUB-029, FR-PUB-031 — connect a provider and report connection health distinctly |
| FR-PUB-029a, FR-PUB-029b — refresh an expired token without user interaction; never expose a stored token |
| FR-PUB-030, FR-PUB-039 — more than one provider type, behind one boundary, new types without change elsewhere |
| FR-PUB-032, FR-PUB-034 — publish artifacts organised by project, and record what landed where |
| FR-PUB-033 — exclude artifacts the publisher cannot access, and report the exclusion |
| FR-PUB-035 — publish failures report a specific named reason |
| FR-PUB-036, FR-PUB-040 — republish preview; no two concurrent publishes of one project |
| FR-PUB-037, FR-PUB-038 — platform artifacts survive any provider change, deletion or disconnection |

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
- SC-017 — a publish of 500 artifacts completes without failure or degradation (added 2026-08-19; the parent's ceiling covers 200 questions per review session, whose half EPIC-023 owns)

## Depends on

- EPIC-008 — artifacts to publish
- EPIC-024 — access control, because publish must exclude what the publisher cannot see (FR-PUB-033)

## Clarifications

### Session 2026-08-19

- No questions required.

Scanned against the twenty-category ambiguity taxonomy. **12** categories are not answered in this document, of which **9** — *Out of Scope*, *Domain & Data*, *Scale assumptions*, *UX Flow*, *Accessibility / i18n*, *Reliability*, *Edge cases*, *Constraints*, *Tradeoffs* — are answered up the chain from the [parent](../002-team-review-access-storage/spec.md) and inherited here under Constitution II. Asking those again per Epic would require this document to restate what the parent owns, which is the duplication `T686` removed from the task counts.

**3** are answered nowhere in that chain:

- *Error / empty states* — **Outstanding** — a plan-level concern that changes no requirement this Epic owns, recorded rather than asked
- *Performance* — **Resolved 2026-08-19** — the parent set a scale ceiling the same day: `SC-017`, 500 artifacts per publish, owned here and tested by `T820`
- *Terminology* — **Outstanding** — no canonical glossary exists programme-wide; naming has held without one so far

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register is in [`_shared/platform-spec.md`](../_shared/platform-spec.md); the
epic-level register is in the [parent design](../002-team-review-access-storage/spec.md). This
epic records only where it **differs** or is the place a principle is satisfied:

| Principle | Status in this epic |
|---|---|
| PP-015 Open Standards / no lock-in | ✅✅ **Satisfied here.** FR-PUB-030 and FR-PUB-038 require provider interchangeability and loss-free switching — the same adapter pattern ADR-0001 applies to engines |
| PP-002 Single Source of Truth | ✅ One-way publishing keeps the platform authoritative; a published copy can never compete with it |

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [x] **SRS back-fill complete** — `SRS/PMI-DOC-004_Business_Requirement_Specification_v1.0.md` **BR-0063** is the business source for `FR-PUB-029`–`FR-PUB-040` (approved 2026-08-20, T-106)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/025-external-storage-publishing/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
- [ ] A closing report was published (Constitution IX)
