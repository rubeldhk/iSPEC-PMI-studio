# Epic Specification: Project Management

**Epic**: `EPIC-006` | **Module**: M-02 | **Tasks**: 13

**Parent product spec**: [../_shared/platform-spec.md](../_shared/platform-spec.md)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (Business Requirement
> Specification, APPROVED; scope ruling T-106). This Epic implements **BR-0010**. The prior
> hold (decision D-10, PMI-TASK-001 T-101/T-106) is discharged; resumption goes through the
> Definition-of-Ready gate, not by declaration (EPIC-026).

## Purpose

Projects as the container every other artifact belongs to: create, view, rename, archive, with content preserved intact through archival.

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
| FR-001 create, view, rename, and archive projects |
| FR-003 project content scoped with no cross-project leakage · *co-owned* |

## User stories owned

- US1 — set up a workspace and project

## Success criteria owned

- SC-004 workspace isolation

## Depends on

- EPIC-004 — tenancy; EPIC-005 — an authenticated actor

## Clarifications

### Session 2026-08-19

- No questions required.

Scanned against the twenty-category ambiguity taxonomy. **14** categories are not answered in this document, of which **11** — *Out of Scope*, *Domain & Data*, *Lifecycle / States*, *Scale assumptions*, *UX Flow*, *Performance*, *Reliability*, *External deps*, *Edge cases*, *Constraints*, *Tradeoffs* — are answered up the chain from the [parent](../_shared/platform-spec.md) and inherited here under Constitution II. Asking those again per Epic would require this document to restate what the parent owns, which is the duplication `T686` removed from the task counts.

**3** are answered nowhere in that chain:

- *Error / empty states* — **Outstanding** — a plan-level concern that changes no requirement this Epic owns, recorded rather than asked
- *Accessibility / i18n* — settled in this session as **WCAG 2.2 Level AA** — automated checks in CI plus a manual keyboard and screen-reader pass at Epic exit — recorded against [EPIC-010](../010-specification-interface/spec.md)
- *Terminology* — **Outstanding** — no canonical glossary exists programme-wide; naming has held without one so far

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register lives in the [parent product spec](../_shared/platform-spec.md).
This epic records only where it **differs** or is the place a principle is satisfied:

*No deltas.* This epic inherits the platform register unchanged.

## Notes

`GenerationJob` carries a foreign key to `Project`, so job persistence touches a table this held epic
owns — the D-10 seam in [srs-alignment.md](../srs-alignment.md).

✅ **Settled: the stub table, option 1** *(recorded 2026-08-19; the choice was made in code when the
EPIC-001 slice started)*. `Project` exists in `backend/prisma/schema.prisma` with workspace, name and
owner only — no service, no validation, no behaviour. EPIC-004 `T011a` asserts both halves: that the
three structural columns are present, and that `status` and `archivedAt` are **not**. This epic takes
ownership and extends it when it unfreezes; until then the table must not grow.

*This note previously offered both options as open. It was stale — the decision had already been
taken and guarded, and only the document still presented it as a question.*

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

- [x] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [x] `/speckit-converge` reports no unbuilt work for this epic
- [x] `specs/006-project-management/defects/` contains no open defect records
- [x] Principle deltas above still hold; any deferral retains a valid owner
- [x] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
