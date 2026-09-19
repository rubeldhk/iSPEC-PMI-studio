# Phase 1 Data Model: Defect Room

**Epic**: `EPIC-035` · **Date**: 2026-08-23 · **Plan**: [plan.md](./plan.md) ·
**Research**: [research.md](./research.md)

## 0. The one structural idea

**A classification without a destination is not representable**, and neither is a fix without the
test that proved the defect. Everything else here is bookkeeping around those two.

`ADR-0016` names three outcomes and the specification's exit criteria call two outcomes *"the shape
this Epic is most likely to ship by accident."* So the outcome is a three-member union, the
destination is a total `Record` over it (`R-035-5`), and the database carries a `CHECK` besides
(`R-035-8`) — because a type guards the code this Epic writes and a constraint guards the callers it
does not.

**Nothing here stores requirement text, specification text or test output.** Baselines are held by
version reference (`EPIC-033`), evidence by reference into `EPIC-032`, tasks by id into `EPIC-012`.

---

## 1. `DefectRecord`

| Field | Notes |
|---|---|
| `id` | |
| `workspaceId`, `projectId` | `FR-DFR-011` — project link |
| `epicId` | **nullable**, and nullable is not laxity — `FR-DFR-012` requires an unlinkable defect to be *held for triage with the missing link named*, which needs a state where the link is absent and visible |
| `state` | `held-for-triage`, `triaged`, `reproducing`, `test-pending`, `confirmed`, `repairing`, `verifying`, `closed`, `routed`, `withdrawn` — projected from `EPIC-030`, never authored here |
| `origin` | `automated-test`, `manual-report`, `monitoring`, `review-tool`, `production-incident`, `agent` — `FR-DFR-010`, `FR-DFR-013` |
| `originDetail` | free text; the reporting system's own identifier where it has one |
| `contestedArtifactRef` | the artifact whose behaviour is contested |
| `contestedArtifactVersion` | **NOT NULL** — `FR-DFR-024`, `PP-012`. A defect is against a *version*; without this the re-evaluation against current has nothing to compare to |
| `severity` | `FR-DFR-080`, captured at intake per `FR-DFR-082` |
| `reportedBy`, `reportedAt` | |
| `withdrawnAt`, `withdrawnReason` | nullable |

`origin` includes **`agent`** because the specification's edge cases accept an AI-filed defect. It
is an origin and nothing more: `FR-DFR-023` still forbids an agent confirming a defect.

---

## 2. `Classification` — three outcomes, and every one goes somewhere

| Field | Notes |
|---|---|
| `id`, `defectId` | |
| `outcome` | `confirmed-defect` \| `change-request` \| `requirement-gap` — `FR-DFR-022`, `ADR-0016` |
| `destination` | **NOT NULL** — `repair` \| `change-room` \| `requirement-room`, resolved from `DESTINATIONS` (`R-035-5`) |
| `approvedBehaviourRef` | the baseline version the report was judged against — nullable **only** when `outcome = 'requirement-gap'` |
| `absenceRecorded` | `FR-DFR-021` — where no approved behaviour exists, the absence is recorded rather than left blank |
| `classifiedBy`, `classifiedByKind` | `human` \| `agent` |
| `proposedByAgent` | `FR-DFR-023` — an agent may propose; the confirming actor must be human |
| `supersededByClassificationId` | nullable; set on reclassification |
| `reclassifiedAt` | nullable — **the row is never deleted** (`FR-DFR-025`, `ADR-0016`) |

**Database constraints** (`R-035-8`, hand-edited migration SQL):

- `destination` **NOT NULL**, and a `CHECK` that it matches the outcome's mapped destination —
  `FR-DFR-077`, so an item cannot rest classified with nowhere to go even if a caller bypasses the
  service;
- a `CHECK` that `outcome = 'confirmed-defect'` implies `classifiedByKind = 'human'` —
  `FR-DFR-023`, the same belt `EPIC-034` put beside `EPIC-031`'s braces.

**Reclassification is a new row**, not an update. `ADR-0016`'s never-delete rule is about
auditability, and an updated row destroys the same history a deleted one does, more quietly.

---

## 3. `Reproduction`

| Field | Notes |
|---|---|
| `id`, `defectId` | |
| `reproducible` | `always` \| `intermittent` \| `not-reproduced` \| `not-automatable` — `FR-DFR-030`, `FR-DFR-031` |
| `environment` | structured: platform, version, tenant scope |
| `steps` | |
| `evidenceRefs` | **references into `EPIC-032`** — `FR-DFR-032`. No payload is stored here |
| `notAutomatableReason` | **required when `reproducible = 'not-automatable'`** — `FR-DFR-043`, so the exception is enumerable rather than implicit |
| `affectedBehaviour` | what the contested behaviour actually did |

`intermittent` is a first-class member rather than a flag, because `FR-DFR-031` needs the loop to
refuse closure on a single passing run — and a state the transition rules can read is what makes
that possible.

---

## 4. `DefectTest`

| Field | Notes |
|---|---|
| `id`, `defectId` | |
| `testRef` | the test's stable identifier |
| `contestedBehaviourRef` | `FR-DFR-042` — linked to the behaviour, not only to the defect |
| `firstObservedFailingAt` | **NOT NULL** — the moment the test demonstrated the defect. `FR-DFR-040` |
| `lastRunOutcome` | `fail` \| `pass` \| `not-run` |
| `lastRunEvidenceRef` | into `EPIC-032` |

`firstObservedFailingAt` is non-nullable **on purpose**: a `DefectTest` row that never failed is not
the artifact `FR-DFR-040` is asking for, and a nullable column would let one exist and satisfy a
naive "does a test exist?" check. This is the field the `FR-DFR-041` `CHECK` constraint reads.

---

## 5. `EvidenceCheck` — where a passing reproduction test goes

| Field | Notes |
|---|---|
| `id`, `defectId`, `defectTestId` | |
| `path` | `refine-test` \| `investigate` \| `reclassify` — **required, no default** (`R-035-6`) |
| `resolvedBy`, `resolvedAt` | |
| `rationale` | |

A table rather than a status field, because `US4` scenario 2 requires **which path was taken** to be
recorded, and because an intermittent defect can pass through this step more than once
(`FR-DFR-031`).

---

## 6. `RepairLink`

| Field | Notes |
|---|---|
| `id`, `defectId`, `defectTestId` | |
| `taskId` | → `EPIC-012` `TaskRecord.id`. **The `TaskRecord` is not modified** (`R-035-3`) |
| `orphanedByClassificationId` | nullable — set when the defect is reclassified after tasks exist, so the tasks and the reclassification are **both** visible rather than the tasks silently orphaned |

`orphanedByClassificationId` exists because the specification added that edge case on 2026-08-22 and
`US7` scenario 4 asserts it. Note the naming: the tasks are *marked* as orphaned by a
reclassification, and are not deleted — the same rule as the classification row, applied to the work
it produced.

---

## 7. `Routing` — including the one the spec calls *Transfer*

| Field | Notes |
|---|---|
| `id`, `defectId`, `classificationId` | |
| `destination` | `change-room` \| `requirement-room` — `repair` needs no routing row; it stays here |
| `offeredReason` | **NOT NULL** — `FR-DFR-072`, `UX-0034`. *"An unexplained transfer button is a reclassification nobody decided"* |
| `state` | `offered` \| `declined` \| `accepted` \| `refused` \| `returned` |
| `declinedAt`, `declinedReason` | `FR-DFR-073` — the offer **and** the decline are both retained |
| `refusalDetail` | `FR-DFR-074` — an item the Change Room refuses returns carrying the refusal |
| `carriedEvidenceRefs` | references, not copies — `FR-DFR-071`, `FR-DFR-076` |
| `targetRef` | the Change Request or requirement candidate created at the destination |

> **Terminology, stated once.** The specification's Key Entity **Transfer** is `Routing` where
> `destination = 'change-room'`. One table, because `FR-DFR-077` requires *every* routed outcome to
> have a destination and two tables would let one outcome quietly have none — which is the failure
> `R-035-5` and this table exist together to prevent. The word *transfer* is kept everywhere it
> refers to the Change Room move, including in the HTTP surface.

---

## 8. `EscapeRecord`

| Field | Notes |
|---|---|
| `id`, `defectId` | one-to-one |
| `origin` | denormalised from `DefectRecord` at intake |
| `escapePoint` | `requirements`, `specification`, `design`, `implementation`, `review`, `test`, `release`, `production` |
| `severity`, `affectedRequirementRef`, `affectedSpecificationRef` | |
| `resolutionEvidenceRef` | into `EPIC-032`, set at closure |
| `capturedAt` | **NOT NULL at intake** — `FR-DFR-082` |

**Written at intake, not at closure.** `FR-DFR-082` is explicit and the reason is in the
specification's own priority note for `US6`: the fields must exist from the first defect or the
first quarter of data is lost. `escapePoint` is nullable until known; the **row is not**.

---

## 9. Derived views

- **Origin distribution** — aggregate over `EscapeRecord.origin`, and it **carries a completeness
  note** rather than presenting itself as whole: `FR-DFR-083`, because telemetry-originated linkage
  is `BR-0163`, `U-19`, unowned. A distribution that silently omits a source it cannot see is a
  chart that lies by arithmetic.
- **Escape-point aggregation** — `SC-DFR-008`, answerable without opening individual records.

---

## 10. What this Epic deliberately does not model

| Not modelled | Whose it is |
|---|---|
| The task model, and any provenance field on `TaskRecord` | `EPIC-012`, `BR-0151`, `U-12` (`R-035-3`) |
| Test execution, runs, runners, schedules | nobody — `BR-0080` has no callable owner (`R-035-1`) |
| Evidence payloads, attestation envelopes, access rules | `EPIC-032`, `EPIC-024` (`R-035-7`) |
| Loop stages, transitions, gates | `EPIC-030` |
| Risk bands, decision records, the Inbox | `EPIC-031` |
| Baselines and requirement text | `EPIC-033` |
| Change Requests, impact views, baseline deltas | `EPIC-034` |
| Links between artifacts | `EPIC-011` `LinkWriterService` |
| Production telemetry linkage | `BR-0163`, `U-19`, unowned |

---

## Counts

**8 tables** — `DefectRecord`, `Classification`, `Reproduction`, `DefectTest`, `EvidenceCheck`,
`RepairLink`, `Routing`, `EscapeRecord`. **2 derived views** (§9). **0 stored payloads.**
