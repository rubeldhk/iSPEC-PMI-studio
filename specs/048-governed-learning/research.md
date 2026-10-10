# Research: Governed Learning

**Epic**: `EPIC-048` · **Date**: 2026-10-09 · **Plan**: [plan.md](./plan.md)

Twenty-two decisions. **No new external library is introduced** — the Epic is built on NestJS 10,
Prisma 5.22 and Vitest 2.1, already in the repository — so Context7 was not consulted: no decision
below depends on the current shape of an external API. Every decision is grounded in the repository
instead, with `file:line` references taken on 2026-10-09 from this worktree (`main` at `e47e96e`)
and from the four sibling worktrees:

| Epic | Worktree | Read at |
|---|---|---|
| `EPIC-031` Decision & Policy Engine | `.claude/worktrees/epic-031-decision-policy-engine` | `afb918c` |
| `EPIC-032` Evidence Store & Contracts | `.claude/worktrees/epic-032-evidence-store-contracts` | `9feac09` |
| `EPIC-038` Engineering Context | `.claude/worktrees/epic-038-engineering-context` | `ab7301c` |
| `EPIC-047` Engineering Experts | `.claude/worktrees/epic-047-engineering-experts` | `22d51db` + **uncommitted working tree** |

All four are **unmerged**. `R-048-20` decides how this Epic is built without waiting on them, and
`R-048-21` names the merge order it needs. Paths below are relative to the named worktree.

**Code, not documents, was read.** Where a sibling's design document and its code disagree, the code
is cited and the disagreement noted — e.g. `EPIC-031`'s `contracts/decision-contract.md` §3 omits
`projectId`, `objectVersion`, `requestedBy` and `triggeredBy`, all of which
`packages/decision-contract/src/types.ts:47-61` carries.

---

## Findings that shape the plan (verification of the preliminary findings)

| # | Preliminary finding | Verified against code | Recorded as |
|---|---|---|---|
| 1 | `EPIC-038` has no `scope` exclusion reason | **Confirmed** — `EXCLUSION_REASONS = ['permission','classification','budget','boundary','stale']` (`retrieval/outcome.types.ts:32`), CHECKed in `migrations/20260831190000_epic038_context/migration.sql:139-141` | **Decision** `R-048-11` — scope refusals map to `boundary` with the scope named in `detail`; **spec inconsistency flagged** (`FR-LRN-045`) |
| 2 | `EPIC-031` has no AI actor kind | **Confirmed, and worse** — `ActorRef.kind` is `'human' \| 'automation'` (`packages/decision-contract/src/authority.ts:11`), and the HTTP service labels **every** session principal `human` (`decision/decision.service.ts:57-59`) | **Decision** `R-048-6` — `FR-LRN-027` is enforced inside this Epic in three layers, one mutation-proven (`MP-3`) |
| 3 | `DecisionRequest` may lack `objectVersion` | **Refuted** — present, required (`types.ts:54`); only the 031 contract *document* is stale | Noted above; no action |
| 4 | `EmbeddingPort` is unowned; reindex `503`s | **Confirmed** — token `EMBEDDING_PORT` (`context.tokens.ts:86`) provided nowhere; `IndexService` constructed with `null` (`context.module.ts:118-132`); `embedChecked` throws `GovernanceSeamUnboundError` (`retrieval/embedding.port.ts:43-77`) | **Risk** `RK-2` + **Decision** `R-048-13` — *not yet retrievable* is the normal state until a provider exists |
| 5 | Knowledge fits `PackageItem` by `sourceType` | **Confirmed with four gaps** — the approved set is a hard-coded `Set` (`retrieval/index.service.ts:46-52`), `sources.adapter.ts` serves no unknown type (`:132-135`), status is `current\|superseded\|undetermined` only (`package.types.ts:33-39`), and there is no registration mechanism | **Decision** `R-048-11` — one additive seam in `EPIC-038`, done by this Epic's adapter phase; **spec amendment** to `FR-CTX-015` required (`A-038-1`) |
| 6 | `DEF-047-001` — Expert runs cannot be registered | **Confirmed** — `ExpertExecutions` is bound refusing (`specs/047-engineering-experts/defects/DEF-047-001-no-expert-execution-identity.md`) | **Risk** `RK-3` — until it closes, no Expert-sourced candidate can exist in the composed application |
| 7 | Exit criteria allow deferring `FR-LRN-055/056` | **Confirmed** — spec Epic Exit Criteria, second-last item | **Decision** `R-048-10` — **the deferral clause is not used**; the `FR-EXP-020` amendment is a hard prerequisite with no workaround |
| 8 | Merge order `032 → 031 → 038 → 047 → 048` | **Confirmed** — `EPIC-047` consumes 031, 032 and 038 (`R-047-13`); 031, 032 and 038 do not consume each other in code (031's `EvidenceContractSource` is unbound, `decision.module.ts:210-211`) | **Decision** `R-048-21` |

Four further gaps were found that the preliminary list did not have. Each is a decision below:

- **`EPIC-031` has no reject path.** Routes are `POST /decisions`, `/decisions/:id/approve`,
  `/decisions/:id/exceptions` and reads (`decision/decision.controller.ts:53-101`); the engine has
  `decide`, `approve`, `recordException` only (`evaluator.ts:94,145,209`). A pending decision can be
  approved and never refused. `FR-LRN-029` cannot be met without a second rejection record, which
  `FR-LRN-021` forbids → **hard prerequisite `A-031-1`** (`R-048-5`).
- **`EPIC-031` exposes no resolution read and no callback.** `resolutionOf` exists
  (`decision.repository.ts:105`) but the module exports only `DecisionEngine` and `DecisionService`
  (`decision.module.ts:239-284`) → additive export `A-031-3` (`R-048-7`).
- **The Decision Inbox renders every item identically** (`frontend/src/pages/DecisionInbox.tsx:96-124`)
  — no detail panel, no renderer per target type → additive extension point `A-031-2` (`R-048-16`).
- **`EPIC-032` has no read by evidence id, no retirement, no per-item withholding, and no
  `approval/v1` predicate body** → additive read `A-032-1`, predicate body proposed `A-032-2`
  (`R-048-8`, `R-048-9`).

---

## R-048-1 — A new `learning` module; candidates and knowledge are different tables

- **Decision**: `backend/src/modules/learning/` owns the Learning Candidate, the Knowledge Entry and
  their lifecycle — nothing else. Candidates and knowledge entry versions live in **separate tables**;
  no row is ever "promoted" by changing a state column. A knowledge entry version is a new row,
  written by exactly one function (`materialiser.ts`, `R-048-4`).
- **Rationale**: `FR-LRN-001`/`FR-LRN-002` are easiest to prove when the untrusted thing and the
  trusted thing cannot share a query. A `status = 'approved'` column on the candidate would make every
  context read one `WHERE` clause away from serving candidates as knowledge.
- **Alternatives considered**: one table with a state machine (rejected — above); storing knowledge
  as a steering document (rejected — steering is authoritative content, and `FR-LRN-052` requires
  knowledge to be distinguishable from it).
- **Docs consulted**: none needed.

## R-048-2 — A contract package, `packages/learning-contract`

- **Decision**: a new member of the `packages/*-contract` family. It holds: the candidate states,
  scope and confidence vocabularies, the **versioned submission schema** agents and connectors use
  (`FR-LRN-061`), the `learning-candidate-recorded` event payload kinds, and the two ports `EPIC-038`
  calls — `KnowledgeSourceReader` and `KnowledgeAdmission` (`R-048-11`).
- **Rationale**: the house pattern publishes a package when **another Epic's code or an external
  connector** consumes the shape: `decision-contract` (`EPIC-031`), `evidence-contract`
  (`EPIC-032`), `execution-registry-contract` (`EPIC-037`). Both conditions hold here —
  `EPIC-038`'s assembly calls this Epic's ports, and agents submit through an integration contract
  (Constitution XII rule 7). `EPIC-038` and `EPIC-047` published none because nothing outside them
  consumes their types.
- **Alternatives considered**: types in the backend module only (rejected — `EPIC-038` would import
  from `modules/learning`, inverting the dependency its architecture test `context-not-a-room.spec.ts`
  guards against).

## R-048-3 — Learning policy is a steering document

- **Decision**: categories (`FR-LRN-003`), their explicit low-risk flag (`FR-LRN-022`, `FR-LRN-026`),
  the reuse policy (`FR-LRN-040`, `FR-LRN-047`) and the three defaults (grace 24 h, review window
  30 days, bound 20 per execution — spec Assumption 8) are one **`EPIC-019` steering document** with a
  new subject `learning_policy`. The `SteeringSubject` enum (`schema.prisma:797-809`) gains one value
  in this Epic's migration. Versioning, actor and instant come from `SteeringService.edit`
  (`steering.service.ts:71`), which appends a version — `FR-LRN-047` holds by construction.
- **Content shape** (validated on read; malformed → refuse, never permissive):

  ```text
  { categories: [{ key, description, lowRisk: boolean, defaultClassification? }],
    reuse: { workspaceScopeAllowed: boolean, namedSetsAllowed: boolean,
             permittedClassifications: { default: string[], byProject?: { [projectId]: string[] } } },
    gracePeriodHours: 24, reviewWindowDays: 30, maxCandidatesPerExecution: 20 }
  ```
- **No document → no categories → every submission refused** naming the missing policy
  (`FR-LRN-003`). `lowRisk` defaults to `false` and is never inferred (`FR-LRN-026`).
- **Rationale**: `EPIC-031` puts classification rules in steering for the same reasons
  (`specs/031-decision-policy-engine/data-model.md` §1); the spec's Key Entities say categories are
  "declared through steering".
- **Alternatives considered**: a `learning_policies` table (rejected — a second versioning
  implementation beside `EPIC-019`'s).

## R-048-4 — One write path into knowledge, fenced three times

- **Decision**: `materialiser.ts` is the only code that inserts a `knowledge_entry_versions` row. It
  runs only on a **resolved `EPIC-031` decision accepted by `R-048-6`**, in one transaction with the
  candidate's `approved` transition. Three fences:
  1. **Module** — the store's insert method is not on the store interface other services receive;
     an architecture test asserts only `materialiser.ts` references it, and that no route under
     `/learning` (or anywhere) maps to a knowledge write (`SC-LRN-001`).
  2. **Database** — a `BEFORE INSERT` trigger on `knowledge_entry_versions` refuses a row unless the
     cited `policy_decisions` row exists in the same workspace, targets this candidate
     (`targetType = 'learning-candidate'`, `targetId = candidateId`), and has outcome `approved` or
     `auto-executed`. A foreign key from `decisionId` to `policy_decisions.id` keeps it honest
     (`EPIC-031`'s table is append-only by `reject_mutation()`,
     `migrations/20261008120000_epic031_decision_engine/migration.sql:130-137`, so the check cannot be
     invalidated afterwards).
  3. **Mutation proof** `MP-1` (`plan.md`).
- **Rationale**: `SC-LRN-001` is mutation-tested *by adding a direct write path*. A fence the
  mutation can bypass by adding a new caller must sit below the caller — hence the trigger.

## R-048-5 — The decision is `EPIC-031`'s, including rejection: hard prerequisite `A-031-1`

- **Decision**: every candidate decision is a `DecisionRequest`
  (`packages/decision-contract/src/types.ts:47-61`) with
  `target = {type: 'learning-candidate', id: candidateId}`,
  `objectVersion = sha256(canonical candidate core)`, `requiredGates: []`, `projectId` = the source
  project, and `proposedClass` = the submitter's proposed band when given (`FR-LRN-023` — kept
  separate by 031 itself, `FR-DPE-003`).
- **Rejection, withdrawal and expiry need a refusal of a *pending* decision**, which `EPIC-031` does
  not have (see Findings). **`A-031-1`**: `DecisionEngine.refuse({workspaceId, decisionId, by:
  ActorRef, reason})` and `POST /decisions/:id/refuse`, appending a resolving `refused` row with
  `resolvesDecisionId` exactly as `approve` does (`evaluator.ts:187-198`). A human reviewer may
  refuse; the requesting automation may refuse **only its own request** (withdrawal, expiry). The
  Inbox gains a Reject control. This is `EPIC-031`'s amendment, made on its branch or as its first
  follow-up — **not** by this Epic, and **no workaround**: a rejection recorded only in this Epic
  would be the second approval record `FR-LRN-021` forbids.
- **Rationale**: `AuthorityDecision` already includes `'refused'` (`authority.ts:15`); the gap is a
  missing path, not a missing concept.

## R-048-6 — An AI actor never approves: enforced here, whatever `EPIC-031` models

- **Finding**: `EPIC-031` cannot tell an AI from a person. `ActorRef.kind` is `human | automation`,
  its HTTP service sets `kind: 'human'` for **every** session principal (`decision.service.ts:57-59`),
  and `approve` checks only that kind (`evaluator.ts:168-169`). An agent able to reach
  `POST /decisions/:id/approve` through any session would be recorded as a human approver.
  `EPIC-028`'s principal model does distinguish them — `PRINCIPAL_KINDS = ['human','agent','service',
  'connector']` (`packages/agent-contract/src/principal.ts:46`).
- **Decision — three layers, each sufficient on its own for the case it covers**:
  1. **Review route** (`POST /learning/candidates/:id/review`): served only behind the human session
     guard, never the connector guard; refuses when the session's `userId` resolves to a
     `NonHumanPrincipal` (`EPIC-028` principal registry), or is one of the candidate's **AI source
     identities** — the agent principal of its source execution, the Expert, and every corroborating
     agent. Refused attempts are audited and leave the decision pending.
  2. **Approver guard in the materialiser** (`approver.guard.ts`) — the load-bearing layer, because
     approval can also happen in `EPIC-031`'s generic Inbox route this Epic does not own. A
     resolution is **accepted** only if either:
     - outcome `approved`, `actorKind = 'human'`, and `decidedBy` resolves to a `User` (not a
       `NonHumanPrincipal`) and is not one of the candidate's AI source identities; or
     - outcome `auto-executed`, on a request this Epic made through the **automatic path**
       (`R-048-12`), whose actor is this Epic's policy automation — policy, not an AI.

     Anything else is **not accepted**: no knowledge is written, the candidate transitions to
     `pending review` with reason `decision-not-accepted`, and an audit record names why. The
     decision itself is `EPIC-031`'s and is left untouched.
  3. **Database** — `knowledge_entry_versions` CHECKs `approvedByKind IN ('human','policy')`, and the
     insert trigger (`R-048-4`) refuses `approvedBy` equal to the candidate's
     `sourcePrincipalId` or `expertId`.
- **Separation of duties for people** (`FR-LRN-027` second sentence) is `EPIC-031`'s
  `selfApprovalAllowed` (`policy.loader.ts:34`; `evaluator.ts:172-181`) — consumed, not re-implemented.
- **Mutation proof** `MP-3`: remove layer 2's principal-kind check; the test approving through
  `DecisionEngine.approve` with `{kind: 'human', id: <agent principal>}` — exactly what 031's HTTP
  service would record — must fail.
- **Recorded for `EPIC-031`** (not a prerequisite): `ActorRef` cannot express *agent*; its own
  approve path is open to the same mislabel. Raised as a follow-up, not fixed here.

## R-048-7 — No callback: resolution is read, and a sweep closes the gap

- **Decision**: `EPIC-031` emits nothing on resolution (no emitter, subscription or outbox in
  `backend/src/modules/decision/`). This Epic learns a resolution two ways:
  - **Synchronously** when the reviewer decides through this Epic's review route, which calls
    `DecisionEngine.approve` / `refuse` in-process and materialises in the same request.
  - **By sweep** for decisions resolved elsewhere (031's own Inbox route): a job on the existing
    `jobs` module every **30 s** reads `resolutionOf(workspaceId, decisionId)` for candidates in
    `pending review`.
- **`A-031-3`** (additive, done by this Epic's adapter phase, asserted in 031's suite): export a
  read — `DecisionEngine.resolutionOf(workspaceId, decisionId)` delegating to the repository — since
  the `DECISION_REPOSITORY` token is not exported.
- **Candidate status is stored, decision status is not copied.** The candidate's transition log
  records *that* it moved to `approved` and which decision did it; the decision's own content is read
  from 031 on demand (`FR-LRN-021`, spec Assumption 3), as `EPIC-047` does (`R-047-5`).

## R-048-8 — Evidence is cited by id and digest, resolved through an additive `EPIC-032` read

- **Decision**: a citation is `{evidenceId, digest: {sha256}}` (`FR-LRN-012`), stored in
  `learning_candidate_evidence`. Nothing from the payload is copied.
- **Resolution** needs a by-id read `EPIC-032` does not have — evidence is reachable only through
  the work it is attached to (`evidence.repository.ts:49-80`). **`A-032-1`** (additive, done by this
  Epic's adapter phase, asserted in 032's suite): `EvidenceService.resolve(workspaceId, ids[])`
  returning, per id, the `AttachedEvidence` view 032 already computes (`completion.gate.ts:41-55`:
  `integrity: valid|failed`, `resolution: resolved|unresolvable`, `attestedArtifact`) plus the
  attested target `{type, id}`.
- **Displayed state** per citation (`FR-LRN-015`): `verified` (resolved, integrity valid, cited
  digest equals stored subject digest); `integrity-failed` (integrity failed **or** cited digest
  differs — a substituted item is a tampered citation); `unresolvable` (absent, other workspace, or
  storage unresolvable); `withheld` (reader-specific, `R-048-9`). Integrity is **re-derived on every
  read** by 032 for referenced payloads (`contract.status.ts:57-99`), so a later failure is seen.
- **Retirement does not exist in `EPIC-032`** (no state, column or method). `FR-LRN-037`'s
  *retired* is therefore **unreachable** until 032 adds it; the state is reserved in the contract and
  never produced. Recorded as risk `RK-6`, not faked.
- **Alternatives considered**: reading `evidence_items` directly (rejected — reading around 032's
  access and integrity rules, which `FR-LRN-016` forbids).

## R-048-9 — Withholding evidence by the reader's access

- **Decision**: per citation, call `EPIC-032`'s own `AccessControlEvidencePolicy.canRead(reader,
  attestedTarget)` (`evidence/access.adapter.ts:40-53`), constructed over `EPIC-024`'s
  `AccessInheritanceService.effectivelyReadable` (`access-inheritance.service.ts:61`). Unreadable →
  the citation is returned as `{state: 'withheld'}` **with no id, digest or predicate**, and the
  candidate carries `withheldEvidenceCount` (`FR-LRN-016`).
- **Inherited limitation**: 032 governs only `specification` and `project` targets
  (`ACCESS_GOVERNED_TYPES`, `access.adapter.ts:29`; `DEF-032-003`). Other targets are readable on
  workspace membership. Consumed as-is; this Epic does not widen or narrow 032's rule.
- **Eligibility uses the unfiltered state.** Whether a candidate may be auto-approved is decided on
  every citation's real state, not the reader's view — a citation withheld from one reviewer is not
  thereby healthy.

## R-048-10 — `memoryPolicy: governed-knowledge` is a hard prerequisite (`A-047-1`); the deferral clause is not used

- **Decision**: the spec's Epic Exit Criteria allow *"`FR-LRN-055`/`FR-LRN-056` deferred to a named
  Epic"*. **This plan does not use that clause.** The `EPIC-047` amendment is a **prerequisite to
  merge**, and no part of this Epic emulates it.
- **`A-047-1`** — the exact change, on `EPIC-047`'s branch, through its own Spec Kit flow:
  - `FR-EXP-020` admits `governed-knowledge`;
  - `MEMORY_POLICIES = ['none', 'governed-knowledge']` (`experts/expert.types.ts:26`) and the
    validation message (`contract.validation.ts:114-120`);
  - a migration replacing `expert_contract_versions_memory_check` (`migrations/20261009090000_epic047_experts/migration.sql:54`)
    with `CHECK ("contract"->>'memoryPolicy' IN ('none','governed-knowledge'))`. Existing rows are
    unaffected — the trigger at `:64-82` forbids editing them and none needs it;
  - tests: `expert-types.spec.ts:26` expectation; `expert-contract-validation.spec.ts:43-46` and
    `expert-constraints.spec.ts:87-90` keep refusing `'session'`; quickstart Q2 keeps `'session'`
    → `400`; `frontend/src/services/api.ts:320` literal type widened.
- **`A-047-2`** (same amendment, additive): `ExpertsModule` exports a read —
  `ExpertProvenance.forExecution(workspaceId, executionId) → {expertId, contractVersionId,
  contractVersion, memoryPolicy} | null` — composed from `findSession` (`experts.store.ts:39`) and
  `versionsFor` (`:31`). Today the module exports only `ExpertsService` and `EXPERT_PORTS`
  (`experts.module.ts:131`).
- **Until both land** the `ExpertProvenance` port is bound **refusing**: a submission from an
  execution that is an Expert session cannot be judged and is refused `503`, naming the port.
  Submissions from non-Expert executions and from people are unaffected. Knowledge admission for a
  package whose execution is an Expert's is likewise refused-closed (no knowledge supplied).
- **Effect** (`FR-LRN-055`, `SC-LRN-009`): submission from an Expert whose contract version declares
  `none` is refused and recorded on its execution; `KnowledgeAdmission` excludes every knowledge
  candidate from such an Expert's package (reason `permission`, detail naming the memory policy).
  `FR-LRN-056` holds because this Epic stores nothing per Expert.

## R-048-11 — Approved knowledge enters `EPIC-038` as a source class, through one additive seam

- **What `EPIC-038` has** (verified): a closed approved set (`index.service.ts:46-52`), enforced at
  reindex (`:101-106`), assembly (`assembly.service.ts:426-438`) and search (`search.service.ts:113`);
  per-type `if` branches in `sources.adapter.ts` for `currentVersion`/`read`; a workspace-partitioned
  index whose `projectId` comes from `ArtifactSource.read` (`null` = workspace-wide,
  `isolation.ts:42-52`); exclusion reasons closed at five.
- **Decision — `EPIC-038` changes, all additive, made by this Epic's adapter phase and asserted in
  038's own suites**:
  1. `'knowledge-entry'` joins `APPROVED_SOURCE_TYPES`.
  2. `sources.adapter.ts` gains a `knowledge-entry` branch delegating to this Epic's
     `KnowledgeSourceReader` (`learning-contract`): `currentVersion` = the entry's current version id,
     or `{resolves: false}` once deprecated; `read` = the statement text with `projectId: null`
     (scope is judged by admission, not by the index partition).
  3. `ProvenanceService` resolves a `knowledge-entry` item's `authoritativeStatus` from the same
     reader: `current`, or `superseded` naming the successor version (`FR-LRN-052`).
  4. `AssemblyPorts` gains an optional `admission?: Map<sourceType, KnowledgeAdmission>` consulted
     after `judgeBoundary` and before `access.mayRead`. `KnowledgeAdmission.admit(candidates,
     {workspaceId, projectId, executionId?})` returns, per candidate, admitted or
     `{reason, detail}` using **existing** reason codes:

     | This Epic's rule | `ExclusionReason` | `detail` begins |
     |---|---|---|
     | approved scope excludes the project (`FR-LRN-041`) | `boundary` | `scope:` |
     | classification not permitted, or undetermined outside origin (`FR-LRN-044`) | `classification` | `classification:` |
     | workspace boundary (`FR-LRN-043`) | `boundary` | `workspace:` |
     | reuse policy disallows (`FR-LRN-040`) | `boundary` | `reuse-policy:` |
     | version superseded / deprecated (`FR-LRN-033`) | `stale` | `superseded:` / `deprecated:` |
     | project archived (`FR-LRN-046`) | `boundary` | `archived:` |
     | Expert contract declares `none` (`FR-LRN-055`) | `permission` | `memory-policy:` |
  5. `knowledge-entry` items carry `inclusionReason` prefixed `approved knowledge —` and the screen
     labels them **approved knowledge, not authoritative** (`FR-LRN-052`, `FR-CTX-072`).
- **Spec inconsistency flagged** (`FR-LRN-045`): it requires an exclusion naming *scope*. `EPIC-038`
  has no `scope` reason, and adding one is a migration on 038's CHECK for a distinction the `detail`
  already carries. **Fix**: scope refusals are `boundary` with `detail` beginning `scope:`; the
  requirement is met by the record naming scope, not by a dedicated enum member.
- **Prerequisite `A-038-1`** (spec text): `EPIC-038` `FR-CTX-015` closes the approved set to
  *specifications, requirements, baselines, decisions and execution history*. Adding
  `knowledge-entry` contradicts it unless amended. Documentation-only, on 038's branch or as its first
  follow-up; the code changes above stay with this Epic.
- **Rationale**: one optional port keeps every learning rule in this Epic (`FR-LRN-050` — 038 still
  assembles; this Epic only answers "may this entry be supplied here?") and keeps the exclusion
  record in 038's table, where `FR-CTX-063` inspection already reads it.
- **Alternatives considered**: indexing one `IndexEntry` per in-scope project (rejected — the index
  is unique on `(workspaceId, sourceType, sourceId)`, and a named-set scope change would re-embed N
  times); encoding scope as `ReusableKnowledgeAuthorisation` rows (rejected — `FR-LRN-043` forbids
  registering knowledge there in this Epic).

## R-048-12 — Automatic approval: an explicit category, and a path only an eligible candidate takes

- **Decision — two action types, chosen by this Epic before the request is made**:
  - `learning.approve.<categoryKey>` — the **automatic path**, sent only when `eligibility.ts` finds
    **all** of: the category exists **and is declared `lowRisk: true`** in the learning policy
    (`FR-LRN-022`, `FR-LRN-026`); claimed scope is exactly the source project (`FR-LRN-022`, US3-6);
    every citation `verified` (`FR-LRN-015`); no conflict with an approved entry (`FR-LRN-036`); kind
    is `new` (never supersede, deprecate or widen — `FR-LRN-034`); the source execution is governed
    (`FR-LRN-063`).
  - `learning.review.<kind>` — everything else (`kind` ∈ `candidate`, `supersede`, `deprecate`,
    `widen-scope`).
- **The band is still `EPIC-031`'s** (`FR-LRN-023`): `learning.approve.<category>` auto-executes only
  if 031's steering classifies it `low` and the tenant policy treats `low` as `auto-execute`. An
  unclassified action gets `high` (`classifier.ts:280-287`), so **with nothing configured, everything
  waits for a human** (`SC-LRN-008`). A workspace opts a category in by **two** recorded declarations
  — `lowRisk` in the learning policy (the explicit category) and a `low` classification rule (the
  band). Both are steering documents with actor and instant.
- **The request actor**: `{kind: 'automation', id: 'learning-intake'}`, `requestedBy` = the
  submitter's principal or user id, `triggeredBy = {ruleId: 'learning.candidate-submitted', eventId:
  candidateId}`. 031 refuses automation not covered by the tenant's `automatedActions`
  (`evaluator.ts:127-130`, `automationRefusal :417`) — so **a workspace enables governed learning by
  listing `learning.*` there**. Until it does, every request is refused by policy, the candidate
  stays `proposed`, and the refusal's explanation is shown (fail closed, `FR-LRN-030`). Consumed
  exactly as 031 defines automation; nothing is special-cased.
- **Defence in depth**: if 031 ever returns `auto-executed` for a `learning.review.*` request (a
  workspace classified it `low`), the approver guard (`R-048-6`) does not accept it. The candidate is
  flagged `policy-auto-executed-review` and waits for a human — whom 031 can no longer route, since
  the decision is closed. **Recorded as risk `RK-5`**, with the spec's existing follow-up asking 031
  to put `learning.review.*` in `IRREDUCIBLY_HIGH` (`policy/classification.ts:46-50`).
- **Medium band**: 031 refuses a medium-band request naming no gates (`evaluator.ts:309-316`). This
  Epic sends none, so a category classified `medium` is refused and stays `proposed` with that
  explanation. Learning actions are meant to be classified `low` or `high`; recorded in the quickstart.
- **Mutation proof** `MP-2` removes the `lowRisk` term from `eligibility.ts`.

## R-048-13 — Retrievability is derived from the reindex outcome, never assumed

- **Decision**: after every approval, supersession, deprecation and scope change (`FR-LRN-051`), this
  Epic calls `IndexService.reindex({workspaceId, sourceType: 'knowledge-entry', sourceId: entryId,
  sourceVersion: versionId})` (`index.service.ts:93`; `IndexService` is exported,
  `context.module.ts:254`) and appends the outcome to `knowledge_retrievability`:
  `indexed`/`current` → **retrievable**; `GovernanceSeamUnboundError` (embedding unbound) or a `400`
  (no `knowledge-entry` source class — `DEF-038-007`: 038 has no configuration write path) →
  **not yet retrievable** with that reason (`FR-LRN-053`). A sweep retries not-yet-retrievable
  versions every 10 minutes.
- **Deprecation** has no index-removal API in 038; the reindex call returns *does not resolve*
  (`read` returns null for a deprecated entry). That is the expected outcome. **Admission is the
  guarantee** that a deprecated version is never supplied (`R-048-11` row `stale`).
- **Consequence stated plainly**: with no embedding provider in the programme, **every approved
  entry reads *not yet retrievable* in the composed application until one is bound**. That is the
  requirement working, and the closing report must say so.

## R-048-14 — Candidate lifecycle is an append-only transition log

- **Decision**: the candidate's core (statement, source, scope claimed, …) is immutable. Its state is
  the latest row of `learning_candidate_transitions` (`FR-LRN-004`: `proposed`, `pending-review`,
  `approved`, `rejected`, `expired`, `withdrawn`). Allowed moves:

  ```text
  proposed ──decision pending──▶ pending-review ──accepted approval──▶ approved
     │  ▲                              │──refused by reviewer──────▶ rejected
     │  └──decision-not-accepted───────┤──window elapsed (A-031-1)──▶ expired
     └──────────── withdrawn ◀─────────┘
  ```
  `approved`, `rejected`, `expired` and `withdrawn` are terminal. Only `materialiser.ts` writes
  `approved` (`FR-LRN-004`: *no other state leads to approved knowledge*).
- **Expiry and withdrawal close the 031 decision** through `A-031-1` (the requesting automation
  refuses its own request with reason `expired`/`withdrawn`), so the item leaves the Inbox
  (spec Edge Case *never decided*). Until `A-031-1` exists the candidate cannot expire cleanly —
  another reason it is a hard prerequisite.
- **Rationale**: Constitution XII rule 2's reasoning applied here — history is the record; state is a
  projection.

## R-048-15 — Corroboration and conflict are exact-subject matches

- **Decision**: a submission's `subjectKey` = `category + ':' + normalise(subject)` (lower-case,
  whitespace collapsed, punctuation stripped). A submission whose `subjectKey` matches an **open**
  candidate (`proposed` or `pending-review`) in the same workspace is attached as a corroboration
  (`FR-LRN-017`), serialised by a transaction-scoped advisory lock on `hash(workspaceId,
  subjectKey)`. A `new` candidate whose `subjectKey` matches a **current** approved entry is
  `conflicting` (`FR-LRN-036`) and goes to `learning.review.candidate`.
- **Out of scope, stated**: semantic contradiction between differently worded subjects. Detecting it
  needs an embedding model nobody provides (`RK-2`); the reviewer sees same-category entries in the
  candidate view.

## R-048-16 — Screens: a detail renderer in 031's Inbox, a sub-view in 038's Context area

- **Decision**:
  - **Candidate review** — the Decision Inbox (`frontend/src/pages/DecisionInbox.tsx`, area
    `decision-inbox`, `/decisions`) gains a **detail-renderer registry keyed by `objectRef.type`**
    (`A-031-2`, additive, a prerequisite made by `EPIC-031` — reassigned to its owner by the Project Owner on 2026-10-09; this Epic registers its renderer into it). This Epic registers
    `LearningCandidateDetail` for `learning-candidate`: statement, category, source session, evidence
    with state, confidence and basis, claimed scope, corroborations, conflict or superseded entry side
    by side, and Approve (with narrowing and editing) / Reject (`FR-LRN-071`, `FR-LRN-072`). Without a
    renderer the Inbox keeps its current row — nothing breaks for other target types.
  - **Knowledge browser** — `/context/knowledge`, registered in `SUB_VIEWS`
    (`frontend/src/shell/routes.tsx:44-77`) as "`Area.path` plus a segment", reached from the Context
    page by a link (`FR-LRN-070`, `UX-0003`). No entry in `areas.ts`; an architecture test asserts it.
- **Rationale**: clarification Q2. Both areas are `delivered` on their own branches (`areas.ts:131-141`,
  `:254-265`) and `declared-not-delivered` on `main`, which is one more reason this Epic merges after
  them.

## R-048-17 — Execution events: one additive content event type

- **Decision**: `EXECUTION_EVENT_TYPES` gains **one** content-class type,
  `learning-candidate-recorded`, payload `{kind, candidateId, reason?}` with
  `kind ∈ submitted | late-submitted | corroborated | refused | bound-exceeded |
  memory-policy-refused` (`FR-LRN-060`). **No statement text** in the payload — the candidate holds it.
  The pattern is `EPIC-047`'s `expert-governance-recorded` (`R-047-4`).
- **Late submissions** (`FR-LRN-005`): content events may follow a terminal lifecycle event — only
  lifecycle events are refused after terminal (`executions/execution-event.service.ts:217-234`). So a
  late submission is recordable on its execution, within the grace period measured from the terminal
  event's `occurredAt` (`history`, `execution-registry.facade.ts:118`).
- **Provisional executions** (`FR-LRN-063`): `ExecutionSnapshot.governanceState`
  (`packages/execution-registry-contract/src/contract.ts:226`) ≠ `governed` → the candidate is
  recorded `proposed` and **no decision is requested**; the sweep requests it after
  `execution-reconciliation-accepted`.
- **"Marked invalid" is not a concept in `EPIC-037`.** Defined here (spec Edge Case) as: the source
  execution has a `validation-failed`, `transition-refused`, `transition-inconsistent` or
  `execution-reconciliation-conflicted` event. *"Its work reverted"* is not detectable from the
  registry; recorded as a limitation (`RK-7`).
- **Count assertion**: `ALL_EVENT_TYPES` is asserted at 29 on `main` (`events.ts:89`); `EPIC-047` adds
  one, this Epic one more — 31. Another reason to merge after `EPIC-047`.

## R-048-18 — Secret screening reuses `EPIC-037`'s patterns, with names

- **Decision**: `executions/sanitisation.ts` has the patterns (`SECRET_PATTERNS :45-55`,
  `CREDENTIAL_FIELDS :27`) but returns a boolean (`looksLikeSecret :73`). `FR-LRN-018` requires the
  refusal to **name the rule**. Additive change on `main` (no merge dependency): name each pattern and
  export `secretRuleMatching(value): string | null`; `looksLikeSecret` delegates to it so `EPIC-037`'s
  behaviour is unchanged and asserted by its existing tests. Statement, subject, confidence basis and
  every free-text field are screened **before** anything is stored.
- **Traceability note**: the spec cites `EPIC-037` for `BR-0173`; `specs/brs-v2-reconciliation.md:133`
  traces `BR-0173` to `EPIC-028`. The code is `EPIC-037`'s; the citation is kept and the discrepancy
  noted for the register.

## R-048-19 — Approval attestation: `approval/v1`, body defined here and proposed to `EPIC-032`

- **Decision**: every approval — automatic (`FR-LRN-025` requires it) and human (uniformity costs one
  call) — contributes an attestation through `EvidenceService.contribute` (`evidence.service.ts:222`):
  `predicateType = https://pmi.studio/attestation/approval/v1` (`predicates.ts:45`), `source.uri =
  'pmi:learning'` (the platform-source branch, `:40`), `attachedTo = {type: 'decision', id:
  decisionId}`, `attestedArtifact = {id: entryId, version: versionNumber}`, subject digest = sha256 of
  the canonical approved version. Its id is stored on the version.
- **Predicate body** (`A-032-2`, proposed to 032 — it defines the URI but no body):
  `{decisionId, resolvingDecisionId, candidateId, entryVersionId, outcome, approvedByKind,
  approvedBy, policyVersion, matchedRule, effectiveClass}`. **No new predicate type** (spec
  Assumption 4).
- **Ordering**: the attestation is written after the version commits. A failure leaves the version
  flagged `attestation-missing` and the sweep retries; the version is not rolled back (it is already
  decided and audited by 031).

## R-048-20 — Building against four unmerged dependencies

- **Decision**: every dependency is a **port declared in `learning.tokens.ts`**: `LearningDecisions`
  (031), `EvidenceReads` + `ApprovalAttestations` (032), `KnowledgeIndex` (038), `ExpertProvenance`
  (047), plus `main` ports `Executions` (037), `SecretScreen` (037), `Principals` (028), `ReaderAccess`
  (024), `Audit` (004), `LearningPolicySource` (019). `main` ports get adapters immediately. The four
  unmerged ports are bound **refusing** (`GovernanceSeamUnboundError`, `503`, naming the port) and
  their adapters are **one task phase, last, blocked on merge**. Route tests that need a decision or
  evidence override the ports with in-test bindings that record every call, visibly in the test; the
  module default stays refusing (`EPIC-047` analysis finding I1).
- **What works before the merges**: submission from people and non-Expert executions — validation,
  secret screening, idempotency, bound, events, corroboration — with evidence resolution refusing.
  In practice the composed application refuses every submission (evidence is mandatory) until
  `EPIC-032` merges. That is the honest behaviour.

## R-048-21 — Merge order

1. **`EPIC-032`** — Evidence Store (consumed by 038's `ArtifactSource`, by 047, and here).
2. **`EPIC-031`** — **with `A-031-1`** (refuse a pending decision) and `A-031-2` (Inbox renderer registry). Independent of 032 in code.
3. **`EPIC-038`** — **with `A-038-1`** (`FR-CTX-015` admits `knowledge-entry`; text only).
4. **`EPIC-047`** — **with `A-047-1` and `A-047-2`** (`governed-knowledge`; provenance read). 047
   consumes 031, 032 and 038, and adds the 30th event type.
5. **`EPIC-048`** — this Epic, whose last task phase adds `A-031-3`, `A-032-1` and the
   038 seam (`R-048-11` items 1–5) to the merged code, each asserted in its owner's suite.

Steps 1–3 may land in any order among themselves; 4 must follow all three; 5 must follow 4. **No
workaround exists for `A-031-1` or `A-047-1`** — this Epic cannot reach its exit gate without them.

## R-048-22 — Performance and scale targets (`PP-018`)

| Operation | Target (p95) | Design point |
|---|---|---|
| Submit a candidate (validate, screen, resolve ≤ 5 citations, snapshot, record, event) | < 400 ms | excluding the 031 decision request |
| Submit, including the 031 decision request | < 800 ms | |
| Candidate detail in the Inbox | < 500 ms | 5 citations, 20 corroborations, one superseded entry |
| Review decision → entry materialised (this Epic's route) | < 600 ms | |
| Decision taken in 031's Inbox → entry materialised | < 60 s | sweep every 30 s |
| `KnowledgeAdmission.admit` inside assembly | < 25 ms | 200 knowledge candidates per package, one batched query |
| Knowledge browser, filtered page of 50 | < 1 s | 5,000 entries, 20,000 versions per workspace |
| Entry history | < 300 ms | 50 versions with status events |
| Approval → reindex attempted | < 5 s | when an embedding provider is bound |

Volume: 20 candidates per execution (configurable, `FR-LRN-007`); design point 10,000 candidates and
1,000 approved versions per workspace per month. `SC-LRN-007` (decide in under 2 minutes) is a
usability target, exercised in the Tier 2 transcript, not a latency one.
