# Tasks: Governed Execution Registry

**Epic**: `EPIC-037` | **Branch**: `037-governed-execution-registry` | **Date**: 2026-08-25

**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/](./contracts/) · [quickstart.md](./quickstart.md)

**Tasks**: 64 (T1018–T1081)

> **Identifier block `T1018`–`T1081`.** Four-digit identifiers, legal since `EPIC-026`
> `FR-ESK-025`. `T441n` once called the three-digit exhaustion *"a blocker on EPIC-037, not a
> warning"* — this Epic is the first to allocate a block above it.

**Delivery posture**: Phases 1–5 are the **thin foundation** the project owner authorised for step C.
Phases 6–8 are the remaining connectors and advanced reconciliation, sequenced after Requirement
Room slices S1 and S4 per the approved A–G order.

---

## Phase 1: Setup

- [X] T1018 Create `packages/execution-registry-contract/` mirroring `packages/engine-contract`'s layout — `package.json`, `tsconfig.json`, `src/index.ts`, `tests/` — and register it in the workspace and `vitest.workspace.ts` as project `execution-contract`
- [X] T1019 [P] Add `backend/src/modules/executions/` and its test directories under `backend/tests/{unit,contract,integration}/executions/`
- [X] T1020 [P] Create `specs/037-governed-execution-registry/defects/` with `.gitkeep` (Constitution VI — the sole defect intake for this Epic)

## Phase 2: Foundational — blocking prerequisites

**Nothing in Phase 3+ can be built before these.** The contract package and the immutability
enforcement are what every later task depends on.

- [X] T1021 Write failing contract tests for the semantic operation surface in `packages/execution-registry-contract/tests/contract-shape.spec.ts` — seven operations, their refusal conditions, and the rule that **no operation mutates** (unit test: itself; conformance for T1022)
- [X] T1022 Define the provider-neutral semantic contract in `packages/execution-registry-contract/src/contract.ts` per `contracts/execution-contract.md` §1 — `register`, `appendEvent`, `complete`, `comment`, `proposeStatus`, `history`, `sync` (unit test: T1021). **No transport type and no data-access import may appear in this package**
- [X] T1023 [P] Define the 29-event vocabulary as a discriminated union in `packages/execution-registry-contract/src/events.ts` per `contracts/event-vocabulary.md`, with the four classes and the terminal-lifecycle set named once (unit test: T1024)
- [X] T1024 [P] Write failing unit tests in `packages/execution-registry-contract/tests/events.spec.ts` asserting every event has exactly one class, the nine lifecycle events are the only terminality-bearing ones, and the three withdrawn names (`validation-completed`, `status-proposed`, `reconciled`) are **absent** — reintroducing an ambiguous name is the regression this guards
- [X] T1025 Write the failing migration test in `backend/tests/integration/executions/immutability.spec.ts` asserting, **separately for each immutable table**, that (a) `UPDATE` is rejected, (b) `DELETE` is rejected, each raising `'% is append-only'`; and that (c) a correction is representable **only** as a new superseding row and (d) a redaction **only** as a new event plus a state flag — never as an in-place edit (conformance: T1026). **Observe all four failing before `T1026` attaches the triggers**: the `reject_mutation()` FUNCTION exists, but **no EPIC-037 table is protected until a trigger is bound to it**
- [X] T1080 [P] Write the failing test in `backend/tests/integration/executions/immutability.spec.ts` asserting the **application database role cannot bypass immutability** — it holds no `BYPASSRLS`, is not the table owner, is not `SUPERUSER`, and cannot `ALTER TABLE … DISABLE TRIGGER`. A protection the application can switch off is a convention, not a control (conformance: T1026)
- [X] T1026 Additive migration in `backend/prisma/migrations/` creating the ten tables of `data-model.md` §2 and **attaching a trigger to each immutable table** — `CREATE TRIGGER execution_events_immutable BEFORE UPDATE OR DELETE ON "execution_events" FOR EACH ROW EXECUTE FUNCTION reject_mutation();` and the same for `execution_comments` — plus `audit_entries.executionId` and the `runs` inverse relation (integration test: T1025, T1080). **The function is reused; the triggers are new.** Reusing `reject_mutation()` avoids a second mechanism for one meaning, and grants the new tables **nothing** until these statements run. **No column dropped, renamed or retyped; no data moved** (`R-037-6`)
- [X] T1081 Implement transactional event append in `backend/src/modules/executions/execution-event.service.ts` — **sequence allocation and event insert occur in one transaction**, so two concurrent appends cannot both read the same next sequence and one must lose on the `UNIQUE (executionId, sequence)` constraint rather than silently overwrite (integration test: T1046). Allocation outside the transaction is the classic read-modify-write race and would make the gapless guarantee decorative
- [X] T1027 [P] Write the failing architecture test in `backend/tests/architecture/connector-isolation.spec.ts` asserting no file under `packages/execution-registry-contract/` or any connector path imports a store, a Prisma client or a `backend/src` module (conformance for `FR-EXR-019`; the mechanism that keeps `FR-AGT-004` honest today)
- [X] T1028 Ship the fixture connector in `packages/execution-registry-contract/src/fixture-connector.ts` — the conformance oracle every other connector is measured against (`R-037-10`) (unit test: T1029)
- [X] T1029 [P] Write failing unit tests for the fixture connector in `packages/execution-registry-contract/tests/fixture-connector.spec.ts`, driving all seven operations with no server present

**Checkpoint**: the contract compiles, the tables refuse mutation, and no connector can reach data
access. Phase 3 may begin.

## Phase 3: User Story 1 — A governed command is recorded wherever it runs (P1)

**Goal**: register, run and complete one execution, with full input and output binding.

**Independent test**: `V37-1` — the fixture connector round-trips one execution and its history reads
back complete.

- [X] T1030 [P] [US1] Write failing contract tests for registration refusal conditions in `backend/tests/contract/executions/registration.spec.ts` — missing input version identity, unsupported contract version, unauthorised scope (covers T1032)
- [X] T1031 [P] [US1] Write failing contract tests for phase-aware binding in `backend/tests/contract/executions/version-binding.spec.ts` per `V37-2` — **including `AC-EXR-17b`, that requiring `commitAfter` at registration is itself a defect** (covers T1033)
- [X] T1032 [US1] Implement registration in `backend/src/modules/executions/execution-registration.service.ts` — root identity, correlation and idempotency keys, contract-version negotiation, `registered` event (contract test: T1030)
- [X] T1033 [US1] Implement phase-aware target binding in `backend/src/modules/executions/execution-registration.service.ts` — input required at registration, output required at successful completion, absent output legitimate on failure or cancellation (contract test: T1031)
- [X] T1034 [P] [US1] Write failing unit tests for the frozen agent identity snapshot in `backend/tests/unit/executions/agent-identity.spec.ts` — renaming a descriptor afterwards must not alter history (`AC-EXR-14`) (covers T1035)
- [X] T1035 [US1] Implement the agent identity snapshot, referencing EPIC-028's descriptor and freezing provider, model, adapter, version and capabilities (unit test: T1034)
- [X] T1036 [US1] Implement completion in `backend/src/modules/executions/execution-registration.service.ts` — terminal event with outcome, artifacts, evidence references, validation results and a **mandatory** completion comment; an empty completion is a failed completion (contract test: T1037)
- [X] T1037 [P] [US1] Write failing contract tests for completion in `backend/tests/contract/executions/completion.spec.ts` — each of the six terminal outcomes, and refusal of a success with no output binding
- [X] T1038 [US1] Expose the REST binding in `backend/src/modules/executions/executions.controller.ts` per `contracts/execution-contract.md` §2 — **no `PATCH` route may exist** (integration test: T1039)
- [X] T1039 [US1] Write the failing Constitution XI Tier 1 test in `backend/tests/integration/executions/round-trip.spec.ts` driving `V37-1` through the **real HTTP route against the composed module graph**, with the real composition root — a mocked collaborator does not satisfy this tier
- [X] T1040 [P] [US1] Write failing integration tests for idempotency in `backend/tests/integration/executions/sequence.spec.ts` per `V37-3` — replay returns the original, concurrent replays yield exactly one (covers T1041)
- [X] T1041 [US1] Implement idempotency and correlation — `UNIQUE (workspaceId, idempotencyKey)` per `R-037-8`, replay returning the original record (integration test: T1040)
- [X] T1042 [P] [US1] Write failing unit tests for argument sanitisation in `backend/tests/unit/executions/sanitisation.spec.ts` — a connection string in arguments never reaches storage or any response (`AC-EXR-10`) (covers T1043)
- [X] T1043 [US1] Implement argument sanitisation and credential refusal in the registration path (unit test: T1042)

**Checkpoint**: `V37-1`, `V37-2`, `V37-3` pass. One execution round-trips end to end.

## Phase 4: User Story 2 — History is append-only and survives its own execution (P1)

**Goal**: the event stream is authoritative, terminality binds lifecycle only, and comments and
redaction preserve the chain.

**Independent test**: `V37-4`, `V37-8`, `V37-9`.

- [X] T1044 [P] [US2] Write failing contract tests for terminality in `backend/tests/integration/executions/sequence.spec.ts` per `V37-4` — governance, content and reconciliation events **accepted** after a terminal lifecycle event; any lifecycle event **refused** (`AC-EXR-18`, `AC-EXR-19`) (covers T1045)
- [X] T1045 [US2] Implement event append with class-aware terminality in `backend/src/modules/executions/execution-event.service.ts` (contract test: T1044)
- [X] T1046 [P] [US2] Write failing integration tests for sequence allocation and optimistic concurrency in `backend/tests/integration/executions/sequence.spec.ts` per `V37-8` — gapless server sequence, `expectedSequence` mismatch refused with the current value, a gap reported as a reconciliation fault (`AC-EXR-13`) (covers T1047, T1048)
- [X] T1047 [US2] Implement server-side gapless sequence allocation with `expectedSequence` optimistic concurrency (`R-037-3`) (integration test: T1046)
- [X] T1048 [US2] Implement the rebuildable projection in `backend/src/modules/executions/execution-projection.service.ts`, carrying `projectedThroughSequence` so staleness is visible (integration test: T1046). **Replay must reproduce stored state exactly** (`AC-EXR-12`)
- [X] T1049 [P] [US2] Write failing unit tests for the comment model in `backend/tests/unit/executions/comments.spec.ts` — append-only, threaded, typed, access-scoped; a correction is a superseding comment, never an edit (covers T1050)
- [X] T1050 [US2] Implement comments in `backend/src/modules/executions/execution-comment.service.ts` with the full field set of `data-model.md` §2 (unit test: T1049)
- [X] T1051 [P] [US2] Write failing contract tests for redaction in `backend/tests/contract/executions/redaction.spec.ts` per `V37-9` — body concealed, tombstone recorded, integrity chain verifies before and after, **no hard-delete path reachable** (`AC-EXR-15`) (covers T1052)
- [X] T1052 [US2] Implement redaction per `R-037-9` — immutable `comment-redacted` event, original retained under a named compliance role with each access audited; cryptographic erasure only where law compels (contract test: T1051)
- [X] T1053 [P] [US2] Write failing integration tests for re-run linkage in `backend/tests/integration/executions/rerun.spec.ts` — a re-run creates a new linked execution and the parent stream is byte-identical afterwards (`AC-EXR-09`) (covers T1054)
- [X] T1054 [US2] Implement re-run linkage via `parentExecutionId`; a terminal execution is never reopened (integration test: T1053)

**Checkpoint**: `V37-4`, `V37-8`, `V37-9` pass. History cannot be rewritten.

## Phase 5: User Story 3 — The platform decides status, not the agent (P1)

**Goal**: proposals in, verdicts out, adjudicated by EPIC-030 and recorded only as events.

**Independent test**: `V37-5`.

- [X] T1055 [P] [US3] Write failing contract tests for proposal immutability in `backend/tests/contract/executions/proposals.spec.ts` — the proposal row carries **no adjudication field**, and every verdict arrives as a governance event (`R-037-5`) (covers T1056)
- [X] T1056 [US3] Implement `status-proposal.service.ts` recording immutable proposals and projecting `status_transition_state` from governance events (contract test: T1055)
- [X] T1057 [P] [US3] Write failing integration tests for status authority in `backend/tests/integration/executions/status-authority.spec.ts` per `V37-5` — connector applying a transition **refused** (`AC-EXR-16`); a passed validation routed to approval **not applied** (`AC-EXR-20`); AI self-approval **refused with a recorded reason** (`AC-EXR-08`) (covers T1058, T1059)
- [X] T1058 [US3] Wire proposal intake to EPIC-030 through the **single** exported token `PROPOSAL_ADJUDICATOR` — **consume, never re-implement**. This Epic must NOT import or resolve EPIC-030's individual ports (`ADJUDICATION_GATE_OUTCOMES`, `ADJUDICATION_AUTHORITY_POLICY`, `ADJUDICATION_LIFECYCLE_VALIDATION`, `ADJUDICATION_LIFECYCLE_APPLICATION`, `ADJUDICATION_INTAKE_AUTHORIZATION`, `ADJUDICATION_RECORDS`), which are deliberately unexported: a consumer that could reach them could assemble its own adjudicator over its own gate provider, which is the bypass `FR-GEL-073` forbids. Record the proposal and the returned verdict as events; **validation is never application**. *(tests: `backend/tests/integration/executions/status-authority.spec.ts`, plus `backend/tests/architecture/` asserting this Epic imports no EPIC-030 internals)*
- [X] T1059 [US3] Implement the refusal path for a connector attempting to apply a transition directly, recorded as a contract violation (integration test: T1057)

**Checkpoint**: `V37-5` passes. The thin foundation is complete — **step C's exit condition**.

## Phase 6: User Story 4 — Work continues when the control plane is unreachable (P2)

**Independent test**: `V37-6`, `V37-7`.

- [ ] T1060 [P] [US4] Write failing integration tests for offline modes in `backend/tests/integration/executions/offline.spec.ts` per `V37-6` — strict blocks, permitted goes provisional with `execution-sync-queued`, and the execution is presented as **not yet governed** (covers T1061, T1062)
- [ ] T1061 [US4] Implement the connector-side durable outbox in `packages/execution-registry-contract/src/outbox.ts`, preserving `localSequence` and original `occurredAt` (unit test: T1060)
- [ ] T1062 [US4] Implement provisional registration and the `provisional → pending_sync → governed` machine, derived from `class='registration'` events — **`pending_sync` is never a mutable flag** (integration test: T1060)
- [ ] T1063 [P] [US4] Write failing integration tests for reconciliation in `backend/tests/integration/executions/reconcile.spec.ts` per `V37-7` — causal order preserved, original timestamps retained, conflicts **returned for a human and never auto-resolved** (`AC-EXR-21`) (covers T1064)
- [ ] T1064 [US4] Implement `reconciliation.service.ts` — ordered replay, authoritative sequence assignment, `originalLocalSequence` retention, explicit conflict reporting (integration test: T1063)
- [ ] T1065 [US4] Implement the strict-governance block path: the command is refused and **no execution record is created** (integration test: T1060)

## Phase 7: User Story 5 — Execution history queries (P3)

**Independent test**: history for one artifact, authorisation-filtered.

- [ ] T1066 [P] [US5] Write failing integration tests for history queries in `backend/tests/integration/executions/history.spec.ts` — ordered, bounded, paginated, and disclosing nothing about an artifact the caller may not read (covers T1067)
- [ ] T1067 [US5] Implement authorisation-filtered history queries consuming EPIC-024's access scope (integration test: T1066)

## Phase 8: Connector bindings and parity

- [ ] T1068 [P] Write failing contract tests for MCP bindings in `packages/execution-registry-contract/tests/mcp-binding.spec.ts` — `inputSchema` and `outputSchema` present, `structuredContent` returned, and **refusals as `isError: true` rather than JSON-RPC errors** (`R-037-7`) (covers T1069)
- [ ] T1069 Implement the MCP binding for the seven operations (contract test: T1068)
- [ ] T1070 [P] Implement the connector SDK binding and its conformance suite, run against the fixture connector (unit test: T1029)
- [ ] T1071 [P] Implement the managed-sandbox connector, consuming EPIC-028's execution environment
- [ ] T1072 [P] Implement the local CLI connector under `BR-0132` — the controlled developer-machine surface
- [ ] T1073 [P] Implement the CI/CD connector
- [ ] T1074 Write the failing surface-parity test in `backend/tests/integration/executions/surface-parity.spec.ts` per `V37-10` — **semantic equivalence, not byte identity** (`AC-EXR-01`–`04`) (covers T1069, T1070, T1071, T1072, T1073)

## Phase N: Polish & Cross-Cutting

- [ ] T1075 [P] Confirm audit retention integration — execution events follow EPIC-004's indefinite, redaction-only policy rather than a parallel scheme (`FR-EXR-021`)
- [ ] T1076 [P] Run the five mutation checks in `quickstart.md` and record each **observed failing** before its guard was in place

## Phase Z: Epic Closure (MANDATORY — Constitution IV, VI, VII, IX, XI, XII)

- [ ] T1077 Confirm every implementation task has a passing test, and every configuration or document task a conformance check **observed failing first** (Constitution V); record in `closure.md`
- [ ] T1078 **Constitution XI Tier 1** — every user-facing capability driven through its real entry point against the composed module graph. **Tier 2 not applicable**: this Epic delivers no user-facing journey; its screens belong to EPIC-031/033/036. Record which applies rather than deleting the task
- [ ] T1079 Run `/speckit-converge`; triage `defects/`; confirm principle deltas and deferral owners (PP-010, PP-013, PP-018, PP-019); publish the closing report

---

## Implementation stop boundary

*Added at C1 closure. `/speckit-implement` **must not** run unrestricted across this file — the
approved A–G sequence requires only the thin foundation before Requirement Room S1 and S4.*

| Band | Task IDs | Count | Authorised? |
|---|---|---|---|
| **A. Thin foundation** — the next authorisation request | `T1018`–`T1059`, plus `T1080`, `T1081` | **44** | **Awaiting authorisation** |
| **B. Requirement Room S1** — reachable read path | *(none in this Epic)* | 0 | Not yet |
| **C. Requirement Room S4** — execution-history integration | `T1066`, `T1067` | 2 | Not yet |
| **D. Offline and reconciliation** | `T1060`–`T1065` | 6 | Not yet |
| **E. Connectors and parity** | `T1068`–`T1074` | 7 | Not yet |
| **F. Polish and closure** | `T1075`–`T1079` | 5 | Not yet |

**Band B is empty, and that is the finding.** Requirement Room S1 is a *reachable read path* owned by
**EPIC-033** — intent captured, listed, opened, baseline visible. It consumes nothing from this
Epic. S1 can therefore begin the moment band A lands, in parallel with nothing here. **S4** is where
EPIC-033 first reads execution history, and it needs bands A and C.

### Is band A the smallest usable foundation?

**Yes, and each of the three P1 stories earns its place** — verified against what S4 actually
requires, not assumed:

| Story | Tasks | Why S4 cannot proceed without it |
|---|---|---|
| **US1** register / complete / bind | `T1030`–`T1043` | Without registration there is no execution to show on a requirement |
| **US2** append-only history | `T1044`–`T1054` | S4 shows *history*; a mutable record would make the Room display something that can be rewritten behind it |
| **US3** status authority | `T1055`–`T1059` | S4 shows each command's **status**. Without proposal intake an agent's outcome has nowhere to go, and the Room would display executions with no lifecycle meaning |

Dropping US3 would leave a Room that lists commands and cannot say what they did to the
specification — less than S4 specifies. **Band A is minimal, not conservative.**

### Band A introduces no UI

Every path touched is `packages/execution-registry-contract/`, `backend/src/modules/executions/`,
`backend/prisma/migrations/`, `backend/tests/**` or `tests/architecture/`. **No file under
`frontend/`**, and no area is added to the shell registry. Screens remain owned by EPIC-031
(Decision Inbox), EPIC-033 (Requirement Room) and EPIC-036 (Home activity panel), each consuming
this Epic through the dependency table rather than being built by it.

### Exit condition for band A

The fixture connector round-trips **one** execution end to end: registered → started → completed,
with input binding at registration and output binding at completion, an append-only stream that
refuses mutation at the database, a proposal recorded and adjudicated by EPIC-030, and a mandatory
completion comment. Scenarios `V37-1`–`V37-5`, `V37-8`, `V37-9` green; `V37-6`, `V37-7`, `V37-10`
belong to later bands and must **not** be reported as passing.

## Traceability matrix

*Added by `/speckit-analyze` 2026-08-25, finding `A2`. Twenty of twenty-two requirements were
reachable only through an acceptance criterion or a scenario id, never by requirement identifier —
so `grep FR-EXR-012 tasks.md` returned nothing and the requirement looked unowned. Constitution II
and III both turn on a requirement being traceable to the work that discharges it.*

| Requirement | Tasks | Acceptance | Scenario |
|---|---|---|---|
| `FR-EXR-001` registration | T1030, T1032, T1034, T1035 | AC-EXR-14 | V37-1 |
| `FR-EXR-002` immutable events | T1025, T1026, T1044, T1045 | AC-EXR-19 | V37-4 |
| `FR-EXR-003` derived projection | T1046, T1048 | AC-EXR-12 | V37-8 |
| `FR-EXR-004` input binding | T1031, T1033 | AC-EXR-17a | V37-2 |
| `FR-EXR-005` output binding | T1031, T1033, T1037 | AC-EXR-17b, 17c, 17d | V37-2 |
| `FR-EXR-006` proposal not application | T1055, T1056, T1059 | AC-EXR-16, 20 | V37-5 |
| `FR-EXR-007` no AI self-approval | T1057, T1058 | AC-EXR-08 | V37-5 |
| `FR-EXR-008` identity and authorisation | T1030, T1032, T1067 | — | V37-1 |
| `FR-EXR-009` idempotency | T1040, T1041 | AC-EXR-05 | V37-3 |
| `FR-EXR-010` strict / provisional | T1060, T1062, T1065 | AC-EXR-06, 07 | V37-6 |
| `FR-EXR-011` not-yet-governed | T1060, T1062 | AC-EXR-07 | V37-6 |
| `FR-EXR-012` reconciliation | T1063, T1064 | AC-EXR-21 | V37-7 |
| `FR-EXR-013` no privileged surface | T1068–T1074 | AC-EXR-01–04 | V37-10 |
| `FR-EXR-014` completion | T1036, T1037 | — | V37-1 |
| `FR-EXR-015` comments and redaction | T1049–T1052 | AC-EXR-15 | V37-9 |
| `FR-EXR-016` history queries | T1066, T1067 | — | — |
| `FR-EXR-017` sequence and concurrency | T1046, T1047 | AC-EXR-13 | V37-8 |
| `FR-EXR-018` terminality and re-run | T1044, T1045, T1053, T1054 | AC-EXR-09, 18, 19 | V37-4 |
| `FR-EXR-019` no direct data access | T1027, T1072 | AC-EXR-03 | — |
| `FR-EXR-020` one contract, three bindings | T1021, T1022, T1068–T1070, T1074 | AC-EXR-01–04 | V37-10 |
| `FR-EXR-021` audit retention | T1075 | — | — |
| `FR-EXR-022` sanitisation | T1042, T1043 | AC-EXR-10 | V37-9 |

**Success criteria**: `SC-EXR-001`→V37-1 · `002`→V37-10 · `003`→V37-6 · `004`→V37-8 · `005`,
`006`→V37-5 · `007`→V37-3 · `008`→V37-9 · `009`→V37-7.

**`SC-EXR-010` is deliberately unowned by this Epic's tasks.** *"A person can answer what has been
run against this artifact from one screen"* is a **screen** outcome, and screens belong to EPIC-031,
EPIC-033 and EPIC-036 under the Step C1 boundary. This Epic delivers the query those screens read
(`FR-EXR-016`, T1066–T1067) and no more. Recorded here rather than deleted, so the criterion keeps a
visible owner instead of quietly disappearing from the corpus.

## Dependencies

```text
Phase 1 (setup)
   └─► Phase 2 (contract + immutability + fixture)   ← blocks everything
          ├─► Phase 3 (US1 register/complete/bind)
          │      └─► Phase 4 (US2 append-only history)
          │             └─► Phase 5 (US3 status authority)   ← THIN FOUNDATION ENDS
          │                    ├─► Phase 6 (US4 offline)
          │                    ├─► Phase 7 (US5 history queries)
          │                    └─► Phase 8 (connectors + parity)
          └─► Phase N ─► Phase Z
```

**Cross-epic dependencies, consumed and never duplicated**: EPIC-028 (agent descriptors, execution
environment) · EPIC-030 (adjudication, approval policy) · EPIC-032 (evidence) · EPIC-024
(authorisation scope) · EPIC-004 (audit retention) · EPIC-023 (run association).

## Parallel opportunities

- **Phase 2**: T1023/T1024 (events) alongside T1027 (architecture test) — different files.
- **Phase 3**: all four test tasks (T1030, T1031, T1034, T1037, T1040, T1042) can be written together
  before any implementation, which is the TDD order this Epic requires.
- **Phase 8**: T1070–T1073, four connectors in different packages, once the MCP binding shape is
  settled.

## Implementation strategy

**MVP is Phases 1–5** — the thin foundation the project owner authorised. Its exit condition is a
single execution round-tripping through the fixture connector with append-only history and
platform-adjudicated status. **Requirement Room S1 and S4 follow before Phases 6–8**, per the
approved A–G delivery order; building every connector first would repeat the mistake this whole
remediation corrected — internal completeness ahead of user-reachable product.


## Dependency corrections *(applied 2026-08-27, Step C3A §1)*

*Applied before implementation, per the C3A instruction. Band A did not begin — see the identity
preflight in the C3A report.*

**Adjudication (§1D).** `PROPOSAL_ADJUDICATOR` is the only EPIC-030 token this Epic may resolve.

**Application policy (§1E).** `applied` requires an **effective explicit** application policy.
With no policy the verdict is `validated`, not `applied` — and `validated` is not application.
Authorisation (EPIC-024), gates and the mandatory human decision (EPIC-021), authority and
separation of duties all run **before** any policy is consulted; the policy decides only whether an
already-permissible transition applies automatically.

**Governed artifact ownership (§1F).** Every specification this Epic references or creates must
already hold, or atomically receive, a durable human owner/editor grant. Since C2E an artifact with
**zero grants is inaccessible, not unrestricted** — so an execution targeting an ungranted
specification is refused by EPIC-024 before adjudication is reached. `T1081`'s end-to-end proof must
use a specification created through the production service **with** its owner grant, never a row
inserted directly into PostgreSQL.

## Identity dependency corrections *(applied 2026-08-27, Step C3B §8)*

*EPIC-037 was **not** implemented. These record what its future registration must bind, now that the
identity model exists.*

**Eight concepts, never collapsed into `actorId`.** A future execution registration binds each
separately, because collapsing any two is how a connector ends up able to approve its own work:

| Bound field | What it is |
|---|---|
| authenticated principal id | who is acting, resolved server-side |
| proposer snapshot id | the frozen identity that proposed |
| originating agent/service snapshot id | the frozen identity that executed |
| connector registration / snapshot id | the **surface** it arrived through — not an actor |
| sponsoring human reference | the person accountable for the agent |
| delegation reference | the scoped authority relied on |

**A connector is not an agent.** The same agent may act through several, and a connector proposes
nothing on its own. `originatingConnector` in the proposal contract is a surface identifier and MUST
NOT be substituted for the proposer.

**Identity is referenced, never defined.** EPIC-037 records immutable references to identities
EPIC-028 minted and EPIC-024 authorised. It defines no principal, mints no snapshot, and reads
neither epic's tables.

**A non-human principal needs a delegation, not just a grant.** Since C3B a sponsoring human's
ownership does not reach the agents they sponsor. An execution registered against a specification
requires an explicit, unexpired, version-matched delegation carrying `execution.register`; a
proposal requires `transition.propose`. Neither can ever carry approval.
