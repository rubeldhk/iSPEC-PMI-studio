# Feature Specification: PMI Integration Contract

**Feature Branch**: `epic/043-pmi-integration-contract`

**Epic**: `EPIC-043` — PMI Integration Contract: MCP Server and Mounted Registry

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "PMI Integration Contract — deliver the MCP binding of the EPIC-037
execution contract as a stdio server `pmi-studio`, add the read tools a local agent needs (project
context, requirements, constitution, decomposition) and the sync tools (artifacts, tasks), and
mount the EPIC-037 REST surface behind connector-token authentication, closing `DEF-037-001` and
`ADR-0010`." *(PMI-DOC-007 §7, verbatim)*

> **This is the second Epic of the local-first replan** (`D-47`, PMI-DOC-007 v1.0) and the one
> that reaches milestone **M1 — first execution seen**: *create project → open in the agent →
> `/speckit-specify` → the execution appears in PMI Studio*. `EPIC-041` gave a project a directory
> on the user's machine and a credential that opens exactly that project. `EPIC-037` specified one
> semantic contract for governed execution with REST, MCP and SDK bindings, built the registry, and
> then **could not mount its REST surface** because nothing could authenticate a non-human caller
> (`DEF-037-001`), and could not ship its MCP binding because the authorisation model was open
> (`ADR-0010`, awaiting `R-AI-014`). The credential is that authentication and that model. This
> Epic binds the contract to it: a `pmi-studio` server the user's agent starts from `.mcp.json`,
> the same operations on `/v1/executions/*` behind the connector guard, the reads a local agent
> needs to begin, and the first screen on which a governed execution from a developer's machine is
> visible.
>
> **Six judgement calls were made in writing this document**, each listed under **Assumptions**
> with the reasoning and the alternative, so that `/speckit-clarify` can confirm or overturn them
> with the requester. No `[NEEDS CLARIFICATION]` marker is used: every call has a defensible
> default and none changes whether the Epic should exist.

## Clarifications

### Session 2026-09-04

Five of the six judgement calls were put to the requester in one round (Constitution X); the
sixth (the Epic list is derived from the requirements' grouping until `EPIC-044` exists) is a
plan-level detail with a reversible default and stands as recorded. **All five recommendations
were accepted.**

- Q: How should a developer's agent get the MCP server program that `.mcp.json` names? → A: **An
  npm package built from this repository, run through the package runner `.mcp.json` names, with
  an environment override that points at a checkout for development.** No copy of platform code
  is placed in the project directory; PMI Studio does not serve the package. *(Confirms Assumption
  1; `FR-PIC-062`.)*
- Q: What should the tools owned by later Epics do until those Epics ship? → A: **Reserved: listed
  in the tool surface with their schemas, arguments validated, and a refusal naming the owning
  Epic.** Neither omitted nor built with placeholder content. *(Confirms Assumption 2;
  `FR-PIC-002`, `FR-PIC-045`.)*
- Q: Should every tool call check the credential against its stored record, or may the server hold
  a short-lived session? → A: **Every call is verified; revocation takes effect on the next call.**
  No session cache, no session token. *(Confirms Assumption 3; `FR-PIC-023`.)*
- Q: Where do people see executions from a developer's machine? → A: **A panel on the project
  screen only.** A workspace-wide executions area is `EPIC-040`'s or `EPIC-044`'s. *(Confirms
  Assumption 4; `FR-PIC-050`.)*
- Q: Which surface does a REST call with a connector credential register? → A: **REST with a
  credential records `local-cli`; the MCP server records `mcp-client`.** The caller never
  declares the surface. *(Confirms Assumption 6; `FR-PIC-025`.)*

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-007_Local_First_Replan_v1.0` | §7 `EPIC-043` brief | every `FR-PIC-` below |
| `SRS/PMI-DOC-007_Local_First_Replan_v1.0` | §4.1 MCP tool surface · §4.2 REST binding · §4.3 why the controller can now be mounted | FR-PIC-001 to FR-PIC-012, FR-PIC-030 to FR-PIC-036, FR-PIC-040 to FR-PIC-045 |
| `SRS/PMI-DOC-007_Local_First_Replan_v1.0` | §2.4 security model · §9.3 `LR-08`, `LR-11` | FR-PIC-020 to FR-PIC-027 |
| `SRS/PMI-DOC-007_Local_First_Replan_v1.0` | §2.2 first-run flow steps 4–5 (`pmi.health`, workstation connected) · §6 workstation status | FR-PIC-046, FR-PIC-050 to FR-PIC-053 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.22 `BR-0196`–`BR-0203` — universal registration, immutable history, version binding, platform-held status, separation of duties, contract not database, strict and provisional, comments | FR-PIC-001, FR-PIC-004, FR-PIC-010, FR-PIC-030 to FR-PIC-034 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.13 `BR-0122` — MCP support · `BR-0124` — least privilege | FR-PIC-001, FR-PIC-002, FR-PIC-022, FR-PIC-023 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.14 `BR-0132` — controlled local connector · `BR-0133` — uniform governance · `BR-0135` — credential isolation | FR-PIC-011, FR-PIC-020, FR-PIC-026 |
| `specs/037-governed-execution-registry/spec.md` · `contracts/execution-contract.md` | `FR-EXR-013`, `FR-EXR-019`, `FR-EXR-020`, `FR-EXR-022`; `AC-EXR-01`–`04`; the seven MCP tools | FR-PIC-001 to FR-PIC-012, FR-PIC-027 |
| `specs/037-governed-execution-registry/research.md` | `R-037-10` — the fixture connector is the conformance oracle | FR-PIC-003, SC-PIC-001 |
| `specs/041-local-project-workspace/spec.md` | `FR-LPW-025`, `FR-LPW-026`, `FR-LPW-034` — the credential, its scope, the assurance | FR-PIC-020 to FR-PIC-025 |
| `.specify/memory/constitution.md` | XII — Execution Registration | FR-PIC-010, FR-PIC-030 to FR-PIC-034 |
| `adr/ADR-0010` · `adr/ADR-0030` | MCP architecture (open on `R-AI-014`) · local-first execution and the integration contract | FR-PIC-002, FR-PIC-060, FR-PIC-061 |

**Requirements not yet covered by SRS**: none by document — every requirement traces to
PMI-DOC-007, which lives in `SRS/`. **Two carry provisional identifiers** (`LR-08`, `LR-11`) that
receive `BR-` numbers only in PMI-DOC-004 v2.1; the back-fill is owed by the Project Owner before
the platform release gate and is restated under Assumptions (the `D-46` pattern, as `EPIC-041`).

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | The contract this Epic binds was specified in `EPIC-037` before any transport existed; this document precedes the server |
| PP-002 | Single Source of Truth | Satisfied | `FR-PIC-010` — one semantic contract, two bindings; neither transport holds logic the other lacks |
| PP-003 | Human-in-the-Loop | Satisfied | `FR-PIC-033` — the agent proposes a transition over MCP; a human approves in PMI Studio; no tool applies one |
| PP-004 | End-to-End Traceability | Satisfied | Every tool call that mutates is an execution event with actor, correlation and idempotency (`FR-PIC-004`, `FR-PIC-030`) |
| PP-005 | Modular Architecture | Satisfied | The server is a transport over `ExecutionRegistryFacade` and the read services; it holds no business rule (`FR-PIC-011`, `PC-1`) |
| PP-006 | Engine Independence | Satisfied | The server knows a project, a credential and the contract; it names no engine and no agent (`FR-PIC-012`) |
| PP-007 | API & MCP First | Satisfied | This Epic **is** the MCP binding, with REST parity asserted (`FR-PIC-010`); the one screen calls the same reads |
| PP-008 | Security by Design | Satisfied | `FR-PIC-020`–`FR-PIC-027`: bearer credential resolved to a connector principal server-side, one project, one refusal, no credential in any argument or result, mutation-tested |
| PP-009 | Quality by Design | Satisfied | The fixture conformance suite runs against the server (`FR-PIC-003`); `SC-PIC-003` and `SC-PIC-004` are mutation-tested |
| PP-010 | Observability by Default | Satisfied | `FR-PIC-046` — `pmi.health` records the workstation as connected with versions; every call carries a correlation id. Discharges `EPIC-041`'s `PP-010` partial |
| PP-011 | Documentation as Code | Satisfied | The tool surface is a contract document checked by a conformance test (`FR-PIC-005`) |
| PP-012 | Everything Versioned | Satisfied | The server declares the contract version it speaks and refuses a client that names another (`FR-PIC-006`) |
| PP-013 | Knowledge-Driven Engineering | Not applicable | No retrieval or knowledge concern in this Epic |
| PP-014 | Configuration over Customization | Satisfied | Platform address and credential come from the project's `.mcp.json` and the environment; nothing is baked in (`FR-PIC-007`) |
| PP-015 | Open Standards | Satisfied | Stdio MCP as the agent ecosystems document it; REST unchanged from `EPIC-037` |
| PP-016 | Explainable AI | Not applicable | No AI decision is made here |
| PP-017 | Cost-Aware AI | Not applicable | No AI execution is initiated here |
| PP-018 | Scalability First | Satisfied | One server process per agent session, stateless between calls; the registry's gapless sequence is per execution (`EPIC-037`) |
| PP-019 | Continuous Improvement (DORA/SPACE) | Deferred | Execution counts and durations from local surfaces are inputs to `EPIC-040` Metrics & Reporting (held); no metric is derived here |
| PP-020 | Customer Value | Satisfied | `SC-PIC-005` — milestone `M1`: the first governed execution from a developer's own machine is visible in PMI Studio |

**Deferral count**: 1 — `PP-019`, owner `EPIC-040` (held per PMI-DOC-007 §9.4), reviewed at this
Epic's convergence gate.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A governed command from my machine appears in PMI Studio (Priority: P1)

As a developer, my agent opens the project directory `EPIC-041` prepared, starts the `pmi-studio`
server from `.mcp.json` with the credential I set in my environment, and — when a governed command
runs — registers the execution, reports its progress, and completes it over MCP. In PMI Studio, the
project's execution timeline shows that execution: registered, its events, its completion, its
requested transition awaiting a human.

**Why this priority**: this is milestone `M1`. Every objective of the replan that follows —
one spec per Epic, the journey board, synced artifacts, the task board — is a *consequence* of an
execution being recorded from the user's machine. Until this story holds, PMI Studio cannot see
any work the user's own agent does.

**Independent Test**: start the server against a provisioned project with a valid credential;
drive `pmi.execution.register` → `appendEvent` → `complete` with a status proposal from an MCP
client (the fixture connector's conformance sequence); open the project screen and read the
timeline entry with its events; the proposal is shown as awaiting approval, not applied.

**Acceptance Scenarios**:

1. **Given** a provisioned project, its credential in the environment and the server listed in
   `.mcp.json`, **When** the agent lists tools, **Then** it sees exactly the documented tool
   surface, each with a schema, and `pmi.health` answers with the project id, the contract version
   and the API version — and PMI Studio records the workstation as connected.
2. **Given** the server, **When** the agent calls `pmi.execution.register` with an idempotency key,
   a command, its input binding and a correlation id, **Then** an execution exists in PMI Studio
   with surface `mcp-client`, assurance `local`, the connector principal as its initiator and the
   sponsoring owner as its sponsor — and the response carries the execution id and sequence `1`.
3. **Given** a registered execution, **When** the agent appends `progress-reported` events and
   then calls `pmi.execution.complete` with outcome, artifact digests, a completion comment and a
   requested transition, **Then** the events are sequenced without a gap, the completion is
   terminal for lifecycle, and the transition is recorded as **proposed** — never applied.
4. **Given** that execution, **When** a signed-in member opens the project screen, **Then** the
   timeline lists it newest-first with command, surface, assurance, state, initiator and time, and
   expanding it shows every event in sequence and the pending proposal.
5. **Given** a completed execution, **When** the agent calls `pmi.execution.history`, **Then** it
   receives the same event sequence a REST caller receives for the same execution.

---

### User Story 2 - A wrong credential opens nothing and learns nothing (Priority: P1)

As the platform, I refuse a call whose credential is revoked, unknown, or minted for another
project — with one identical refusal that discloses nothing about any project — and I never accept
an identity the caller asserts in a request body.

**Why this priority**: mounting the `EPIC-037` REST surface is exactly what `DEF-037-001`
forbade until a caller could be authenticated. The moment a route answers a bearer credential,
the refusal path is the security boundary of the whole local-first product (`BR-0135`,
`FR-LPW-025`). It ships with the transport, not after it.

**Independent Test**: with the composed application, present no credential, a revoked one, a
malformed one and one minted for project B against project A's tools and routes; every case is
the same refusal; the same calls with project A's credential succeed; then remove the
project-scope check and observe the suite fail (`SC-PIC-004`).

**Acceptance Scenarios**:

1. **Given** any MCP tool or mounted route, **When** it is called with no credential, a malformed
   credential, a revoked credential or a credential for another project, **Then** the refusal is
   identical in shape, code and message across the four — it names neither the project nor the
   reason a credential is unacceptable — and the call performs nothing.
2. **Given** a credential revoked in PMI Studio a moment ago, **When** the very next tool call
   arrives, **Then** it is refused: revocation is a stored fact read on every call, not a cached
   session.
3. **Given** a registration request whose body names a principal, sponsor or delegation, **When**
   it arrives over REST or MCP, **Then** the body's identity is ignored or refused — the
   execution's initiator is derived from the credential alone.
4. **Given** a credential that is valid for the project, **When** it calls an operation outside
   the connector's scope (any Room read, any approval, any workspace administration), **Then** it
   is refused with a forbidden refusal that names the scope required and nothing else.
5. **Given** the mounted routes, **When** the architecture test that once asserted *unmounted*
   runs, **Then** it asserts *mounted behind the connector guard* and fails if the guard is
   removed from any route.

---

### User Story 3 - A retried registration is the same registration (Priority: P2)

As an agent on a flaky network, I replay `pmi.execution.register` with the same idempotency key
and receive the original execution — not a second one — and a replay with the same key but a
different payload or a different credential is refused as a conflict.

**Why this priority**: a duplicate execution corrupts every downstream gate that counts them;
`EPIC-037` already enforces this in the registry (`FR-EXR-009`). This story asserts the MCP
binding preserves it end to end, which is cheaper than any repair and is why it is P2 and not
polish.

**Independent Test**: register twice with one key and one payload → one execution, identical
response; register with one key and two payloads → the second refused as a conflict, no new
execution, no sequence consumed.

**Acceptance Scenarios**:

1. **Given** a registration accepted with key `K`, **When** the identical registration is replayed
   with `K`, **Then** the response is the original execution, byte-for-byte in its identifying
   fields, and no second execution exists.
2. **Given** key `K` used once, **When** a registration with `K` and a different command, target or
   binding arrives, **Then** it is refused as a conflict and the original is untouched.
3. **Given** key `K` used by credential A, **When** credential B (another credential for the same
   project) replays it, **Then** it is refused as a conflict — the key is compared on content
   **and** emitting principal.

---

### User Story 4 - My agent can read what it needs to begin (Priority: P2)

As an agent starting work in a provisioned directory, I read the project's context — its id,
name, agent integration, extension version and Epic list — and its requirements grouped by Epic
with baseline state, so that the first `/speckit-specify` starts from PMI Studio's requirements
and not from a blank page.

**Why this priority**: `EPIC-042`'s first-run decomposition consumes these reads; without them the
extension has nothing to decompose. They are P2 because `M1` is visible without them, and P2 rather
than P3 because `EPIC-042` cannot start until they exist.

**Independent Test**: against a project with requirements assigned to Epics and some unassigned,
call `pmi.project.context` and `pmi.requirements.list`; the context names the project and every
Epic; the requirements come grouped with the unassigned ones visible as such; the same reads over
REST return the same content.

**Acceptance Scenarios**:

1. **Given** a provisioned project, **When** `pmi.project.context` is called, **Then** it returns
   the project id, name, agent integration, script type, extension version, contract version, the
   platform's public address and the Epic list (number, slug, name) — and nothing from any other
   project.
2. **Given** requirements in the project, **When** `pmi.requirements.list` is called, **Then** each
   requirement appears once, under its Epic or under *unassigned*, with reference, description,
   type, priority and baseline state.
3. **Given** the reserved tools `pmi.constitution.get` and `pmi.project.decompose`, **When** either
   is called before `EPIC-042` ships their content, **Then** the refusal names the Epic that
   provides it — the tool exists in the surface, and its absence of content is a fact, not an
   error the agent must guess at.

---

### User Story 5 - I can see that a developer's machine is connected (Priority: P3)

As a project owner, I see on the project screen when a workstation last spoke to PMI Studio for
this project, with which extension version and toolkit version, so that *nothing is arriving* is
distinguishable from *nobody is connected*.

**Why this priority**: it is the observability half of the replan's first-run flow (PMI-DOC-007
§2.2 step 4) and what `EPIC-042`'s setup skill reports into. It is P3 because it changes no
governed outcome; it explains one.

**Independent Test**: call `pmi.health` from a workstation; the project screen shows *connected*
with time and versions; revoke the credential; the record remains, marked with the revoked
credential; a second credential's health call creates a second record.

**Acceptance Scenarios**:

1. **Given** a credential, **When** `pmi.health` is called, **Then** a workstation connection
   record for that project and credential is created or updated with last-seen time, extension
   version, toolkit version and contract version.
2. **Given** connection records, **When** the project screen is opened, **Then** the Local
   workspace panel shows the most recent connection per credential, or *no workstation has
   connected yet*.

---

### Edge Cases

- **The credential is set but empty** (`PMI_STUDIO_TOKEN=`). The server starts, every tool
  answers the one refusal, and `pmi.health` says the credential is absent — the setup skill's
  check reads that reason from `structuredContent`.
- **The platform address in `.mcp.json` is unreachable.** The server starts (stdio is the agent's
  transport, not the platform's) and every tool returns `isError: true` with a `platform_unreachable`
  reason; nothing is retried silently. Provisional operation is `EPIC-042`'s (`BR-0202`).
- **Two agents, one credential, one project.** Both are the same connector principal; their
  executions are distinct by idempotency key and correlation id; a replay across them is a replay.
- **A tool call carries something that looks like a credential** (`pmi_ct_…`, an API key shape)
  in an argument, a comment or an artifact digest field. It is refused at intake (`FR-EXR-022`
  unchanged) and the refusal does not echo the value.
- **The contract version the client names is not the one the server speaks.** Refused by name
  with both versions; no tool runs.
- **A completion arrives for an execution already terminal.** Refused: lifecycle after terminal
  is forbidden (`FR-EXR-018`); a comment on it is accepted.
- **The MCP client sends the credential as a tool argument instead of the environment.** Refused;
  the argument is named in the refusal, its value is not.
- **The credential is revoked mid-execution.** Every later call from it is refused; the execution
  stays registered and non-terminal until a person or a later valid credential completes it, and
  the timeline shows it as such.

## Requirements *(mandatory)*

### Functional Requirements

**The server and its surface**

- **FR-PIC-001**: The platform MUST provide the MCP binding of the `EPIC-037` execution contract as
  a stdio server named `pmi-studio`, startable by an agent from a project's `.mcp.json` as
  `EPIC-041` writes it, exposing **exactly** the seven execution tools `EPIC-037` names
  (`register`, `appendEvent`, `complete`, `comment`, `proposeStatus`, `history`, `sync`) with
  unchanged semantics (`BR-0122`, `LR-08`).
- **FR-PIC-002**: The server MUST additionally expose `pmi.health`, `pmi.project.context` and
  `pmi.requirements.list`, and MUST reserve `pmi.constitution.get`, `pmi.project.decompose`,
  `pmi.artifacts.sync` and `pmi.tasks.sync` as named tools whose refusal states the Epic that
  supplies them (`EPIC-042`, `EPIC-045`, `EPIC-046`) until it does.
- **FR-PIC-003**: The fixture connector conformance suite (`R-037-10`) MUST run against the MCP
  server through a real MCP client and pass without modification of its expectations.
- **FR-PIC-004**: Every mutating tool MUST require an idempotency key and a correlation id, and
  MUST record the call as the corresponding execution event with the connector principal as actor.
- **FR-PIC-005**: The tool surface — names, argument schemas, result schemas, refusal codes — MUST
  be a contract document under this Epic, checked by an executable conformance test against the
  running server's tool list.
- **FR-PIC-006**: The server MUST declare the contract version it speaks; a client naming another
  MUST be refused by name before any tool runs.
- **FR-PIC-007**: The server MUST take the platform address and the credential from the project's
  `.mcp.json` and the environment (`${PMI_STUDIO_TOKEN}`) and from nowhere else; it MUST NOT read
  any other file under the project directory.

**Parity and placement**

- **FR-PIC-010**: The REST and MCP bindings MUST be semantically equivalent for every operation
  (`AC-EXR-01`–`04`, `FR-EXR-020`): the same request produces the same execution, events, sequence
  numbers, refusals and history through either binding, asserted by a parity test that drives
  both against one registry.
- **FR-PIC-011**: The server MUST be a transport over the platform's existing services and
  facades; it MUST hold no business rule, no lifecycle policy and no state between calls
  (`FR-EXR-019`, `PC-1`).
- **FR-PIC-012**: The server MUST name no engine, no agent product and no provider; the agent
  integration is data read from the project (`PP-006`).

**Authentication, authorisation and refusal**

- **FR-PIC-020**: Every tool call and every mounted route MUST authenticate a connector credential
  presented as a bearer credential, resolve it server-side to the `connector` principal `EPIC-041`
  minted, and derive the acting project from the credential — never from the request (`BR-0135`,
  `FR-LPW-025`).
- **FR-PIC-021**: A missing, malformed, unknown, revoked or other-project credential MUST receive
  one identical refusal that discloses neither the reason nor any project's existence, and MUST
  perform nothing.
- **FR-PIC-022**: A credential MUST authorise only the operations this Epic binds — the seven
  execution tools, `pmi.health`, `pmi.project.context`, `pmi.requirements.list` — through the
  connector scope registry; any other operation is a forbidden refusal naming the scope required
  (`BR-0124`, `FR-LPW-026`).
- **FR-PIC-023**: Revocation MUST take effect on the next call: the credential is verified against
  its stored record on every call, never cached for a session.
- **FR-PIC-024**: No mounted route and no tool MAY accept an identity assertion from a request body
  (`authenticatedPrincipalId`, `sponsorUserId`, delegation fields); the initiator and sponsor MUST
  be derived from the credential's principal and its sponsoring owner.
- **FR-PIC-025**: Every execution registered through the server MUST carry surface `mcp-client`,
  and every one registered through the mounted REST routes with a connector credential surface
  `local-cli`; assurance MUST be derived from the surface and never supplied (`FR-LPW-034`, `LR-11`).
- **FR-PIC-026**: No tool MAY accept or return credential material in any argument, result, comment
  or refusal; recognisable credential shapes MUST be refused at intake without being echoed
  (`FR-EXR-022`).
- **FR-PIC-027**: Every refusal MUST be returned as `isError: true` with `structuredContent`
  carrying a stable code, so the setup skill and the extension can act on it without parsing prose.

**The mounted registry**

- **FR-PIC-030**: The `EPIC-037` REST surface (`/v1/executions/*`) MUST be mounted in the composed
  application behind the connector guard, closing `DEF-037-001` by the mechanism its record names.
- **FR-PIC-031**: The architecture check that asserted the controller *unmounted* MUST be replaced
  by one that asserts it is *mounted behind the connector guard on every route* and fails when
  the guard is removed from any route.
- **FR-PIC-032**: History reads through the mounted surface MUST be scoped to the credential's
  project; the workspace and execution named in a path MUST be verified against it, never trusted.
- **FR-PIC-033**: No mounted route and no tool MAY apply, approve or patch a transition; proposals
  are recorded and a human approves in PMI Studio (`BR-0199`, `BR-0200`, Constitution XII.5–6).
- **FR-PIC-034**: `pmi.execution.sync` MUST accept a provisional execution's events for
  reconciliation exactly as `EPIC-037` specifies (`BR-0202`); producing provisional records is
  `EPIC-042`'s.
- **FR-PIC-035**: The session-authenticated read of a project's execution timeline MUST be
  available to workspace members through the platform API for the screen in `FR-PIC-050`,
  scoped by workspace and project as every product endpoint is.
- **FR-PIC-036**: Every mounted route and every tool MUST write its audit entry naming the
  connector principal, the project, the operation and the outcome (`EPIC-004`).

**The reads**

- **FR-PIC-040**: `pmi.project.context` MUST return the project id, name, agent integration,
  script type, provisioning state, extension version, contract version, the platform's public
  address and the Epic list (number, slug, name), and the same content MUST be available at
  `GET /v1/projects/{id}/context` to a connector credential.
- **FR-PIC-041**: `pmi.requirements.list` MUST return the project's requirements grouped by Epic,
  each once, with reference, description, type, priority and baseline state, unassigned ones
  visible as such, and the same content at `GET /v1/projects/{id}/requirements?groupBy=epic`.
- **FR-PIC-042**: The reads MUST return nothing from any other project, asserted by a
  cross-project test.
- **FR-PIC-043**: Where the product has no Epic entity yet (`EPIC-044`), the Epic list MUST be
  derived from the requirements' existing grouping field and MUST state that derivation in the
  response, so `EPIC-044` replaces the source without changing the shape.
- **FR-PIC-044**: `pmi.health` MUST confirm the credential opens the project and return the
  project id, the contract version and the API version.
- **FR-PIC-045**: The reserved tools MUST validate their arguments against their published
  schemas even while refusing, so a client written against the contract is not surprised when
  the content arrives.
- **FR-PIC-046**: `pmi.health` MUST record a workstation connection for the project and credential
  — last-seen time, extension version, toolkit version, contract version — creating or updating
  one record per credential.

**The execution timeline screen**

- **FR-PIC-050**: The project screen MUST show the project's execution timeline: every execution
  newest-first with command, surface, assurance, state, initiator, sponsor and registration time,
  in the four states `FR-SHL-060` requires.
- **FR-PIC-051**: Expanding an execution MUST show its events in sequence with type, actor and
  time, and any proposal with its state (proposed, approved, refused) and who decided.
- **FR-PIC-052**: The timeline MUST be filterable by surface, state and initiator (`PMI-DOC-005`).
- **FR-PIC-053**: The Local workspace panel MUST show the most recent workstation connection per
  credential from `FR-PIC-046`, or that none has connected yet.
- **FR-PIC-054**: The timeline MUST offer no control that applies or approves a transition; where
  approval belongs (`EPIC-030`), the screen states where.

**Closure of the open records**

- **FR-PIC-060**: `ADR-0010` MUST be closed as delivered, with `R-AI-014` resolved as
  *project-scoped connector credentials, least privilege by the connector scope registry*, at the
  plan step.
- **FR-PIC-061**: `DEF-037-001` MUST be annotated closed-by-mounting with the test that proves it,
  and `ADR-0030` MUST record the integration contract as bound.
- **FR-PIC-062**: The MCP server MUST be the package `.mcp.json` names (`EPIC-041`,
  `PMI_MCP_SERVER_VERSION`), runnable from this repository and published as that package before
  promotion out of `local`; until publication a documented override MUST let a checkout supply it.

### Key Entities

- **MCP server session**: one `pmi-studio` process started by an agent for one project directory;
  holds the platform address and the credential reference; keeps no state between calls.
- **Tool call**: one invocation of a named tool with schema-validated arguments, a correlation id
  and — when mutating — an idempotency key; produces a result or a structured refusal.
- **Connector principal context**: what the credential resolves to on every call — the `connector`
  principal, its sponsoring owner, the one project, the scopes registered for the route or tool.
- **Execution timeline entry**: the projection of one execution and its event sequence as the
  project screen shows it; derived from `EPIC-037`'s records, never stored separately.
- **Workstation connection**: the record `pmi.health` creates or updates — project, credential,
  last-seen time, extension version, toolkit version, contract version.
- **Contract document**: the published tool surface and refusal codes this Epic owns, checked
  against the running server.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-PIC-001**: **100%** of the fixture connector conformance suite passes against the MCP server
  through a real client, with zero expectations changed.
- **SC-PIC-002**: **Zero** semantic differences between the REST and MCP bindings across
  `AC-EXR-01`–`04`: the same registrations, events, sequences, refusals and history from both.
- **SC-PIC-003**: **Zero** credential material in any tool argument, result, comment, audit entry or
  refusal — mutation-tested by making a refusal echo the presented credential and observing the
  suite fail.
- **SC-PIC-004**: A credential opens **exactly one** project through every tool and every mounted
  route — mutation-tested by removing the project-scope check from the guard and observing the
  suite fail.
- **SC-PIC-005**: **Milestone M1**: from *create project* through opening the directory in the
  agent to a governed command, the execution appears on the project's timeline within **five
  seconds** of its completion call, on the reference-local stack, recorded as a transcript.
- **SC-PIC-006**: **100%** of replayed registrations with an unchanged key and payload return the
  original; **zero** create a second execution or consume a sequence number.
- **SC-PIC-007**: **100%** of mounted routes and tools refuse an absent, malformed, revoked or
  other-project credential with one identical refusal; **zero** disclose a project's existence.
- **SC-PIC-008**: **100%** of executions registered through the server carry surface `mcp-client`
  and assurance `local`; **zero** accepted an assurance or an identity from the caller.
- **SC-PIC-009**: The replaced architecture check is red when any mounted route loses the guard
  and green otherwise — shown by inversion before closure.

## Assumptions

Six judgement calls, each with the alternative that lost. **Five were put to the requester on
2026-09-04 and all five confirmed**; the fifth (the derived Epic list) was not asked, being
plan-level and reversible, and stands as recorded. The reasoning is kept because it describes the
risk each confirmation accepts.

1. **The server is an npm package in this repository, run by the agent through the package runner
   `.mcp.json` names, with a checkout override for development** (`FR-PIC-062`) — **confirmed**. `EPIC-041` already
   writes `@pmi/mcp-server@<PMI_MCP_SERVER_VERSION>` into `.mcp.json`; this Epic makes that name
   true. The alternative — copying the server into every project directory at provisioning — needs
   no registry but puts a second copy of platform code on every machine, which `PP-002` and the
   toolkit-drift finding in `EPIC-041` argue against. Publication itself is a release act and is a
   promotion condition, not a task.
2. **`pmi.constitution.get` and `pmi.project.decompose` are reserved, not built** — **confirmed** (`FR-PIC-002`,
   `FR-PIC-045`). Their content is `EPIC-042`'s model (constraints, decomposition policy); building
   them here would either invent that model or return placeholders that look like content. A named
   refusal is honest and lets `EPIC-042` fill the tool without changing the surface. The
   alternative — omit them entirely — leaves a client unable to distinguish *not yet* from *never*.
3. **The credential is verified on every call** (`FR-PIC-023`) — **confirmed**. A session cache would make
   revocation eventual; `FR-LPW-023` says immediate. The cost is one digest lookup per call,
   measured against `EPIC-041`'s 0.024 ms verification. The alternative — a short-lived session
   token minted from the credential — is a second credential model and was rejected for the same
   reason expiry was in `EPIC-041`.
4. **The execution timeline is a panel of the project screen, not a new area** (`FR-PIC-050`) — **confirmed**.
   PMI-DOC-007 §7 names *the execution timeline* as the one screen in scope and §6 places
   execution visibility on the project; a new navigation area is `EPIC-044`'s board. The
   alternative — a workspace-wide executions area — is useful and deferred to `EPIC-040`/`044`.
5. **The Epic list is derived from the requirements' grouping until `EPIC-044` exists**
   (`FR-PIC-043`) — **not asked; stands as recorded**. `EPIC-044` makes Epic a product entity; this Epic cannot wait for it and must not
   invent it. Returning the derivation with the data is what lets `EPIC-044` swap the source. The
   alternative — return no Epic list — leaves `EPIC-042`'s decomposition nothing to decompose
   into.
6. **Mounted REST routes with a connector credential register surface `local-cli`; the server
   registers `mcp-client`** (`FR-PIC-025`) — **confirmed**. Both are `BR-0132` surfaces and both derive assurance
   `local`; the distinction is kept because `AC-EXR-02` and `AC-EXR-03` test them separately. The
   alternative — one surface for both — loses information the parity test needs.

**Provisional identifiers**: `LR-08` and `LR-11` (PMI-DOC-007 §9.3) receive `BR-` numbers only in
PMI-DOC-004 v2.1; the back-fill is owed by the Project Owner before the platform release gate.

**Dependencies**: `EPIC-041` complete on its branch (credential, guard, scope registry, assurance
write, `.mcp.json`); `EPIC-037`'s registry and fixture connector; `EPIC-028`'s principal registry.
**Out of scope**: adjudication and approval of proposals (`EPIC-030`); evidence storage
(`EPIC-032`); the extension, hooks, setup skill and provisional-mode production (`EPIC-042`);
artifact and task sync content (`EPIC-045`, `EPIC-046`); any screen other than the timeline and
the connection panel; third-party MCP server registration and marketplace (`ADR-0010`'s M-09
half).

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test — or, for document/configuration outputs, a
      passing executable conformance check (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/043-pmi-integration-contract/defects/` contains no open defect records
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
- [ ] A closing report was published: work completed, work deferred, and the recommended next task
      named as a concrete Spec Kit command (Constitution IX)
- [ ] **`SC-PIC-001` holds**: the fixture conformance suite is green against the MCP server through
      a real client, unchanged
- [ ] **`SC-PIC-003` and `SC-PIC-004` are mutation-tested** and the suite observed failing under each
      mutation
- [ ] **`FR-PIC-031` holds**: the *mounted behind the guard* architecture check is green, and was
      observed red by inversion
- [ ] **Constitution XI Tier 2**: a transcript of User Story 1 and User Story 2 against the running
      application is recorded (`SC-PIC-005`, `SC-PIC-007`)
- [ ] `ADR-0010` is closed and `DEF-037-001` annotated at the plan step (`FR-PIC-060`, `FR-PIC-061`)
- [ ] The server package is published under the name `.mcp.json` carries, or the override is
      documented for the environment being promoted to (`FR-PIC-062`)
