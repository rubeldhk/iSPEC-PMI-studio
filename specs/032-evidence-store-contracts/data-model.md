# Data Model: Evidence Store & Evidence Contracts

**Epic**: `EPIC-032` · **Phase**: 1 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

Four persisted entities, one embedded value, two derived views. The organising rule, from
`FR-EVS-030`: **met/unmet is derived from evidence, never set.** There is no column a caller can
write to mark an item satisfied.

---

## 0. The one structural idea

```text
   ADOPTED FORMAT (in-toto v1)          THIS EPIC OWNS
   ───────────────────────────          ──────────────
   Statement                            EvidenceContract   ── what MUST exist, declared up front
     subject[].digest   ──┐               └─ ContractItem  ── accepting predicateTypes
     predicateType        ├──► EvidenceItem                    met/unmet DERIVED
     predicate            │        │
   (what WAS attested)  ──┘        └──► CompletionGate ── accepted | refused-with-unmet
```

in-toto describes **what was attested**. It has no notion of what **must** be — that is `BR-0142`,
and it is entirely this Epic's (`R-032-1`).

---

## 1. `EvidenceItem`

One typed attestation. Append-only.

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | |
| `workspaceId` | uuid | `BR-0001` — `FR-EVS-016` forbids crossing this boundary |
| `projectId` | uuid | |
| `predicateType` | string | the in-toto URI — **what it proves**, not who made it (`FR-EVS-003`) |
| `subjectName` | string | the attested artifact |
| `subjectDigest` | json | `{ sha256 \| gitCommit \| gitBlob: … }` — **required** (`FR-EVS-011`, `FR-EVS-042`) |
| `attestedVersion` | string | the artifact version this attests. Never inferred from "current" |
| `producedAt` | timestamptz | `FR-EVS-010` |
| `sourceUri` | string | the producing tool or run |
| `sourceVersion` | string? | required for external contributions (`FR-EVS-041`) |
| `storage` | enum | `stored` · `referenced` (`FR-EVS-005`) |
| `payload` | json? | present when `stored` |
| `reference` | json? | present when `referenced` — resolved via `StorageProvider` (`R-032-2`) |
| `integrity` | json | digest algorithm and value for the payload or reference target (`FR-EVS-013`) |
| `attachedTo` | json | artifact, task, decision or outcome (`FR-EVS-004`) |

**Constraints**
- `storage = 'stored' ⇒ payload IS NOT NULL`; `storage = 'referenced' ⇒ reference IS NOT NULL`.
  A row that is neither is not representable.
- `subjectDigest IS NOT NULL` — the database expression of `FR-EVS-042`. A contribution naming no
  version is refused by the schema, not by a service check that could be bypassed.
- Append-only: no `UPDATE`, no `DELETE`, following `audit-immutability.spec.ts`.

**Reads honour the attested artifact's access rules** (`FR-EVS-015`, `BR-0062`). Evidence must not
become a side channel around `EPIC-024` — a scan result naming a file someone cannot read is a
disclosure with better formatting.

---

## 2. `EvidenceContract`

The versioned minimum set. Repository-resident (`R-032-4`); the row binds a version to a work class.

| Field | Rules |
|---|---|
| `id`, `workspaceId` | |
| `workClass` | must match a file in `packages/evidence-contract/contracts/` |
| `contractVersion` | monotonic per `(workspaceId, workClass)`; never reused |
| `items` | the `ContractItem` set (§3) |
| `zeroItemPolicyRef` | **required when `items` is empty** (`FR-EVS-026`) — the explicit declaration that this class needs none |
| `supersededBy` | the version that replaced this one; null while current |

**Never updated.** A change writes a new `contractVersion`, so `FR-EVS-023` — work is judged against
the version it began under — holds by construction rather than by a lookup that could drift.

**`FR-EVS-024` weakening check**: a new version that removes an item or widens an accepting type,
while work is in flight under the prior version, is **refused at load**. Refused when the
configuration is read, so a weakened Contract fails in CI rather than at the moment someone needs it
to pass.

---

## 3. `ContractItem` — embedded

| Field | Rules |
|---|---|
| `itemId` | stable within the Contract |
| `description` | what this item requires proof of |
| `acceptingPredicateTypes` | one or more in-toto `predicateType` URIs (`FR-EVS-025`) |
| `state` | **DERIVED** — `met` · `unmet` · `unresolvable` · `integrity-failed`. Never stored, never set |

**Four states, and three of them are not "met".** `FR-EVS-014` (an unresolvable reference),
`FR-EVS-034` (a failed integrity check) and plain absence all resolve to **not met**. They are
distinct because a reader needs to tell *"nobody produced it"* from *"it was produced and cannot be
trusted"* — but neither satisfies the gate.

---

## 4. `WorkEvidenceBinding`

Ties one governed work item to the Contract version it began under.

| Field | Rules |
|---|---|
| `id`, `workspaceId` | |
| `workRef` | `{ type, id }` — **opaque** to this Epic |
| `workClass` | determines the Contract |
| `contractVersion` | **fixed at creation** (`FR-EVS-021`, `FR-EVS-023`) |
| `createdAt` | |

**`workRef` is opaque on purpose.** A foreign key to a requirement, change or defect table would put
Room vocabulary in the evidence store — the mirror of `EPIC-030` `FR-GEL-061` and `EPIC-031`
`FR-DPE-051`, and the third Epic in a row to need the same fence.

---

## 5. `CompletionAttempt`

Every declaration of completion, accepted or refused. `FR-EVS-033` requires the refusals be recorded.

| Field | Rules |
|---|---|
| `id`, `workspaceId`, `workRef` | |
| `declaredBy`, `declaredAt` | the agent or user (`FR-EVS-030`) |
| `outcome` | `accepted` · `refused` |
| `unmetItems` | json — required when refused (`FR-EVS-032`) |
| `contractVersion` | the version judged against |

**`outcome = 'refused' ⇒ unmetItems IS NOT NULL`.** A refusal that does not say what is missing is
the "not ready" message `FR-EVS-032` exists to forbid.

**Re-evaluation is a new attempt** (`FR-EVS-031`), not a mutation of the old one. The history of what
was missing when, and when it stopped being missing, is the useful part.

---

## 6. `ContractStatus` — derived view

`FR-EVS-022`, `FR-EVS-027`. Computed, never stored.

| Field | Derivation |
|---|---|
| `items[]` | each `ContractItem` with its derived state |
| `unmet[]` | the subset that is not `met` — what a Room's Evidence region renders |
| `satisfied` | true only when every item is `met` |

Deriving it is what makes `FR-EVS-031` true without a cleanup path: evidence arriving changes the
answer on the next read, with nothing to invalidate.

---

## 7. `ProjectEvidenceRollup` — derived view

`FR-EVS-006` and `SC-EVS-008`. *"Which items are unmet across this scope"* and the `BG-08` measure
— *% of completed work with a satisfied Evidence Contract* — **computed from the store rather than
estimated**, which is the whole difference between a measure and an impression.

---

## 8. What this Epic deliberately does not model

| Not here | Owner |
|---|---|
| The compliance **verdict** (`BR-0143`) and spec/code convergence (`BR-0036`) | **unowned** — `U-09`. `ADR-0022` stays Open on it, and this Epic does not converge it |
| Gate definitions and approvers | `EPIC-021` — already built (`backend/src/modules/reviews/`); this Epic stores what its runs produce |
| Running validation | `EPIC-015` — **built and closed 2026-08-20**. Its suites are attestation producers (`R-032-6`) |
| The adapter registry external tools arrive through | `EPIC-013` / `U-13` (`BR-0125`) |
| Risk bands and policy | `EPIC-031` — an evidence gate names a Contract item; it does not hold a band |
| Requirement, change and defect records | `EPIC-033`–`035` — `workRef` stays opaque |

An architecture test asserts `packages/evidence-contract` imports nothing from a Room module,
carries no Room vocabulary, and declares **no verdict type** — the last because `U-09` is the
boundary this Epic is most likely to drift across, being the one everybody wants next.
