# Research: AI-Native Amendment Reconciliation

**Epic**: `EPIC-027` | **Date**: 2026-08-13 | **Plan**: [plan.md](./plan.md)

Two registers. The first is the fourteen research items **Native Spec-Kit §26 names by identifier** —
these are not mine to invent or rename, and §26 is explicit: *"Do not make unsupported assumptions
where research is required."* The second is eight items this reassessment raised that §26 does not
cover.

**A note on honesty.** Several `R-AI-*` items ask what a specific vendor's product supports *today*.
I have not run those investigations in this session, and a plausible-sounding answer written from
memory is exactly what §26 forbids. Those are marked **OPEN — not investigated**, with what they
block. Five items are answerable from this repository alone; those are answered, with the evidence.

---

## Register 1 — Native Spec-Kit §26 research items

| ID | Question | Status | Blocks |
|---|---|---|---|
| **R-AI-001** | Current supported server-side Claude Code / Agent SDK execution model | 🔴 **OPEN — not investigated** | Claude reference adapter design; `D-20` implementation, not the decision |
| **R-AI-002** | Claude Code headless / container execution | 🟡 **Partially known** — see below | Whether today's sandbox invocation survives the agent-contract refactor |
| **R-AI-003** | Claude MCP integration and authorization | 🔴 OPEN | `D-26` MCP phase move; least-privilege model |
| **R-AI-004** | Claude hooks / subagent applicability to PMI governance | 🔴 OPEN | Whether governance gates can be enforced *inside* an agent run or only around it |
| **R-AI-005** | Cursor remote / cloud / CLI / agent integration capabilities | 🔴 OPEN | Whether a Cursor adapter is buildable at all — which is the evidence `D-20` ultimately rests on |
| **R-AI-006** | Spec Kit behaviour in persistent vs disposable repositories | 🟡 **Partially known** — see below | `D-22`, `D-29` — the source-of-truth rule |
| **R-AI-007** | Best mechanism for preserving Spec Kit project state between agent runs | 🔴 OPEN | `D-22` persistent project state |
| **R-AI-008** | Provider-neutral agent contract design | 🟢 **Answered** — see below | `D-20`; drafted in [contracts/agent-gateway.md](./contracts/agent-gateway.md) |
| **R-AI-009** | Sandbox network/credential isolation for agents needing package/repo/MCP access | 🟡 **Partially answered** — see below | `D-28` egress profiles |
| **R-AI-010** | Persistent workspace vs ephemeral worktree/container trade-offs | 🟡 Partially answered | `D-21`, `D-22` |
| **R-AI-011** | Secure git credential delegation to ephemeral agents | 🔴 OPEN | `D-27` — the largest new security surface |
| **R-AI-012** | Agent cancellation and timeout semantics | 🟢 **Answered from the repository** — see below | `D-25` state machine |
| **R-AI-013** | Model/context/cost metadata availability across providers | 🔴 OPEN | RAID **R-02** re-scoring (`D-38`); PP-017 |
| **R-AI-014** | MCP least-privilege authorization model | 🔴 OPEN | `D-26`; ContextScope design |

**Nine open, three partial, two answered.** That ratio is itself a finding: the amendment's agent
layer rests on vendor capabilities nobody in this programme has verified, and §26 exists precisely
because the documents' authors knew it.

### R-AI-002 · Claude Code headless execution — partially known

**What the repository already demonstrates**: `speckit.adapter.ts` invokes `claude -p /speckit-tasks`
and `claude -p /speckit-analyze` inside a container, and `engine-image.spec.ts` asserts the image
pins an agent CLI version. So a non-interactive, single-shot invocation model is what the design
assumes and what the tests encode.

**What is not known**: whether that invocation is the *supported* server-side model, what it costs
in session/authentication terms, and whether multi-turn or long-running agent work needs a different
mechanism. **Critically: no container has ever been started** (EPIC-003 closure report), so the
invocation is asserted by mocks, not observed.

**Consequence**: `D-20` (introduce the agent contract) does **not** depend on this. The contract's
shape is provider-neutral by construction. The *Claude adapter's implementation* does depend on it,
and that work should not start until `R-AI-001`/`R-AI-002` are investigated.

### R-AI-006 · Spec Kit in persistent vs disposable repositories — partially known

**Known from this repository's own use**: Spec Kit maintains `.specify/feature.json`, numbered
`specs/NNN-slug/` directories, and template state that survives across commands. It is designed for a
persistent repository — this repository is one. The disposable-sandbox usage in `speckit.adapter.ts`
is the *unusual* configuration, adopted because generation had no persistent project to run in.

**Unknown**: how Spec Kit behaves when two agent runs touch one persistent project concurrently;
whether feature numbering is safe under concurrency; what happens when a run is cancelled mid-command.

**This is the mechanical half of `D-29`.** The governance half — which store is authoritative — is a
decision, not a research finding.

### R-AI-008 · Provider-neutral agent contract — answered 🟢

**The answer is in this repository, and it has already been validated once.**

`ADR-0001` established the pattern: a contract package, a build-time architecture test, and a
deliberately trivial fixture implementation that proves the contract is not shaped around one
provider. The EPIC-003 closure report records what that bought — *"the conformance suite found three
real defects in my own adapter"* — which is the strongest available evidence that the pattern works
rather than merely looking tidy.

**Design decision**: the agent contract copies it exactly.

| Element | Engine precedent | Agent equivalent |
|---|---|---|
| Contract package | `packages/engine-contract` | `packages/agent-contract` |
| Architecture test | `engine-independence.spec.ts` | `agent-independence.spec.ts` |
| Neutrality proof | `engine-adapters/fixture` | `agent-adapters/fixture` |
| Conformance suite | 13 cases, both adapters | equivalent, from the start |
| Typed failures | `engineFail(reason, detail)` | same taxonomy shape |
| Composition root | `worker/src/engine-composition.ts` | extended, same file |

**Rationale**: adopting a proven in-repository pattern is cheaper and lower-risk than designing a new
one, and it means the agent layer inherits an enforcement mechanism that has already caught real
defects. **Alternatives considered**: a single merged contract (rejected — Native §3 forbids it, and
A.3 shows the merge already causes the harm §3 predicts); an external gateway SDK as the contract
(rejected — it would make a vendor's API the architectural authority, which Native §30 forbids in
terms).

### R-AI-009 · Sandbox network and credential isolation — partially answered 🟡

**Answered**: the *shape* is settled. `EgressPolicy` becomes a named-profile abstraction rather than
a single list, because the two execution purposes have genuinely different needs and collapsing them
means granting generation the access implementation requires.

| Profile | Egress | Credentials | Status |
|---|---|---|---|
| `generation` | AI provider endpoint only | AI provider token | **Built and tested. Unchanged.** |
| `implementation` | AI provider · package registries · repository · approved MCP servers · documentation services | AI token + per-run scoped repository token | **New — enumerated, never open** |

**Not answered**: the concrete allow-list contents (registry hostnames vary by ecosystem and by
mirror), and whether egress is enforced at container network level, a proxy, or both. Native §19 is
explicit that *"Do NOT simply open general internet access"* — a proxy with an allow-list is the
mechanism that makes the policy auditable, but that is a recommendation, not a verified design.

### R-AI-012 · Cancellation and timeout semantics — answered from the repository 🟢

The EPIC-003 conformance suite found this exact class of bug three times, and the findings transfer
directly to the agent layer:

1. *"`addEventListener('abort')` never fires on an already-aborted signal"* — a cancellation arriving
   in a narrow window was missed, **and the run then reported a timeout for what was a cancellation.**
2. *"The adapter waited for a hung step instead of self-terminating"* — the wall-clock flag was set
   and nothing acted on it.
3. A bad correlation id was reported as `engine_unavailable`, disguising a wiring defect as an outage.

**Conclusion**: the agent contract must specify cancellation and timeout semantics *in the contract*,
and its conformance suite must include the already-aborted-signal case and the hung-step case from
day one. These are not hypothetical edge cases; they are defects this programme has already shipped
once and caught only because a conformance suite existed.

**This is the single most transferable piece of knowledge the platform has**, and it is why
`D-20`'s recommendation is "now" rather than "when the first agent adapter is written".

---

## Register 2 — reassessment research items

| ID | Question | Status | Blocks |
|---|---|---|---|
| **R-027-1** | Does the clause register need to be machine-readable, or is markdown enough? | 🟢 Answered | Constitution V compliance for this epic |
| **R-027-2** | What synchronisation model reconciles PostgreSQL governance state with repository markdown? | 🔴 OPEN | `D-29` — the deepest design question in the amendment |
| **R-027-3** | Can BullMQ carry human-approval waits, or is a durable workflow engine required? | 🟢 Answered | `D-25` |
| **R-027-4** | At what corpus size do PostgreSQL recursive traversals stop meeting the knowledge-graph latency need? | 🔴 OPEN — needs measurement | Whether a graph store ever enters the stack |
| **R-027-5** | Is `pgvector` sufficient for duplicate detection and context selection at target scale? | 🟡 Partial | `D-24` |
| **R-027-6** | What is an acceptable context-assembly latency and token budget per agent run? | 🔴 OPEN | Context Engine design; PP-017 |
| **R-027-7** | Does the amendment's positioning (§1) require multi-tenant SaaS hosting? | 🔴 OPEN — **business decision, not research** | `D-31` |
| **R-027-8** | How many substantive clauses are there across the five documents? | 🟢 Answered — ~470 | Sizing F-27.1 |

### R-027-1 · Machine-readable register — answered 🟢

**Decision: markdown for humans, a generated JSON projection for checks.**

Constitution V (v1.2.0) requires an executable conformance check that *can fail*. A check that parses
prose to decide whether every clause has a verdict is brittle and will produce false confidence — the
exact failure mode Principle V's rationale names (*"a document that silently rots, and rotted
governance is worse than none because it is still trusted"*).

**Rationale**: the register's rows are structured data wearing a table's clothing. Emitting a JSON
projection alongside the markdown makes `SC-AMD-001` through `SC-AMD-012` assertable in a few lines
each rather than by regex over prose.

**Alternatives**: JSON only (rejected — the register must be readable by the project owner, who is
its audience); markdown only with regex checks (rejected — brittle, and a check that passes on
malformed input is decoration). Schema in
[contracts/reconciliation-register.md](./contracts/reconciliation-register.md).

### R-027-3 · Human-approval waits — answered 🟢

**Decision: a database-owned run state machine; BullMQ carries compute segments only.**

**Rationale**: three independent reasons, any one sufficient.

1. **Timeouts stop meaning anything.** Native §20 requires jobs to remain "timeout-controlled". A run
   in `waiting_for_approval` for six days is not late; a compute segment running for six hours is.
   One wall-clock cap cannot express both.
2. **Worker slots are finite.** A held job occupies concurrency that generation needs. The current
   design's bounded worker concurrency (`system-design.md`) becomes a queue of approvals.
3. **Recovery semantics.** §20 insists states be added only with defined *transition ownership*. A
   database row has an owner and a transition log; an in-flight queue job's suspended state does not.

**Mechanism**: a run suspends by *completing* its queue job and persisting `waiting_for_approval`. The
approval event enqueues a fresh job to resume. Restart-safety and idempotency — both §20 requirements
— come free, because resumption reads persisted state rather than in-memory continuation.

**Alternative considered and rejected for now**: **Temporal** or an equivalent durable-workflow
engine. It solves this properly and would also carry the Integration Hub's long-running interactions.
Rejected because Native §28 preserves BullMQ, because it adds an operational service to a product
aimed at organisations without platform teams (§1), and because the database-machine approach is not
a dead end — it is the state Temporal would model anyway. **Trigger to revisit**: when more than one
capability needs multi-step compensation, or when run duration routinely exceeds a day.

### R-027-5 · `pgvector` sufficiency — partial 🟡

**What is known**: `pgvector` handles corpora in the low millions of vectors with HNSW indexing, and
keeps embeddings transactionally consistent with the rows they describe — which matters here more
than raw recall, because a retired requirement whose embedding survives is a governance defect.

**What is not known for this product**: the corpus size at target scale. The Backlog states
10,000+ stories and 50,000+ tasks; if every requirement, specification section, defect and change
request is embedded, the vector count is plausibly in the low hundreds of thousands per large
tenant — comfortably inside `pgvector`'s range, but unmeasured.

**Recorded threshold rather than a guess**: revisit if p95 similarity query latency exceeds the 1s
budget already set for traceability views (platform clarification, 2026-08-13 register), or if index
build time blocks migrations.

### R-027-8 · Clause count — answered 🟢

Approximate substantive clause counts, used to size F-27.1. "Substantive" means a statement carrying
a normative verb (SHALL/MUST/SHOULD/MAY) or naming a capability, entity, workflow step or constraint.

| Document | Sections | Approx. substantive clauses |
|---|---|---|
| Plan Amendment | 19 | ~150 |
| Native Spec-Kit Execution Environment | 30 | ~120 |
| Recommended PMI Studio lifecycle | 13 + architecture | ~45 |
| Defect Management governed intelligence workflow | 12 | ~25 |
| Augment/Cosmos Learnings Amendment *(added 2026-08-14)* | 13 | ~130 |
| **Total** | **87** | **~470** |

Overlap is substantial — the three Rooms appear in four of the five documents — so the register's
row count will exceed the number of *distinct* capabilities considerably. `FR-AMD-002` requires a
verdict per clause regardless; duplicates resolve to the same owner, which is how the register proves
`SC-AMD-003` (no new identifier where one exists).

**Granularity settled 2026-08-14: one row per clause, duplicates cross-linked** — not one row per
distinct capability. The collapsed form was offered and rejected for a specific reason: **it cannot
prove `SC-AMD-001`.** A register that lists a capability and cites the clauses mentioning it looks
identical whether every clause was read or three were missed, because a clause nobody noticed simply
never appears. Cross-linked duplicates cost roughly 200 extra rows and buy the one property the
criterion actually asserts — *zero clauses silently dropped*.

---

## What research does **not** resolve

Six of the twenty-two items above are business or architecture **decisions** wearing research
clothing. Recording them here so they are not mistaken for work an investigation can discharge:

| Looks like research | Is actually |
|---|---|
| `R-027-7` SaaS vs self-hosted | Business model decision — `D-31` |
| Source-of-truth authority (`R-027-2`'s governance half) | Governance decision — `D-29` |
| Whether the Rooms are new capability | Premise ruling — `D-32`, and Finding A already supplies the evidence |
| Whether Requirement Intelligence is EPIC-007 | Scope decision — `D-33` |
| Whether MCP moves phase | Sequencing decision — `D-26` |
| Whether the BRS hold releases | Owner decision — `D-34` |

**Native §26's instruction cuts both ways.** Not making unsupported assumptions where research is
required also means not commissioning research where a decision is required. Six investigations that
would have produced nothing are avoided by saying so.
