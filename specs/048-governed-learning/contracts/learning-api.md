# Contract: Governed Learning API

**Epic**: `EPIC-048` · **Date**: 2026-10-09 · **Model**: [data-model.md](../data-model.md) ·
**Package**: [learning-contract.md](./learning-contract.md)

Every capability is callable without the screen (`PP-007`); the two views use exactly these routes.
All routes are workspace-scoped through the authenticated workspace context. Identity fields
(`workspaceId`, `actor`, `requestedBy`, `reviewerId`, `approvedBy`) are **stripped from bodies** and
taken from the session — `EPIC-031`'s `strip()` convention (`decision.controller.ts:35-46`).

Errors use the platform classes: `400 ValidationFailedError` (lists **every** problem), `403
ForbiddenError`, `404 NotFoundError` (another workspace's resource is absent, not forbidden),
`409 ConflictError`, `503 GovernanceSeamUnboundError` (the body names the port).

**Permissions** *(stated 2026-10-09, analysis finding `U1`; spec Assumption 11)*. No session → `401`;
another workspace's resource → `404`. Any workspace member may `GET` a candidate, browse knowledge,
read history and submit as a person (any `kind`). Only the submitter may withdraw. Review is a human
session and never one of the candidate's AI source identities; the authority to decide is
`EPIC-031`'s. Agents submit only through the connector route, scope `learning.submit`. Route tests
`T2334` and `T2370` assert the `401` and `404` halves.

**There is no route that creates, edits or deletes knowledge.** An architecture test enumerates
the composed application's routes and fails if one appears (`SC-LRN-001`, `MP-1`).

---

## Submission (`BR-0114`, `BR-0115`)

### `POST /learning/candidates` — people, through the session

### `POST /projects/:projectId/learning/candidates` — agents and connectors

Behind `EPIC-041`'s `ConnectorAuthGuard` (`connector/connector-auth.guard.ts:57`), declared
`@ConnectorScope('learning.submit')` and registered with `registerConnectorScope`
(`connector/connector-scope.ts`) — the house pattern of `connector-reads.controller.ts:38-50`. The
credential is scoped to its project, so `projectId` comes from the path. Same body and outcomes; the
body is `learning-contract`'s versioned `LearningSubmissionV1` (`schemaVersion: 1`, `FR-LRN-061`).
The submitting principal is the credential's `TrustedPrincipalContext`, which records the agent
principal as `sourcePrincipalId`.

```text
{ executionId?,                 // required for agents; absent ⇒ person source (FR-LRN-006)
  projectId,
  kind: 'new' | 'supersede' | 'deprecate' | 'widen-scope',
  targetVersionId?,             // required unless kind = 'new'
  statement, category, subject,
  evidence: [{ evidenceId, digest: { sha256 } }],   // ≥ 1
  confidence: { level: 'low'|'medium'|'high', basis },
  claimedScope: { kind: 'project'|'workspace'|'projects', projectIds? },
  proposedBand?,
  idempotencyKey, correlationId }
```

| Outcome | Status | Body / effect |
|---|---|---|
| Recorded | `201` | `{candidateId, state, decisionId?, late, provisional, eligibleForAutomatic, reasonIfNot}`; event `submitted` (or `late-submitted`) on the execution |
| Attached as corroboration | `200` | `{candidateId, corroborationId}`; event `corroborated` (`FR-LRN-017`) |
| Retried with the same `idempotencyKey` | `200` | The original response; nothing new written (`FR-LRN-061`) |
| Missing source, evidence, confidence or scope | `400` | Names **every** missing element (`FR-LRN-010`); event `refused` when an execution is named |
| Unknown category, or no learning policy | `400` | Names the category and policy version (`FR-LRN-003`) |
| Secret detected | `400` | Names the rule and the field, never the value (`FR-LRN-018`); **nothing stored** |
| Execution not registered | `400` | `FR-LRN-005` |
| After the grace period | `400` | Names the terminal event and the grace period |
| Over the per-execution bound | `400` | Event `bound-exceeded` (`FR-LRN-007`) |
| Expert contract version declares `none` | `400` | Event `memory-policy-refused` (`FR-LRN-055`) |
| Scope wider than claimed by kind (`project` with other ids) | `400` | |
| `widen-scope` not wider than the current version | `400` | |
| Evidence not resolvable at all (no such id in this workspace) | `400` | Per citation; withheld is **not** a refusal |
| `EvidenceReads`, `ExpertProvenance` (for an Expert execution) or `Executions` unbound | `503` | Names the port |

**After recording**, the decision is requested (`R-048-12`) unless the execution is provisional.
A refusal by policy or an unreachable decision path is **not** a submission error: the candidate is
`201`, `state: 'proposed'`, with the decision's explanation or the outage named (`FR-LRN-030`).

### `POST /learning/candidates/:id/withdraw`

Submitter only (person, or the connector acting for the source execution). `200` → `withdrawn`;
closes the `EPIC-031` decision through `A-031-1`. `409` once terminal.

---

## Review (`BR-0116`)

### `GET /learning/candidates/:id`

Everything `FR-LRN-071` lists, in one response. This is what the Inbox detail renderer shows:

```text
{ candidate: {…core, state, transitions[]},
  evidence: [{ state: 'verified'|'integrity-failed'|'unresolvable', evidenceId, digest,
               predicateType, attestedArtifact } | { state: 'withheld' }],
  withheldEvidenceCount,
  corroborations: [...],
  source: { executionId?, command?, expert?: {key, contractVersion}, person? },
  conflictsWith?: { entryId, version, statement },
  supersedes?: { entryId, version, statement, scope, classification },   // side by side, FR-LRN-072
  decision?: { decisionId, outcome, effectiveClass, explanation },        // read from EPIC-031
  eligibility: { automatic: boolean, failedConditions: string[] } }
```

`404` for another workspace. Withheld evidence carries no id or digest (`FR-LRN-016`).

### `POST /learning/candidates/:id/review`

Human session only. **Never** reachable through the connector guard.

```text
{ decision: 'approve' | 'reject',
  statement?, scope?, classification?,   // approve only; scope ⊆ claimed (FR-LRN-028)
  reason? }                              // required for reject (FR-LRN-029)
```

| Outcome | Status | Effect |
|---|---|---|
| Approved | `200` | Terms recorded → `DecisionEngine.approve` → entry version materialised → attestation → reindex. Body: `{entryId, version, retrievability}` |
| Rejected | `200` | `A-031-1` refuse with reason → `rejected` transition |
| Reviewer is a non-human principal, or one of the candidate's AI source identities | `403` | Audited; the decision stays pending (`FR-LRN-027`, `R-048-6`) |
| Reviewer is the human submitter and policy forbids self-approval | `403` | `EPIC-031`'s refusal and explanation passed through (`FR-DPE-015`) |
| Scope wider than claimed | `400` | |
| Candidate not `pending-review` | `409` | |
| `LearningDecisions` unbound | `503` | |

---

## Knowledge (`BR-0117`, `BR-0118`)

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/learning/knowledge?projectId=&scope=&category=&status=&after=` | Browse, 50 per page (`FR-LRN-073`). Each row: entry, current version, status, scope, classification, retrievability, open flags |
| `GET` | `/learning/knowledge/:entryId` | One entry, current version, provenance (`SC-LRN-006`) |
| `GET` | `/learning/knowledge/:entryId/history` | Every version in order, the candidate and decision behind each, every status event and flag (`FR-LRN-035`) |

`after` is the previous page's `nextCursor` *(renamed from `cursor` on 2026-10-10: `EPIC-028`'s architecture test `T560` reads the bare word as the name of an AI provider and forbids it in `backend/src`)*.

Supersession, deprecation and widening are **submissions** (`kind` above), not edits — there is no
`PUT` or `PATCH` here (`FR-LRN-031`, `FR-LRN-042`).

---

## What `EPIC-038` calls (in-process, not HTTP)

`KnowledgeSourceReader` and `KnowledgeAdmission` from `learning-contract`. Outcomes are recorded by
`EPIC-038` as package items and exclusions; this Epic writes nothing during assembly
(`FR-LRN-050`). See [learning-contract.md](./learning-contract.md) §3.

---

## Jobs (real entry points for Tier 1)

Registered on the existing `jobs` module; each is a job handler driven by tests through the job
runner, not by calling the service:

| Job | Interval | Does |
|---|---|---|
| `learning.resolve-decisions` | 30 s | `resolutionOf` for `pending-review` candidates → materialise or reject (`R-048-7`) |
| `learning.request-pending` | 60 s | Requests decisions for reconciled provisional executions and after decision-path outages |
| `learning.expire` | hourly | Past the review window → `A-031-1` refuse with `expired` → `expired` (`FR-LRN-030`) |
| `learning.flags` | hourly | Evidence state and source-execution invalidity → `knowledge_flags` (`FR-LRN-037`) |
| `learning.retrievability` | 10 min | Retries not-yet-retrievable versions (`FR-LRN-053`) |
