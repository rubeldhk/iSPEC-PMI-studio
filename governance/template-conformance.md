# Template Conformance Record

**Epic**: [`EPIC-018`](../specs/018-repository-governance/) · **Requirements**: `FR-RGP-010`,
`FR-RGP-011` · **Version**: 2 · **Checks**: `G-06`, `G-06d`

> **Version 2 — 2026-08-17.** Ten cells claimed `Present` for a section the template does not
> contain. The record is the evidence for **D-4**, and D-4 turns on how big the gap is, so
> overstating presence priced the migration at roughly half its real cost — `spec-template.md` read
> as 9 of 13 conformant when it is 5. Corrected below, and `G-06` now verifies the *positive* half
> of every claim, which nothing did before. See
> [`DEF-018-001`](../specs/018-repository-governance/defects/DEF-018-001-conformance-record-overstates-presence.md).

## Governing authority

`PMI-DOC-000` **governs** the templates in this repository — specifically §4 Standard Document
Structure, which names thirteen sections. This is decision **D-16**.

It is *not* the enhancement document's twenty-one-section structure. That structure governs PMI
Studio's **product output** — the specifications the platform generates for its customers — and
belongs to [EPIC-017](../specs/017-enhancement-model/). The two are easily confused and the
confusion is expensive: applying a product-output shape to internal specs would push twenty-one
sections onto 25 epic directories, most of which have no business objective or stakeholder list of
their own because they inherit one.

Check `G-06d` fails if any template adopts the product structure.

## What this record does and does not do

It **records** the gap between each template and `PMI-DOC-000` §4, with a reason for every absence.

It does **not** migrate the templates. Whether they adopt the thirteen sections is decision
**D-4**, which remains **open** and is the product owner's to settle. This record exists to make
D-4 answerable — enumerating the gap is the work; choosing is not this epic's call (R-018-5).

Adopting the thirteen sections now would back-fill six sections into 18 epic specs, several of them
sections an internal spec has no content for. That is a decision with a cost, and it deserves to be
taken deliberately rather than as a side effect of writing a conformance check.

## Conformance against `PMI-DOC-000` §4

Legend: **Present** — the section exists, possibly under a different heading. **Absent — reason** —
the section is not present, with why.

| Section | `spec-template.md` | `plan-template.md` | `tasks-template.md` | `checklist-template.md` |
|---|---|---|---|---|
| Executive Summary | Absent — an epic spec opens with `Input` and SRS traceability; the parent product spec carries the overview (D-4) | Present — as the summary block | Absent — a task list is an index, not a document with a thesis | Absent — a checklist has no summary |
| Business Objective | Absent — inherited from the parent product spec; an epic spec declares the requirements it *owns*, not the objective it inherits (D-4) | Absent — inherited from the epic spec; restating it would fork it (D-4) | Absent — inherited from the epic spec (D-4) | Absent — not applicable to a checklist |
| Scope | Absent — expressed as the requirements and success criteria the epic owns, with boundaries under Assumptions; no dedicated section (D-4) | Present — as technical context | Absent — scope is the epic's, stated once (D-4) | Present — as the `Purpose` field |
| Stakeholders | Absent — the three programme roles are fixed and stated in `steering/organization.md`; per-document repetition would fork the owner list | Absent — same reason | Absent — same reason | Absent — same reason |
| Definitions | Present — where terms are introduced | Absent — terms defined in the epic spec (D-4) | Absent — terms defined in the epic spec (D-4) | Absent — not applicable |
| Requirements | Present | Present — as constraints | Present — tasks cite their requirement | Present — as checklist items |
| Business Rules | Absent — awaits `PMI-DOC-004`; see `steering/business-rules.md` | Absent — same reason | Absent — same reason | Absent — same reason |
| Constraints | Absent — stated per requirement; technical constraints belong to the plan's Technical Context (D-4) | Present — as the Technical Context `Constraints` field | Present — as build order and dependencies | Absent — not applicable |
| Dependencies | Absent — stated per spec where they exist; the template prompts for none (D-4) | Present — as the Technical Context `Primary Dependencies` field | Present | Absent — not applicable |
| Acceptance Criteria | Present — as success criteria and epic exit criteria | Present — as the constitution check | Present — per task | Present — the items are the criteria |
| Traceability | Present — SRS traceability table | Present — links to spec and research | Present — task-to-requirement citation | Absent — the checklist traces to its own spec only |
| Related Documents | Absent — no link block; links are inline and governed by [`traceability-convention.md`](./traceability-convention.md) (D-4) | Present — as the header `Spec` and `SRS References` links | Present — as the `Input` and `Prerequisites` header links | Present — as the `Feature` link |
| Revision History | Absent — git is the revision history; a hand-maintained table in a versioned file is a second source of truth that drifts | Absent — same reason | Absent — same reason | Absent — same reason |

## Summary of deviations

| Deviation | Templates affected | Reason | Owner |
|---|---|---|---|
| Stakeholders section absent | all four | Roles are fixed programme-wide and stated once in [`steering/organization.md`](./steering/organization.md) | project-owner |
| Revision History section absent | all four | Git is the revision history; a maintained table drifts from it | tech-lead |
| Business Rules section absent | all four | Awaits `PMI-DOC-004` — a recorded gap, see [`steering/business-rules.md`](./steering/business-rules.md) | product-owner |
| Business Objective / Definitions / Scope absent from plan, tasks | `plan-template.md`, `tasks-template.md` | Inherited from the epic spec; restating them creates the fork `FR-RGP-004` forbids | product-owner (D-4) |
| Executive Summary absent from tasks, checklist | `tasks-template.md`, `checklist-template.md` | Neither document has a thesis to summarise | tech-lead |
| **Executive Summary / Business Objective / Scope / Constraints / Dependencies / Related Documents absent from the spec template** | `spec-template.md` | **Added in v2.** Each was recorded as `Present` in v1 and is not. An epic spec declares the requirements it *owns* and inherits the rest from the parent product spec; the template prompts for none of these six | product-owner (D-4) |

Every absence above carries a reason. Check `G-06` fails on an absence without one — a deviation
without a reason is a defect, not a deviation, and the difference is whether anyone decided.

## The measured gap

Corrected in v2. This is the number D-4 actually turns on:

| Template | Present under its own name | Present as a stated equivalence | Absent, with a reason |
|---|---|---|---|
| `spec-template.md` | 3 — Requirements, Traceability, Acceptance Criteria | 1 — Definitions (inline) | **9** |
| `plan-template.md` | 1 — Executive Summary | 5 — Scope, Requirements, Constraints, Dependencies, Traceability, Related Documents | 6 |
| `tasks-template.md` | 1 — Requirements | 4 | 8 |
| `checklist-template.md` | 0 | 4 | 9 |

**`spec-template.md` is the outlier**, and it is the template that matters most — it is the one
`PMI-DOC-000` §4 was written for. In v1 it read as 9 of 13 conformant. It is 3, plus one inline
equivalence.

## The pattern in these deviations

Three of the deviations have the same shape: the section exists *once*, at the epic level, and
the lower-level document links to it rather than repeating it. That is the same rule `FR-RGP-004`
applies to steering files, arrived at independently.

This matters for D-4. The question is not really "should the templates have thirteen sections" — it
is "should each document carry a full section set, or should a section be stated once at the level
that owns it and linked from below". The first reading makes conformance mechanical and creates
five places for a business objective to drift. The second keeps one source of truth and makes
conformance a judgement about inheritance. **Recommendation to the product owner: the second.** The
evidence is above; the call is not this epic's.

## Related documents

- [`document-structure.md`](./document-structure.md) — the structure plans and task lists follow.
- [`repository-layout.md`](./repository-layout.md) — where the templates live.
- [`../specs/srs-alignment.md`](../specs/srs-alignment.md) — decisions **D-4** and **D-16**.
- [`../specs/018-repository-governance/research.md`](../specs/018-repository-governance/research.md) — R-018-5.
