# Data Model: Decision & Policy Engine

**Epic**: `EPIC-031` · **Phase**: 1 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

Four persisted entities, one derived view, and one thing deliberately **not** stored here. The
organising rule, from `FR-DPE-005` and `R-031-1`: **classification rules are steering documents, not
rows in this Epic's schema.**

---

## 0. The one structural idea

```text
   EPIC-019 STEERING (existing)                THIS EPIC (new)
   ────────────────────────────                ───────────────
   SteeringDocument  ─┐
     subject: risk-classification              Decision   ── one evaluation, immutable
     scope, version, lineage                     │
   resolveSteering() ─┼──► resolved ruleset ──►  ├─ Explanation  (stored, never recomputed)
     precedence, overrides                       └─ GateOutcome  (per required gate)
                     ─┘
                                               InboxEntry ── DERIVED, never stored
```

`EPIC-019` owns the left column. This Epic reads it and owns the right. Nothing in this schema
stores a rule.

---

## 1. `ClassificationRule` — not a table here

A rule is a **steering document** with `subject: 'risk-classification'`, carried by
`SteeringDocumentRecord` (`backend/src/modules/steering/steering.service.ts`):

| Field | Source |
|---|---|
| `lineageId`, `version`, `status` | `SteeringDocumentRecord` — versioning and retirement |
| `scope` | `ScopeDescriptor` — organization / workspace / project / product |
| `content` | the rule text: action pattern, target pattern, resulting band |
| `createdById`, `createdAt` | authorship and review trail |

**Why not a table.** `FR-DPE-005` requires rules be versioned, reviewable and scope-composable, and
`FR-DPE-042` requires the precedence rule that resolved a conflict to appear in the explanation.
`resolveSteering()` already returns both. A second store would be a second precedence
implementation, which `BR-0071` already has one of.

**`FR-DPE-006` holds by construction**: a rule change creates a new steering version, and a
`Decision` retains the version it was judged under (§2), so changing a rule cannot alter a decision
already taken.

---

## 2. `Decision`

One evaluation. Immutable once written.

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | |
| `workspaceId` | uuid | `BR-0001` |
| `projectId` | uuid | |
| `actionType` | string | what was attempted |
| `targetType` / `targetId` | string / uuid | what it was attempted on — **opaque to this Epic** |
| `effectiveClass` | enum | `low` · `medium` · `high` — from policy (`FR-DPE-003`) |
| `proposedClass` | enum? | what an Engineering Expert suggested, if any. **Recorded separately and never merged** (`FR-DPE-003`) |
| `outcome` | enum | `auto-executed` · `approved` · `refused` · `pending` · `exception` |
| `decidedBy` | string? | null while `pending`; required otherwise |
| `authorityBasis` | string | which authority permitted or was missing (`BR-0005`) |
| `objectVersion` | string | the version the decision was made against (`BR-0005`) |
| `decidedAt` | timestamptz? | |
| `actorKind` | enum | `human` · `automation` — `FR-DPE-032`, distinguishable without inference |
| `steeringVersions` | json | lineage → version for every rule that contributed (`FR-DPE-044`) |
| `explanationId` | uuid | → `Explanation`. **NOT NULL** — see §3 |
| `gateOutcomes` | json | one entry per required gate |

**`targetType`/`targetId` are opaque on purpose.** A foreign key to a requirements or change table
would put Room vocabulary in the policy engine, which is the mirror of `FR-GEL-061` and would break
`FR-DPE-051`'s *"Rooms do not each get their own policy logic"* by inverting it.

**Constraints**
- `outcome != 'pending'` ⇒ `decidedBy IS NOT NULL`.
- `effectiveClass = 'high'` ⇒ `actorKind = 'human'` **at the database level** (`FR-DPE-010`,
  `FR-DPE-012`). A check constraint, not a service branch, because this is the fence `ADR-0025`
  constraint 1 depends on.
- `explanationId IS NOT NULL` — the mechanism behind `SC-DPE-002`; an unexplained decision is not
  representable.

---

## 3. `Explanation`

Stored, never recomputed (`R-031-8`, `FR-DPE-044`).

| Field | Rules |
|---|---|
| `id` | uuid |
| `policyVersion` | the tenant policy version in force |
| `matchedRule` | the steering rule that determined the class |
| `riskClass` | the class as decided |
| `precedenceResolution` | which scope won, and why — the `SteeringOverride` from `resolveSteering()` (`FR-DPE-042`) |
| `authorityApplied` | the authority required or exercised |
| `constraintCited` | when a fence refused it, which one — e.g. *high band not configurable* (`FR-DPE-012`) |

**Why a separate table rather than columns on `Decision`.** `FR-DPE-040` covers **blocked and
allowed alike**, so every decision has one; making it a row with a `NOT NULL` foreign key means an
unexplained decision cannot be inserted. Inline nullable columns would make it possible and rely on
a service check to prevent it — which is the shape `ADR-0025` calls *"an unexplainable allow is a
defect"* and would only ever be caught after the fact.

---

## 4. `Exception`

An authorized, recorded, expiring departure from a required gate.

| Field | Rules |
|---|---|
| `id`, `decisionId` | → `Decision` |
| `gateId` | the gate `EPIC-021` names |
| `authorizedBy` | required |
| `reason` | required |
| `expiresAt` | required. **An expiry is a fact, not a grace period** — an expired exception does not retroactively become a pass |

**Never a fifth outcome.** `FR-DPE-013` gives an unsatisfied gate exactly two resolutions — refuse,
or proceed-under-recorded-exception. `satisfied` is not reachable by omission, and the type has no
member for it.

---

## 5. `TenantPolicy`

The tunable half. Bounded by what `FR-DPE-012` fences.

| Field | Rules |
|---|---|
| `id`, `workspaceId`, `version` | monotonic; never reused |
| `bandTreatment` | per band: auto-execute / gates-required / human-approval |
| `selfApprovalAllowed` | per action class, default **false** (`FR-DPE-015`) |
| `approvedBy`, `approvedAt` | a policy change is itself governed |

**Load-time validation** (`FR-DPE-012`): a policy that lowers **baseline change**, **release
promotion**, **loop instance configuration change** (`EPIC-030` `FR-GEL-016`) or any action
PMI-DOC-004 marks as requiring authorized human decision is **refused when read**, naming the action
it tried to downgrade. Refused at load rather than at use, so a bad policy fails in CI instead of on
the first high-risk action in production.

---

## 6. `InboxEntry` — derived view

`R-031-4`. Computed at read time from open `Decision` rows, the reader's role and current policy.
**No table.**

| Field | Derivation |
|---|---|
| `decisionId` | the open decision |
| `kind` | `approval` · `review` · `escalation` · `blocked` |
| `blockedBy` | the missing evidence, pending approver, or refusing policy (`FR-DPE-025`) |
| `objectRef` | `targetType`/`targetId`, for the link (`FR-DPE-023`) |

`FR-DPE-022` and `FR-DPE-024` hold by construction: membership is recomputed per read, so a role
change or a decision elsewhere is reflected without an invalidation path that can be missed.

---

## 7. What this Epic deliberately does not model

| Not here | Owner |
|---|---|
| The rules themselves | `EPIC-019` steering (`R-031-1`) |
| Gate definitions and approvers | `EPIC-021` — this Epic stores outcomes, not gates |
| Evidence items and Evidence Contracts | `EPIC-032` — an evidence gate names a Contract item, and does not hold one |
| Loop stages and transitions | `EPIC-030` — this Epic *is* the Decide stage, invoked through its seam |
| Requirement, change and defect records | `EPIC-033`–`035` — `targetType`/`targetId` stay opaque |
| The decision-authority record's **shape** | published in `packages/decision-contract/`, adopted by `U-02` (`R-031-3`) |

An architecture test asserts `packages/decision-contract` imports nothing from a Room module and
carries no Room vocabulary — the same shape as `engine-independence.spec.ts` and `EPIC-030`'s
`loop-independence.spec.ts`.
