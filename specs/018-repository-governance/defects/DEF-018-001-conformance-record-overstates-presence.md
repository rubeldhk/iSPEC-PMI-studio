# DEF-018-001 — the template conformance record claims sections that do not exist

**Epic**: `EPIC-018` | **Raised**: 2026-08-17 | **Status**: CLOSED
**Originating task**: `T328` (the conformance record) · found by `T445`, the `V18-5` walkthrough
**Severity**: HIGH — the record is the stated evidence for decision **D-4**, and it overstates the
conformance it measures

## Expected

`V18-5` in [`quickstart.md`](../quickstart.md):

> 1. Open the conformance record for each of `spec-template.md`, `plan-template.md`,
>    `tasks-template.md`. 2. Confirm every `PMI-DOC-000` §4 required section is either present or
>    recorded as a deviation with a reason. 3. Read the reasons.
>
> ⚠️ **This output is the evidence for decision D-4.** … If the record does not make D-4 answerable,
> the record is incomplete.

## Actual

Reading `governance/template-conformance.md` against the four templates it measures, **several cells
claim "Present" for a section the template does not contain in any form.**

`spec-template.md` has exactly these sections: SRS Traceability · Principle Conformance & Deferrals ·
User Scenarios & Testing · Requirements · Success Criteria · Assumptions · Epic Exit Criteria — plus
a header block of `Feature Branch` / `Epic` / `Created` / `Status` / `Input`.

| §4 Section | Record says | In the template | Verdict |
|---|---|---|---|
| Business Objective | **Present** *(unqualified)* | nothing | ❌ **wrong** |
| Constraints | **Present** | nothing | ❌ **wrong** |
| Dependencies | **Present** | one *example bullet* under Assumptions | ❌ **wrong** |
| Related Documents | **Present** | nothing | ❌ **wrong** |
| Scope | **Present** | nothing; Assumptions offers "scope boundaries" as an example bullet | ⚠️ overstated |
| Executive Summary | Present — *as the overview* | there is no overview section | ⚠️ overstated |
| Definitions | Present — *where terms are introduced* | no section; inline at best | ⚠️ qualified, defensible |
| Requirements · Acceptance Criteria · Traceability | Present | `## Requirements`, `## Success Criteria` + `## Epic Exit Criteria`, `## SRS Traceability` | ✅ correct |
| Stakeholders · Business Rules · Revision History | Absent, with reasons | absent | ✅ correct |

**"Related Documents — Present" is claimed for all four templates and is true of none of them.**
`tasks-template.md` and `checklist-template.md` have no such section either, and
`checklist-template.md`'s claimed "Scope — Present, as purpose" is contradicted by its three
headings: `## [Category 1]`, `## [Category 2]`, `## Notes`.

`plan-template.md` fares best: `## Summary`, and Technical Context genuinely carries Scope,
Constraints and Primary Dependencies. Its claims are mostly sound.

## Why `G-06` did not catch it

`tests/governance/template-conformance.spec.ts` asserts *"records a reason for every **absence**"*
(lines 62–72). It parses each cell, decides whether it reads as absent, and requires a reason if so.

**A cell reading "Present" is never compared to the template.** The check's own header says as much:

> *Note what this does NOT assert: that the templates have the thirteen sections.*

That note was written to explain why the epic does not perform the D-4 migration, and it is right
about that. But it also leaves the *positive* half of every claim unverified — so the record could
assert conformance it does not have, indefinitely, while the suite stayed green.

**This is the same failure shape as `DEF-001-001`**, found the same day in a different epic: a check
that verifies one half of a claim, and is read as verifying both.

## Impact

The record exists for one purpose — to make **D-4** answerable. D-4 asks whether repository
templates should adopt `PMI-DOC-000`'s thirteen sections, and the answer turns on **how big the gap
is**.

| | `spec-template.md` conformance |
|---|---|
| As the record reads today | 9 of 13 present |
| Actually | **5 of 13 present**, 3 defensibly-equivalent, 5 absent |

A product owner reading the record would size the D-4 migration at roughly half its real cost. That
is not a documentation nit; it is the decision input being wrong in the direction that makes the
cheaper option look cheaper.

## Options

| | Option | Consequence |
|---|---|---|
| **A** | Correct the overstated cells and extend `G-06` to verify "Present" claims too | The record becomes true and stays true. **Recommended** |
| **B** | Correct the cells only | Fixes today's record; the next edit can overstate again with no signal |
| **C** | Record the discrepancy and defer | Leaves D-4 pending on evidence known to be wrong |

## Resolution

**Option A**, by `T664` (the strengthened check, written to fail first) and `T665` (the corrected
record).

`G-06` now resolves every "Present" cell against the template's actual headings, accepting an
explicitly qualified equivalence (`Present — as X`) and rejecting a bare `Present` for a section
with no matching heading. The qualified form is kept legitimate on purpose: `## Summary` really is
an executive summary, and forcing a rename would be conformance theatre.

**D-4 remains open and is still the product owner's call.** This defect corrects the evidence; it
does not take the decision.

**Status**: CLOSED 2026-08-17.

## Traceability

- Requirements: **FR-RGP-010**, **FR-RGP-011** · Criterion: **SC-RGP-006**
- Scenario that found it: `V18-5` ([quickstart.md](../quickstart.md)) via `T445`
- Decision it feeds: **D-4** — still open
- Check that missed it: `G-06` · Fixed by: `T664`, `T665`
- Related: [`DEF-001-001`](../../001-platform-foundation/defects/DEF-001-001-worker-observability-not-installed.md)
  — same shape, same day, different epic
