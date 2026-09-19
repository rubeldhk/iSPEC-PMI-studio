# Amendment Impact Report

**Epic**: `EPIC-027` | **Date**: 2026-08-17 | **Requirement**: `FR-AMD-009` to `FR-AMD-012`
**Sources**: five amendment documents — four in `SRS/August112026/` (2026-08-11/12/13) and
`SRS/AUg142026/PMI_Studio_Augment_Cosmos_Learnings_Amendment.docx` (2026-08-14)

The twenty-five-part report Plan Amendment §18 specifies. Cosmos §10 asks for a seventeen-part
report over the same ground; the twenty-five-section form is a superset and both are satisfied here.

**This report summarises. The register is authoritative.** Every number below is generated from
[`register/`](./register/) and asserted by a conformance check — 599 clauses, 599 verdicts, 45
capabilities, 20 capability areas, 20 premise checks, 17 ADRs, 22 research items, 17 decisions.
Restating the register here would create a second answer that drifts (PP-002).

---

## 1. Executive summary

The amendment is **evolutionary, and the corpus survives it**. Five documents, 599 substantive
clauses, and **not one existing requirement, epic or architecture decision is discarded**. Every
clause carries exactly one verdict; 54% name an existing requirement, principle, decision or epic
that already covers them.

Three findings shaped everything else.

**Finding A — the three Rooms do not exist.** The amendment says *"maintain and enhance the existing
Change Room"* and *"the existing Defect Room"*. Searching all 27 other epic specifications returns
**zero** occurrences of Change Room, Defect Room, Requirement Room or Decision Room. These are
**builds, not enhancements**, and the difference is a programme-sized estimate. 157 of the 599
clauses are classified `conflicting` largely because of this.

**Finding B — EPIC-007 is a name collision.** It is called *Requirement Intelligence* and its own
spec says *"AI-assisted analysis is Phase 2 and out of scope."* The amendment's Requirement
Intelligence Engine is a far larger capability sharing a name. `D-33`: EPIC-007 keeps its identifier
and scope.

**Finding C — the buildable slice was small, and it is now built.** Of twenty capability areas, four
proceeded and sixteen were held. EPIC-028 delivered three of the four in four days. **Sixteen remain
held behind `PMI-DOC-004` — untouched by this reconciliation.**

**The scope-creep answer is a table with nothing in it.** `epic_status_changes` is empty: 599 clauses
classified, twenty areas assigned, and **no epic's delivery posture changed**. `G-27-14` blocks CI if
that stops being true.

## 2. Existing architecture impact

The architecture absorbed the amendment without a reset. `ADR-0003`'s stack — React, NestJS,
TypeScript, PostgreSQL, Prisma, BullMQ, Valkey — is **entirely unchanged**, and Native §28's sixteen
preserved elements match it exactly.

Three seams changed, all additively:

| Seam | Change | Status |
|---|---|---|
| Agent independence | New `packages/agent-contract`; `SpecKitEngine` takes an injected agent | **BUILT** |
| Execution substrate | `ContainerRuntime` → `ProjectExecutionEnvironment`; Docker becomes a provider | **BUILT** |
| Egress | One allow-list → named profiles; `generation` frozen by committed hash | **BUILT** |

The worker composition-root pattern was not merely preserved but **applied twice more**, which is the
strongest available evidence it was the right pattern.

## 3. Product-boundary changes

§1 names the target market explicitly for the first time: organizations that want a sophisticated
internal developer platform **without building one**. §14 states what the product must not become —
a replacement for Cursor, VS Code, Claude Code or JetBrains.

`C-26` recorded that this implies a hosting decision the corpus deliberately never made. **`D-31`:
multi-tenant SaaS first** — the decision with the widest blast radius in the amendment. It escalates
credentials from important to blocking, turns egress into a tenant-isolation control, and makes the
second execution provider near-certainly Kubernetes.

`D-40`: self-hosted is out of scope now, with the seams kept abstracted.

## 4. Requirements affected

**Zero existing requirements are invalidated.** 164 clauses resolve to requirements, principles or
decisions that already cover them — `PP-006` engine independence, `PP-003` human-in-the-loop,
`PP-010` observability, `PC-1`, `PC-3`, `FR-024` to `FR-028`, `ADR-0001` to `ADR-0003`.

190 clauses are `needs-enhancement`: an existing requirement covers the ground and the amendment
widens it. 66 are `missing` and 22 `should-integrate`.

Full breakdown in [`register/verdicts.md`](./register/verdicts.md). No requirement identifier was
renumbered.

## 5. Modules affected

| Module | Effect |
|---|---|
| M-08 Specification Engine | Agent and execution seams added; EPIC-003 closed, EPIC-028 built |
| M-06 Workflow | `GenerationJob` → `AgentRun` state machine (`D-25`), held in EPIC-012 |
| M-04 Specification | Source-of-truth rule (`D-29`); Spec Kit lifecycle as workflows, held |
| M-13 Security | Egress profiles, credential isolation, context authorization |
| M-11 DevOps | Repository operations, CI/CD integration, held in EPIC-014 |
| M-16 API & Integration | Integration Hub — **new, unowned** |

`D-23` (the deferred 18-module re-cut) is **not triggered** by this amendment; the dependency is
recorded, and the re-cut should happen once, folding in `D-1` and `D-9`.

## 6. Epics affected

**No epic's delivery posture changed.** EPIC-028 was created on 2026-08-13 to carry the buildable
slice and is now 65/66. EPIC-003 closed. EPIC-007 keeps its identifier and scope (`D-33`).

Nineteen epics remain held behind `PMI-DOC-004`. Six or more **new** epics are implied — three Rooms,
Decision Intelligence, Context Engine, Integration Hub — plus the three unowned Cosmos areas.

## 7. New requirements

**Eighteen**, all in the `FR-AMD-*` namespace, and all belonging to this reconciliation rather than
to the product. `FR-AMD-003` forbids creating a product requirement identifier where an existing one
applies, and `G-27-03` asserts every `new_identifier` carries a stated necessity.

**Zero new product requirement identifiers were created by this reconciliation.** The capabilities
the amendment introduces will acquire identifiers when their epics are specified, which is the
correct moment — not now, while `PMI-DOC-004` is outstanding.

## 8. Requirements requiring modification

None modified in place. `FR-AMD-016` bounds this epic to analysis, and `G-27-09` **blocks CI** if any
product source file changes.

Enhancements are *recorded* against 190 clauses and land in the owning epic when it unfreezes. The
one existing artifact this epic corrected is its **own** spec: `SC-AMD-011` said *seventeen* and
*twenty* one sentence apart (`DEF-027-001`).

## 9. Requirements that should become integrations

`FR-AMD-010`, answered in full. Eight capabilities are classified `integrated`, each with a named
abstraction boundary:

AI code generation (`AgentGateway.execute()`) · source control (`CreateImplementationBranch()`) ·
CI/CD · cloud provisioning (`ProjectExecutionEnvironment`) · communication · deep code review ·
static analysis and security scanning · IDE tooling.

**Nothing in the existing corpus moves from native to integrated.** The amendment introduces these as
integrations; it does not ask PMI Studio to give up anything already specified. §2 forbids removing
functionality merely because an external product provides something similar, and `G-27-04` asserts
`removed_because_external` is false on all 45 rows.

## 10. Architecture changes

Four dependency rules are now enforced by build-failing tests, up from two:

```text
backend        ──►  engine adapter               ❌  (existing)
service        ──►  HTTP types                   ❌  PC-1 (existing)
engine adapter ──►  a named AI provider          ❌  NEW — enforced
any component  ──►  a container runtime directly ❌  NEW — enforced
execution-contract ──► agent-contract            ❌  NEW — layering
```

The layering rule matters most: the agent contract references `ExecutionSession`, never the reverse.
Getting it backwards would make the execution layer depend on the AI layer.

## 11. New and updated ADRs

**Seventeen created** — `ADR-0006` to `ADR-0022`, twelve from Native §27 and five from Cosmos §9,
under `D-35`. **Eight Accepted, nine Open**, and every open one names what it awaits.

**`ADR-0001` to `ADR-0005` are preserved and `supersedes` is empty on every new row.** No existing
ADR was superseded. `ADR-0002` is *extended* by `ADR-0013` (`D-36`).

Three became decidable only because EPIC-028 shipped: an ADR whose decision is already in the tree is
not open, it is undocumented.

## 12. Engineering Integration Hub impact

**Missing entirely.** Zero corpus occurrences (`PRE-008`). The Hub would own MCP connectivity, API and
CLI adapters, plugin architecture, webhook ingestion, credential management, capability discovery,
tool registration, integration health, rate limiting and integration audit logging.

Cosmos §5 adds the **Capability Resolver**: a workflow requests `CreatePullRequest()` and the resolver
selects an authorized GitHub MCP adapter, GitHub API adapter or GitLab adapter. This is the same
abstraction argument this programme has already applied twice — to engines and to agents — so the
pattern is proven even though the component is not built.

**New held epic, M-16. Unowned.**

## 13. AI Gateway and Agent Orchestrator impact

**Largely built.** `packages/agent-contract` declares `AgentGateway`, `AgentDescriptor` and a closed
failure taxonomy; two adapters run one shared conformance suite; `agent-independence.spec.ts` makes a
named provider a build failure.

`D-30` remains **open**: is the AI Gateway native or integrated? Recommendation — split, with the
agent layer native and model routing integrable. Cosmos §3.3's **Engineering Expert** model extends
`AgentDescriptor` with role, fallback model, retrieval strategy, prohibited actions, approval
requirements and an **Evidence Contract**. These are fields on an existing type, not a new
abstraction (`ADR-0020`, decided).

## 14. Context Engine and Knowledge Graph impact

**Context Engine: missing** (`PRE-009`). Cosmos §3.2 decomposes it into four coordinated capabilities
— semantic retrieval, knowledge graph, live engineering state and **context curation**. Curation is
the one that matters for governance: it decides what an agent may see, which is an access-control
decision, not a search decision.

**Knowledge Graph: needs enhancement.** EPIC-011 and EPIC-022 exist and are held. The amendment
expands the node and edge set substantially — agent sessions, decisions, evidence, incidents — but
the capability itself is specified.

`D-24` (`pgvector`) stays open: adopt when the first similarity requirement is planned, not before.

## 15. Remote Workspace impact

The `ProjectExecutionEnvironment` port is **built**, with a Docker provider behind it and every
`ADR-0002` control asserted field-by-field in CI.

Cosmos §6's **Workspace Fabric** extends this with customer-cloud and controlled local-connector
modes. The port accommodates them; **neither is built**, and the hosted substrate `D-31` implies has
**no owning epic**.

`D-22`: the git remote is the durable substrate; volumes are cache and always reconstructible. This
avoids a new storage tier to operate, back up and isolate per tenant.

## 16. Requirement Room impact

**Does not exist** (`PRE-003`). Zero corpus occurrences.

The amendment describes requirement capture, AI analysis, clarification questions, options,
trade-offs, risk identification, acceptance-criteria generation, MoSCoW/WSJF prioritisation, a
twelve-state requirement machine and baselining.

**EPIC-007 is not this.** It owns six CRUD requirements and states AI-assisted analysis is out of
scope (Finding B). `D-33`: EPIC-007 unchanged; the Engine becomes a new held epic.

## 17. Change Room impact

**Does not exist** (`PRE-001`). Zero corpus occurrences — and "Change Room" is one of only two
concepts appearing in **all five** amendment documents, which is what made the false premise so
persuasive.

Scope: change request intake, AI impact analysis across the traceability graph, affected
requirements/specifications/architecture/tasks/code/tests, cost and schedule analysis, options,
trade-offs, recommendation, authorized decision, re-baseline.

**New held epic behind `PMI-DOC-004`** — correctly, since the BRS is precisely the document that
should settle change-approval behaviour.

## 18. Defect Room impact

**Does not exist as a product capability** (`PRE-002`).

This is the section where `FR-AMD-007` matters most. The word *defect* appears in **all 27** other
epic specs — always as the Constitution VI obligation that `specs/<epic>/defects/` holds no open
records. That is a **repository process convention**, not a product Defect Room. A careless search
returns 27 hits and concludes the capability exists.

Scope: defect intake from automated and manual sources, AI triage into Confirmed Defect / Change
Request / Requirement Gap / Duplicate / Cannot Reproduce / Invalid, expectation-verification testing,
a TDD remediation queue, and evidence-gated completion.

The governing rule: **a defect must first prove the implementation violates an already-approved
expectation.** If current behaviour matches the baseline, it is a Change Request.

## 19. Governance and security impact

**Strengthened, not weakened.** `PP-003` gains a checkable mechanism — the Human Decision / AI
Recommendation / AI Execution split. `PP-016` gains decision evidence packages. Cosmos §7 adds
risk-adaptive banding so not every AI action needs approval.

Security decisions taken: per-run minted, purpose-scoped, short-lived credentials (`D-27`); BYOK as a
near-term requirement (`D-41`); named egress profiles, proxy-enforced (`D-28`); `ADR-0002`'s threat
model widened from *the agent is untrusted* to *the agent is untrusted **and** the neighbouring
tenant is untrusted*.

**The credential broker and the egress proxy are unbuilt and unowned.** `R-AI-011` and `R-AI-009` are
uninvestigated.

## 20. Traceability and evidence impact

Traceability expands from the specification chain to the full engineering graph: business goal
through requirement, decision, specification, architecture, plan, epic, feature, task, **agent run**,
code change, commit, PR, test, security evidence, release, deployment, incident, defect and change
request. Native §23 adds that relationships are **typed and bidirectional**, not strictly
hierarchical.

Evidence becomes a first-class concept: an **Engineering Evidence Package**, and completion gates
that evaluate it. Cosmos §3.5 states the rule — *"An agent reporting 'done' is not sufficient."*

Neither exists (`PRE-010`). EPIC-011 and EPIC-022 own the graph and are held.

## 21. Implementation-plan impact

The plan absorbed the amendment without re-planning. `_shared/ai-native-architecture.md` records the
target seams; `srs-alignment.md` Parts 8–10 record the conflicts and decisions; EPIC-028 carried the
buildable slice.

**Delivery sequence is unchanged for held work**, because the amendment is architecture and
positioning, not a Business Requirement Specification (`D-34`).

## 22. Tasks to add, change or remove

**Removed: none.** `FR-AMD-017` requires work in flight to continue, and `G-27-14` blocks CI on any
posture change.

**Added**: EPIC-028's 66 tasks (2026-08-13) and this epic's 51. **Changed**: `T646`/`T647`/`T648`
routed from EPIC-003 to EPIC-028, and `T138` routed to EPIC-013 (`C-29`) — routed, never reissued,
so exactly one epic owns each.

**Future tasks are named but not generated.** §17 makes reconciliation the precondition for new
implementation tasks, and the capabilities they would implement are held.

## 23. Migration strategy

**Additive throughout — there is no migration.** No schema change, no data migration, no breaking
contract change.

`SpecKitAdapterOptions.runtime` became `.environment`, and `ContainerRuntime`/`SandboxSession` are
retained as deprecated type aliases so existing tests compile. `ExecutionSession` is deliberately
identical in shape to the `SandboxSession` it replaces.

Three preserved-element changes are recorded with all five Native §28 fields in
[`register/preserved-elements.md`](./register/preserved-elements.md).

## 24. Risks

| Risk | Assessment |
|---|---|
| **`SC-AGT-001` unverified** | No real container has ever started. `T646b` needs a Docker daemon; RAID `R-04` blocks it in CI |
| **Three capability areas unowned** | Governed Engineering Loops, Governed Learning, Specification Compliance Agent |
| **Four architectural components unowned** | SaaS substrate, egress proxy, credential broker, BYOK — all decided, none homed |
| **Nine of fourteen `R-AI-*` uninvestigated** | Including `R-AI-011` (credential delegation) and `R-AI-014` (MCP least privilege) |
| **`RAID R-02` AI cost** | Re-scored **down** by `D-41` — the first structural mitigation after three epics flagged it |
| **393 tasks held on one document** | 54% of the corpus waits on `PMI-DOC-004`. No engineering sequence changes that |

## 25. Open decisions requiring human approval

Nine, each with options and consequences in [`register/decisions.md`](./register/decisions.md).

**Carried from `srs-alignment.md` Part 8**: `D-23` (18-module re-cut — *record the dependency*),
`D-24` (`pgvector` — *when the first similarity requirement is planned*), `D-30` (AI Gateway native
or integrated — *split*), `D-34` (does the amendment release the hold — ***no***), `D-36`
(`ADR-0002` extended or superseded — *extended*), `D-37` (Human/AI register in `_shared/` — *yes*),
`D-39` (branch-vs-epic check — ***yes, seven occurrences***).

**Raised by this reconciliation**: `UNOWNED-1` — who owns the three Cosmos capability areas;
`UNOWNED-2` — who owns the SaaS substrate, egress proxy, credential broker and BYOK.

---

## Proposed implementation sequence

§17.11's three bands. **`FR-AMD-011`**.

### Band 1 — immediate architectural corrections

No BRS dependency. **Built to its last line and stopping there.**

`D-20` agent contract ✅ · `D-21` execution port ✅ · `D-28` egress profiles ✅ ·
agent-independence test ✅ · Spec Kit as default engine ✅ · **`T646b` the first real container run
🔴 NOT DONE**

One command stands between this programme and the first specification ever produced by a real
container, and it is not an engineering task — it needs a machine with a Docker daemon.

**Also Band 1, and unstarted**: persistent project state (`EPIC-029`, proposed) — the only proceeding
capability area still unspecified.

### Band 2 — near-term, unblocked by the BRS

Credential broker and BYOK intake (`D-27`, `D-41`) · egress proxy (`D-28`) · SaaS hosting substrate
(`D-31`) · agent-facing MCP context surface and its least-privilege model (`D-26`, `R-AI-014`) ·
Human/AI responsibility register in `_shared/` (`D-37`) · `AgentDescriptor` extension to Engineering
Expert (`ADR-0020`).

**Four of these have no owning epic.** That is `UNOWNED-2`, and it is the most actionable finding in
this report: they are decided, unblocked and homeless.

### Band 3 — later platform capability

All behind `PMI-DOC-004`: the three Rooms · Decision Intelligence · Context Engine (four
capabilities) · Evidence Package and completion gates · Integration Hub and Capability Resolver ·
Knowledge Graph expansion · Governed Engineering Loops · Governed Learning · Specification Compliance
Agent · interactive engineering workspace · Workspace Fabric modes · `AgentRun` state machine.

**Sixteen of twenty capability areas sit here, and none can start until one business document
exists.** That is the honest shape of this programme: the engineering is not the constraint.
