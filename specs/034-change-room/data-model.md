# Data Model: Change Room

**Epic**: `EPIC-034` · **Phase**: 1 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

Five persisted entities, two embedded values, two derived views. The organising rule, from
`R-034-1` and `R-034-2`: **this Room composes existing traversals and records obligations. It owns
no graph and executes no re-plan.**

---

## 0. The one structural idea

```text
   EXISTS, COMPOSED (not rebuilt)          THIS EPIC OWNS
   ──────────────────────────────          ──────────────
   ImpactService (depth 25)     ─┐
   ChainTraversalService        ─┼──► ImpactView ──┐
   EPIC-033 Baseline            ─┘   (snapshot)    │
                                                    ├─ ChangeRequest ── the RULE-02 gate
   TaskRegenerationService ── NOT CALLED ──► RePlanObligation  (recorded, not executed)
```

Two absences are deliberate and load-bearing. This Epic **does not** hold an impact graph — it
snapshots one. And it **does not** call `TaskRegenerationService`, because that service replaces and
`BR-0154` requires revision without destroying completed work (`R-034-2`).

---

## 1. `ChangeRequest`

| Field | Rules |
|---|---|
| `id`, `workspaceId`, `projectId` | `BR-0001` |
| `roomObjectId` | → the `EPIC-030` loop object; this Room is a **distinct workflow type** |
| `targetBaselineId`, `targetBaselineVersion` | **required** — `FR-CHR-010`, a change is always *against* a baseline |
| `requestedOutcome`, `reason`, `requester` | `BR-0043` |
| `urgency` | **a recorded attribute, never a gate bypass** (`FR-CHR-021`) |
| `openQuestions` | json |
| `origin` | `direct` · `defect-transfer` — with the originating defect ref when transferred (`FR-CHR-012`) |
| `state` | `open` · `withdrawn` · `decided` · `applied` · `closed` |
| `rebasedFrom` | the prior `targetBaselineVersion`, when explicitly rebased (`FR-CHR-013`) |

**Constraint**: `targetBaselineVersion` is `NOT NULL`. A change with no baseline is not a change —
it is intent, and belongs in the Requirement Room.

**`urgency` has no privileged value.** `ADR-0025` constraint 2 and `FR-CHR-021`: an emergency change
is a change with a recorded urgency, not a change with fewer gates.

---

## 2. `ImpactView` — a snapshot, not a graph

| Field | Rules |
|---|---|
| `id`, `changeRequestId` | |
| `computedAt`, `traversalDepth` | depth is **25**, from `DEFAULT_IMPACT_DEPTH` (`R-034-1`) |
| `areas` | the eight `BR-0044` classes, each an `ImpactArea` (§3) |
| `retainedForDecision` | true once a decision referenced it — `FR-CHR-035` |

**Retained with the change** (`FR-CHR-035`), which is what makes `R-034-5`'s re-decision test
answerable: *has the impact changed since the decision?* is a comparison against a stored snapshot,
not a human recollection.

**Not a graph.** The traversal belongs to `ImpactService` and `ChainTraversalService`. This table
holds what those returned, at a time, for a decision.

---

## 3. `ImpactArea` — embedded, three-state

```ts
type ImpactState = 'impacted' | 'not-impacted' | 'unknown';
```

| Field | Rules |
|---|---|
| `area` | one of the eight: requirements · specifications · architecture · tasks · code · tests · release scope · operational effects |
| `state` | **required**, three members (`R-034-7`) |
| `items` | the impacted refs, when `impacted` |
| `unknownReason` | **required when `unknown`** — e.g. *"check not owned (`BR-0073`, `U-17`)"* |

**All eight areas are always present.** `FR-CHR-032`: an area the platform cannot determine is
`unknown`, never omitted. The spec states why — *"an absent row and a clean row must not look
alike"* — and a fixed eight-member set with a required state makes absence unrepresentable rather
than discouraged.

This is also `FR-CHR-034`: the architecture area carries `unknown` with *"violation check not
owned"* rather than a clean panel, because a check that has not run must not read as passed.

---

## 4. `ChangeOption` — embedded

| Field | Rules |
|---|---|
| `optionId`, `summary`, `reasoning` | |
| `tradeOffs` | **six dimensions, each stated or explicitly not-applicable** — schedule, cost, quality, **security**, compatibility, delivery (`FR-CHR-041`) |
| `epistemic` | **`recommendation`** — from `packages/room-contract`'s `Labelled<T>`; never `fact` |

**Two or more per decision** (`FR-CHR-040`), **none pre-selected** (`FR-CHR-042`). The six trade-off
dimensions are a fixed set for the same reason the eight impact areas are: presenting a change
choice on schedule alone is how security and compatibility become discoveries rather than inputs.

---

## 5. `ChangeDecision`

| Field | Rules |
|---|---|
| `id`, `changeRequestId` | |
| `decidedBy` | **must be human** — baseline change is permanently high band |
| `authorityBasis`, `objectVersion`, `decidedAt` | `EPIC-031`'s published `BR-0005` record, **not redefined** |
| `decisionId` | → `EPIC-031`'s `Decision`, which evaluated the band |
| `chosenOption`, `declinedOptions`, `rationale` | `FR-CHR-043` |
| `impactViewId` | **the snapshot the decision was made against** (`FR-CHR-035`) |

**Constraint**: `decidedBy` resolves to a human, enforced at the database. `EPIC-031`'s
`FR-DPE-012` fences the band; this constraint makes the fence hold even if a caller bypasses the
policy engine, which is the belt the `EPIC-033` precedent established.

---

## 6. `BaselineDelta`

`FR-CHR-063` — readable as a delta, not only as two full versions.

| Field | Rules |
|---|---|
| `id`, `changeDecisionId` | |
| `fromBaselineVersion`, `toBaselineVersion` | |
| `added`, `removed`, `versionChanged` | member **requirement version ids** (`R-034-4`) |

**A set diff over version ids**, not a text diff. `EPIC-033`'s baseline stores version ids and a set
hash and deliberately holds no requirement text; a text diff would re-derive from content this Epic
cannot see, and would disagree with the hash.

---

## 7. `RePlanObligation` — recorded, never executed

**The entity `R-034-2` exists to create.**

| Field | Rules |
|---|---|
| `id`, `changeDecisionId` | |
| `affectedSpecificationId` | |
| `whatMustChange`, `why` | |
| `state` | `recorded` · `discharged-by-U-12` |

**This Epic never calls `TaskRegenerationService.regenerate()`.** That service replaces a task list
(`replaced: boolean`, *"existing when refused, the new list when replaced"*), and `BR-0154` requires
revision **without destroying completed-work history**. Calling it would satisfy `FR-CHR-062`'s
wording and violate the requirement it cites.

So the obligation is recorded and surfaced, and `FR-CHR-065` — *"re-plan MUST NOT silently discard
work already completed"* — is the requirement that forbids the shortcut. Executing it is `U-12`'s.

---

## 8. `ChangeClosure`

| Field | Rules |
|---|---|
| `id`, `changeRequestId` | |
| `whatChanged`, `why` | `BR-0048` |
| `validatingEvidence` | → `EPIC-032` Contract items, by reference |
| `supersedingBaselineVersion` | |

**All four `BR-0048` questions answerable from this row alone** (`FR-CHR-073`). Closure is refused
while the Evidence Contract is unmet (`FR-CHR-071`), and a declaration of completion does not
substitute for it (`FR-CHR-072`, `BR-0144`).

---

## 9. Derived views

| View | Derivation | Requirement |
|---|---|---|
| `ChangeReadiness` | undecided state, unmet evidence, unknown impact areas, pending approval | `FR-CHR-083`, `UX-0032` |
| `RoomProgress` | `EPIC-030`'s loop-progress projection — **not recomputed** | `FR-CHR-080` |

---

## 10. What this Epic deliberately does not model

| Not here | Owner |
|---|---|
| The impact **graph** and its traversal | `EPIC-020` / `dependencies`, `EPIC-011` — composed, never rebuilt (`FR-CHR-031`) |
| Task revision that preserves completed work | **unowned** — `U-12`, `BR-0154`. This Epic records the obligation (`R-034-2`) |
| Architecture-violation flagging | **unowned** — `U-17`, `BR-0073`. The impact area carries `unknown` with a reason |
| Rationale queries (*why did this change?*) | **unowned** — `U-17`, `BR-0083`. This Epic retains the *why*; it does not answer queries over it |
| The baseline itself | `EPIC-033` — this Room changes it, and holds no requirement text |
| Region vocabulary and the Room shell | `EPIC-033` — **imported** from `packages/room-contract` (`R-034-3`) |
| Risk bands, the Decision Inbox | `EPIC-031` |
| Evidence items and Contracts | `EPIC-032` |
| The transfer **decision** | `EPIC-035` — this Room owns the reception (`R-034-6`) |

An architecture test asserts this Room declares no region vocabulary of its own and no second impact
traversal — the two boundaries most likely to be crossed, one because deriving a shell feels
independent and the other because a local traversal feels faster.
