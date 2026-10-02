# Feature Specification: Governed Execution Registry

**Feature Branch**: `037-governed-execution-registry`

**Epic**: `EPIC-037` — Governed Execution Registry

**Created**: 2026-08-25

**Status**: Draft

**Input**: Project owner's authoritative product decision of 2026-08-25, ratified as Constitution
Principle XII (v1.6.0) and PMI-DOC-004 v2.0 §6.22. Step C1 authorised the full definition journey.

> **Operating principle**: *execute anywhere through an approved integration; govern, record and
> trace everything in PMI Studio.*

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.22 `BR-0196` | FR-EXR-001, 002, 013, 016 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.22 `BR-0197` | FR-EXR-002, 003, 017, 018 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.22 `BR-0198` | FR-EXR-004, 005 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.22 `BR-0199` | FR-EXR-006, 007 *(consumed from EPIC-030)* |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.22 `BR-0200` | FR-EXR-007 *(consumed from EPIC-030)* |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.22 `BR-0201` | FR-EXR-008, 009, 019, 020 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.22 `BR-0202` | FR-EXR-010, 011, 012 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.22 `BR-0203` | FR-EXR-014, 015 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.14 `BR-0132` | FR-EXR-019 *(local connector)* |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.14 `BR-0133` | FR-EXR-013 *(no privileged surface)* |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.18 audit | FR-EXR-021 |
| `SRS/August112026/Native Spec-Kit Execution Environment…docx` | §1, §2 *(clarified 2026-08-25)* | FR-EXR-008, 013, 020 |
| `.specify/memory/constitution.md` | Principle XII | every FR below |

**Requirements not yet covered by SRS**: none. Every requirement traces to `BR-0196`–`BR-0203`,
`BR-0132`, `BR-0133` or Principle XII.

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | This Epic exists because a spec-first decision was ratified before any code |
| PP-002 | Single Source of Truth | Satisfied | The event stream is the single authority; projections are explicitly derived |
| PP-003 | Human-in-the-Loop | Satisfied | Approval-gated transitions require a human; AI self-approval is refused (FR-EXR-007) |
| PP-004 | End-to-End Traceability | Satisfied | Phase-aware version binding is the Epic's centre (FR-EXR-004, 005) |
| PP-005 | Modular Architecture | Satisfied | One semantic contract, six connector bindings, no cross-imports |
| PP-006 | Engine Independence | Satisfied | No connector or engine is privileged (FR-EXR-013); fixture connector proves it |
| PP-007 | API & MCP First | Satisfied | REST, MCP and SDK bindings specified together with semantic parity (FR-EXR-020) |
| PP-008 | Security by Design | Satisfied | Authz per registration, secret redaction, no direct database access (FR-EXR-008, 009, 019) |
| PP-009 | Quality by Design | Satisfied | Every acceptance criterion observed failing first (Constitution V) |
| PP-010 | Observability by Default | Partial | Execution history is inherently observable; **metrics and dashboards deferred → EPIC-040** |
| PP-011 | Documentation as Code | Satisfied | Contracts live in `contracts/` and are checked executably |
| PP-012 | Everything Versioned | Satisfied | Contract version negotiated at registration; unsupported versions refused |
| PP-013 | Knowledge-Driven Engineering | Partial | Execution history is a knowledge source; **retrieval deferred → EPIC-038** |
| PP-014 | Configuration over Customization | Satisfied | Policy classes are configuration read by EPIC-030, not code in this Epic |
| PP-015 | Open Standards | Satisfied | HTTP, JSON, MCP; no proprietary transport |
| PP-016 | Explainable AI | Satisfied | Every agent completion carries a mandatory comment stating what was done and what remains |
| PP-017 | Cost-Aware AI | Not applicable | Cost and resource limits belong to the execution environment, owned by EPIC-028 |
| PP-018 | Scalability First | Partial | Bounded, paginated history (FR-EXR-016); **retention tiering deferred → EPIC-040** |
| PP-019 | Continuous Improvement | Partial | The registry is the raw data for DORA metrics; **metric derivation deferred → EPIC-040** |
| PP-020 | Customer Value | Satisfied | Nine of seventeen prototype screens read execution state; this unblocks them |

**Deferral count**: 4 — PP-010, PP-013, PP-018, PP-019, each owned by a named Epic (EPIC-038,
EPIC-040) and reviewed at this Epic's convergence gate.

## Clarifications

### Session 2026-08-25

**No question was escalated.** Step C1's clarification rule reserves the project owner's time for
questions that would materially change product scope, constitutional invariants, epic ownership,
security posture, governance authority or destructive migration strategy. Seven ambiguities were
found; **all seven resolved from existing architecture and approved decisions**, and each is
recorded below with the source that settled it rather than with an author's preference.

- Q: Which commands must be registered — every `/speckit-*` invocation, or only those that change artifacts? → A: **Every `/speckit-*` command run against a managed project's artifacts**, which is Constitution I's eight plus `/speckit-clarify` and `/speckit-constitution`. *Basis*: Principle XII says "every governed Spec Kit command" without qualification, and a read-only command still establishes who looked at what, when. A registry that recorded only mutations could not answer "was this reviewed".
- Q: How long are execution events retained, and may they ever be deleted? → A: **Indefinite retention; erasure by redaction, never deletion** — inherited unchanged from `EPIC-004` (clarified 2026-08-19). *Basis*: `FR-EXR-021` requires alignment with platform audit policy rather than a parallel scheme, and EPIC-004 already settled this against a database that physically refuses `DELETE` on audit rows. Inventing a retention window here would create the second scheme the requirement forbids.
- Q: Which redaction mechanism is the default? → A: **Immutable redaction event with the original retained under access control.** Cryptographic erasure of the content key is available **only where law compels deletion**. *Basis*: Rev 3 §08 approved both; retention-by-default follows EPIC-004's erasure-by-redaction posture, and crypto-erasure is the exception it names.
- Q: Who may read a retained redacted original? → A: **A named compliance or legal reviewer role only, and every such access is itself audited.** No engineering or administrative role inherits it. *Basis*: Rev 3 §08, approved.
- Q: How are provisional execution identifiers generated offline without collision? → A: **Client-generated, collision-resistant identifiers, validated on intake; a collision is a reconciliation conflict, never an overwrite.** *Basis*: `FR-EXR-012` already forbids silent resolution of conflicts, so a colliding identifier is simply an instance of that rule.
- Q: Are executions inside an unattended run registered, and does that absorb `EPIC-023`? → A: **Registered and linked; `EPIC-023` keeps run semantics.** A run may contain many executions; the concepts associate rather than merge. *Basis*: Principle XII admits no exemption by originating surface, and the Step C1 boundary explicitly reserves unattended-run semantics to `EPIC-023`.
- Q: Does this Epic require a destructive migration? → A: **No. Additive only.** New tables; `Run` and `AuditEntry` are untouched except for one optional nullable reference each. *Basis*: no existing table carries execution semantics — `Run` is scoped to unattended-run mode and stop-range, and overloading it would conflate two concepts and break `EPIC-023`'s contract.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A governed command is recorded wherever it runs (Priority: P1)

An engineer runs `/speckit-plan` for a managed project. Whether they run it in the managed sandbox,
from VS Code through the local connector, from an MCP client, or in CI, PMI Studio holds a complete
record: what command, against which specification version, on which commit, by whom, with what
outcome, evidence and comments.

**Why this priority**: This is the Epic. Without it, the specification's status, evidence chain and
audit trail are silently wrong whenever anyone works outside the sandbox, and every downstream gate
reads a corpus that no longer describes reality.

**Independent Test**: Register, run and complete one execution through the fixture connector, then
read its full history back. No other connector, UI or Room is required.

**Acceptance Scenarios**:

1. **Given** a managed project and an approved connector, **When** a governed command is registered
   and completes, **Then** the execution record carries command, initiator, agent identity,
   environment, input and output version binding, outcome, artifacts, evidence and a completion
   comment.
2. **Given** the same command run from four different surfaces under the same policy, **When** each
   completes, **Then** all four agree on normalized command, target-version bindings, required
   lifecycle milestones, governance outcome and evidence obligations, differing only in identity,
   transport, environment, timing and surface metadata.
3. **Given** a registration that omits required **input** version identity, **When** it is
   submitted, **Then** it is refused with a reason naming the missing field.
4. **Given** a registration, **When** it is replayed with the same idempotency key, **Then** the
   original execution is returned and no second execution exists.

### User Story 2 - History is append-only and survives its own execution (Priority: P1)

A reviewer opens a requirement three days after a command ran, reads what happened, adds a comment,
and approves the transition the agent proposed. Nothing they do rewrites what the agent recorded.

**Why this priority**: Equal to US1. An audit trail that can be edited is not an audit trail, and a
record that closes when the command finishes cannot hold an approval that arrives later — which is
the normal case, not the exception.

**Independent Test**: Append a terminal event, then append governance and comment events after it;
assert both that the later events are accepted and that a further lifecycle event is refused.

**Acceptance Scenarios**:

1. **Given** a completed execution, **When** an approval or comment event is appended, **Then** it
   is accepted and ordered after the terminal event.
2. **Given** a completed execution, **When** any lifecycle event is appended, **Then** it is
   refused.
3. **Given** an execution that is re-run, **When** the re-run registers, **Then** a new execution is
   created linked to the original, and the original's stream is byte-identical afterwards.
4. **Given** an execution's event stream, **When** the projection is rebuilt by replay, **Then** it
   reproduces the stored state exactly.
5. **Given** a comment requiring redaction, **When** an authorised redaction is applied, **Then** the
   body is concealed, an immutable tombstone records actor, time and reason, and the integrity chain
   still verifies.

### User Story 3 - The platform decides status, not the agent (Priority: P1)

An agent finishes `/speckit-clarify` and proposes moving a specification to *clarified*. PMI Studio
decides whether that is applied automatically, validated, sent to a human, refused, or flagged
inconsistent. The agent never applies it.

**Why this priority**: Equal to US1 and US2. If a connector can move lifecycle state, governance is
advisory, and Principle XII's authority clause is unenforced.

**Independent Test**: Submit a proposal through the fixture connector and assert the adjudication is
performed by the governed workflow, and that a connector attempting to apply a transition directly
is refused.

**Acceptance Scenarios**:

1. **Given** an agent completion, **When** it requests a transition, **Then** a proposal is recorded
   and no transition is applied by the connector.
2. **Given** a proposal whose validations pass but whose policy routes it to approval, **When**
   validation completes, **Then** the transition is **not** applied and an approval is requested.
3. **Given** an approval-gated transition proposed by an AI agent, **When** that agent attempts to
   approve it, **Then** the approval is refused and the refusal is recorded with its reason.
4. **Given** a connector that attempts to apply a transition directly, **When** the request is
   received, **Then** it is refused as a contract violation.

### User Story 4 - Work continues when the control plane is unreachable (Priority: P2)

A developer on a train runs a governed command. Tenant policy permits offline execution. The command
runs, everything is queued locally, and the artifact is visibly **not yet governed** until the
connector reconnects and PMI Studio accepts it.

**Why this priority**: Below US1–US3 because it is a mode rather than the core guarantee — but above
history queries because an unregistered execution silently presented as governed is the failure
Principle XII exists to prevent.

**Independent Test**: Drive the fixture connector with the control plane unavailable under each
policy, then reconnect and reconcile.

**Acceptance Scenarios**:

1. **Given** strict-governance mode and an unreachable control plane, **When** a governed command is
   attempted, **Then** it is blocked and nothing is presented as governed.
2. **Given** permitted offline mode, **When** a governed command runs, **Then** a provisional record
   exists before execution, an `execution-sync-queued` event marks it `pending_sync`, and the
   execution is presented as not yet governed.
3. **Given** a queued offline execution, **When** the connector reconnects, **Then** events replay in
   connector-local causal order, original source timestamps are preserved, an authoritative server
   sequence is assigned, and the execution becomes governed.
4. **Given** a replay that cannot be applied, **When** reconciliation runs, **Then** a conflict is
   surfaced for a human and is **never** silently resolved or reordered.

### User Story 5 - Anyone can ask what has been executed against an artifact (Priority: P3)

A reviewer opens a specification and sees every governed command run against it, in order, with
outcomes and links to evidence.

**Why this priority**: Valuable and visible, but it reads data the earlier stories create. Nine of
the seventeen prototype screens consume it; none can be built before the record exists.

**Independent Test**: Register several executions against one artifact and query its history.

**Acceptance Scenarios**:

1. **Given** several executions against one artifact, **When** its history is queried, **Then** the
   results are ordered, bounded, paginated and filtered to what the caller may read.
2. **Given** a caller without read access to an artifact, **When** they query its history, **Then**
   they receive nothing that discloses the artifact's existence.

### Edge Cases

- **A gap appears in the server sequence.** Reported as a reconciliation fault, never silently
  accepted — a gap means an event was lost or an ordering assumption broke.
- **Two connectors append concurrently.** `expectedSequence` fails the loser with the current
  sequence; the caller re-reads and retries. Last-write-wins is not available.
- **An execution never completes** (process killed, machine lost). It has no terminal event; it is
  reported as *incomplete*, distinguishable from both *running* and *failed*.
- **A partial completion.** A first-class terminal outcome carrying what was done and what remains,
  not a success with caveats.
- **A connector sends a secret in arguments.** Redacted at the connector before transmission; the
  registry additionally refuses to store recognisable credential material.
- **An agent descriptor is renamed after an execution.** The historical snapshot is unchanged — the
  record says what ran, not what the thing is called now.
- **A target artifact is deleted after execution.** The record survives with its version binding; a
  history query reports the target as removed rather than dropping the execution.
- **The same command is registered twice with different idempotency keys.** Two executions, both
  valid. Idempotency protects against retries, not against a human running a command twice.
- **An approval arrives for a proposal already refused.** Refused as inconsistent, recorded.
- **Contract version unsupported.** Registration refused with the supported range, never
  best-guessed.

## Requirements *(mandatory)*

### Functional Requirements

**Registration and intake**

- **FR-EXR-001**: The platform MUST register every governed Spec Kit execution for a managed project
  before it begins, capturing root identity, correlation identifier and idempotency key. **Governed
  commands are every `/speckit-*` command run against a managed project's artifacts** — Constitution
  I's eight plus `/speckit-clarify` and `/speckit-constitution` — including read-only ones, because a
  registry that recorded only mutations could not answer *"was this reviewed"* *(clarified 2026-08-25)*.
- **FR-EXR-002**: Execution history MUST be an append-only sequence of immutable events. No
  operation may mutate or delete a recorded event.
- **FR-EXR-003**: Current execution state MUST be a projection over accepted events, reproducible by
  replay, and MUST NOT be the authoritative record.
- **FR-EXR-013**: Executions originating outside the managed sandbox MUST enter through the same
  contract. No execution surface may be privileged.

**Version binding**

- **FR-EXR-004**: At registration an execution MUST bind its applicable **input** identity: target
  identifier, target version or baseline, repository, branch, worktree, commit-before, and input
  artifact digests.
- **FR-EXR-005**: At successful completion an execution MUST bind its applicable **output** identity:
  commit-after, resulting version or baseline, generated artifact digests, and evidence references.
  Registration MUST NOT require output identity. A failed or cancelled execution MUST be accepted
  with no output binding.

**Completion and governance hand-off**

- **FR-EXR-006**: An agent or connector MUST submit a requested transition as a proposal. It MUST NOT
  apply a transition. *Adjudication is EPIC-030's; this Epic owns the proposal record and its
  events.*
- **FR-EXR-007**: An approval-gated transition MUST NOT be approved by the AI agent that proposed it.
  *The policy is EPIC-030's; this Epic records the request, grant or refusal.*
- **FR-EXR-014**: Completion MUST carry outcome, artifacts, evidence, validation results and a
  mandatory completion comment. An empty completion is a failed completion.
- **FR-EXR-015**: Comments MUST be append-only, threaded, typed and access-scoped. A correction MUST
  be a superseding comment. An authorised redaction MUST conceal content while preserving an
  immutable tombstone and a verifiable integrity chain. No unaudited hard-delete path may exist.
  **Default mechanism: an immutable redaction event with the original retained under access control**,
  readable only by a named compliance or legal reviewer role, and every such access is itself
  audited. Cryptographic erasure of the content key is permitted **only where law compels deletion**
  *(clarified 2026-08-25)*.

**Integrity**

- **FR-EXR-008**: Every registration MUST authenticate a user or service principal and authorise
  against organization, workspace, project and target artifact scope.
- **FR-EXR-009**: A replayed registration bearing a known idempotency key MUST return the original
  execution and MUST NOT create a second.
- **FR-EXR-017**: The server MUST assign a gapless authoritative sequence per execution. Append MUST
  support an expected-sequence precondition; a mismatch MUST be refused with the current sequence.
- **FR-EXR-018**: A terminal lifecycle event MUST prevent any later **lifecycle** event and MUST NOT
  prevent governance, content, comment, redaction or reconciliation events. A terminal execution MUST
  NOT be reopened; a re-run MUST create a new linked execution.

**Offline and reconciliation**

- **FR-EXR-010**: Where the control plane is unreachable, strict-governance mode MUST block the
  governed command; permitted offline mode MUST create a durable provisional record before execution
  and mark it pending synchronisation by an immutable event.
- **FR-EXR-011**: A provisional execution MUST be presented as not yet governed and MUST become
  governed only when the platform accepts and reconciles it. Provisional identifiers are
  **client-generated, collision-resistant, and validated on intake**; a collision MUST be raised as a
  reconciliation conflict and MUST NOT overwrite an existing execution *(clarified 2026-08-25)*.
- **FR-EXR-012**: Reconciliation MUST preserve connector-local causal order and original source
  timestamps, assign the authoritative server sequence, retain the original local sequence, and
  surface conflicts. It MUST NOT silently reorder causally dependent events or resolve a conflict
  without a human.

**Queries, contracts and retention**

- **FR-EXR-016**: The platform MUST answer *what has been executed against this artifact* with
  authorisation-filtered, bounded, ordered, paginated history.
- **FR-EXR-019**: Agents and connectors MUST NOT access data-access modules directly and MUST use an
  authenticated, authorised, versioned integration contract.
- **FR-EXR-020**: One provider-neutral semantic contract MUST be expressed as REST, MCP and
  connector-SDK bindings with semantic parity. A fixture connector MUST ship with the contract.
- **FR-EXR-021**: Execution events MUST follow platform audit retention, immutability and export
  rules rather than a parallel scheme: **indefinite retention, erasure by redaction, never by
  deletion**, inherited unchanged from `EPIC-004` *(clarified 2026-08-25)*.
- **FR-EXR-022**: Arguments MUST be recorded sanitised. Recognisable credential material MUST NOT be
  stored or returned.

### Key Entities *(include if feature involves data)*

- **Execution** — the stable root identity and summary of one governed command: scope, normalized
  command, sanitised arguments, initiator, surface, environment, correlation and idempotency keys,
  governance state, and a link to a parent execution when it is a re-run.
- **Execution Event** — one immutable, sequenced fact about an execution. Carries its class, payload,
  the source clock, the server clock, the emitting principal and an integrity value.
- **Execution State** — a rebuildable projection over accepted events, carrying the sequence it was
  projected through so staleness is visible.
- **Agent Identity Snapshot** — the frozen provider, model, adapter, version and capabilities in
  effect when the execution ran, alongside a reference to the live descriptor.
- **Execution Target Binding** — what the execution acted on, at an exact version, in an input or
  output phase.
- **Execution Artifact** — an affected or generated artifact with its role, digest and evidence link.
- **Execution Comment** — an append-only, threaded, typed, access-scoped note with redaction state.
- **Status Transition Proposal** — an immutable request for a lifecycle change. Carries no verdict.
- **Outbox Entry** — a connector-side durable queue entry preserving local order and original
  timestamps.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-EXR-001**: **100%** of governed Spec Kit commands run for a managed project have an execution
  record, measured across all four supported surfaces.
- **SC-EXR-002**: The same governed command run from four surfaces produces records that agree on
  every governance-relevant field, with differences confined to identity, transport, environment,
  timing and surface metadata.
- **SC-EXR-003**: **Zero** governed executions can complete unregistered. Strict mode blocks;
  permitted offline mode marks the execution not-yet-governed until reconciled.
- **SC-EXR-004**: **Zero** recorded events are mutable. Replaying a stream reproduces its projection
  exactly, every time.
- **SC-EXR-005**: **Zero** lifecycle transitions are applied by a connector. Every applied transition
  names the platform authority that applied it.
- **SC-EXR-006**: **Zero** AI self-approvals succeed on an approval-gated transition.
- **SC-EXR-007**: A retried registration creates **no** duplicate execution, at any concurrency.
- **SC-EXR-008**: **Zero** stored events or API responses contain recognisable credential material.
- **SC-EXR-009**: **Zero** reconciliation conflicts are resolved without a human, and **zero**
  causally dependent events are reordered.
- **SC-EXR-010**: A person can answer *"what has been run against this artifact, by whom, with what
  result"* from one screen without reading a log file.

## Acceptance Criteria

*Added by `/speckit-analyze` 2026-08-25, finding `A1`. These identifiers were referenced sixteen
times across `tasks.md` and `quickstart.md` while being defined **only in the remediation package**,
outside the Epic. A task citing an acceptance criterion the Epic does not carry is a dangling
reference, and the criterion cannot be checked at convergence.*

| ID | Criterion | Proves | Scenario |
|---|---|---|---|
| **AC-EXR-01** | The same governed command from the **managed sandbox** produces the canonical governed outcome | `FR-EXR-013`, `FR-EXR-020` | `V37-10` |
| **AC-EXR-02** | …from an **MCP client**, semantically equivalent | `FR-EXR-013`, `FR-EXR-020` | `V37-10` |
| **AC-EXR-03** | …from the **local CLI connector** (`BR-0132`), semantically equivalent | `FR-EXR-013`, `FR-EXR-019` | `V37-10` |
| **AC-EXR-04** | …from **CI/CD**, semantically equivalent. All four agree on normalized command, target-version bindings, required lifecycle milestones, governance outcome and evidence obligations; they may differ **only** in identity, transport, environment, timing and surface metadata | `FR-EXR-013` | `V37-10` |
| **AC-EXR-05** | A replayed registration with a known idempotency key returns the original execution; the event count is unchanged | `FR-EXR-009` | `V37-3` |
| **AC-EXR-06** | With the control plane unreachable, **strict** mode blocks the command and no execution record is created | `FR-EXR-010` | `V37-6` |
| **AC-EXR-07** | **Permitted offline** creates a provisional record before execution, appends `execution-sync-queued`, presents it as not yet governed, and on reconnection promotes it to governed with original `occurredAt` preserved | `FR-EXR-010`, `FR-EXR-011` | `V37-6`, `V37-7` |
| **AC-EXR-08** | An AI agent attempting to approve its own approval-gated transition is **refused**, and the refusal is recorded with its reason | `FR-EXR-007` | `V37-5` |
| **AC-EXR-09** | A re-run creates a new linked execution; the parent's stream is byte-identical afterwards | `FR-EXR-018` | — |
| **AC-EXR-10** | An argument containing a connection string never appears in any stored event or API response | `FR-EXR-022` | `V37-9` |
| ~~**AC-EXR-11**~~ | **RETIRED — NON-NORMATIVE.** Merged into `AC-EXR-19`, which states terminality as one rule rather than two. **This row is not an acceptance criterion.** It is not enforceable, MUST NOT be mapped to an implementation task, and MUST NOT be counted as live | — | — |
| **AC-EXR-12** | Rebuilding the projection from events reproduces the stored state exactly | `FR-EXR-003` | `V37-8` |
| **AC-EXR-13** | A gap in the event sequence is reported as a reconciliation fault, never silently accepted | `FR-EXR-017` | `V37-8` |
| **AC-EXR-14** | Renaming an agent descriptor after execution leaves the historical snapshot unchanged | `FR-EXR-001` | — |
| **AC-EXR-15** | Redaction conceals the body and preserves row, sequence, thread linkage and integrity hash; **no hard-delete path is reachable** | `FR-EXR-015` | `V37-9` |
| **AC-EXR-16** | A connector attempting to apply a transition directly is **refused** as a contract violation | `FR-EXR-006` | `V37-5` |
| **AC-EXR-17a** | Registration omitting required **input** version identity is refused, naming the missing field | `FR-EXR-004` | `V37-2` |
| **AC-EXR-17b** | Registration **MUST NOT** require `commitAfter`, resulting version, or generated digests. *A test asserting otherwise is itself a defect* | `FR-EXR-005` | `V37-2` |
| **AC-EXR-17c** | A terminal **success** event omitting required output identity is refused | `FR-EXR-005` | `V37-2` |
| **AC-EXR-17d** | A terminal **failure** or **cancellation** with no output binding is accepted — absence of output is the correct record | `FR-EXR-005` | `V37-2` |
| **AC-EXR-18** | Governance, content, comment and reconciliation events are **accepted** after a terminal lifecycle event | `FR-EXR-018` | `V37-4` |
| **AC-EXR-19** | Any **lifecycle** event after a terminal lifecycle event is **refused** | `FR-EXR-018` | `V37-4` |
| **AC-EXR-20** | A passed validation routed to approval is **not applied** until an authorised human approves | `FR-EXR-006` | `V37-5` |
| **AC-EXR-21** | Offline replay preserves causal order and **reports conflicts rather than reordering** or auto-resolving | `FR-EXR-012` | `V37-7` |

**Counts.** **23 live** enforceable criteria · **1 retired** (`AC-EXR-11`, non-normative) · **24**
table rows · **21** distinct base identifiers `AC-EXR-01`–`21`, of which `AC-EXR-17` is split four
ways into `17a`–`17d`. Only the 23 live criteria are mapped in the traceability matrix; `AC-EXR-11`
is referenced by no task and no scenario, which is asserted rather than assumed.

**`AC-EXR-11` is deliberately retired, not renumbered.** Renumbering would break the sixteen existing
citations, and `RULE-16` — *identifiers are corpus-wide and never re-mean* — forbids reusing the
number for something else.

## Assumptions

- **Governance policy classes are EPIC-030's**, read as configuration. This Epic records what was
  adjudicated, never how the decision was reached.
- **Evidence storage is EPIC-032's.** This Epic links to evidence; it does not own the store.
- **Agent descriptors and capability negotiation are EPIC-028's.** This Epic freezes an identity
  snapshot for history and does not select agents.
- **Unattended-run semantics remain EPIC-023's.** A run may contain executions; the concepts are
  linked, not merged.
- **The first delivery is the thin foundation** — registration, immutable events, completion,
  target/version binding, status proposal, comments, evidence linking, with the fixture connector.
  Additional connectors and advanced reconciliation follow by dependency and priority.
- **Retention follows `EPIC-004`'s settled policy** — indefinite, erasure by redaction only — rather
  than introducing a second scheme.
- **This Epic requires no destructive migration.** It is additive: new tables only. `Run` and
  `AuditEntry` are untouched apart from one optional nullable reference each. No existing table
  carries execution semantics, and overloading `Run` would conflate two concepts and break
  `EPIC-023`'s contract *(clarified 2026-08-25)*.

## Dependencies

| Depends on | For | Direction |
|---|---|---|
| **EPIC-028** Agent & Execution Seam | Agent descriptors, capability negotiation, adapter conformance | EPIC-037 consumes |
| **EPIC-030** Governed Engineering Loop | Transition adjudication, approval and separation-of-duties policy | EPIC-037 consumes |
| **EPIC-032** Evidence Store | Evidence records this Epic links to | EPIC-037 consumes |
| **EPIC-004** Workspace Tenancy & Audit | Audit retention and immutability rules | EPIC-037 consumes |
| **EPIC-024** Artifact Access Control | Authorisation scope for registration and history | EPIC-037 consumes |
| **EPIC-023** Unattended Runs | Optional association between a run and its executions | EPIC-037 links |
| **EPIC-031** Decision Inbox | Renders proposals awaiting approval | consumes EPIC-037 |
| **EPIC-033** Requirement Room | Renders execution history on a requirement | consumes EPIC-037 |
| **EPIC-036** Application Shell | Home activity panel | consumes EPIC-037 |
| **EPIC-039** Integration Hub | Generalises the connector pattern this Epic establishes | consumes EPIC-037 |

## Out of Scope

- Any user interface. Screens belong to EPIC-031, EPIC-033 and EPIC-036.
- Adjudication logic, policy authoring, or approval routing rules — EPIC-030.
- Agent selection, capability negotiation, sandbox provisioning — EPIC-028.
- Evidence storage, formats and compliance verdicts — EPIC-032.
- Metrics, dashboards and DORA derivation — EPIC-040.
- Context retrieval over execution history — EPIC-038.
- Becoming, replacing or embedding an IDE. PMI Studio records what editors do; it is not one.
