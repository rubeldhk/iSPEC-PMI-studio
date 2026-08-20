# Epic Specification: Identity & Sign-in

**Epic**: `EPIC-005` | **Module**: M-01 | **Tasks**: 15

**Parent product spec**: [../_shared/platform-spec.md](../_shared/platform-spec.md)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (Business Requirement
> Specification, APPROVED; scope ruling T-106). This Epic implements **BR-0002**. The prior
> hold (decision D-10, PMI-TASK-001 T-101/T-106) is discharged; resumption goes through the
> Definition-of-Ready gate, not by declaration (EPIC-026).

## Purpose

Session-based sign-in behind an identity-provider boundary, plus the web client that consumes it. Deliberately minimal — the boundary exists so Phase 3 SSO replaces an adapter rather than the request pipeline.

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
| FR-000 sign-in and an authenticated session; governed actions refused to an unauthenticated actor · *provisional, superseded when `PMI-DOC-004` lands* |

*Until 2026-08-19 this read "none directly" — sign-in descended from a clarification and traced to
no requirement at all. `FR-000` is provisional, not a discovery: it holds the trace open until the
BRS supersedes it.*

## User stories owned

- US1 — sign-in portion

## Success criteria owned

- SC-001 contributes to the sign-in-to-specification journey

## Depends on

- EPIC-004 — workspace and user data foundation

## Clarifications

### Session 2026-08-19

- Q: Until the Business Requirement Specification lands, how should sign-in be traced when no functional requirement covers it? → A: **Mint a provisional requirement in the parent spec, marked provisional and owned, superseded when `PMI-DOC-004` lands.** Sign-in currently descends from the clarification *"basic sign-in"* rather than from a requirement, which makes it the one delivered capability tracing to nothing while EPIC-011 builds requirement → spec → task traceability. A provisional requirement closes the hole now and turns the BRS into a supersession rather than a discovery — the shape EPIC-023 and EPIC-025 already use to carry their SRS debt with an owner and a before-approval gate.

Scanned against the twenty-category ambiguity taxonomy. **11** categories are not answered in this document, of which **8** — *Out of Scope*, *Lifecycle / States*, *Scale assumptions*, *UX Flow*, *Performance*, *Reliability*, *Edge cases*, *Constraints* — are answered up the chain from the [parent](../_shared/platform-spec.md) and inherited here under Constitution II. Asking those again per Epic would require this document to restate what the parent owns, which is the duplication `T686` removed from the task counts.

**3** are answered nowhere in that chain:

- *Error / empty states* — **Outstanding** — a plan-level concern that changes no requirement this Epic owns, recorded rather than asked
- *Accessibility / i18n* — settled in this session as **WCAG 2.2 Level AA** — automated checks in CI plus a manual keyboard and screen-reader pass at Epic exit — recorded against [EPIC-010](../010-specification-interface/spec.md)
- *Terminology* — **Outstanding** — no canonical glossary exists programme-wide; naming has held without one so far

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register lives in the [parent product spec](../_shared/platform-spec.md).
This epic records only where it **differs** or is the place a principle is satisfied:

*No deltas.* This epic inherits the platform register unchanged.

## Notes

⚠️ **Sign-in descends from a clarification, not from an SRS requirement.** It derives from the
clarification *"basic sign-in"*, which left it the one delivered capability tracing to nothing while
EPIC-011 builds requirement → spec → task traceability.

✅ **Settled 2026-08-19: carried by a provisional requirement, `FR-000`,** minted in the
[parent product spec](../_shared/platform-spec.md) and owned there. It is marked provisional and is
**superseded when `PMI-DOC-004` lands** — the BRS then replaces it rather than discovering the gap.
This is the shape EPIC-023 and EPIC-025 already use for their SRS debt: a named owner and a gate at
approval, not a warning that waits for someone to notice it.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

- [x] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [x] `/speckit-converge` reports no unbuilt work for this epic
- [x] `specs/005-identity-signin/defects/` contains no open defect records
- [x] Principle deltas above still hold; any deferral retains a valid owner
- [x] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
