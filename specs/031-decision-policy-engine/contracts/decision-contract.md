# Contract: `packages/decision-contract`

**Epic**: `EPIC-031` · **Phase**: 1 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

The surface three Rooms, `EPIC-030` and the eventual `U-02` build against. Fifth in the
`packages/*-contract` family, after `engine-contract`, `agent-contract`, `execution-contract` and
`EPIC-030`'s `loop-contract`.

---

## 1. The three bands — `FR-DPE-010`

```ts
export const RISK_BANDS = ['low', 'medium', 'high'] as const;
export type RiskBand = (typeof RISK_BANDS)[number];
```

**Three members, no fourth, no `unknown`.** `FR-DPE-004` gives an unclassified action type the most
restrictive band rather than a band of its own — an `unknown` member would be a fourth treatment
nobody specified, and the first thing a permissive default would attach to.

---

## 2. The decision-authority record — `BR-0005`, published for `U-02`

```ts
export interface DecisionAuthorityRecord {
  readonly actor: ActorRef;
  readonly authorityBasis: string;
  readonly objectVersion: string;
  readonly decision: DecisionOutcome;
  readonly decidedAt: string;   // ISO-8601
}
```

Exactly the five elements `BR-0005` names: actor, authority basis, object version, decision,
timestamp. **This Epic publishes the shape provisionally; `U-02` adopts it unchanged when declared**
(`FR-DPE-014`, clarified 2026-08-22). It is deliberately not a class and carries no behaviour, so
adopting it costs `U-02` nothing but an import.

---

## 3. The decision call — the `EPIC-030` Decide seam

This is the concrete type behind `loop-contract`'s `PolicyProvider`, which `EPIC-030`
`FR-GEL-062` defaults to **refuse** when unregistered.

```ts
export interface DecisionRequest {
  readonly workspaceId: string;
  readonly actionType: string;
  readonly target: { type: string; id: string };   // opaque — no Room vocabulary
  readonly actor: ActorRef;
  readonly proposedClass?: RiskBand;               // MAY propose; MUST NOT assign
  readonly requiredGates: readonly string[];
}

export interface DecisionResult {
  readonly outcome: 'auto-executed' | 'approved' | 'refused' | 'pending' | 'exception';
  readonly effectiveClass: RiskBand;
  readonly explanation: Explanation;               // NOT optional — FR-DPE-040
  readonly gateOutcomes: readonly GateOutcome[];
}
```

**`explanation` is not optional.** `FR-DPE-040` covers blocked and allowed alike, so a result
without one is unrepresentable rather than merely discouraged. This is the type-level half of what
`ADR-0025` constraint 3 asks for; the database `NOT NULL` in [data-model.md](../data-model.md) §3 is
the other.

**`proposedClass` is separate from `effectiveClass` on purpose** (`FR-DPE-003`). An Engineering
Expert may propose; the engine classifies from policy. Merging them into one field is how a
model-assigned class would enter without anyone deciding to allow it.

---

## 4. The explanation — `FR-DPE-041`, `FR-DPE-042`

```ts
export interface Explanation {
  readonly policyVersion: string;
  readonly matchedRule: SteeringRuleRef;      // lineageId + version
  readonly riskClass: RiskBand;
  readonly precedenceResolution?: string;     // present when scopes conflicted — BR-0071
  readonly authorityApplied: string;
  readonly constraintCited?: string;          // e.g. "high band not configurable" — FR-DPE-012
}
```

`precedenceResolution` is populated from `resolveSteering()`'s `SteeringOverride`, so the
explanation **quotes** the precedence decision rather than reconstructing it (`R-031-1`).

---

## 5. Gate outcomes — four members, no default

```ts
export type GateResult = 'satisfied' | 'refused' | 'exception' | 'violation';
```

Identical to `EPIC-030`'s `loop-contract` `GateOutcome.result`, and deliberately the same four
words. Two contracts describing one concept with different vocabularies is the divergence `UX-0035`
forbids at the interface, applied one layer down.

**`satisfied` is reachable only by a gate provider returning it.** `FR-DPE-013` forbids reaching it
by omission, and `data-model.md` §4 has no representation for an absent outcome.

---

## 6. Ports this Epic requires

| Port | Filled by | Absent behaviour |
|---|---|---|
| `SteeringSource` | `EPIC-019` | **refuse** — `FR-DPE-050`, `R-031-5`: unreadable rules are not permissive rules |
| `GateProvider` | `EPIC-021` | **refuse** — a required gate with no provider is not a satisfied gate |
| `EvidenceContractSource` | `EPIC-032` | **refuse** for medium-band evidence gates |
| `AuditSink` | `EPIC-004` | **refuse** — a decision that cannot be recorded is not taken (`FR-DPE-016`) |

Every absent port refuses. That is `ADR-0025`'s reasoning applied to composition, and it matches
`EPIC-030` `FR-GEL-062` exactly — the two substrate Epics fail the same direction so a governed
action cannot slip through the seam between them.

---

## 7. HTTP surface — the real entry points

Constitution XI Tier 1 drives these. Listed because *"the entry point MUST be the real one"*.

| Method | Route | Requirement |
|---|---|---|
| `POST` | `/decisions` | request a decision — the Decide seam's HTTP face |
| `POST` | `/decisions/:id/approve` | `FR-DPE-014`, `FR-DPE-015` |
| `GET` | `/decisions/:id/explanation` | `FR-DPE-040` — for blocked **and** allowed |
| `GET` | `/inbox` | `FR-DPE-020`–`FR-DPE-026`, role-scoped, derived |
| `GET` | `/decisions/metrics` | `FR-DPE-033` band distribution and auto-execution rate |

`403` for missing authority, `409` for a policy refusal, both carrying the decision id so the caller
reads the explanation rather than inferring it.

---

## 8. What the contract must never contain

Asserted by `backend/tests/architecture/decision-independence.spec.ts`:

- no import from any Room module, and no Room vocabulary — `requirement`, `change`, `defect`,
  `baseline`, `triage` — in a type or field name;
- no loop stage names (`EPIC-030` owns the vocabulary; this contract is invoked *by* a stage);
- no evidence type beyond the `EvidenceContractSource` port (`EPIC-032`);
- **no fourth risk band, and no `unknown`** — the check asserts `RISK_BANDS.length === 3`, because
  the band set widening silently is how `FR-DPE-004`'s most-restrictive default would stop being
  the most restrictive.
