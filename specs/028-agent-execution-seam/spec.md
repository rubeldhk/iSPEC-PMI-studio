# Feature Specification: Agent & Execution Seam

**Feature Branch**: `028-agent-execution-seam`

**Epic**: `EPIC-028` — Agent & Execution Seam

**Module**: M-08 Specification Engine (execution half)

**Created**: 2026-08-13

**Status**: Draft — ready for clarification

**Delivery posture**: ▶ **PROCEEDING** (decision D-10). Every requirement below sits in the engine
lane. Nothing here touches product surface, and nothing waits on `PMI-DOC-004`.

**Parent design**: [`_shared/platform-spec.md`](../_shared/platform-spec.md) ·
[`_shared/ai-native-architecture.md`](../_shared/ai-native-architecture.md)

**Input**: EPIC-027's reconciliation of the four `SRS/August112026/` amendment documents, and the
three decisions taken on 2026-08-13 that gate it — `D-20`, `D-21`, `D-28`.

## Why this epic exists

**EPIC-003 delivered a specification engine that cannot run.** Its closure report says so plainly:
*"The Spec Kit engine cannot run. Its logic is complete and conformant, but `ContainerRuntime` has no
production implementation, so nothing can start a container."* `T447` was named as the single next
task standing between a tested adapter and a working engine.

EPIC-027's reassessment then found that writing `T447` the obvious way — a Docker driver behind the
existing port — would bake in two couplings the amendment forbids, on the one component nobody can
test without Docker. It also found a third coupling **already in the tree**.

This epic closes all three and ends at the first real generation run in the programme's history.

| Coupling | Evidence | Amendment source |
|---|---|---|
| **Agent = engine** | `speckit.adapter.ts` names `claude` at lines 133, 144, 172, 178, 201 and takes one `aiProviderToken`. Swapping the AI provider and swapping the specification engine are the same edit | Native §3 — *"Do NOT merge SpecificationEngine and AgentExecutor"* |
| **Docker = the abstraction** | `ContainerRuntime` has no lifecycle, egress policy, credential scope or provider descriptor | Native §4 — *"business logic must not depend directly on Docker"* |
| **One egress list for every purpose** | `ADR-0002`: *"AI provider endpoint only"*, asserted by test. An implementation agent cannot reach a package registry, so it cannot run a build | Native §19 — re-evaluate, but *"do NOT simply open general internet access"* |

**The three are one slice, not three.** They land in the same files, and none of them is verifiable
until a container actually starts. Splitting them across epics would mean three convergence gates on
work that cannot be proven separately.

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/August112026/Native Spec-Kit Execution Environment & AI Agent Integration Architecture.docx` | §2 — engine independence extended to AI agents; agent abstraction | FR-AGT-001 to FR-AGT-004 |
| ″ | §3 — SpecificationEngine and AgentExecutor must not merge | FR-AGT-001, FR-AGT-005 |
| ″ | §4 — `ProjectExecutionEnvironment` abstraction; Docker as Phase 1 provider | FR-AGT-006 to FR-AGT-009 |
| ″ | §7 — agent descriptors, capability negotiation, execution records | FR-AGT-002, FR-AGT-003, FR-AGT-012 |
| ″ | §19 — sandbox security; explicit `EgressPolicy` abstraction | FR-AGT-010, FR-AGT-011 |
| ″ | §26 — research items `R-AI-001`, `R-AI-002`, `R-AI-005`, `R-AI-008`, `R-AI-009` | Assumptions |
| ″ | §28 — sixteen preserved elements; change requires the five-field record | FR-AGT-013 |
| ″ | §30 — no AI provider or sandbox provider may become the architectural authority | FR-AGT-004, FR-AGT-009 |
| `SRS/August112026/PMI Studio Plan Amendment.docx` | §6 — AI/Agent abstraction layer; capability negotiation before assignment | FR-AGT-002, FR-AGT-003 |
| `_shared/ai-native-architecture.md` | §A.3, §A.4, §A.6, §C.2 — the three couplings and the dependency rules that close them | all |
| `specs/srs-alignment.md` Part 8 | `C-19`, `C-20`, `C-22`; decisions `D-20`, `D-21`, `D-28`, `D-36` | all |
| `adr/ADR-0001` | Contract + architecture test + fixture — the pattern this epic replicates | FR-AGT-004, FR-AGT-005 |
| `adr/ADR-0002` | Container sandbox; **extended, not superseded** | FR-AGT-010, FR-AGT-013 |

**Requirements not yet covered by SRS**: none.

## Principle Conformance — deltas *(PMI-DOC-003, decision D-6)*

| Principle | Status in this epic |
|---|---|
| PP-006 Engine Independence | ✅ **Extended to a second axis.** The amendment generalises the rule to AI providers; this epic makes that mechanical rather than aspirational. `ADR-0001` is preserved, not superseded |
| PP-008 Security by Design | ⚠️ **Two controls change.** Egress becomes profile-based and credentials become per-run refs. Both are widenings of a tested control and both carry the §28 five-field record (`FR-AGT-013`) |
| PP-015 Open Standards / no lock-in | ✅ **Strengthened.** Three substrates become swappable where one was hard-coded: engine, agent, execution environment |
| PP-017 Cost-Aware AI | 🔶 Containment half only, unchanged. Optimisation stays deferred to M-07. Agent descriptors carry cost metadata so M-07 can attribute retrospectively without a backfill |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The AI provider can be changed without touching the engine (Priority: P1)

An operator registers a different agent adapter, and specification generation runs unchanged with
the new provider recorded as its producer.

**Why this priority**: it is the amendment's most-repeated architectural instruction, and the
violation exists in the tree today.

**Independent Test**: run one engine-agnostic caller against two agent adapters and confirm identical
result shape, identical failure classification, and distinct provenance — the `V11` pattern EPIC-003
already proved for engines.

**Acceptance Scenarios**:

1. **Given** two registered agent adapters, **When** a generation runs against each, **Then** both
   produce the same result shape and record different provider and model provenance.
2. **Given** a file under `backend/src` or an engine adapter naming a provider identifier, **When**
   the architecture suite runs, **Then** the build fails, naming the file and the identifier.
3. **Given** an agent adapter declaring fewer capabilities than a request needs, **When** assignment
   is attempted, **Then** it is refused, naming the missing capability.
4. **Given** an agent request expressing a provider preference that is unavailable, **When** it is
   assigned, **Then** it succeeds with an available agent — the preference is never load-bearing.

---

### User Story 2 - A specification is generated by a real container, end to end (Priority: P1)

A generation job starts a real container, runs the engine inside it, and writes a specification —
the first time in the programme's history.

**Why this priority**: every claim EPIC-003 makes about the real engine is currently proven by mocks.
`T447` is the last unexecuted piece of *"Spec Kit is Engine V1"*.

**Independent Test**: quickstart `V13` — the scenario that has never run.

**Acceptance Scenarios**:

1. **Given** a registered Docker provider, **When** a generation job runs, **Then** a container
   starts, the five invocation steps execute in order, and a specification is written.
2. **Given** the run completes, **When** the environment is inspected, **Then** it has been destroyed
   and no workspace remains.
3. **Given** a run is cancelled while the container is live, **When** it terminates, **Then** it
   reports `cancelled` — never `timeout` — and the container is destroyed.
4. **Given** a step hangs past the wall clock, **When** the limit is reached, **Then** the adapter
   self-terminates rather than waiting.

---

### User Story 3 - Execution substrate and egress are policy, not code (Priority: P1)

The execution provider and the network policy are chosen by configuration and registration, not by
editing business logic.

**Why this priority**: `D-31` commits the product to multi-tenant SaaS, where the second provider is
near-certainly Kubernetes and the sandbox host is shared between tenants. Both make the seam
load-bearing rather than tidy.

**Acceptance Scenarios**:

1. **Given** any component outside the composition root, **When** the architecture suite runs,
   **Then** the build fails if it reaches a container runtime directly.
2. **Given** the `generation` egress profile, **When** its policy is asserted, **Then** it is
   byte-for-byte what `ADR-0002` specified — the existing control and its test are unchanged.
3. **Given** the `implementation` profile, **When** it is inspected, **Then** every destination is
   explicitly enumerated; a wildcard or general-internet rule fails the check.
4. **Given** a workspace binding, **When** it is persistent, **Then** it names a branch — there is no
   binding that is persistent and unnamed.

### Edge Cases

- **The agent CLI is absent from the image** — refused before a container starts, with a named
  reason, so a doomed run is never billed (the `E7` pattern).
- **An already-aborted signal arrives** — must report `cancelled`. This defect has shipped once in
  this repository and was caught only by a conformance suite.
- **Two adapters claim the same provider identifier** — registration is refused.
- **The Docker daemon is unreachable** — `engine_unavailable`, distinguished from a wiring defect,
  which was a real EPIC-003 defect.
- **An egress profile names a destination the provider cannot enforce** — refused at registration
  rather than silently unenforced.
- **A credential ref cannot be resolved at run start** — the run fails before the container starts;
  a partially credentialed sandbox never exists.

## Requirements *(mandatory)*

> **Identifier scheme**: `FR-AGT-###` / `SC-AGT-###`, namespaced per conflict **C-01**.

### Functional Requirements

#### The agent seam *(decision D-20)*

- **FR-AGT-001**: An `AgentGateway` contract MUST exist in its own package, separate from
  `SpecificationEngine`. The two MUST NOT be merged.
- **FR-AGT-002**: An agent MUST be described by a descriptor carrying provider, model, execution
  type, capabilities, context limits, tool capabilities, MCP support, repository capabilities, cost
  metadata, security classification and unattended support.
- **FR-AGT-003**: Capability negotiation MUST occur **before** assignment. An agent lacking a
  requested capability MUST be refused, naming the missing capability.
- **FR-AGT-004**: No file under `backend/src` and no engine adapter may name a concrete AI provider.
  This MUST be enforced by an architecture test that fails the build.
- **FR-AGT-005**: A fixture agent adapter MUST ship with the contract, and the conformance suite MUST
  run against every registered adapter. It MUST include the already-aborted-signal case and the
  hung-step case.

#### The execution seam *(decision D-21)*

- **FR-AGT-006**: A `ProjectExecutionEnvironment` contract MUST replace the direct container runtime,
  carrying lifecycle, provider descriptor, egress profile, credential scope and resource limits.
- **FR-AGT-007**: A Docker provider MUST implement it and MUST be the Phase 1 default.
- **FR-AGT-008**: A workspace binding MUST be either ephemeral with a scratch path, or persistent
  with a project reference, a mode and a **named branch**. No other form may exist.
- **FR-AGT-009**: No component outside the worker composition root may reach a container runtime
  directly. Enforced by architecture test.

#### Egress and credentials *(decisions D-28, D-27)*

- **FR-AGT-010**: Egress MUST be expressed as named profiles. The `generation` profile MUST remain
  byte-for-byte what `ADR-0002` specifies, with its existing test unchanged.
- **FR-AGT-011**: The `implementation` profile MUST enumerate every permitted destination
  explicitly. A wildcard or general-internet rule MUST fail validation.
- **FR-AGT-012**: Every agent execution MUST record provider, model, agent version where available,
  execution id, correlation id, timestamps, status and cost metadata where available. Prompts and
  model output MUST NOT appear in operational logs (PC-3).

#### Compatibility *(Native §28)*

- **FR-AGT-013**: Each change to a preserved element — `ContainerRuntime`, Docker isolation, the
  sandbox credential model — MUST record the reason, affected requirement, migration impact,
  compatibility impact and alternative considered.

### Key Entities

- **AgentDescriptor** · **AgentRegistration** · **AgentExecutionRequest** — mirroring the built
  `EngineDescriptor` / `EngineRegistration` shapes rather than inventing new ones.
- **ExecutionEnvironmentDescriptor** · **ExecutionRequest** · **WorkspaceBinding** (discriminated
  union) · **EgressProfile** · **ScopedCredentialRef**.

## Success Criteria *(mandatory)*

- **SC-AGT-001**: A specification is generated by a real container, end to end, with evidence — the
  first such run in the programme.
- **SC-AGT-002**: Two agent adapters produce identical result shape and failure classification, and
  distinct provenance.
- **SC-AGT-003**: Zero provider identifiers appear under `backend/src` or in any engine adapter;
  asserted by a test that fails the build.
- **SC-AGT-004**: Zero components reach a container runtime outside the composition root; asserted.
- **SC-AGT-005**: The `generation` egress profile is unchanged from `ADR-0002`, and its existing test
  passes unmodified.
- **SC-AGT-006**: The `implementation` profile contains zero wildcard destinations.
- **SC-AGT-007**: Cancellation is never reported as timeout, and a hung step self-terminates at the
  wall clock — both proven by conformance cases, not by inspection.
- **SC-AGT-008**: Every preserved-element change carries all five §28 fields.

## Assumptions

- **`T447`, `T448` and `T449` are routed here with their identifiers preserved**, following the
  `D-19` precedent (`T340`→023, `T377`→024, `T391`→025). EPIC-003 stays closed; its closure report
  already records all three as deferred with named owners.
- **`R-AI-001`, `R-AI-002` and `R-AI-005` are uninvestigated and gate the *real* Claude and Cursor
  adapters, not this epic.** The contract is provider-neutral by construction. This epic ships the
  contract, the fixture agent, and a Claude adapter no more capable than what `speckit.adapter.ts`
  already does — which is known to work only as far as mocks prove.
- **`ADR-0002` is extended, not superseded** (`D-36`). Every control it asserts still applies to the
  case it was written for.
- **Proxy-based egress enforcement is the target** (`D-28`) but the concrete destination list is open
  (`R-AI-009`). The `implementation` profile may ship with a deliberately minimal list.
- **Persistent workspace bindings are specified here and exercised by EPIC-029.** This epic defines
  the type; it does not build the persistence.
- **Prisma is still not a dependency** (EPIC-004 `T013`), so any new persisted registration follows
  the `T463` precedent — a narrow delegate with Prisma's own shape.

## Dependencies

- **Depends on**: nothing. `D-20`, `D-21` and `D-28` were taken on 2026-08-13.
- **Depended on by**: **EPIC-029** (persistent project state) needs `WorkspaceBinding`; the BYOK work
  (`D-41`) needs `ScopedCredentialRef`; every future agent-executed capability needs `AgentGateway`.
- **Supersedes routing in**: EPIC-027 `plan.md` D.1, which provisionally split this work between
  "EPIC-003 re-entry" and a narrower EPIC-028. One slice, one gate.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

- [ ] Every implementation task has a passing unit test, written to fail first
- [ ] A real container has started and produced a specification (`SC-AGT-001`) — **not a mock**
- [ ] Quickstart `V13` executed and recorded
- [ ] The engine-swap scenario passes for agents as it does for engines (`SC-AGT-002`)
- [ ] Three architecture suites pass: engine, transport, **agent** (`SC-AGT-003`, `SC-AGT-004`)
- [ ] The `generation` egress test passes **unmodified** (`SC-AGT-005`)
- [ ] The conformance suite has been mutation-tested — a deliberately broken adapter turns it red
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/028-agent-execution-seam/defects/` contains no open defect records
- [ ] A closing report was published (Constitution IX)
- [ ] Epic closure recorded in `closure.md`
