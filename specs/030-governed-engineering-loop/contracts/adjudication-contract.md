# Contract: specification status-transition adjudication

**Epic**: `EPIC-030` · **Phase**: C2A · **Date**: 2026-08-25 · **Plan**: [plan.md](../plan.md)

The surface `EPIC-037` consumes. It exists because `EPIC-037` Band A stopped: it needed to submit a
status-transition proposal and read a governed verdict, and no owner existed. `EPIC-021` owns gate
outcomes, `EPIC-009` owns lifecycle validity and application, `EPIC-030` owns authority and gates —
and **nothing owned the adjudication of a proposal**.

Source: [`packages/loop-contract/src/adjudication.ts`](../../../packages/loop-contract/src/adjudication.ts).

---

## 1. Why it lives in the contract package — `FR-GEL-073`

A connector or registry service must be able to **propose** a transition and **read** a verdict
without importing a backend module. That is not a packaging preference; it is the mechanism that
makes *"no connector may interpret or apply lifecycle policy"* enforceable rather than aspirational.
If the proposer could reach `SpecificationLifecycleService`, the rule would rest on discipline.

Asserted by [`backend/tests/architecture/adjudication-boundary.spec.ts`](../../../backend/tests/architecture/adjudication-boundary.spec.ts):
the contract package imports no backend module, store or Prisma client, and only
`backend/src/modules/specifications/` plus the one governed adapter may reach the lifecycle service.

## 2. Input — `AdjudicationProposal` (`FR-GEL-063`)

Identity (`proposalId`, `executionId`, `workspaceId`, `specificationId`), the **expected current
status** and the requested status, `targetVersion`, proposer identity (`proposerId`,
`proposerType`, and a **frozen** `proposerIdentitySnapshotId`), `originatingConnector`,
`evidenceRefs`, `reason`, `correlationId`, `causationId`, `idempotencyKey`, `proposedAt`.

`expectedCurrentStatus` is what makes optimistic concurrency possible (§5). `proposerType` is
`'human' | 'agent' | 'service'` and drives separation of duties (§6).

**Specification lifecycle types, never `LoopStage`** (`FR-GEL-064`). The eight loop stages and the
specification lifecycle are different vocabularies for different objects; an implicit mapping would
make one of them meaningless.

## 3. Output — `AdjudicationVerdict`, a closed set of six (`FR-GEL-068`)

| Verdict | Means | Applied? |
|---|---|---|
| `validated` | Valid, authorised, gates clear — and policy does **not** authorise automatic application | no |
| `applied` | `EPIC-009` **confirmed** the transition | yes |
| `approval_required` | Valid, but the actor lacks an authority; `requiredApproverRole` names it | no |
| `refused` | Separation of duties, lifecycle, a gate, or `EPIC-009` said no — carries `refusalStage` **and** `refusalReasonCode` | no |
| `inconsistent` | Observed status contradicts `expectedCurrentStatus` | no |
| `reconciliation_required` | The application outcome was **never observed** | unknown |

Two distinctions the set exists to preserve:

- **`validated` is not `applied`.** A proposal can be entirely valid and still not be applied. Rev 2
  collapsed these and the project owner corrected it.
- **`applied` is not claimed until `EPIC-009` confirms** (`FR-GEL-069`). `appliedTransitionId` is
  present *only* for `applied`.

Every verdict carries a `reason` an auditor can read. *"Refused"* is not a reason — and the
`reason` is **supplementary evidence only**, never parsed to select behaviour.

The type is a **closed discriminated union**: each variant carries exactly what it needs, and every
non-applied variant declares `appliedTransitionId?: never`, so a refusal that applied something
cannot be constructed. Nine CHECK constraints enforce the same invariants in PostgreSQL.

## 3a. Refusal, and the deterministic event mapping — `X1`

Two **orthogonal** concepts. `refusalStage` answers *when* and selects the event;
`refusalReasonCode` answers *why* and never selects one.

| `refusalStage` | `EPIC-037` event | Reason codes filed here |
|---|---|---|
| `validation` | `validation-failed` | `invalid_lifecycle_transition`, `gate_failed`, `gate_outcomes_unavailable` |
| `approval` | `approval-refused` | `self_approval_prohibited`, `distinct_approver_required`, `unauthorized_actor`, `approval_authority_missing` |
| `transition` | `transition-refused` | `lifecycle_application_refused` |

`REFUSAL_STAGE_OF` **derives** the stage from the code, so the two cannot disagree — which is what
would put event selection back to guessing. Rehydration from a row recomputes it rather than
trusting the stored column.

Stale state remains `inconsistent`, and an unobserved outcome remains `reconciliation_required`.
Neither is a refusal: no decision was taken against the proposal in either case.

## 4. Application — `LifecycleApplicationPort` (`FR-GEL-069`)

Returns `confirmed` | `refused` | `unknown`. Only a **stated** refusal from `EPIC-009` —
`InvalidLifecycleTransitionError`, `ValidationFailedError`, `ForbiddenError` — becomes `refused`. A
timeout, a database fault, or a returned state other than the one requested is `unknown`.

`unknown` becomes `reconciliation_required`, never `applied` (a lie) and never `refused` (a
different lie, since the transition may well have happened).

**Atomicity is not claimed.** `EPIC-009`'s `transition()` exposes no transaction client, so the
adjudication record and the authoritative transition cannot share a commit boundary. A durable
intent is recorded **before** the call, so an outcome nobody observed still leaves a trace for a
reconciliation pass to find.

## 5. Concurrency and idempotency — `FR-GEL-070`, `FR-GEL-071`

Two protections that are easy to confuse:

- **Optimistic concurrency** stops a *stale* proposal. Observed ≠ expected → `inconsistent`, and
  nothing is applied. Checked **before** authority, so a stale proposal is not reported as merely
  unauthorised — that would send a human to approve a transition that no longer makes sense.
- **Idempotency** stops a *repeated* proposal. Unique on `(workspaceId, proposalId,
  idempotencyKey)` **in the database**, so it does not rest on a read-then-write race. A retry
  returns the **original** verdict and re-decides nothing.

## 6. Separation of duties — `FR-GEL-067`

An **agent or service** may never approve its own proposal. This is evaluated *before* policy is
consulted and is not reachable by configuration. A **human** self-approving is tenant policy,
defaulting to a distinct approver required. Identity is read from the frozen snapshot, never from
mutable display metadata.

## 7. Authorisation — `IntakeAuthorizationPort` (`FR-GEL-066`)

A port onto **`EPIC-024`**, not a new model. Applied at intake, **ahead of the idempotency lookup**
— otherwise an unauthorised caller could read a prior verdict back out of it. It throws rather than
returning a verdict: a verdict would write audit evidence on behalf of a caller with no standing.

## 8. Evidence — `FR-GEL-072`

Every intake, evaluation, approval, refusal and application writes an `adjudication_records` row.
Immutability is enforced by an **attached** `reject_mutation()` trigger, not by application code.
See [data-model.md §8](../data-model.md).

## 9. What this contract does not carry

No table of permitted transitions (`EPIC-009`). No gate evaluation (`EPIC-021`). No authorisation
model (`EPIC-024`). No event vocabulary of its own — but the refusal **stage → event** mapping above
is exported (`REFUSAL_EVENT_OF`, `refusalEventFor`) so `EPIC-037` selects by lookup rather than by
re-deriving a rule this Epic already owns.
