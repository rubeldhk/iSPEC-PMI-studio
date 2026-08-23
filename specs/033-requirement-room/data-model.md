# Data Model: Requirement Room

**Epic**: `EPIC-033` · **Phase**: 1 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

Five persisted entities, one embedded value, two derived views. The organising rule, from
`R-033-1`: **this Room adds the baseline, not the requirement.** No table here duplicates
`EPIC-007`'s register.

---

## 0. The one structural idea

```text
   EPIC-007 OWNS (exists)                THIS EPIC OWNS (new)
   ──────────────────────                ────────────────────
   Requirement          ─┐
   RequirementVersion   ─┼──► referenced by id ──► Baseline ── an approved, immutable SET
   requirement-hash.ts  ─┘         (never copied)      │
                                                        ├─ BaselineException
   EPIC-028 AgentGateway ──► AiAnalysis                └─ Handoff
     capability: 'analyze'      (epistemically labelled)
```

`EPIC-007` versions **a requirement**. Nothing in the repository represents **a set of requirements
approved together** — that absence is `BR-0026`, and it is this Epic's whole addition
(`R-033-1`, verified in code rather than assumed from `D-33`).

---

## 1. `RequirementCandidate`

Extracted, normalized, not yet decided. Distinct from `EPIC-007`'s `RequirementRecord`, which is a
**decided** requirement.

| Field | Rules |
|---|---|
| `id`, `workspaceId`, `projectId` | `BR-0001` |
| `roomObjectId` | → the loop object this Room instance governs |
| `sourceRef` | the intake it came from — document, direct input, imported artifact |
| `normalizedText` | |
| `epistemic` | **required** — `fact` · `inference` · `recommendation` · `open-question` (`R-033-4`) |
| `promotedTo` | the `EPIC-007` requirement id, once decided; null while a candidate |

**A candidate is never a requirement.** Promotion writes to `EPIC-007`'s register through its
service and sets `promotedTo`. This is `FR-RQR-002` in the schema: there is no column here holding a
decided requirement's text.

---

## 2. `Clarification`

| Field | Rules |
|---|---|
| `id`, `roomObjectId` | |
| `question` | generated or authored |
| `askedBy` | actor or agent session (`AgentExecutionRecord` id when AI-generated) |
| `answer`, `answeredBy`, `answeredAt` | null while open |
| `blocksBaseline` | derived — an open question on a candidate intended for implementation |

**Retained after resolution** (`FR-RQR-013`). Clarifications are project knowledge, not scaffolding:
the question somebody had to ask is evidence about the requirement's clarity.

---

## 3. `AiAnalysis` — embedded, epistemically typed

Stored as a structured value on `Clarification` and on `RequirementDecision`, never as free text.

```ts
type Epistemic = 'fact' | 'inference' | 'recommendation' | 'open-question';
```

**Four members, required, no default, no optional variant** (`R-033-4`). `FR-RQR-011` says an
unlabelled element **MUST NOT be presentable**; a required discriminant makes that a compile error
rather than a runtime guard somebody removes. `UX-0031` then maps the discriminant to `EPIC-029`
tokens — the visual distinction is *derived from* the label, so the two cannot disagree.

---

## 4. `RequirementDecision`

| Field | Rules |
|---|---|
| `id`, `roomObjectId` | |
| `decidedBy` | **must be human** — `FR-RQR-041` |
| `authorityBasis`, `objectVersion`, `decidedAt` | the `BR-0005` record, consumed from `EPIC-031`'s published contract, **not redefined** |
| `chosenOption` | |
| `declinedOptions` | json — `FR-RQR-023`, the options *not* taken are retained |
| `rationale` | **required** — `BR-0025` |
| `decisionId` | → `EPIC-031`'s `Decision`, which evaluated the authority |

**Constraint**: `decidedBy` must resolve to a human identity. `FR-RQR-041` — *an AI or agent MUST
NOT take a requirement decision* — is a check constraint, not a service branch, following
`EPIC-031`'s `effectiveClass = 'high' ⇒ actorKind = 'human'` precedent.

---

## 5. `Baseline` — the entity this Epic exists to add

| Field | Rules |
|---|---|
| `id`, `workspaceId`, `projectId` | |
| `version` | monotonic per project; never reused |
| `memberVersionIds` | json — the **`EPIC-007` requirement version ids** frozen, never copies of their text (`R-033-5`) |
| `setHash` | content hash over the member set, via `requirement-hash.ts` |
| `approvedBy`, `approvedAt`, `rationale` | `BR-0026`, `BR-0025` |
| `decisionId` | → the `RequirementDecision` that approved it |
| `supersededBy` | the baseline that replaced it; null while current |
| `evidenceContractRef` | → `EPIC-032`, satisfied before approval completes (`FR-RQR-053`) |

**Append-only. Never updated.** `FR-RQR-050`'s immutability and `FR-RQR-052`'s *"a superseded
baseline remains readable"* both hold by construction rather than by a guard.

**`setHash` is what makes `FR-RQR-051` checkable.** An in-place edit of a member requirement changes
the hash; the mismatch is detectable rather than argued about. Reusing `requirement-hash.ts` avoids
two hashing schemes over the same content, which would eventually disagree and produce a baseline
nobody can verify.

**Constraint**: concurrent approval of overlapping member sets is refused (`FR-RQR-054`) — a
conflict, never a merge.

---

## 6. `BaselineException`

`FR-RQR-032`, `FR-RQR-033`.

| Field | Rules |
|---|---|
| `id`, `baselineId`, `requirementVersionId` | which member the exception covers |
| `condition` | which precondition was waived — currently only *missing acceptance criteria* |
| `authorizedBy`, `reason` | both **required** |

**Enumerable per baseline without opening each requirement** (`FR-RQR-033`). An exception that
becomes invisible is a rule waived once and then forgotten — which is why this is a table rather
than a flag on the member.

---

## 7. `Handoff`

`BR-0027`, `FR-RQR-060`–`FR-RQR-062`.

| Field | Rules |
|---|---|
| `id`, `baselineId`, `baselineVersion` | the version selected, not the baseline generally |
| `specificationWorkflowRef` | opaque — **engine-agnostic** (`FR-RQR-062`) |
| `selectedAt`, `selectedBy` | |

**`specificationWorkflowRef` is opaque on purpose.** A foreign key to a Spec Kit artifact would make
a baseline a Spec Kit thing, and `BR-0027` says baselined requirements are selectable inputs to *one
or more* specification workflows.

---

## 8. Derived views

| View | Derivation | Requirement |
|---|---|---|
| `RoomProgress` | `EPIC-030`'s loop-progress projection for this object — **not recomputed here** | `FR-RQR-074` |
| `BaselineReadiness` | open clarifications, candidates lacking acceptance criteria, unmet Evidence Contract items, pending decision | `FR-RQR-073`, `UX-0032` |

`BaselineReadiness` is what the Room header renders. Deriving it is what makes *"what is blocking
progress"* true without an invalidation path — the same reasoning `EPIC-031` applied to its Inbox.

---

## 9. What this Epic deliberately does not model

| Not here | Owner |
|---|---|
| The requirement itself, its versions, its hash | **`EPIC-007`** — consumed, never duplicated (`D-33`, `FR-RQR-002`) |
| Loop stages and transitions | `EPIC-030` — this Room is a **distinct workflow type** over that engine |
| Risk bands, approval policy, the Decision Inbox | `EPIC-031` — this Room raises decisions; it does not band them |
| Evidence items and Contracts | `EPIC-032` — `evidenceContractRef` points, it does not hold |
| Change requests | `EPIC-034` — an edit after baseline becomes one (`RULE-02`, `FR-RQR-051`) |
| External stakeholder access | **unowned** (`U-02`, `BR-0004`) — `FR-RQR-004` forbids an interim path |
| AI provider, model, budget | `EPIC-028` gateway; `U-11` for budgets (`R-033-2`) |

An architecture test asserts this Room's module imports nothing from `EPIC-034`/`EPIC-035` and
declares no requirement-storage type of its own — the second because `FR-RQR-002` is the boundary
this Epic is most likely to drift across, being the one that would feel convenient.
