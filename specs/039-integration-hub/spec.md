# Feature Specification: Integration Hub

**Feature Branch**: `epic/039-integration-hub`

**Epic**: `EPIC-039` — Integration Hub (capability contracts, Capability Resolver, adapter registry)

**Module**: PMI-DOC-004 v2.0 §6.13 · M-16 (`EPIC-027` capability-area register)

**Created**: 2026-08-25 (ownership declared) · **Specified**: 2026-10-09

**Status**: Draft — specified; five clarifications and one screen decision recorded 2026-10-09;
scope amended the same day to add `Embed` as a fifth v1 capability (Clarifications, last bullet)

**Input**: User description: "EPIC-039 Integration Hub — rank 6 of `specs/brs-v2-gap-ranking.md`.
Vendor-neutral capability contracts (`BR-0120`), a policy-aware Capability Resolver (`BR-0121`),
adapter lifecycle metadata (`BR-0123`) and typed external evidence (`BR-0125`), delivered as the
Execution & Integration Plane through replaceable adapters. Depends on `EPIC-043` (done)."

> **This document supersedes the ownership declaration of 2026-08-25**, which carried no
> requirements and named `/speckit-specify` as its exit. The decision boundary it specifies was
> already taken in `ADR-0023` (three layers: capability contracts → Capability Resolver →
> adapters; MCP is a transport at the adapter layer; the public marketplace stays in the Expansion
> Plane). This Epic fixes the v1 vocabulary `ADR-0023` left open, and builds the three layers.
>
> **Ownership.** PMI-DOC-004 v2.0 §6.13 leaves `BR-0120`, `BR-0121`, `BR-0123` and `BR-0125`
> with no owner; this Epic owns them. It **takes over** `BR-0126` (portability), annotated to
> `EPIC-028`, which closed without citing it. `BR-0122` (MCP support) is **consumed** as `EPIC-043`
> delivered it; `BR-0124` (least privilege) is **enforced at resolution** here but stays owned by
> `EPIC-024` and `EPIC-028`. The BRS owner annotations are updated when this Epic is accepted into
> the stage register, not before.
>
> **Local-first boundary** (`D-47`, `ADR-0030`). The developer's own agent keeps using its own
> tools on the developer's machine, and what it does is recorded through `EPIC-043`. The Hub serves
> **platform-side** callers — Rooms, the Governed Engineering Loop and evidence intake — and lists
> the inbound connectors so that every integration surface carries the same lifecycle metadata.

## Clarifications

### Session 2026-10-09

- Q: Which §6.13 requirements should this Epic own, and which should it only use? → A: **Own
  `BR-0120`, `BR-0121`, `BR-0123`, `BR-0125`, and take over `BR-0126` from closed `EPIC-028`.**
  Consume `BR-0122` as `EPIC-043` delivered it; enforce `BR-0124` at resolution while its ownership
  stays with `EPIC-024`/`EPIC-028` (`FR-HUB-060`–`FR-HUB-064`, `FR-HUB-034`).
- Q: Under local-first, who calls a capability — PMI Studio's server-side workflows, or the
  developer's local agent? → A: **Platform-side callers only** (Rooms, Governed Engineering Loop,
  evidence intake). The local agent keeps its own tools, recorded through `EPIC-043`
  (`FR-HUB-004`).
- Q: How does the Hub relate to the `EPIC-037`/`EPIC-043` connectors, given PMI-DOC-007 §9.4 says
  the `pmi-studio` MCP server becomes 039's first registered capability? → A: **One registry, two
  directions.** The adapter registry also lists the inbound connectors — `pmi-studio` first — which
  gain `BR-0123` health, version and audit metadata; their protocols are unchanged. One term per
  concept, fixed in the **Glossary** (`FR-HUB-020`–`FR-HUB-025`).
- Q: Which capabilities and adapters does v1 deliver? → A: **A slice of four** — `ReadBuildStatus`,
  `ReadTestResults` (test-result intake feeding `EPIC-032` evidence), `ReadRepository`,
  `SendNotification` — **each with a fixture adapter and one real vendor adapter**; two adapters per
  capability prove `BR-0126` (`FR-HUB-010`, `FR-HUB-060`). *Amended below: five.*
- Q: Where are outbound adapter credentials stored, and at what scope? → A: **Per project,
  encrypted at rest on the platform, set by the project owner through the API, never exposed to an
  agent**; the resolver grants each adapter only what the requested capability needs
  (`FR-HUB-040`–`FR-HUB-047`).
- Q: What may people do on the Integrations screen? → A: **View only** — adapters, connectors,
  health, version and capabilities; configuration through the API only, following the `EPIC-047`
  precedent (`FR-HUB-070`–`FR-HUB-076`).
- Q *(amends Q4, Project Owner, 2026-10-09)*: Should the v1 slice also own embedding, given that
  `EPIC-038`'s `EmbeddingPort` (`FR-CTX-013`, risk `R-038-1`) has no owner anywhere in the programme
  and context assembly and re-indexing answer `503` in every deployment? → A: **Yes — five
  capabilities.** `Embed` is added so that `EmbeddingPort` has an owner. It follows the same rules
  as the other four: a versioned contract, a deterministic non-semantic fixture adapter and one real
  provider adapter (chosen in `plan.md`, with a local-model option weighed against a hosted one),
  credentials as for every adapter, and an explained refusal when nothing is bound. `EPIC-038`'s
  `T1282` and `T1301` become dischargeable through this Epic (`FR-HUB-010`, `FR-HUB-080`–`FR-HUB-087`,
  `SC-HUB-009`).
- Q: Who owns the `Embed` binding, given `EmbeddingPort` takes no workspace and one model serves
  every workspace's index (analysis finding I1)? → A: **Deployment configuration**, recorded at boot.
  No workspace can change the model other workspaces depend on; v1 needs no `Embed` credential route
  (`FR-HUB-084`). Decided by the Project Owner, 2026-10-09.

## Glossary *(one term per concept — clarified 2026-10-09)*

| Term | Means | Not to be called |
|------|-------|------------------|
| **Capability** | A named, vendor-neutral engineering operation a platform workflow may request, e.g. `ReadBuildStatus`. Defined by a versioned **capability contract** (inputs, outputs, errors, required permission scope) | "integration", "tool", "API" |
| **Adapter** | An **outbound** implementation of one or more capabilities against one provider, over one transport (native API, CLI, MCP server, customer connector) | "connector", "plugin", "integration" |
| **Connector** | An **inbound** surface through which an external caller reaches PMI Studio — the `EPIC-037` bindings and `EPIC-043`'s `pmi-studio` server. Unchanged by this Epic | "adapter" |
| **Registry entry** | One adapter or connector as listed in the registry, with its direction and lifecycle metadata | — |
| **Capability Resolver** | The policy-aware selector that binds one capability request to one eligible adapter, or refuses with an explanation | "router", "dispatcher" |
| **Resolution** | One resolver decision: the request, the adapter chosen (or the refusal), and the reasons | — |
| **Integration Hub** | This Epic's whole: capability contracts, the Capability Resolver and the registry. *"Capability Hub"* (gap ranking) and *"Integration Hub"* name the same thing; this document uses **Integration Hub** | "Capability Hub" |
| **Provider** | The external product an adapter talks to, e.g. a Git host, a CI service, a mail service, an embedding model server | "vendor" (used only in prose about lock-in) |
| **Embedding model** | The model behind an `Embed` adapter, identified by a model id **and** a version that changes whenever its vectors would change. Two models' vectors are never compared | "embedder", "vectoriser" |
| **Deployment scope** | A capability bound once for the whole deployment rather than per project. In v1 only `Embed` is resolved at deployment scope (`FR-HUB-084`) | "global", "platform-wide config" |

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.13 `BR-0120` — Capability contracts | FR-HUB-001 to FR-HUB-016 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.13 `BR-0121` — Capability resolver | FR-HUB-030 to FR-HUB-039 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.13 `BR-0123` — Adapter lifecycle | FR-HUB-020 to FR-HUB-029, FR-HUB-040 to FR-HUB-047 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.13 `BR-0125` — External evidence | FR-HUB-050 to FR-HUB-055 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.13 `BR-0126` — Portability *(taken over from `EPIC-028`)* | FR-HUB-060 to FR-HUB-064 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.13 `BR-0122`, `BR-0124`; §6.14 `BR-0135`; §6.18 `BR-0174` (consumed, not owned) | FR-HUB-013, FR-HUB-034, FR-HUB-036, FR-HUB-044 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.13 `BR-0120` (the `Embed` capability contract); §6.10 `BR-0091` — *"provide or integrate semantic retrieval"*, consumed through `EPIC-038` `FR-CTX-013` | FR-HUB-010, FR-HUB-080 to FR-HUB-087 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §2 `BG-04` — *"second adapter added without business-logic change"* | FR-HUB-060, SC-HUB-001 |
| `SRS/PMI-DOC-004A_V2_Gap_Analysis_and_Amendment_Package_v1.1.md` | `G-14`, `G-15`, Amendment E | FR-HUB-001, FR-HUB-013, FR-HUB-030 |
| `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` | §4 — **Platform › Integrations** area (`U-13`) | FR-HUB-070 to FR-HUB-076 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §9.4 — `EPIC-043`'s server is the first registered entry | FR-HUB-021, FR-HUB-022 |
| `adr/ADR-0023-capability-resolver-integration-hub.md` | Decision — three layers; MCP is a transport | FR-HUB-001, FR-HUB-013, FR-HUB-030 |
| `adr/ADR-0012-agent-credential-isolation.md` | Credentials travel as references, never values | FR-HUB-042, FR-HUB-044 |
| `.specify/memory/constitution.md` | XI — Reachability; XII — Execution Registration | FR-HUB-038, FR-HUB-070 |

**Requirements not yet covered by SRS**: none. The screen requirements (`FR-HUB-070`–`076`) derive
from PMI-DOC-006's area map and the shared shell pattern (`UX-0031`, `UX-0032`, `UX-0040`).

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | Capability contracts are declared before any adapter implements them (`FR-HUB-002`) |
| PP-002 | Single Source of Truth | Satisfied | One registry for both directions (`FR-HUB-020`); external evidence lands in `EPIC-032`'s store, not a second one (`FR-HUB-051`) |
| PP-003 | Human-in-the-Loop | Satisfied | The Hub performs no state-changing capability in v1 except `SendNotification`; nothing it reads applies a transition — completion stays a proposal through `EPIC-037` |
| PP-004 | End-to-End Traceability | Satisfied | Every resolution is recorded with its reasons and, inside an execution, as an event on it (`FR-HUB-037`, `FR-HUB-038`) |
| PP-005 | Modular Architecture | Satisfied | Callers name capabilities; only adapters name providers (`FR-HUB-003`, `FR-HUB-061`) |
| PP-006 | Engine Independence | Satisfied | `BR-0126` is owned here — every v1 capability ships with two interchangeable adapters (`FR-HUB-060`) |
| PP-007 | API & MCP First | Satisfied | Every operation is callable through the API; MCP is a first-class transport at the adapter layer (`FR-HUB-013`) |
| PP-008 | Security by Design | Satisfied | Per-project encrypted credentials, write-only, never to an agent (`FR-HUB-040`–`FR-HUB-047`); least privilege bound at resolution (`FR-HUB-034`) |
| PP-009 | Quality by Design | Satisfied | `SC-HUB-001` and `SC-HUB-004` are mutation-tested |
| PP-010 | Observability by Default | Partial | Health, resolutions and refusals are recorded and shown; dashboards and trend reporting → `EPIC-040` |
| PP-011 | Documentation as Code | Satisfied | A capability contract is a versioned, machine-readable record |
| PP-012 | Everything Versioned | Satisfied | Capability contracts and adapters are versioned; compatibility is checked at resolution (`FR-HUB-011`, `FR-HUB-033`) |
| PP-013 | Knowledge-Driven Engineering | Satisfied | `ReadRepository` is available to `EPIC-038` context assembly as a platform-side caller, and `Embed` gives `EPIC-038`'s `EmbeddingPort` its owner (`FR-HUB-087`) |
| PP-014 | Configuration over Customization | Satisfied | Adapter selection is configuration and policy, not code (`FR-HUB-031`) |
| PP-015 | Open Standards | Partial | MCP is supported as a transport (`BR-0122`, consumed); no external capability-description standard is adopted |
| PP-016 | Explainable AI | Satisfied | Every resolution and every refusal names the rule that decided it (`FR-HUB-036`, `BR-0174`) |
| PP-017 | Cost-Aware AI | Satisfied | The Hub invokes no generative model. `Embed` runs an embedding model; its batch limits are part of the contract (`FR-HUB-083`) and the provider choice and cost are justified in `plan.md` |
| PP-018 | Scalability First | Partial | Health checks and resolutions are bounded per project (`FR-HUB-027`); volume targets land in `plan.md` |
| PP-019 | Continuous Improvement (DORA/SPACE) | Deferred | Build and test signals the Hub reads are inputs to DORA metrics → `EPIC-040` |
| PP-020 | Customer Value | Satisfied | `SC-HUB-001` — switching a Git or CI provider is a configuration change, not a project |

**Deferral count**: 1 — `PP-019` → `EPIC-040`, restated in the closing report.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A platform workflow asks for a capability, never a provider (Priority: P1)

**`BR-0120`, `BR-0121`.** A Room or the Governed Engineering Loop needs the build status of a
commit. It requests `ReadBuildStatus` for the project. The Capability Resolver picks the adapter the
project has configured, checks policy, environment, health and version compatibility, and either
returns the result or refuses with an explanation.

**Why this is P1 and the MVP**: every other story is a property of a resolved capability. Without
the contract and the resolver there is nothing to configure, observe or swap.

**Independent test**: with only the fixture adapter registered, request each v1 capability through
the real entry point and receive its result; then make the fixture ineligible and receive an
explained refusal.

**Acceptance scenarios**

1. **Given** a project with an eligible adapter for `ReadBuildStatus`, **When** a platform workflow
   requests it, **Then** the result is returned and the resolution names the adapter, its version
   and why it was eligible.
2. **Given** a request naming a capability that is not in the registry's vocabulary, **When** it is
   made, **Then** it is refused, naming the unknown capability.
3. **Given** a request that names a provider or adapter instead of a capability, **When** it is
   made by a platform workflow, **Then** it is refused — workflows cannot pin a provider.
4. **Given** no adapter that is configured, healthy, policy-permitted and version-compatible,
   **When** a capability is requested, **Then** it is refused with a decision that names, for each
   candidate adapter, the reason it was ineligible; nothing is queued or retried silently.
5. **Given** a request arriving from the developer's local agent, **When** it asks the Hub to run a
   capability, **Then** there is no such operation — the local agent uses its own tools.

### User Story 2 - Swapping a provider changes configuration, not business rules (Priority: P1)

**`BR-0126`, `BG-04`.** A project switches its CI provider. The project owner configures the other
adapter for the same capability. Every Room and workflow keeps working, unchanged.

**Why P1**: `BG-04` is otherwise aspirational. A Hub with one adapter per capability cannot show
that the abstraction holds.

**Independent test**: run the same caller-level test suite for each v1 capability twice — once
against the fixture adapter and once against the real one — with no change to any caller.

**Acceptance scenarios**

1. **Given** a capability with two registered adapters, **When** the project's configuration is
   switched from one to the other, **Then** the next request resolves to the new adapter and the
   caller receives a result of the same contract shape.
2. **Given** the switch, **When** the platform's business-rule modules are compared before and
   after, **Then** they are unchanged — the switch is a configuration event, recorded as such.
3. **Given** a core module that names a provider or imports an adapter, **When** the boundary check
   runs, **Then** it fails, naming the module.

### User Story 3 - Every integration surface is listed with the same lifecycle facts (Priority: P1)

**`BR-0123`.** The registry lists every outbound adapter and every inbound connector, starting with
`EPIC-043`'s `pmi-studio` server. Each entry states its direction, transport, configuration status,
authorisation model, permission scope, health, version and compatibility, and carries an audit
trail of changes.

**Why P1**: an integration whose health and version nobody can see fails as an outage nobody can
explain. And two registries — one per direction — would be two answers to *"what talks to this
platform?"*.

**Independent test**: read the registry for a project and find the `pmi-studio` connector and every
v1 adapter, each with all lifecycle fields populated or explicitly marked *not applicable* with a
reason.

**Acceptance scenarios**

1. **Given** the platform's connectors and adapters, **When** the registry is read, **Then** every
   entry carries direction, transport, version, compatibility range, permission scope, health and
   last health check.
2. **Given** the `pmi-studio` connector, **When** it is listed, **Then** its permission scope is the
   operations `EPIC-043` binds, its authorisation is the project connector credential, and its
   protocol is unchanged by being listed.
3. **Given** an inbound connector, **When** a capability is requested, **Then** the connector is
   never a resolution candidate — connectors are listed, not resolved.
4. **Given** an adapter that fails its health check, **When** the registry is read, **Then** it reads
   **unhealthy** with the instant and reason, and it is ineligible for resolution until healthy.
5. **Given** any change to a registry entry — registered, version changed, configured, retired —
   **When** it happens, **Then** it is recorded with actor, instant and before/after.

### User Story 4 - A project owner configures a provider without ever exposing its secret (Priority: P1)

**`BR-0123`, `BR-0124` (enforced), `BR-0135` (consumed).** The project owner gives the project the
credential an adapter needs — for example a token for the project's Git host — through the API. The
credential is stored encrypted, can be replaced or removed, and is never readable afterwards by
anyone, any agent or any log.

**Why P1**: per-project credentials are what make the real adapters usable; a credential that leaks
through a read, a log or an agent turns the Hub into the platform's largest exposure.

**Independent test**: set a credential, then attempt to recover it through every read, the screen,
the execution record, error output and the `pmi-studio` server — and find it nowhere.

**Acceptance scenarios**

1. **Given** the owner grant on a project, **When** a credential is set for an adapter, **Then** it
   is stored encrypted and the adapter's configuration status reads **configured** — the value is
   never returned.
2. **Given** an identity without the owner grant, **When** it sets, replaces or removes a
   credential, **Then** it is refused.
3. **Given** a credential set for project A, **When** a capability is resolved for project B,
   **Then** project A's credential is never used.
4. **Given** a request for `ReadRepository`, **When** the adapter is invoked, **Then** it receives
   only the scope that capability requires (read), even if the stored credential could do more, or
   the resolution is refused where the provider cannot narrow it and policy requires narrowing.
5. **Given** a credential is removed, **When** the next request arrives, **Then** the adapter is
   ineligible as **not configured**.

### User Story 5 - External test and build results become typed evidence (Priority: P2)

**`BR-0125`.** When work is governed by an `EPIC-032` Evidence Contract that requires passing tests,
evidence intake requests `ReadTestResults` for the commit the work produced. The results arrive as
typed evidence in `EPIC-032`'s store, naming the contributing adapter and its version, and the
completion gate re-evaluates.

**Why P2**: the Evidence Store accepts external evidence only *"through the adapter mechanism"*
(`FR-EVS-040`), and until this Epic exists no such mechanism does.

**Independent test**: complete a governed task whose Evidence Contract requires a passing test
result; let intake read results through the fixture adapter; observe the item move from unmet to
met without anyone attaching it by hand.

**Acceptance scenarios**

1. **Given** test results for a commit, **When** intake reads them, **Then** they are stored as
   typed evidence naming the artifact version, the adapter, the adapter's version and the provider.
2. **Given** results that name no commit or artifact version, **When** intake reads them, **Then**
   no evidence is attached and the reason is recorded (`FR-EVS-042`).
3. **Given** results for a commit that are still running, **When** intake reads them, **Then** no
   evidence is attached as passing; a pending read is recorded and retried within the configured
   bound.
4. **Given** intake's adapter is ineligible, **When** evidence is needed, **Then** the Evidence
   Contract item stays unmet with the resolution's refusal as its reason — never satisfied by
   default.

### User Story 6 - Notifications go out through whichever provider the project uses (Priority: P2)

**`BR-0120`.** When a governed event needs a human — a decision is waiting, a gate refused — the
platform requests `SendNotification`. The project's configured notification adapter delivers it.

**Independent test**: trigger a notification with the fixture adapter and confirm one delivery
record; switch to the real adapter and confirm the same caller produces a real delivery.

**Acceptance scenarios**

1. **Given** a configured notification adapter, **When** a notification is requested, **Then** it is
   delivered once and the delivery outcome is recorded.
2. **Given** delivery fails at the provider, **When** the adapter reports it, **Then** the failure is
   recorded with the provider's reason; the governed event that caused it is unaffected.
3. **Given** a notification whose content would include credential material, **When** it is
   requested, **Then** the material is refused or redacted before it leaves the platform.

### User Story 7 - Context assembly embeds through whichever model the deployment binds (Priority: P2)

**`BR-0120`; `BR-0091` consumed through `EPIC-038`.** Context assembly and re-indexing need text
turned into vectors. They ask `EPIC-038`'s `EmbeddingPort`, which the Hub now fills by resolving the
`Embed` capability to the deployment's bound adapter. Nothing in `EPIC-038` names a model or a
provider.

**Why P2**: until this exists `EPIC-038` refuses every assembly and re-index with a `503`, and its
ranking-by-meaning test (`T1282`) and Tier 2 journey (`T1301`) cannot be discharged.

**Independent test**: with only the fixture `Embed` adapter bound, request a context package and a
re-index through `EPIC-038`'s real routes and receive answers instead of the `503`; unbind it and
receive the `503` naming `EmbeddingPort` with the Hub's refusal explanation.

**Acceptance scenarios**

1. **Given** an eligible `Embed` adapter bound for the deployment, **When** context assembly
   embeds texts, **Then** it receives one vector per text, in order, of the dimension the adapter
   declared, with the model id and version recorded.
2. **Given** no eligible `Embed` adapter, **When** assembly or re-indexing runs, **Then** it is
   refused naming `EmbeddingPort` and the reason no adapter was eligible — never ranked by a
   stand-in.
3. **Given** a request exceeding the contract's batch limits, **When** it is made, **Then** it is
   refused naming the limit; nothing is truncated.
4. **Given** the deployment switches from one `Embed` adapter to another, **When** the next search
   runs, **Then** entries indexed under the previous model are treated as foreign until re-indexed
   (`EPIC-038` refuses to rank across models) and the switch is recorded as a configuration change.
5. **Given** the fixture adapter, **When** the same text is embedded twice, **Then** the vectors are
   identical, and texts that share meaning but not letters are **not** ranked together.

### User Story 8 - A reviewer sees what the platform is connected to and whether it is healthy (Priority: P3)

**PMI-DOC-006 §4 — Platform › Integrations.** A view-only screen lists every adapter and connector,
opens one, and shows its capabilities, version, health history, configuration status (never a
secret) and recent resolutions with their explanations.

**Independent test**: open the area for a project with one unhealthy adapter and one refused
resolution; read the unhealthy reason and the refusal's explanation without leaving the screen.

**Acceptance scenarios**

1. **Given** registry entries, **When** the area is opened, **Then** each shows name, direction,
   transport, capabilities, version, health and configuration status.
2. **Given** an entry, **When** it is opened, **Then** its health history and recent resolutions are
   shown, each refusal with its explanation.
3. **Given** a reviewer, **When** they look for a way to change configuration on the screen,
   **Then** there is none; the screen says configuration is through the API.

### Edge Cases

- **Two adapters are eligible for the same capability.** The project's configured preference
  decides; where none is configured, resolution is refused as **ambiguous** naming both — the Hub
  never picks a provider by itself.
- **An adapter's health changes mid-request.** The request finishes or fails against the adapter it
  was resolved to; it is never silently re-resolved to another provider. A failure is recorded and
  the caller decides whether to request again.
- **A capability contract gains a new major version** while adapters implement only the previous
  one. Requests for the new major are refused as **no compatible adapter**; requests for the old
  major continue to resolve until that major is retired.
- **A provider is rate-limiting.** The adapter reports it; the resolution records **provider
  throttled** with the provider's retry hint, and the adapter's health reads **degraded**, not
  unhealthy.
- **Health has not been checked within its interval.** Health reads **unknown**, and an adapter
  with unknown health is ineligible — stale health is never shown as healthy.
- **A credential expires at the provider.** The provider's authorisation failure marks the adapter
  **unhealthy: credential rejected**; the stored credential is not shown or logged in the reason.
- **An adapter is retired while a project is configured to use it.** Requests are refused naming the
  retirement; the project's configuration shows it as pointing at a retired adapter.
- **The Hub itself is unavailable when evidence intake runs.** Intake fails closed — Evidence
  Contract items stay unmet (`FR-EVS-035`).
- **The embedding model is replaced by a new version of itself.** The model version changes, so
  every existing index entry is foreign to it; ranking is refused until re-indexed, exactly as for a
  different model — a new version is never assumed to be compatible.
- **An `Embed` adapter returns a vector of the wrong length, a zero vector or a non-finite
  component.** It is an adapter fault (`FR-HUB-016`); the batch fails and nothing is indexed.

## Requirements *(mandatory)*

### Functional Requirements

**Capability contracts (`BR-0120`)**

- **FR-HUB-001**: Platform workflows MUST request engineering work as named, vendor-neutral
  capabilities. A workflow MUST NOT name a provider, an adapter or a transport.
- **FR-HUB-002**: Each capability MUST be defined by a capability contract stating its inputs,
  outputs, error categories, the permission scope it requires, and whether it changes state at the
  provider.
- **FR-HUB-003**: The capability vocabulary MUST be a registry the platform holds, not a set of
  names spread across callers. A request naming a capability outside it MUST be refused, naming the
  unknown capability.
- **FR-HUB-004**: The Hub MUST serve platform-side callers only — Rooms, the Governed Engineering
  Loop, context assembly and evidence intake *(clarified 2026-10-09)*. It MUST NOT expose an
  operation through which a developer's local agent runs a capability; the local agent's own tool
  use stays recorded through `EPIC-043`.
- **FR-HUB-005**: A caller's request MUST name the project it acts for; the Hub MUST resolve within
  that project and its workspace only (`BR-0001`).
- **FR-HUB-010**: The v1 vocabulary MUST contain exactly **five** capabilities *(clarified
  2026-10-09, amended the same day to add `Embed`)*: **`ReadRepository`** (read a hosted
  repository's content at a named revision), **`ReadBuildStatus`** (the build outcome for a named
  revision), **`ReadTestResults`** (test results for a named revision, for evidence intake),
  **`SendNotification`** (deliver one message to named recipients), and **`Embed`** (turn an ordered
  batch of texts into vectors of the dimension the adapter declares, for `EPIC-038`). Every other
  capability `ADR-0023` lists is out of scope here.
- **FR-HUB-011**: Capability contracts MUST be versioned as *major.minor*. A change that removes or
  alters an input, output or error category MUST be a new major version; an addition that existing
  adapters and callers can ignore MUST be a minor version.
- **FR-HUB-012**: An approved capability contract version MUST be immutable; changing it MUST
  create a new version.
- **FR-HUB-013**: A capability contract MUST NOT depend on any transport. An adapter MAY reach its
  provider over a native API, a command-line tool, an MCP server or a customer connector; MCP is a
  first-class transport and MUST NOT be the only one (`BR-0122`, consumed).
- **FR-HUB-014**: Of the v1 capabilities only `SendNotification` changes state at a provider. Any
  later state-changing capability MUST state in its contract that it does, so policy can treat it
  differently.
- **FR-HUB-015**: Defining or changing a capability contract MUST be recorded with actor, instant
  and before/after.
- **FR-HUB-016**: Results returned to a caller MUST conform to the capability contract regardless of
  which adapter produced them; an adapter result that does not conform MUST be refused as an
  adapter fault, never passed through.

**Registry and lifecycle (`BR-0123`)**

- **FR-HUB-020**: The platform MUST hold **one registry** listing every outbound adapter and every
  inbound connector *(clarified 2026-10-09)*, each entry stating its **direction**.
- **FR-HUB-021**: The registry MUST list `EPIC-043`'s `pmi-studio` server as its first inbound
  entry, and the `EPIC-037` connector bindings beside it (PMI-DOC-007 §9.4).
- **FR-HUB-022**: Listing a connector MUST NOT change its protocol, its authorisation or its
  operations. Connectors MUST NOT be resolution candidates.
- **FR-HUB-023**: Every registry entry MUST expose: configuration status; authorisation model;
  permission scope; health with last-checked instant and reason; version; compatibility (for an
  adapter, the capability contract major versions it implements; for a connector, the integration
  contract version it serves); transport; and audit metadata. A field that does not apply MUST read
  *not applicable* with a reason, never blank.
- **FR-HUB-024**: Every adapter MUST declare which capabilities it implements and which provider it
  talks to.
- **FR-HUB-025**: Registering, versioning, configuring and retiring an entry MUST each be recorded
  with actor, instant and before/after.
- **FR-HUB-026**: Adapter health MUST be one of **healthy**, **degraded**, **unhealthy** or
  **unknown**. Only **healthy** adapters are eligible by default; a project MAY permit **degraded**
  per capability. **Unknown** and **unhealthy** MUST be ineligible.
- **FR-HUB-027**: Each adapter's health MUST be checked on a configured interval per project, and
  health older than that interval MUST read **unknown**.
- **FR-HUB-028**: A retired adapter MUST NOT be resolved; its history MUST remain readable.
- **FR-HUB-029**: Registering an adapter or connector, and retiring one, MUST require an
  `EPIC-024` edit grant on the workspace's `integration-registry` artifact; reading the registry
  MUST require read.

**Capability Resolver (`BR-0121`)**

- **FR-HUB-030**: The Capability Resolver MUST bind each capability request to exactly one adapter,
  or refuse.
- **FR-HUB-031**: An adapter MUST be eligible only when **all** hold: it implements the capability
  at a compatible major version; the project has configured it; its credential is set where one is
  required; its health meets `FR-HUB-026`; it is permitted in the request's environment; and policy
  (`EPIC-030`/`EPIC-031`) permits it for this project and capability.
- **FR-HUB-032**: Where more than one adapter is eligible, the project's configured preference for
  that capability MUST decide. Where no preference is configured, the request MUST be refused as
  **ambiguous**, naming the candidates.
- **FR-HUB-033**: A request MUST state the capability major version it expects; the resolver MUST
  NOT bind it to an adapter implementing a different major.
- **FR-HUB-034**: The resolver MUST give the chosen adapter only the permission scope the
  capability contract requires (`BR-0124`, enforced here, owned by `EPIC-024`/`EPIC-028`). Where the
  provider cannot narrow a credential to that scope, the resolution MUST record the scope as
  **not narrowable** and follow policy: refuse, or proceed and record. The default for capabilities
  that change state at a provider MUST be **refuse**.
- **FR-HUB-035**: Where no adapter is eligible, the request MUST be refused immediately. The Hub
  MUST NOT queue, retry or fall back to an unconfigured or unhealthy adapter.
- **FR-HUB-036**: Every resolution — success or refusal — MUST be explainable: it MUST name the
  rule, policy or condition that decided it, and for a refusal, each candidate adapter and why it
  was ineligible (`BR-0174`).
- **FR-HUB-037**: Every resolution MUST be recorded with the caller, project, capability and
  version, adapter and version (or refusal), outcome and instant, under platform audit retention
  (`EPIC-004`).
- **FR-HUB-038**: Where the caller acts within a registered `EPIC-037` execution, the resolution
  MUST also be recorded as an event on that execution (Constitution XII), not only in a separate
  log.
- **FR-HUB-039**: A request MUST complete or fail against the adapter it was resolved to; it MUST
  NOT be re-resolved to another adapter mid-request.

**Credentials (`BR-0123`; `BR-0124`, `BR-0135` consumed)**

- **FR-HUB-040**: Adapter credentials MUST be held **per project** *(clarified 2026-10-09)*. A
  credential set for one project MUST NOT be usable for another.
- **FR-HUB-041**: Setting, replacing and removing a credential MUST require the **owner grant** on
  the project (`EPIC-024`, as `FR-LPW-027` uses it), and MUST be done through the API.
- **FR-HUB-042**: Credentials MUST be encrypted at rest. Inside the platform they MUST travel as a
  reference, never a value, until the adapter uses them (`ADR-0012`).
- **FR-HUB-043**: Credentials MUST be write-only: no read, screen, export, error, log or execution
  event MAY return or contain a credential value. Configuration status reads only **configured** or
  **not configured**, and when it was last set and by whom.
- **FR-HUB-044**: A credential MUST NOT be given to any agent, sandbox or connector, including the
  developer's local agent and the `pmi-studio` server (`BR-0135`).
- **FR-HUB-045**: Recognisable credential material in any capability input, output or notification
  content MUST be refused or redacted before it is recorded or sent (`FR-EXR-022`).
- **FR-HUB-046**: Setting, replacing and removing a credential MUST be recorded with actor and
  instant, never with the value.
- **FR-HUB-047**: A provider's rejection of a credential MUST mark the adapter **unhealthy:
  credential rejected** for that project.

**External evidence (`BR-0125`)**

- **FR-HUB-050**: Evidence intake MUST obtain CI and test outcomes only through `ReadBuildStatus`
  and `ReadTestResults`; no bespoke per-tool path MAY be built (`FR-EVS-040`).
- **FR-HUB-051**: Results MUST be contributed to `EPIC-032`'s evidence store as typed evidence; this
  Epic MUST NOT keep a second evidence record.
- **FR-HUB-052**: Contributed evidence MUST name the artifact version it attests, the capability and
  its version, the adapter and its version, and the provider (`FR-EVS-041`).
- **FR-HUB-053**: Results that name no revision or artifact version MUST NOT be contributed; the
  reason MUST be recorded (`FR-EVS-042`).
- **FR-HUB-054**: Results that are not yet final MUST NOT be contributed as passing. Intake MUST read
  again on a configured bound and record when it gives up.
- **FR-HUB-055**: Where intake cannot resolve an adapter, the Evidence Contract item MUST stay
  unmet with the refusal as its reason — never satisfied by default.

**Portability (`BR-0126`, taken over from `EPIC-028`)**

- **FR-HUB-060**: Every v1 capability MUST ship with **two** adapters — a fixture adapter and one
  real provider adapter — that pass the same caller-level test suite *(clarified 2026-10-09)*.
- **FR-HUB-061**: Platform business-rule modules MUST NOT name a provider or depend on an adapter.
  An automated boundary check MUST enforce this and fail naming any offending module.
- **FR-HUB-062**: Switching a project's adapter for a capability MUST be a recorded configuration
  change requiring no change to any business-rule module.
- **FR-HUB-063**: Portability of the **AI provider** MUST be evidenced by citing `EPIC-028`'s agent
  seam (`BR-0103`), not rebuilt here.
- **FR-HUB-064**: Portability of the **observability provider** MUST be recorded as **deferred**
  until a telemetry capability exists; this Epic MUST NOT claim it.

**Embedding (`BR-0120`; `BR-0091` and `FR-CTX-013` consumed through `EPIC-038`)** *(added
2026-10-09)*

- **FR-HUB-080**: The `Embed` capability contract MUST take an ordered batch of texts and return,
  for each text and in the same order, one vector, together with the embedding model's id and
  version. It does not change state at a provider.
- **FR-HUB-081**: Every `Embed` adapter MUST declare, before any request, the **dimension** of its
  vectors and its **model id and version**. A result whose vector count differs from the text count,
  or with a vector of another dimension, a non-finite component or all components zero, MUST be
  refused as an adapter fault (`FR-HUB-016`) — the same refusals `EPIC-038` applies.
- **FR-HUB-082**: The model version MUST change whenever the vectors for the same text would change
  (for example a new weights digest), and it MUST be recorded on every resolution. Vectors from two
  model versions MUST be treated as incomparable.
- **FR-HUB-083**: The `Embed` contract MUST state a maximum number of texts per request and a
  maximum length per text. A request over either MUST be refused naming the limit; texts MUST NOT be
  truncated or dropped silently.
- **FR-HUB-084**: `Embed` MUST be resolved at **deployment scope** — one bound adapter for the
  whole deployment — because vectors from different models cannot share a workspace's index and
  `EmbeddingPort` carries no project. This is the one stated exception to per-project configuration
  (`FR-HUB-005`, `FR-HUB-031`, `FR-HUB-040`). **The binding — adapter, model and any credential — is
  deployment configuration, read and recorded at boot; no API route and no workspace grant can set
  or switch it.** Switching is an operator action that takes effect on restart and MUST appear as a
  recorded configuration change. v1's real `Embed` adapter needs no credential, so v1 has no route
  for an `Embed` credential *(clarified 2026-10-09, analysis finding I1)*.
- **FR-HUB-085**: Where no `Embed` adapter is bound, or the bound one is ineligible, embedding MUST
  be refused with the Hub's explanation; `EPIC-038`'s refusal naming `EmbeddingPort` stands. No
  stand-in vector MAY ever be returned.
- **FR-HUB-086**: The fixture `Embed` adapter MUST be deterministic and MUST NOT be semantic —
  equivalent to `EPIC-038`'s letter-bag test fixture — so that a test of ranking by meaning cannot
  pass against it.
- **FR-HUB-087**: The Hub MUST fill `EPIC-038`'s `EmbeddingPort` by resolving `Embed`, **without
  changing the port's shape** (a model id, a dimension, texts in, vectors out). A shape change, if
  one is ever needed, is `EPIC-038`'s to make and MUST be raised as a defect there, not made here.

**The Integrations screen** *(PMI-DOC-006 §4, Platform group)*

- **FR-HUB-070**: Integrations MUST be presented in their own application area in the Platform
  group as a **view-only** registry screen *(clarified 2026-10-09)*, not a governed Room.
- **FR-HUB-071**: The screen MUST list every registry entry with name, direction, transport,
  capabilities, version, health and configuration status.
- **FR-HUB-072**: An opened entry MUST show its health history and its recent resolutions, each
  refusal with its explanation, without opening another screen (`UX-0032`).
- **FR-HUB-073**: Health states and **not applicable** fields MUST be visually distinguishable from
  one another and from recorded fact (`UX-0031`).
- **FR-HUB-074**: The screen MUST NOT show, accept or offer to edit a credential or any
  configuration; it MUST say that configuration is through the API.
- **FR-HUB-075**: Entries, health and resolutions MUST remain readable at a 360px viewport
  (`UX-0040`).
- **FR-HUB-076**: The screen MUST be reachable from the application shell's navigation and MUST
  honour `EPIC-024` read access to the registry.

### Key Entities

- **Capability Contract Version** — one capability's name, major.minor version, inputs, outputs,
  error categories, required permission scope and whether it changes state; immutable once
  approved.
- **Registry Entry** — one adapter (outbound) or connector (inbound): direction, transport,
  provider, implemented capabilities and versions, permission scope, authorisation model, version,
  status (active or retired).
- **Health Record** — one health check of one adapter for one project: state, reason, instant.
- **Project Adapter Configuration** — for one project and capability: the adapter chosen, its
  preference order, whether **degraded** is permitted, the permitted environments, and a reference
  to the credential.
- **Adapter Credential** — per project and adapter: the encrypted value (never readable), who set
  it and when. Referenced, never copied.
- **Resolution** — one request and its outcome: caller, project (or deployment scope, for
  `Embed`), capability and version, adapter and version or refusal, scope granted, the deciding
  reasons, and the execution it belongs to if any.
- **Deployment Capability Binding** — for a capability resolved at deployment scope (`Embed`): the
  adapter bound, its non-secret binding, a reference to its credential if any, who set it and when.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-HUB-001**: For **each** of the five v1 capabilities, switching the project (for `Embed`, the deployment) from the fixture
  adapter to the real adapter (and back) changes **zero** business-rule modules, and the same
  caller-level suite passes against both — mutation-tested by inserting a provider reference into a
  core module and observing the boundary check fail.
- **SC-HUB-002**: **100%** of capability requests are either served by an eligible adapter or
  refused with an explanation naming each ineligible candidate; **zero** requests are served by an
  unconfigured, unhealthy, unknown-health or incompatible adapter.
- **SC-HUB-003**: **100%** of registry entries — including `pmi-studio` — expose every lifecycle
  field, populated or marked *not applicable* with a reason.
- **SC-HUB-004**: **Zero** credential values are recoverable through any read, screen, export,
  error, log, execution event, agent or connector — mutation-tested by returning the stored value
  from the configuration read and observing the suite fail.
- **SC-HUB-005**: **Zero** cross-project credential uses: a request for project B never resolves
  with project A's credential.
- **SC-HUB-006**: A governed task whose Evidence Contract requires passing tests moves from unmet to
  met from external results alone, with no hand-attached evidence, in **100%** of runs against the
  fixture adapter.
- **SC-HUB-007**: A reviewer can answer *"what is this project connected to, is it healthy, and why
  was that request refused?"* from the Integrations screen alone, without asking an engineer.
- **SC-HUB-008**: A project owner can configure a new provider for a capability, and see the next
  request resolve to it, in **under 5 minutes** from having the provider credential in hand.
- **SC-HUB-009**: Once an `Embed` adapter is bound through the Hub, `EPIC-038`'s context assembly
  and re-index entry points answer **without** the `503` naming `EmbeddingPort` in **100%** of runs
  through their real routes; unbinding it restores the `503` with the Hub's explanation. With the
  real adapter's model available, `EPIC-038`'s ranking-by-meaning test (`T1282`) **runs rather than
  skips**, and its result is reported as observed.

## Assumptions

1. **Ownership: own four, take over `BR-0126`, consume `BR-0122`/`BR-0124`** — *confirmed
   2026-10-09*. `EPIC-028` closed without citing `BR-0124` or `BR-0126`; `EPIC-013` does not cite
   `BR-0122`, which `EPIC-043` delivered for its server. Least privilege is *enforced* where the
   resolver hands an adapter its scope, which is the only place `ADR-0023` says it is enforceable.
2. **Platform-side callers only** — *confirmed 2026-10-09*. The developer's agent works on the
   developer's machine with its own tools (`D-47`, `ADR-0030`). Routing its Git and CI operations
   through the platform would change `EPIC-043`'s closed contract and put the platform in the path
   of every local edit.
3. **One registry, two directions** — *confirmed 2026-10-09*. It honours PMI-DOC-007 §9.4 and
   `EPIC-037`'s note that this Epic *"generalises the connector pattern"* without rewriting shipped
   connectors.
4. **`ReadTestResults` is a pull, not a push.** Intake reads results for a revision through an
   adapter; providers calling into the platform (webhooks) would be a new inbound connector with its
   own authorisation, and is deferred. The alternative — push — is lower-latency and needs an
   authenticated inbound surface this Epic does not otherwise require.
5. **Real providers for v1** — the Git host and CI service most projects in the corpus use (GitHub
   for `ReadRepository`, `ReadBuildStatus` and `ReadTestResults`), and one mail-delivery provider
   for `SendNotification`. The exact provider per capability is fixed in `plan.md`; the requirement
   is *one real provider per capability*, not a particular vendor.
6. **No-healthy-adapter behaviour: refuse with an explained decision** (`FR-HUB-035`,
   `FR-HUB-036`). Queuing would hide an outage behind latency and make a governed step appear to be
   waiting when it has failed. `BR-0174` (owned by `EPIC-031`) supplies the explanation standard.
7. **Capability versioning: major.minor, breaking = major** (`FR-HUB-011`). Adapters declare the
   majors they implement; resolution never crosses a major. `ADR-0023` names versioning as the cost
   of the abstraction; this is the smallest scheme that makes the cost visible.
8. **Ambiguity is refused, not guessed** (`FR-HUB-032`). The Hub never chooses a provider the
   project did not choose.
9. **A hosted repository binding is per-project configuration.** `EPIC-041` (Assumption 5) left
   *"configuring a remote"* to this Epic. `ReadRepository` needs the hosted repository's identity;
   configuring the developer's local working copy's remote stays the developer's.
10. **Performance targets land in `plan.md`.** Resolution adds a policy and health check before
    every provider call; latency and volume targets are set against measured provider latency, not
    guessed here. That includes the `Embed` batch limits and latency (`FR-HUB-083`).
11. **`Embed` is bound per deployment, not per project** (`FR-HUB-084`). `EPIC-038` keeps one vector
    space per workspace and refuses to rank across models, and its `EmbeddingPort` takes no project.
    Per-project embedding models would need a port shape change in `EPIC-038` and a partition per
    model; neither is in scope. The alternative — per-project resolution — is recorded in
    `research.md` with why it was rejected.

**Dependencies**: `EPIC-043` (`pmi-studio` server — **done**), `EPIC-037` (execution registry and
connector bindings), `EPIC-032` (evidence store — **open PR**), `EPIC-031` (decision and policy,
`BR-0174` — **open PR**), `EPIC-030` (policy classes), `EPIC-024` (grants), `EPIC-041` (project and
owner grant), `EPIC-004` (audit retention), `EPIC-036` (application shell), `EPIC-028` (agent seam,
for `FR-HUB-063`).

**Consumer**: `EPIC-038` (Engineering Context — its retrieval is on its own branch) consumes
`Embed` through `EmbeddingPort` (`FR-CTX-013`). Its `T1282` (ranking by meaning) and `T1301`
(Tier 2 journey, with the known-red `T1294`) and `SC-CTX-006` become **dischargeable through this
Epic** once `Embed` is bound — discharged in `EPIC-038`, evidenced here by `SC-HUB-009`. `EPIC-048`
depends on re-indexing and so on the same binding.

## Out of Scope

- The **public marketplace** — discovery, install, ratings, third-party publishing (Expansion Plane,
  `ADR-0023`).
- Any capability other than the five in `FR-HUB-010` — including `CreateBranch`,
  `CreatePullRequest`, `RunTests`, `RunSecurityScan`, `DeployEnvironment`, `ReadTelemetry`,
  `CreateIssue`, `SearchCode`.
- Running capabilities on behalf of the developer's local agent (`FR-HUB-004`).
- Changing any connector's protocol or authorisation, including `pmi-studio`'s.
- Inbound webhooks from providers (Assumption 4).
- Configuration on the screen, and administrator roles (no owning Epic yet).
- Customer-cloud execution (`BR-0131`, rank 9).
- Dashboards and trend reporting over health and resolutions (`EPIC-040`).

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX, XI)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test — or, for document/configuration outputs, a
      passing executable conformance check (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/039-integration-hub/defects/` contains no open defect records
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
- [ ] A closing report was published: work completed, work deferred, and the recommended next task
      named as a concrete Spec Kit command (Constitution IX)
- [ ] **Reachability** (Constitution XI, Tier 1): each v1 capability is requested through a real
      platform-side caller's entry point against the composed module graph, and the Integrations
      screen is reached through the shell's navigation
- [ ] **`FR-HUB-061` is mutation-tested**: a provider reference is inserted into a core module and the
      boundary check observed failing (`SC-HUB-001`)
- [ ] **`FR-HUB-043` is mutation-tested**: the configuration read returns the stored value and the
      suite observed failing (`SC-HUB-004`)
- [ ] **`Embed` reaches `EPIC-038`** (`SC-HUB-009`): context assembly and re-index driven through
      `EPIC-038`'s real routes against the composed module graph answer without the `EmbeddingPort`
      `503` when bound, and with it when unbound; `T1282` observed **running** against the real
      adapter, its result recorded as observed
- [ ] The PMI-DOC-004 §6.13 owner annotations for `BR-0120`, `BR-0121`, `BR-0123`, `BR-0125` and
      `BR-0126` name `EPIC-039`
