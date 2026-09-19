# Contract: Review Role Capability

**Epic**: `EPIC-017` | **Date**: 2026-08-04 | **Extends**:
[`../../_shared/contracts/specification-engine.md`](../../_shared/contracts/specification-engine.md)

Adds **one capability** to the Phase 1 engine contract: `reviewSpecification`. A reviewing role is a
parameter of that call, not a service.

## Shape

`reviewSpecification(input) → EngineResult<ReviewOutput>`

`ReviewInput`:

| Field | Type | Notes |
|---|---|---|
| `specification` | string | the content under review |
| `role` | `RoleInput` | which perspective to review from |
| `steering` | `SteeringInput[]` | optional; the standards the review should apply |

`RoleInput`:

| Field | Type | Notes |
|---|---|---|
| `name` | string | e.g. `security-reviewer` |
| `responsibility` | string | what this role is accountable for |
| `permittedArtifactTypes` | string[] | what it may act on |

`ReviewOutput`:

| Field | Type | Notes |
|---|---|---|
| `findings` | `ReviewFinding[]` | empty means the role found nothing, which is a **pass** |

`ReviewFinding`:

| Field | Type | Notes |
|---|---|---|
| `location` | string | **required** — the part of the specification concerned |
| `severity` | enum | |
| `message` | string | |

The `role` is echoed back by the platform, not by the adapter — the platform knows which role it
asked, and trusting the adapter to report it correctly would make attribution forgeable.

## Rules

- **E-R1** — Returns `EngineResult`, a discriminated union. Adapters **return** failures; they do not
  throw. This is rule E2 of the base contract and is what makes the failure taxonomy enforceable.
- **E-R2** — A finding without `location` is **malformed output**. The whole result is a failure with
  reason `malformed_output`; it is never stored as a partial review. Mirrors FR-ENH-013 and the
  existing `ValidationFinding` rule (EPIC-009 T117).
- **E-R3** — An unavailable engine yields failure reason `engine_unavailable`, which the gate treats
  as **failed**, never as a pass (FR-ENH-016). There is no "skip the reviewer that timed out" path.
- **E-R4** — Empty `findings` is a **pass**, and must be distinguishable from a failed call. Empty
  output as failure (base contract rule) applies to *generation*, where an empty specification is
  meaningless; a review that finds nothing is a legitimate and common outcome. **This is a deliberate
  divergence from the base contract's empty-output rule** and the most likely place to implement it
  wrongly.
- **E-R5** — An adapter registered without `reviewSpecification` remains valid. Review is **not** a
  Phase 1 required capability, so registration is not refused (FR-021); gates configured against an
  engine lacking it fail with a named reason at gate time.
- **E-R6** — Role definitions come from platform configuration and are passed in. Adapters MUST NOT
  hold a role catalogue — that is M-07's prompt registry, deferred.

## Cost note ⚠️

**One invocation per role per gate.** A gate configured with all twelve roles is twelve engine
invocations against a single model, with no optimisation available — M-07 stayed deferred by the
2026-08-04 ruling.

Two consequences the implementer must not discover later:

1. Gates SHOULD be configured with the roles a transition actually needs. Twelve is the maximum, not
   the default.
2. Roles within one gate run **concurrently**, bounded by the platform's existing per-job caps
   (FR-025). Sequential execution makes a gate unusably slow without reducing spend.

RAID **R-02** must be re-scored against this profile before implementation — it is an exit criterion
of the epic.

## Conformance additions

| Case | Assertion |
|---|---|
| **C-17** | Empty `findings` returns success, not `empty_output` failure — E-R4 |
| **C-18** | A finding without `location` yields `malformed_output` — E-R2 |
| **C-19** | An unavailable engine yields `engine_unavailable`, and the gate records failure — E-R3 |
| **C-20** | An adapter without `reviewSpecification` still registers successfully — E-R5 |

The fixture adapter must be able to inject each of these on demand, so gate behaviour is testable
without invoking a live model — the same property that makes EPIC-003's fixture the backbone of the
fast test suite.
