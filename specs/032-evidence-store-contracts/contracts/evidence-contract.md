# Contract: `packages/evidence-contract`

**Epic**: `EPIC-032` · **Phase**: 1 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

The surface three Rooms, `EPIC-030` and `EPIC-031` build against. Sixth in the `packages/*-contract`
family, after engine, agent, execution, loop and decision.

---

## 1. The attestation envelope — adopted, not invented

```ts
/** in-toto Attestation v1 Statement. The shape is the standard's; the types are ours. */
export interface Attestation {
  readonly _type: 'https://in-toto.io/Statement/v1';
  readonly subject: readonly [AttestationSubject, ...AttestationSubject[]];  // at least one
  readonly predicateType: string;   // a URI — what this proves
  readonly predicate: unknown;      // shaped by predicateType
}

export interface AttestationSubject {
  readonly name: string;
  readonly digest: Readonly<Record<'sha256' | 'gitCommit' | 'gitBlob', string>>;
}
```

**`subject` is a non-empty tuple type.** `FR-EVS-042` refuses a contribution naming no artifact
version; making the array non-empty at the type level means that particular refusal is a compile
error before it is ever a runtime check.

`predicateType` is the whole of `FR-EVS-003` — evidence typed by **what it proves**, not by which
tool produced it. Two scanners emitting `.../vulns/v0.2` are interchangeable to the gate, which is
what `BR-0146` requires.

### Predicate types

| Kind | `predicateType` | Source |
|---|---|---|
| Test result | `https://in-toto.io/attestation/test-result/v0.1` | in-toto standard |
| Vulnerability scan | `https://in-toto.io/attestation/vulns/v0.2` | in-toto standard |
| Build provenance | `https://slsa.dev/provenance/v1` | SLSA |
| **Approval** | `https://pmi.studio/attestation/approval/v1` | **ours** — in-toto has no approval predicate |
| **Transcript** | `https://pmi.studio/attestation/transcript/v1` | **ours** — Constitution XI Tier 2 evidence |
| **Review finding** | `https://pmi.studio/attestation/review-finding/v1` | **ours** — shaped after `EPIC-021`'s `AttributedFinding` |

Standard predicates where one exists; PMI predicates only where none does (`R-032-1`). The split is
recorded so a future standard predicate can replace ours without the gate changing.

---

## 2. The Evidence Contract — ours entirely

```ts
export interface EvidenceContract {
  readonly workClass: string;
  readonly contractVersion: number;
  readonly items: readonly ContractItem[];
  readonly zeroItemPolicyRef?: string;   // REQUIRED when items is empty — FR-EVS-026
}

export interface ContractItem {
  readonly itemId: string;
  readonly description: string;
  readonly acceptingPredicateTypes: readonly [string, ...string[]];  // at least one
}
```

**`ContractItem` carries no `met` field.** State is derived (`data-model.md` §3), so satisfying an
item by assignment is not expressible. That is `FR-EVS-030` — *"completion with an unmet Contract
MUST NOT be reachable"* — enforced by the absence of a field rather than by a guard.

**`zeroItemPolicyRef` is required when `items` is empty.** A Contract with no items is a gate that
always passes, and it looks identical to one nobody has written yet. Requiring the policy reference
makes the difference visible in a diff.

---

## 3. Contract status and the completion gate

```ts
export type ItemState = 'met' | 'unmet' | 'unresolvable' | 'integrity-failed';

export interface ContractStatus {
  readonly items: readonly { itemId: string; state: ItemState }[];
  readonly unmet: readonly string[];
  readonly satisfied: boolean;
}

export type CompletionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly unmet: readonly [string, ...string[]] };
```

**A refused completion is a `Result`, not a thrown error.** This follows `packages/storage-contract`'s
stated rule — *"S1 — adapters RETURN failures; they never throw"* — and matches `EPIC-030`'s
transition refusals. A refusal that arrives as an exception can be swallowed by a caller's `catch`;
a refusal that arrives as a value has to be read.

**`unmet` is non-empty when `ok: false`.** `FR-EVS-032` requires the refusal to name what is
missing; the type makes a refusal with an empty list unrepresentable.

**Three of the four `ItemState` members are not `met`.** `unresolvable` (`FR-EVS-014`) and
`integrity-failed` (`FR-EVS-034`) are distinguished from plain `unmet` because a reader needs to
tell *nobody produced it* from *it was produced and cannot be trusted* — while the gate treats all
three identically. Presence is not validity.

---

## 4. Ports this Epic requires

| Port | Filled by | Absent behaviour |
|---|---|---|
| `EvidenceStorage` | `EPIC-025` `StorageProvider` | **refuse** — `FR-EVS-035`, `R-032-5` |
| `AccessPolicy` | `EPIC-024` (`BR-0062`) | **refuse** — evidence must not read around artifact access (`FR-EVS-015`) |
| `AttestationSource` | `EPIC-013` / `U-13` adapter registry (`BR-0125`) | **refuse** — no bespoke per-tool path (`FR-EVS-040`) |

Every absent port refuses, matching `EPIC-030` `FR-GEL-062` and `EPIC-031`. Three substrate Epics,
one failure direction.

---

## 5. HTTP surface — the real entry points

| Method | Route | Requirement |
|---|---|---|
| `POST` | `/evidence` | contribute a typed attestation — `FR-EVS-001`, `FR-EVS-040` |
| `GET` | `/evidence/:workRef/status` | `ContractStatus` — the Room Evidence region projection (`FR-EVS-027`) |
| `GET` | `/evidence/:workRef/unmet` | `FR-EVS-022` — unmet items without opening each evidence item |
| `POST` | `/evidence/:workRef/complete` | the completion gate — `FR-EVS-030` |
| `GET` | `/evidence/rollup` | `FR-EVS-006`, `SC-EVS-008` — aggregate unmet across a scope |

`400` on an attestation with no subject digest (`FR-EVS-042`), `403` when the attested artifact's
access rules refuse the read (`FR-EVS-015`), `409` on a refused completion carrying its unmet list.

---

## 6. What the contract must never contain

Asserted by `backend/tests/architecture/evidence-independence.spec.ts`:

- no import from any Room module, and no Room vocabulary in a type or field name;
- no loop stage name (`EPIC-030` owns that vocabulary) and no risk band (`EPIC-031` owns that);
- **no compliance-verdict type.** `BR-0143` and `BR-0036` are `U-09` and unowned, `ADR-0022` stays
  Open on them, and this is the boundary this Epic is most likely to drift across — being the one
  everybody wants next. The check is the difference between a boundary and an intention.
