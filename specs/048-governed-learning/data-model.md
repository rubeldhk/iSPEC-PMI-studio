# Data Model: Governed Learning

**Epic**: `EPIC-048` · **Date**: 2026-10-09 · **Research**: [research.md](./research.md)

## 0. The one structural idea

```text
   UNTRUSTED                                   TRUSTED
   ─────────                                   ───────
   learning_candidates ──┐                     knowledge_entries
     + evidence          │  EPIC-031 decision    └─ knowledge_entry_versions   (insert-only,
     + corroborations    ├─────────────────────▶      ▲                         trigger-checked)
     + transitions       │   accepted by            │ status by append:
   learning_review_terms ┘   approver guard          knowledge_version_status_events
                             (R-048-6)               knowledge_flags · knowledge_retrievability
```

Nothing on the left is ever read by context. Nothing on the right is written except by
`materialiser.ts`, and the database checks that a resolved decision stands behind every row
(`R-048-4`). Every table is workspace-scoped, carries `workspaceId` with an FK to `workspaces`
`ON DELETE RESTRICT` and an index, and is **append-only** through the shared `reject_mutation()`
function (`migrations/20260814000000_init/migration.sql:158-162`) — attached, never redefined
(`EPIC-032`'s convention). CHECKs that could meet `NULL` are wrapped in `COALESCE(..., false)`.

**Ten tables. No mutable table. One enum value added to `EPIC-019`. One CHECK added to an
`EPIC-038` table.** Learning policy is a steering document, not a table (`R-048-3`).

---

## 1. `learning_candidates` — `LearningCandidate` (immutable core)

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | |
| `workspaceId` | text | `FR-LRN-008`; every query scoped by it |
| `projectId` | text | The source project — FK `projects.id` |
| `kind` | `new` \| `supersede` \| `deprecate` \| `widen-scope` | Only `new` may take the automatic path (`R-048-12`) |
| `targetVersionId?` | text | Required for `supersede`, `deprecate`, `widen-scope` — FK `knowledge_entry_versions.id`, CHECKed |
| `statement` | text | Required, non-empty; for `deprecate`, the reason |
| `category` | text | A key in the learning policy at `policyVersion` (`FR-LRN-003`) |
| `subject` | text | Required |
| `subjectKey` | text | `category:normalise(subject)` (`R-048-15`); indexed with `workspaceId` |
| `sourceKind` | `execution` \| `person` | `FR-LRN-005`, `FR-LRN-006` |
| `executionId?` | text | Required when `sourceKind = execution`; registered with `EPIC-037` |
| `sourcePrincipalId` | text | The agent principal of the execution, or the person's user id |
| `expertId?`, `expertContractVersionId?`, `expertContractVersion?` | text, text, int | Set together, when the execution is an Expert session (`FR-LRN-011`) |
| `confidenceLevel` | `low` \| `medium` \| `high` | As stated; never raised (`FR-LRN-013`) |
| `confidenceBasis` | text | Required |
| `claimedScope` | jsonb `{kind: 'project'\|'workspace'\|'projects', projectIds: string[]}` | `FR-LRN-014`; `project` ⇒ exactly `[projectId]`; `projects` ⇒ ≥ 2, all in the workspace |
| `proposedBand?` | `low` \| `medium` \| `high` | The submitter's proposal only (`FR-LRN-023`) |
| `late` | bool | Submitted after the execution's terminal event, within grace (`FR-LRN-005`) |
| `provisional` | bool | The execution was not `governed` at submission (`FR-LRN-063`) |
| `policyVersion` | int | The learning-policy steering version it was validated under |
| `objectDigest` | text | sha256 of the canonical core — the `objectVersion` sent to `EPIC-031` |
| `idempotencyKey`, `correlationId` | text | Unique `(workspaceId, idempotencyKey)` (`FR-LRN-061`) |
| `submittedAt` | timestamptz | |

Trigger: `reject_mutation()` on `UPDATE` and `DELETE` (`FR-LRN-029` — never deleted).

## 2. `learning_candidate_evidence` — `EvidenceCitation`

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | |
| `workspaceId`, `candidateId` | | FK `learning_candidates.id` |
| `corroborationId?` | text | Set when the citation came with a corroboration |
| `evidenceId` | text | `EPIC-032` `evidence_items.id` — **no FK** (another Epic's table; resolution is read, `R-048-8`) |
| `digestAlgorithm` | `sha256` | |
| `digest` | text | As cited; compared to the stored digest on every read |

A candidate has ≥ 1 citation (`FR-LRN-012`) — enforced by the service in the same transaction and by
a deferred constraint trigger checking at commit. **No payload, predicate or content column.**
State (`verified`, `integrity-failed`, `unresolvable`, `withheld`) is **derived on read**, never
stored.

## 3. `learning_corroborations` — `Corroboration`

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | |
| `workspaceId`, `candidateId` | | The open candidate it attaches to (`FR-LRN-017`) |
| `sourceKind`, `executionId?`, `sourcePrincipalId`, `expertId?`, `expertContractVersionId?` | | As on the candidate |
| `statement` | text | As submitted — shown to the reviewer, never merged |
| `confidenceLevel`, `confidenceBasis` | | |
| `late` | bool | |
| `idempotencyKey`, `correlationId`, `submittedAt` | | Same uniqueness as candidates |

Corroboration never changes the candidate or its eligibility (spec Edge Case).

## 4. `learning_candidate_transitions` — the lifecycle

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | |
| `workspaceId`, `candidateId` | | |
| `seq` | int ≥ 1 | Unique `(candidateId, seq)`; next = max + 1 under the candidate's row lock |
| `state` | `proposed` \| `pending-review` \| `approved` \| `rejected` \| `expired` \| `withdrawn` | `FR-LRN-004` — CHECKed, exactly six |
| `reason?` | text | e.g. `decision-refused-by-policy`, `decision-not-accepted`, `policy-auto-executed-review`, `decision-path-unavailable` |
| `decisionId?` | text | The `EPIC-031` decision requested (on `pending-review`) or resolving (on terminal states) |
| `actorKind` | `human` \| `policy` \| `platform` | Who caused the move; never an AI on `approved` (CHECK) |
| `actorId` | text | |
| `at` | timestamptz | |

CHECKs: `state = 'approved'` ⇒ `decisionId IS NOT NULL AND actorKind IN ('human','policy')`;
`state = 'rejected'` ⇒ `reason` non-empty and `actorKind = 'human'` (`FR-LRN-029`).

Trigger `learning_transitions_guard` (`BEFORE INSERT`) refuses:
- any row after a terminal state;
- `state = 'approved'` unless a `knowledge_entry_versions` row for the candidate already exists
  **in the same transaction** — the version is inserted first, then the transition, so an
  `approved` candidate without its version cannot be written (plan migration item 2.4; analysis
  finding `I5`).

**Current state = row with max `seq`**, served by an index on `(candidateId, seq DESC)` and a view
`learning_candidate_current`.

**A resolution the approver guard does not accept** (`R-048-6`, amended for analysis finding `I1`)
appends `proposed` with reason `decision-not-accepted` or `policy-auto-executed-review`, the
refused `decisionId`, `actorKind = 'platform'`. It does **not** stay in `pending-review`: its
`EPIC-031` decision is resolved, so nothing could ever move it again. `learning.request-pending`
requests a new decision for it, at most three decision attempts per candidate (counted as
`pending-review` rows). After the third, it stays `proposed` and the review window expires it.

## 5. `learning_review_terms` — what the reviewer approved

Written by the review route **before** it calls `DecisionEngine.approve`, so a crash between the two
loses nothing.

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | |
| `workspaceId`, `candidateId`, `decisionId` | | Unique `(candidateId, decisionId)` |
| `approvedStatement` | text | May differ from the candidate's (`FR-LRN-028`) |
| `approvedScope` | jsonb | Must be ⊆ `claimedScope` — **never wider** (`FR-LRN-028`); checked by the service and by a trigger comparing to the candidate |
| `classification` | text | From the learning policy's category default unless the reviewer sets one; `undetermined` allowed (`FR-LRN-044`) |
| `reviewerId` | text | The human who will approve |
| `at` | timestamptz | |

If a decision is approved through `EPIC-031`'s generic Inbox route instead, no terms exist and the
version is materialised with the proposed statement and claimed scope. Classification then defaults
to the category's, or `undetermined`.

## 6. `knowledge_entries` — `KnowledgeEntry`

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | Stable identity across versions |
| `workspaceId` | text | Never supplied outside it (`FR-LRN-043`) |
| `category`, `subjectKey` | text | From the first version's candidate |
| `originProjectId` | text | `FR-LRN-044`: an undetermined classification stays here |
| `createdAt` | timestamptz | |

Immutable (`reject_mutation()`).

## 7. `knowledge_entry_versions` — `KnowledgeEntryVersion` (the trusted record)

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | |
| `workspaceId`, `entryId` | | FK `knowledge_entries.id` |
| `version` | int ≥ 1 | Unique `(entryId, version)` |
| `statement` | text | As approved |
| `proposedStatement` | text | As the candidate proposed (`FR-LRN-028`) |
| `scope` | jsonb | As approved (`FR-LRN-038`) |
| `proposedScope` | jsonb | As claimed |
| `classification` | text | `FR-LRN-038`; `undetermined` is a value, not a `NULL` |
| `candidateId` | text | **Unique**, FK `learning_candidates.id`, `NOT NULL` (`SC-LRN-001`) |
| `decisionId` | text | FK `policy_decisions.id`, `NOT NULL` — the decision requested |
| `resolvingDecisionId?` | text | FK `policy_decisions.id` — the human approval row, when one resolved it |
| `approvedByKind` | `human` \| `policy` | CHECKed; there is no `agent` value to write (`FR-LRN-027`) |
| `approvedBy` | text | The human's user id, or `policy:v<N>` |
| `approvedAt` | timestamptz | |
| `attestationId?` | text | `EPIC-032` evidence id of the `approval/v1` attestation (`R-048-19`) |

**Insert trigger `knowledge_versions_require_decision`** (`R-048-4`, `R-048-6`) refuses the row
unless all of these hold:

- the decision row exists in the same workspace with `targetType = 'learning-candidate'` and
  `targetId = candidateId`;
- `COALESCE(resolvingDecisionId, decisionId)` has outcome `approved` or `auto-executed`, and is
  `approved` with `actorKind = 'human'` whenever `approvedByKind = 'human'`;
- `approvedBy` is not the candidate's `sourcePrincipalId` or `expertId`.

Then `reject_mutation()` on `UPDATE`/`DELETE` (`FR-LRN-031`, `FR-LRN-039`). The `decisionId` FK makes
this table depend on `EPIC-031`'s migration — one more reason for the merge order.

## 8. `knowledge_version_status_events` — current, superseded, deprecated

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | |
| `workspaceId`, `versionId` | | |
| `status` | `current` \| `superseded` \| `deprecated` | |
| `successorVersionId?` | text | Required when `superseded` (`FR-LRN-032`) |
| `reason?`, `actorId`, `decisionId?` | | Required when `deprecated` (`FR-LRN-033`) |
| `at` | timestamptz | |

The materialiser writes `current` for a new version and, for a supersession, `superseded` on the
predecessor in the **same transaction** — so exactly one version per entry is current. Current
status = latest row per version (view `knowledge_current_versions`). Append-only.

## 9. `knowledge_flags` — review flags (`FR-LRN-037`)

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | |
| `workspaceId`, `versionId?`, `candidateId?` | | Exactly one set (CHECK) |
| `kind` | `evidence-changed` \| `source-invalid` \| `attestation-missing` \| `policy-auto-executed-review` \| `decision-not-accepted` | |
| `detail` | text | |
| `raisedAt` | timestamptz | |
| `clearsFlagId?` | text | A later row clears an earlier one; nothing is updated |

A flag **never** changes status — deprecation is a human decision (`FR-LRN-037`).

## 10. `knowledge_retrievability` — reindex outcomes (`FR-LRN-051`, `FR-LRN-053`)

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | |
| `workspaceId`, `versionId` | | |
| `outcome` | `retrievable` \| `not-yet-retrievable` | |
| `reason?` | text | Required when `not-yet-retrievable` — the `503` port, or the `400` from `EPIC-038` |
| `attemptedAt` | timestamptz | |

Latest row per version is what the browser shows. No row yet ⇒ shown as *not yet retrievable —
indexing not attempted*, never as retrievable.

---

## Changes outside this Epic's tables

| Change | Where | Why |
|---|---|---|
| `SteeringSubject` += `learning_policy` | `EPIC-019` enum, `ALTER TYPE … ADD VALUE` | `R-048-3` |
| `CHECK ("sourceType" <> 'knowledge-entry') NOT VALID` | `EPIC-038` `context_reusable_authorisations` | `FR-LRN-043`, `DEFER-048-01` — nothing may register knowledge as cross-workspace reusable; removed only by the Epic that discharges the deferral |
| `learning-candidate-recorded` event type | `packages/execution-registry-contract/src/events.ts` | `R-048-17` |
| Named secret rules | `backend/src/modules/executions/sanitisation.ts` | `R-048-18` |

## Derived, not stored

- **Evidence state** per citation and reader (`R-048-8`, `R-048-9`).
- **Eligibility** for the automatic path (`R-048-12`) — computed at decision-request time, and its
  inputs recorded in the transition `reason` when it is false, so *"why did this wait for a human?"*
  is answerable.
- **Decision content** (explanation, band, authority) — read from `EPIC-031` (`FR-LRN-021`, `FR-LRN-024`).
- **Supply verdict** for a package — `KnowledgeAdmission`, recorded by `EPIC-038` as items and
  exclusions (`R-048-11`).

## State transitions — knowledge entry version

```text
 (materialised) ──▶ current ──approved supersede──▶ superseded (names successor)
                       └─────approved deprecate───▶ deprecated (reason, actor, instant)
 Scope widening: a new version with the wider scope; the old version → superseded.
```

Every arrow is an `EPIC-031` decision reviewed by a human (`FR-LRN-034`).
