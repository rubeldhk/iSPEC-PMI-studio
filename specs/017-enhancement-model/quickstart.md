# Quickstart: Enhancement Model for Spec-Driven Engineering

**Epic**: `EPIC-017` | **Date**: 2026-08-04 | **Plan**: [plan.md](./plan.md)

Eight runnable validation scenarios. Each proves one requirement group end to end and is written to
be executed, not read. Numbering continues the platform's `V` series without colliding with
`../_shared/quickstart.md` (V1–V13).

## Prerequisites

Platform quickstart **V1** (setup) passes; EPIC-004 tenancy, EPIC-008 specifications, and EPIC-009
lifecycle are available. **The fixture adapter is used throughout** — no scenario here requires a live
model, which is what keeps this suite runnable in CI.

```bash
pnpm install
pnpm db:migrate
pnpm dev            # api + worker + web
```

---

## V17-1 · Steering constrains generation

**Proves**: FR-ENH-001, FR-ENH-002, FR-ENH-004 · SC-ENH-001

1. Create an organization, a workspace beneath it, and a project.
2. Record an organization-scope steering document, subject `coding-standards`.
3. Generate a specification in the project.
4. Inspect the generated specification's steering provenance.

**Expected**: the specification records exactly the steering document and version that applied.
Provenance is present, not inferred.

**Then**: retire the steering document and regenerate. The new specification records an **empty**
steering set — not a missing provenance row. That distinction is what SC-ENH-001 measures.

---

## V17-2 · Narrower scope wins, and the override is recorded

**Proves**: FR-ENH-005 · acceptance scenario 2 of User Story 1

1. Record an organization-scope steering document, subject `technology-stack`.
2. Record a project-scope document on the same subject, stating something different.
3. Generate a specification in that project.

**Expected**: the project-scope document applies. The provenance record contains an **override entry**
naming both the winning and the overridden document. The broader rule is recorded, not discarded.

---

## V17-3 · A steering violation is a finding, not a failure

**Proves**: FR-ENH-004 acceptance scenario 4 · contract rule S6

1. Record steering that the fixture adapter is configured to violate.
2. Generate.

**Expected**: generation **succeeds** and the specification is stored, carrying a finding that names
the violated standard. A violated standard is not a failed generation — it is an actionable finding.

---

## V17-4 · A specification goes stale and is reconciled

**Proves**: FR-ENH-006, FR-ENH-007 · SC-ENH-006

1. Generate a specification; confirm `currency_status = current`.
2. Change an upstream artifact it depends on.
3. View the specification.

**Expected**: it shows as **stale on the specification itself**, not only in a report, naming what
changed.

**Then**: reconcile it. The mark clears, attributed and time-stamped.

**Then**: baseline a specification, change an upstream artifact, and attempt to edit it.
**Expected**: the baseline is unaltered; reconciliation forks a new `draft` (FR-011a preserved).

---

## V17-5 · Impact analysis returns multi-hop dependents with paths

**Proves**: FR-ENH-008, FR-ENH-009, FR-ENH-010 · SC-ENH-002

1. Create specifications A → B → C → D, where each depends on the previous.
2. Request impact for A.

**Expected**: B, C, and D all returned, each with the **path** by which it is affected and its
distance. Not merely a flat list of names.

**Then**: set the depth bound below the chain length and repeat. **Expected**: `bounded = true` in the
result. A truncated result that does not say so reads as completeness — this scenario exists to catch
exactly that.

---

## V17-6 · Cycles are refused, including multi-hop

**Proves**: FR-ENH-011 · SC-ENH-009

1. Create dependency edges A → B and B → C.
2. Attempt to create C → A.

**Expected**: refused or reported — never silently stored. The cycle is detected **on the path**, not
only on a direct edge, so a two-hop cycle is caught as reliably as a self-edge.

---

## V17-7 · A gate needs a human, and remembers what it was told

**Proves**: FR-ENH-012 to FR-ENH-016 · SC-ENH-004, SC-ENH-005

1. Configure a gate on the `review → approved` transition requiring two roles.
2. Submit a specification with a defect the fixture adapter is set to report.
3. Attempt to advance without deciding.

**Expected**: the transition is **refused**. `human_decision` is null and an automated verdict alone
never advances a specification.

**Then**: approve with findings outstanding. **Expected**: approval succeeds, and the gate outcome
records the approver **and the overridden findings**.

**Then**: inspect every finding. **Expected**: each names its location and the role that raised it —
zero unattributed findings.

**Then**: attempt to edit the gate outcome. **Expected**: refused in code and by database trigger,
the way `audit_entries` already are.

---

## V17-8 · An unavailable role fails the gate

**Proves**: FR-ENH-016 · contract rules E-R3, E-R4

1. Configure the fixture adapter to report one role as unavailable.
2. Run the gate.

**Expected**: the gate reports the role as unavailable and **fails**. It does not pass by default and
does not silently skip the role.

**Then**: configure the role to return **zero findings**. **Expected**: that is a **pass** — a review
that finds nothing is a legitimate outcome, and must be distinguishable from a failed call. This is
the deliberate divergence from the base contract's empty-output rule and the most likely thing to be
implemented wrongly.

---

## Not covered here

- **The twelve-link chain (FR-ENH-021, SC-ENH-007)** has no scenario, because most of its link types
  belong to epics not yet built — code, tests, release, and operations links have nothing to point at.
  A partial scenario would assert a partial chain and pass for the wrong reason. It belongs in the
  platform quickstart once those epics land.
- **Live-model review.** Everything here runs against the fixture adapter, deliberately. A real-model
  review run belongs in the nightly suite alongside EPIC-015's `T146`, for the same reasons: slow,
  costly, non-deterministic.
- **Scale (SC-ENH-003).** The 500-specification impact measurement is an integration performance
  test, not a quickstart scenario.
