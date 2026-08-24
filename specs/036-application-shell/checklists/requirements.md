# Specification Quality Checklist: Application Shell & Dashboard

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-24
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

### On scope — the boundary that took the most care

Eighteen areas are specified; **nine are declared and in scope**. `FR-SHL-003` forbids the shell
implementing an area's content, and `UX-0060` forbids an undeclared area appearing at all. The
Assumptions state which nine, so the boundary is a list rather than a judgement at plan time.

`Home` is the one area this Epic **delivers** rather than hosts, because no Epic owns it and
`BR-0192` and `BR-0013` have no surface without one. The Assumptions record what happens to that
work if `U-03` (Portfolio & project health) is later declared.

### Two success criteria worth checking at plan time

- `SC-SHL-006` sets a p95 under one second "on the reference local stack". That phrasing is
  deliberate — `DEF-030-002` records a p95 assertion that fails under suite load and passes alone,
  and a criterion that inherits the same ambiguity would be untestable in the same way.
- `SC-SHL-009` ("answer in under 5 seconds, without opening a menu") is a **human** measure. It
  cannot be automated, and is grouped with the `T885`-class evidence in the Exit Criteria rather
  than pretending otherwise.

### Not a gap, recorded so it is not re-raised

The spec does **not** decide whether a routing library is adopted. `frontend/src/main.tsx` records
that *"a router arrives with EPIC-010"*, and `specs/_shared/dependencies.md` makes a new runtime
dependency a plan change rather than a task decision. That belongs to `/speckit-plan`.
