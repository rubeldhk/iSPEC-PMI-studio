# Contract: `packages/learning-contract`, ports, and cross-Epic amendments

**Epic**: `EPIC-048` · **Date**: 2026-10-09 · **Research**: [research.md](../research.md) `R-048-2`

A new member of the `packages/*-contract` family — `engine-`, `agent-`, `execution-`,
`execution-registry-`, `loop-` and `room-contract` on `main`; `decision-` (`EPIC-031`) and
`evidence-contract` (`EPIC-032`) on their branches. It
exists because two outsiders consume this Epic's shapes: `EPIC-038`'s assembly, and agents that
submit through the integration contract.

---

## 1. Vocabularies

```ts
export const CANDIDATE_STATES = ['proposed','pending-review','approved','rejected','expired','withdrawn'] as const;  // FR-LRN-004 — exactly six
export const TERMINAL_CANDIDATE_STATES = ['approved','rejected','expired','withdrawn'] as const;
export const CANDIDATE_KINDS = ['new','supersede','deprecate','widen-scope'] as const;
export const CONFIDENCE_LEVELS = ['low','medium','high'] as const;                       // FR-LRN-013 — stated, never computed
export type ClaimedScope =
  | { kind: 'project';   projectIds: readonly [string] }
  | { kind: 'workspace'; projectIds: readonly [] }
  | { kind: 'projects';  projectIds: readonly [string, string, ...string[]] };            // FR-LRN-014
export const VERSION_STATUSES = ['current','superseded','deprecated'] as const;
export const EVIDENCE_STATES = ['verified','integrity-failed','unresolvable','withheld','retired'] as const;
//                    'retired' is reserved: EPIC-032 has no retirement yet (R-048-8). Never produced.
export const APPROVER_KINDS = ['human','policy'] as const;                                 // no 'agent' member — FR-LRN-027
```

**No `unknown` member anywhere.** A state the code cannot name is refused, not defaulted
(`EPIC-031`'s `RISK_BANDS` reasoning).

## 2. The integration submission — `LearningSubmissionV1`

```ts
export interface LearningSubmissionV1 {
  readonly schemaVersion: 1;
  readonly executionId: string;               // required on the connector route
  readonly kind: CandidateKind;
  readonly targetVersionId?: string;
  readonly statement: string;
  readonly category: string;
  readonly subject: string;
  readonly evidence: readonly [EvidenceCitation, ...EvidenceCitation[]];   // ≥ 1, FR-LRN-012
  readonly confidence: { readonly level: ConfidenceLevel; readonly basis: string };
  readonly claimedScope: ClaimedScope;
  readonly proposedBand?: 'low' | 'medium' | 'high';                          // EPIC-031 RiskBand, re-exported
  readonly idempotencyKey: string;
  readonly correlationId: string;
}
export interface EvidenceCitation { readonly evidenceId: string; readonly digest: { readonly sha256: string } }
export function parseSubmission(candidate: unknown): ParseResult<LearningSubmissionV1>;   // never throws; lists every problem
```

`parseSubmission` collects **every** missing element (`FR-LRN-010`) and is the same function the
backend uses. A connector can validate before it sends.

## 3. Ports `EPIC-038` calls

```ts
/** Served for sourceType 'knowledge-entry' by EPIC-038's sources adapter and provenance service. */
export interface KnowledgeSourceReader {
  currentVersion(workspaceId: string, entryId: string):
    Promise<{ resolves: true; version: string } | { resolves: false; reason: string }>;
  read(workspaceId: string, entryId: string, versionId: string):
    Promise<{ text: string; projectId: null } | null>;           // scope is admission's job, not the index's
  status(workspaceId: string, entryId: string, versionId: string):
    Promise<{ status: 'current' } | { status: 'superseded'; supersededBy: string } | { status: 'deprecated'; reason: string }>;
}

/** Consulted by EPIC-038's assembly after judgeBoundary, before access.mayRead. */
export interface KnowledgeAdmission {
  admit(
    candidates: readonly { sourceId: string; sourceVersion: string }[],
    target: { workspaceId: string; projectId: string; executionId?: string },
  ): Promise<readonly AdmissionVerdict[]>;                         // same order; one batched read
}
export type AdmissionVerdict =
  | { admitted: true; inclusionNote: string }                      // "approved knowledge — entry E v3, scope workspace"
  | { admitted: false; reason: 'boundary' | 'classification' | 'stale' | 'permission'; detail: string };
```

`reason` is a subset of `EPIC-038`'s `EXCLUSION_REASONS` (`retrieval/outcome.types.ts:32`), so no
038 enum or CHECK changes. `detail` begins with the rule's name (`scope:`, `workspace:`,
`reuse-policy:`, `classification:`, `superseded:`, `deprecated:`, `archived:`, `memory-policy:`) —
the mapping table is `research.md` `R-048-11`.

**Absent `KnowledgeAdmission` ⇒ every knowledge-entry candidate is excluded** with `permission` and
detail `admission port unbound` — never admitted by default.

## 4. Event payload — `learning-candidate-recorded`

```ts
export const LEARNING_EVENT_KINDS = ['submitted','late-submitted','corroborated','refused','bound-exceeded','memory-policy-refused'] as const;
export interface LearningCandidateRecorded { kind: LearningEventKind; candidateId?: string; reason?: string }  // no statement text
```

Added to `EXECUTION_EVENT_TYPES` as one **content** event type (`R-048-17`).

## 5. Ports this Epic requires

| Port | Filled by | When absent |
|---|---|---|
| `Executions` | `EPIC-037` `ExecutionRegistryFacade` (`snapshot`, `history`, `appendEvent`) | **refuse** — an unverifiable source is no source (`FR-LRN-005`) |
| `SecretScreen` | `EPIC-037` `secretRuleMatching` (`R-048-18`) | **refuse** — an unscreened submission is not stored (`FR-LRN-018`) |
| `Principals` | `EPIC-028` principal registry | **refuse review** — an approver whose kind is unknown is not a human (`FR-LRN-027`) |
| `ReaderAccess` | `EPIC-024` through `EPIC-032`'s `AccessControlEvidencePolicy` | **withhold everything** — unreadable is the safe reading (`FR-LRN-016`) |
| `LearningPolicySource` | `EPIC-019` steering, subject `learning_policy` | **refuse submission** — no categories, no candidates (`FR-LRN-003`) |
| `Audit` | `EPIC-004` `AuditService.record` | **refuse** decisions, deprecations, reuse-policy reads that change state (`FR-LRN-062`) |
| `LearningDecisions` | `EPIC-031` `DecisionEngine.decide/approve/refuse/resolutionOf` | **candidate stays `proposed`** (`FR-LRN-030`); review route `503` |
| `EvidenceReads` | `EPIC-032` `EvidenceService.resolve` (`A-032-1`) | **refuse submission** (`503`) — evidence is mandatory and unresolvable is ineligible |
| `ApprovalAttestations` | `EPIC-032` `EvidenceService.contribute` | **flag `attestation-missing`**, retried; the approval stands (`R-048-19`) |
| `KnowledgeIndex` | `EPIC-038` `IndexService.reindex` | **not yet retrievable** with the reason (`FR-LRN-053`) |
| `ExpertProvenance` | `EPIC-047` (`A-047-2`) | **refuse** Expert-sourced submissions `503`; **exclude** knowledge from Expert packages |

Every absent port fails **closed**. None of them makes something approved, supplied or trusted.

---

## 6. Cross-Epic amendments

| Id | Owner | Change | Kind | Who makes it |
|---|---|---|---|---|
| **`A-031-1`** | `EPIC-031` | `DecisionEngine.refuse({workspaceId, decisionId, by, reason})` + `POST /decisions/:id/refuse` + Inbox Reject control; a human may refuse; the requesting automation may refuse **its own** request | **Hard prerequisite** — no rejection, withdrawal or expiry without it (`FR-LRN-021`, `-029`, `-030`) | `EPIC-031`, through its own Spec Kit flow |
| **`A-031-2`** | `EPIC-031` | Inbox detail-renderer registry keyed by `objectRef.type` | **Prerequisite** (frontend, additive) — reassigned to its owner by the Project Owner, 2026-10-09 | `EPIC-031`; this Epic only registers its renderer (T2385) |
| `A-031-3` | `EPIC-031` | `DecisionEngine.resolutionOf(workspaceId, decisionId)` export | Additive | This Epic's adapter phase |
| `A-032-1` | `EPIC-032` | `EvidenceService.resolve(workspaceId, ids[])` → `AttachedEvidence` + attested target | Additive read | This Epic's adapter phase; asserted in 032's suite |
| `A-032-2` | `EPIC-032` | `approval/v1` predicate body for a learning approval | Proposal (spec Assumption 4) | Proposed; this Epic writes the body it defines |
| **`A-038-1`** | `EPIC-038` | `FR-CTX-015` admits `knowledge-entry` to the approved source set | **Prerequisite** (spec text) | `EPIC-038` |
| `A-038-2` | `EPIC-038` | `APPROVED_SOURCE_TYPES` += `knowledge-entry`; sources-adapter and provenance branches; optional `admission` port in `AssemblyPorts` | Additive code | This Epic's adapter phase; asserted in 038's suites |
| **`A-047-1`** | `EPIC-047` | `FR-EXP-020` + `MEMORY_POLICIES` + validation message + replaced `CHECK` admit `governed-knowledge`; tests and frontend literal | **Hard prerequisite, no workaround** — the spec's deferral clause is **not used** | `EPIC-047` |
| `A-047-2` | `EPIC-047` | `ExpertProvenance.forExecution` exported from `ExpertsModule` | Additive | `EPIC-047`, with `A-047-1` |
| `A-037-1` | `EPIC-037` (`main`) | Named secret rules; `secretRuleMatching` | Additive | This Epic, early phase |
| `A-037-2` | `EPIC-037` (`main`) | `learning-candidate-recorded` event type | Additive | This Epic, after `EPIC-047` merges (count 30 → 31) |
| `A-019-1` | `EPIC-019` (`main`) | `SteeringSubject` += `learning_policy` | Additive enum value | This Epic's migration |

**Follow-ups raised, not prerequisites**: `EPIC-031` — put `learning.review.*` in `IRREDUCIBLY_HIGH`
(spec follow-up, `RK-5`); `EPIC-031` — `ActorRef` cannot express *agent* and its HTTP service
labels every principal human (`R-048-6`); `EPIC-032` — retirement (`RK-6`); `EPIC-038` —
`DEF-038-007` configuration write path, without which `knowledge-entry` has no source class
(`RK-2`).
