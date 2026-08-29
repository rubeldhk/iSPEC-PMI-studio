# Specification Quality Checklist: Application Shell & Dashboard

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-24 · **Re-validated**: 2026-08-24, after the clarification session
**Feature**: [spec.md](../spec.md)

## Content Quality

- [X] No implementation details (languages, frameworks, APIs)
- [X] Focused on user value and business needs
- [X] Written for non-technical stakeholders
- [X] All mandatory sections completed

## Requirement Completeness

- [X] No [NEEDS CLARIFICATION] markers remain
- [X] Requirements are testable and unambiguous
- [X] Success criteria are measurable
- [X] Success criteria are technology-agnostic (no implementation details)
- [X] All acceptance scenarios are defined
- [X] Edge cases are identified
- [X] Scope is clearly bounded
- [X] Dependencies and assumptions identified

## Feature Readiness

- [X] All functional requirements have clear acceptance criteria
- [X] User scenarios cover primary flows
- [X] Feature meets measurable outcomes defined in Success Criteria
- [X] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`

### On "no implementation details" — passed with a stated exception

Four requirements name repository artifacts: `FR-SHL-040`, `FR-SHL-042` and `FR-SHL-043` name
`packages/room-contract`, and the Assumptions name `components.md`,
`docs/design/PMI-Studio-V2-Application-Prototype.html` and `EPIC-010` `T200a`/`T200e`.

**Kept deliberately.** *"Adopt the shared Room contract rather than re-deriving it"* is
unverifiable without naming what must be adopted, and re-derivation is the specific failure
`BR-0191` and `UX-0035` exist to prevent — `EPIC-034` `T406b` and `EPIC-035` `T997a` both hard-stop
if that package is absent. The same choice is made in `specs/033-requirement-room/spec.md`, which
names the package in its own requirements. Naming an artifact a requirement must not duplicate is
not the same as specifying how to build one.

No language, framework or API shape appears anywhere in the requirements.

### Re-validation after clarification (2026-08-24)

**16/16 → 16/16 items passing. No checkbox changed state**, and that is the honest result: the five
answers sharpened the spec without exposing a failing criterion. Two of them narrowed scope, which
if anything makes *"scope is clearly bounded"* pass more strongly than before.

What changed underneath the unchanged boxes:

- **`FR-SHL-014` became a deferral with an owner** (`EPIC-024`), and `PP-008` moved from *Satisfied*
  to *Deferred*. The deferral count is now **1**. A requirement built on an authorization model that
  does not exist would have failed *"requirements are testable"* at plan time; declared as a
  deferral it is honest and checkable.
- **`BR-0013` left the Epic** to `U-03`, taking one user-story scenario with it. The SRS
  traceability row is kept and marked out of scope rather than deleted, so the trace still shows
  where the requirement went.
- **`FR-SHL-017` (addressable areas) and `FR-SHL-054` (the drawer) were added**, each with a success
  criterion and, for the first, an exit-criteria mutation test.
- **`FR-SHL-025` resolves a contradiction** the first draft carried: `prototype-parity.md` declines
  the workspace/project selector to the shell, and the draft had the shell owning it. The shell now
  renders a control `EPIC-004` governs.

### On scope — the boundary that took the most care

Eighteen areas are specified; **four are delivered**, two are **partly delivered**, and all five are in scope. *(Updated 2026-08-28, `T1172`: the Requirement Room area was delivered — `/requirement-room` renders the shared `RoomIndex`. The registry moved first; these follow it.)*

> **Corrected 2026-08-25 (Constitution XII Step B, `T1015`).** This said *five delivered*. The registry now reads **3 delivered · 2 partly-delivered · 13 declared-not-delivered · 0 undeclared** across eighteen areas; across the **seventeen V2 prototype screens** it is **2 / 2 / 13 / 0**. Both denominators are stated wherever a count appears — a figure that does not say what it counts is how two published counts came to disagree.
 `FR-SHL-003` forbids the shell
implementing an area's content, and `UX-0060` forbids an undeclared area appearing at all. The
Assumptions state which six, so the boundary is a list rather than a judgement at plan time.

**Revised 2026-08-24** by [../analysis.md](../analysis.md) `C1`. This read *"nine are declared"*,
which conflated two different questions — is the area's **Epic** declared, and has its **screen**
been built. `QA & Releases`, `Architecture & Decisions` and `Governance` answer yes to the first and
no to the second, and the boolean the registry carried had no correct value for them. The registry
now has three states and the boundary is drawn at *delivered*, which is the rule this Epic already
applied to the three Rooms.

`Home` is the one area this Epic **delivers** rather than hosts, because no Epic owns it and
`BR-0192` has no surface without one. Since the clarification session it delivers **attention items
only**: `BR-0013`'s derived project health went to `U-03` rather than being built here and moved
later.

### Two success criteria worth checking at plan time

- `SC-SHL-006` sets a p95 under one second "on the reference local stack". That phrasing is
  deliberate — `DEF-030-002` records a p95 assertion that fails under suite load and passes alone,
  and a criterion that inherits the same ambiguity would be untestable in the same way.
- `SC-SHL-009` ("answer in under 5 seconds, without opening a menu") is a **human** measure. It
  cannot be automated, and is grouped with the `T885`-class evidence in the Exit Criteria rather
  than pretending otherwise.

### Not a gap, recorded so it is not re-raised

The spec requires areas to be **addressable** (`FR-SHL-017`) and deliberately does not decide
**how**. `frontend/src/main.tsx` records that *"a router arrives with EPIC-010"*, and
`specs/_shared/dependencies.md` makes a new runtime dependency a plan change rather than a task
decision. Whether that is a routing library or hand-rolled belongs to `/speckit-plan`. The product
has no URL routing at all today, so it is new work either way.
