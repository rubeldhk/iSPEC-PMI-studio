# Contract: Steering Input to the Specification Engine

**Epic**: `EPIC-017` | **Date**: 2026-08-04 | **Extends**:
[`../../_shared/contracts/specification-engine.md`](../../_shared/contracts/specification-engine.md)

This extends the Phase 1 engine contract. It adds **one input field**; it adds no capability and
changes no existing operation.

## The rule this contract exists to protect

> Nothing outside the adapter layer may depend on a specific engine — FR-017, PP-006, enforced by the
> build-failing architecture test (EPIC-003 T047, T142).

Steering is the single most likely place for that rule to erode, because the obvious implementation
is "append the steering text to the prompt". **Prompt is an engine-specific concept.** A non-LLM
engine has no prompt. The moment `backend/` formats one, the platform has an engine assumption in it.

## Shape

`GenerateSpecificationInput` gains an optional `steering` field:

| Field | Type | Notes |
|---|---|---|
| `steering` | `SteeringInput[]` | absent or empty when no steering is in scope |

`SteeringInput`:

| Field | Type | Notes |
|---|---|---|
| `subject` | enum | one of the ten subjects of FR-ENH-002 |
| `scopeType` | enum | `organization` \| `workspace` \| `project` \| `product` |
| `content` | string | the guidance text, verbatim |
| `version` | integer | the exact version applied |

**Plain data only.** Like `RequirementInput[]`, this carries no database entities, no identifiers the
adapter could dereference, and no platform types. That property is what made the D-10 split possible
and it is preserved here deliberately.

## Rules

- **S1** — `backend/` MUST pass `steering` as structured data. It MUST NOT render steering into
  prose, a prompt fragment, or any engine-specific format.
- **S2** — The array is **pre-resolved**. Conflicts between scopes are settled by the platform before
  the call (narrower scope wins, FR-ENH-005); the adapter never resolves precedence.
- **S3** — The array arrives **ordered broadest to narrowest**, so an adapter that simply concatenates
  produces correct precedence without understanding the hierarchy.
- **S4** — An adapter MUST accept an absent or empty `steering` field and behave exactly as it does
  today. Steering is additive; this is what keeps every existing conformance case valid.
- **S5** — An adapter MUST NOT fetch steering itself. Adapters run sandboxed with no platform
  credentials (ADR-0002); granting database access to read steering would undo the sandbox's central
  property.
- **S6** — The engine result MUST report steering violations as **findings**, using the existing
  finding shape, not as a failure. A specification that violates a standard is still a specification;
  it is the finding that makes the violation actionable (FR-ENH-004, acceptance scenario 4).

## Conformance additions

Three cases join the shared conformance suite. Every adapter must pass all of them, and the fixture
adapter must be able to fail them on demand.

| Case | Assertion |
|---|---|
| **C-14** | With no `steering`, output is identical to the pre-steering baseline — S4 |
| **C-15** | With `steering` present, the adapter consumes it without the platform having formatted anything engine-specific — S1 |
| **C-16** | A steering violation is returned as a finding, not as a failed result — S6 |

## What this contract does not do

- It does not define **how** an adapter presents steering to its engine. The Spec Kit adapter will
  compose a prompt; that is correct, and it happens inside `engine-adapters/speckit/`.
- It does not carry steering for **task generation or validation**. Phase 1 scopes steering to
  specification generation. Widening it later is additive and needs no redesign.
- It does not govern this repository's own steering files — those are
  [EPIC-018](../../018-repository-governance/) and are not an engine input at all.
