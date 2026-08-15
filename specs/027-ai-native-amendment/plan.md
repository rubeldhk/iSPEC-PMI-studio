# Implementation Plan: AI-Native Amendment Reconciliation

**Epic**: `EPIC-027` | **Module**: programme reconciliation (no product module) | **Date**: 2026-08-13 |
**Spec**: [spec.md](./spec.md)

**Posture**: ▶ **PROCEEDING** — analysis of held work is not held work.

**Companion artifacts**: [research.md](./research.md) · [data-model.md](./data-model.md) ·
[contracts/](./contracts/) · [quickstart.md](./quickstart.md)

**Rulings that shaped this plan**: **D-10** (proceed/hold split), **D-12** (authority layered by
subject), **D-16** (authority layered by artifact population), **D-15/D-18/D-19** (epics sit below
modules). All in [srs-alignment.md](../srs-alignment.md).

---

## Summary

The project owner asked for a reassessment of **solution, architecture, system design and
technology** against the amendment documents — four at the time, five since 2026-08-14 — and for the questions to be gathered rather than
dripped out one at a time.

This plan did that. It is not a build plan — `FR-AMD-016` bounds EPIC-027 to analysis — but it is
also not a plan to *write a plan*. The reassessment itself was the deliverable, because §17 makes it
the precondition for every implementation task the amendment implies.

**The reassessment now lives in [`_shared/ai-native-architecture.md`](../_shared/ai-native-architecture.md)
and [`srs-alignment.md`](../srs-alignment.md) Part 8** — see *The reassessment — where it lives*
below for why it moved. What follows here is the summary a reader needs before opening either, and
then EPIC-027's own plan.

**The headline finding is not in the documents. It is in the code.**

> The amendment's central architectural demand — separate the *specification engine* from the *AI
> agent* (Native §3) — is already violated in the built tree, and the violation is invisible because
> the test that would catch it does not exist. `engine-adapters/speckit/src/speckit.adapter.ts`
> hardcodes `claude` as a command name in four places and takes a single opaque `aiProviderToken`.
> Today that is *legal*: the architecture test guards `backend/**` against engine references, and an
> adapter is permitted to be engine-specific. But it means **swapping the AI provider and swapping
> the specification engine are the same edit**, which is precisely the merge Native §3 forbids.

Three further findings compound it, all verified against the repository rather than asserted:

- The `ContainerRuntime` port exists with **no production implementation** (`T646`), and `T646` is
  the *next task the programme was about to do* (EPIC-003 closure report, 2026-08-08). Implementing
  it as a Docker driver — the obvious reading — creates exactly the coupling Native §4 forbids.
  **This is the single most time-critical item in the amendment.**
- The sandbox egress allow-list is *"AI provider endpoint only"*, asserted by test and recorded in
  `ADR-0002`. Native §19 explicitly instructs re-evaluating it. This is the amendment's only direct
  conflict with a **built and tested security control**.
- The current design deliberately destroys the workspace after every job and never commits it.
  Native §5 requires persistent project state alongside ephemeral execution. That is not an
  enhancement of the existing sandbox; it is a second storage tier that does not exist.

Everything else the amendment introduces — Integration Hub, Context Engine, Knowledge Graph,
Evidence Packages, the three Rooms — is **product surface**, and therefore lands behind the
`PMI-DOC-004` hold that already holds nineteen epics. That is the honest answer to the scope-creep
question: the amendment's *immediately actionable* surface is small, architectural, and sits inside
the lane that is already proceeding.

> **Planning session outcome, 2026-08-13.** Twenty-two decisions were raised and **twelve were taken
> in session** — including all three that gate the next task in the programme. The largest is
> `D-31`: **PMI Studio is multi-tenant SaaS first**, which the corpus had deliberately never decided
> and which the amendment's §1 positioning forces. Its consequences propagate through credentials,
> egress, tenancy and cost, and are recorded rather than left to be rediscovered. Nine decisions
> remain open; each has a recommendation and none blocks Band 1.

---

## Technical Context

**Language/Version**: none for this epic's own outputs. The reassessment reasons about the existing
TypeScript 5.x / Node 22 LTS platform; conformance checks are written in the repository's existing
Vitest toolchain.

**Primary Dependencies**: none new *for EPIC-027*. Four candidate additions are evaluated in
[`_shared/ai-native-architecture.md`](../_shared/ai-native-architecture.md) §B.2 for later epics. Two
were **adopted in session** — an execution-substrate driver behind the PEE port (`D-21`) and a
credential broker (`D-27`, `D-41`). Two remain **recommended, not adopted**: `pgvector` (`D-24`) and
the model-routing layer beneath the agent gateway (`D-30`). **None is installed by this epic.**

**Storage**: the git repository. The reconciliation register is a versioned markdown + machine-
readable pair (see [contracts/reconciliation-register.md](./contracts/reconciliation-register.md)).

**Testing**: executable conformance checks under `tests/governance/`, alongside the 159 checks
EPIC-018 already runs. Constitution V (v1.2.0) covers document outputs through exactly this
mechanism; there is no exemption to argue.

**Target Platform**: the repository and its specification corpus. No runtime, no deployment.

**Project Type**: programme reconciliation / architecture analysis.

**Performance Goals**: not applicable to this epic. The reassessment *sets* two thresholds for
later work — knowledge-graph traversal and context assembly — and both are recorded as open
(`R-027-4`, `R-027-6`).

**Constraints**:
- `FR-AMD-016` — analysis only. No product capability, no in-place rewriting of existing specs.
- `FR-AMD-001` — additive. Native §28's sixteen preserved elements are the floor.
- **PP-002 Single Source of Truth** is the failure mode most likely here: the amendment restates
  capabilities that already exist under other names. Every classification must resolve to one owner.

**Scale/Scope**: **5** source documents · **~470** substantive clauses · 26 existing epic specifications ·
598 tracked tasks across 24 task lists · 5 ADRs (12 more required by Native §27) · 14 named research
items · 22 decisions raised, 12 taken.

**NEEDS CLARIFICATION**: none. A clarification session on 2026-08-14 settled the register's
granularity and two further decisions — see [spec.md](./spec.md) *Clarifications*. The **seven**
remaining open decisions ([`srs-alignment.md`](../srs-alignment.md) Part 8) are **stakeholder
decisions**, not specification gaps — they are the §18.25 deliverable, not a failure to specify, and
none blocks task generation.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All changes produced only via Spec Kit commands — no direct edits | **PASS** — outputs land under `specs/027-*/`, which is exempt. No application code is touched by this epic; the code findings below are *observations*, and every correction they imply is routed to a named task in another epic |
| II | Every requirement traces to a cited `SRS/` document | **PASS** — 16 traceability rows in [spec.md](./spec.md); zero untraced requirements. This epic is fully SRS-traced, which is unusual in the corpus |
| III | Work decomposed Epic → Feature → Task; Epic ID assigned; directory exists | **PASS** — `EPIC-027`, **8 functions** defined below, each mapped to its requirements |
| IV | `/speckit-converge` scheduled as the Epic exit gate | **PASS** — Phase Z will be generated by `/speckit-tasks` |
| V | Every task carries a unit test, or for document outputs an executable conformance check that can fail | **PASS** — every function below names its check. Ratified programme-wide in constitution **v1.2.0**; no reading to argue |
| VI | `specs/027-ai-native-amendment/defects/` exists and is the sole defect intake | **PASS** — exists, empty |
| VII | Changes land in local first; promotion local → dev → stage → prod | **PASS** — trivially; this epic ships no runtime artifact |
| VIII | Session labelled with the working Epic | ⚠️ **DEVIATION** — the working branch is `epic/003-specification-engine`, not an EPIC-027 branch. Same lapse recorded in the EPIC-003 closure report; `G-08` passes because it checks branch-name *format*, not correspondence. Recorded, not hidden — see Complexity Tracking |
| IX | Run closes with Work Completed + Recommended Next Task | **PASS** |
| — | Repository synced from GitHub before work started | ⚠️ **NOT VERIFIED** — not checked this session. Stated rather than claimed |
| — | No other Claude session active on this checkout | **PASS** — asserted by the operator, not independently verifiable |
| — | **PMI-DOC-003 register** — deltas recorded per D-6 | **PASS** — 6 deltas in [spec.md](./spec.md); no principle weakened by the amendment |
| — | **D-10 honoured** — held work stays held | **PASS** — `FR-AMD-017`. The amendment is not the BRS; the hold is untouched |
| — | **D-13 not pre-empted** — the deferred 18-module re-cut is recorded, not resolved | **PASS** — `D-23` records the dependency ([srs-alignment.md](../srs-alignment.md) Part 8) |

**One deviation (VIII), no FAIL.** Phase 0 proceeds.

**Post-design re-check (after Phase 1)**: **PASS, and gate V is strengthened.** The register
contract turns `SC-AMD-001` through `SC-AMD-012` from review items into machine-readable assertions
— a clause with no verdict, a verdict with no owner, or a capability with no classification each
fail a check. That is the difference between a reconciliation that is *claimed* complete and one
that is *proven* complete, and it is what stops this epic becoming the 25-section document nobody
audits.

---

# The reassessment — where it lives

The architecture, technology and system-design reassessment this plan produced was **relocated on
2026-08-13**, immediately after the `/speckit-analyze` pass that flagged it. It is programme-wide
content, and programme-wide content inside one epic's plan is a **PP-002 Single Source of Truth**
violation waiting to happen — `D-31` commits the whole product to multi-tenant SaaS, and it must not
be discoverable only by reading EPIC-027.

| What | Now lives in | Why there |
|---|---|---|
| Architecture reassessment (`C-19`–`C-25` in design terms), technology reassessment, target seams, dependency rules | [`_shared/ai-native-architecture.md`](../_shared/ai-native-architecture.md) | Companion to `system-design.md` and `tech-stack.md`, which describe the platform as built |
| Conflicts `C-19`–`C-26` and decisions `D-20`–`D-41`, with the consequences of the twelve taken | [`srs-alignment.md`](../srs-alignment.md) **Part 8** | Where `C-01`–`C-18` and `D-1`–`D-19` already live |
| The agent and execution-environment target contracts | [`contracts/`](./contracts/) | They are EPIC-027 outputs — draft targets that `D-20`/`D-21` adopt |

**This is the D-15 refinement applied again.** That ruling moved the Principle Conformance register
out of every epic into `_shared/platform-spec.md`, because *"twenty rows × fifteen epics would have
become exactly the box-ticking ADR-0005 warned against"*. Twelve architectural decisions with
programme-wide consequences had the same problem in reverse: one epic holding what every epic needs.

**What EPIC-027 still owns**, and what the rest of this plan covers: the reconciliation register, the
§18 impact report, the ADR and research registers, and the classification of every capability area.

---

# Part D — Programme shape

## D.1 Where the amendment's capability areas land

`FR-AMD-012` requires each area to be assigned. This is the preview; the register is the deliverable.

| Capability area | Verdict | Home | Posture |
|---|---|---|---|
| Agent Gateway + agent contract | MISSING, urgent | **EPIC-028** ✅ created 2026-08-13 | ▶ proceeds — engine lane |
| ProjectExecutionEnvironment | ENHANCE, urgent | **EPIC-028** via `T646` | ▶ proceeds |
| EgressPolicy profiles | CONFLICT | **EPIC-028**, `ADR-0002` extension | ▶ proceeds |
| Persistent project state | MISSING | **New epic — EPIC-029 (proposed)** | ▶ proceeds (no product surface) |
| Agent-independence architecture test | MISSING | **EPIC-028** | ▶ proceeds |
| Execution job → AgentRun state machine | ENHANCE | **EPIC-012 Workflow & Tasks** | ⏸ held |
| Requirement Room / Requirement Intelligence | MISSING | **New epic** — *not* EPIC-007 (Finding B) | ⏸ held |
| Change Room / Change Intelligence | MISSING | New epic | ⏸ held |
| Defect Room / TDD remediation | MISSING | New epic | ⏸ held |
| Decision Intelligence / Decision Center | MISSING | New epic — shared by all three Rooms | ⏸ held |
| Engineering Context Engine | MISSING | New epic | ⏸ held |
| Knowledge Graph expansion | ENHANCE | **EPIC-011 + EPIC-022** (already exists) | ⏸ held |
| Evidence Package + Gate | MISSING | New epic, or EPIC-015 QA extension | ⏸ held |
| Integration Hub | MISSING | New epic — M-16 API & Integration | ⏸ held |
| PMI Studio MCP surface | Phase conflict | **M-09**, phase decision `D-26` | ⏸ held |
| Spec Kit native lifecycle | ENHANCE | EPIC-008 / EPIC-013 | ⏸ held |
| Human/AI responsibility model | ENHANCE | Cross-cutting → `_shared/platform-spec.md` | ▶ recordable now |
| **Governed Engineering Loops** *(Cosmos §3.1)* | MISSING | New epic — the shared workflow engine beneath the three Rooms | ⏸ held |
| **Governed Learning** *(Cosmos §3.4)* | MISSING | New epic — nothing in the August-11 set covers it | ⏸ held |
| **Specification Compliance Agent** *(Cosmos §3.5)* | MISSING | New epic, or EPIC-015 QA extension | ⏸ held |

**Twenty areas. Four proceed, sixteen are held.** That is the scope-creep answer in one table:
the amendment adds a small amount of *immediately buildable* architectural work and a long, sequenced
queue behind a gate that already exists. The count is asserted by `G-27-13` so the table and
`SC-AMD-011` cannot drift apart. The count rose from seventeen on 2026-08-14 when the
Augment/Cosmos amendment added three areas the August-11 set does not cover.

**The four proceeding areas were consolidated into one epic on 2026-08-13.** They were provisionally
split between "EPIC-003 re-entry" and a narrower EPIC-028, but they land in the same files and none
is verifiable until a container actually starts — so three convergence gates would have been three
gates on work that cannot be proven separately. [`EPIC-028 Agent & Execution Seam`](../028-agent-execution-seam/spec.md)
owns all of it, with `T646`/`T647`/`T648` **routed rather than reissued**, per the `D-19` precedent.
EPIC-003 stays closed.

## D.2 Sequencing — §17.11's three bands

**Band 1 — immediate architectural corrections** (proceeding lane, no BRS dependency).
**All three gating decisions were taken on 2026-08-13, so this band is now buildable:**

```text
✅ D-20  agent-contract package + fixture agent   ──┐
✅ D-21  PEE port widened                          ─┼─► T646 against PEE, Docker provider
✅ D-28  EgressPolicy profiles (generation frozen)  ─┘        │
                                                             └─► agent-independence.spec.ts
                                                                     └─► T647 Spec Kit as default
                                                                             └─► FIRST REAL RUN
```

That last line matters: it is the first time in the programme's history that a real container starts
and a real specification is generated. Everything in Band 1 is on the critical path to it.

**Band 2 — near-term, unblocked by the BRS**: persistent project state (`D-22` — a git reference plus
a cache policy, not a storage tier); BYOK credential intake (`D-41`); the agent-facing MCP context
surface (`D-26`) and its least-privilege model (`R-AI-014`); the Human/AI responsibility register.
The AgentRun state machine (`D-25`) and the Knowledge Graph node-type expansion sit here by nature
but land in **held** epics — EPIC-012 and EPIC-011/022 respectively.

**Band 3 — later platform capability**: the three Rooms, Decision Intelligence, Context Engine,
Evidence Gate, Integration Hub, MCP surface. All behind `PMI-DOC-004`.

## D.3 EPIC-027's own functions

**Every requirement and criterion has exactly one owning function.** The mapping is explicit so
`/speckit-tasks` allocates rather than infers.

| Function | Requirements | Criteria | Delivers | Check |
|---|---|---|---|---|
| **F-27.1** Clause register | `FR-AMD-002`, `003`, `005` | `SC-AMD-001`, `002`, `003` | Every substantive clause, one verdict, named owner. **~470 rows** — one per clause, duplicates cross-linked (clarified 2026-08-14) | `G-27-01` · `G-27-02` · `G-27-03` |
| **F-27.2** Premise checks | `FR-AMD-006`, `007` | `SC-AMD-005` | Search evidence for each "existing capability" claim | `G-27-05` |
| **F-27.3** Capability classification | `FR-AMD-004` | `SC-AMD-004`, `011` | native / integrated / hybrid + reason + boundary; the twenty capability areas enumerated | `G-27-04` · `G-27-13` |
| **F-27.4** §18 impact report | `FR-AMD-009`, `010`, `011`, `012` | `SC-AMD-006` | All 25 sections, no placeholders, ending in the three-band sequence | `G-27-06` |
| **F-27.5** ADR register | `FR-AMD-013` | `SC-AMD-007` | 12 subjects from Native §27, open ones naming what they await | `G-27-07` |
| **F-27.6** Research register | `FR-AMD-014` | `SC-AMD-008` | `R-AI-001`–`014` + `R-027-*`, each naming what it blocks | `G-27-08` |
| **F-27.7** Decision register | `FR-AMD-008`, `018` | `SC-AMD-012` | Decisions with options and consequences; `srs-alignment` reopenings justified | `G-27-10` |
| **F-27.8** Boundary & do-no-harm | `FR-AMD-001`, `015`, `016`, `017` | `SC-AMD-009`, `010` | The analysis-only boundary, the §28 preserved-element records, and the do-not-disturb rule — all three as assertions rather than promises | `G-27-09` · `G-27-12` · `G-27-14` |

**Eight functions.** `F-27.8` was added on 2026-08-13 by the analyse pass: `FR-AMD-001`, `015`, `016`,
`017` and `018` had checks drafted but **no owning function**, and `SC-AMD-010`/`SC-AMD-011` had no
check at all. Constraints that nobody owns are exactly the requirements that get dropped when task
generation runs, so they now own a function rather than floating in prose.

Coverage after the fix: **18 of 18 `FR-AMD-*` and 12 of 12 `SC-AMD-*` have an owning function and at
least one executable check.** `/speckit-tasks` will size them; the checks are specified in
[contracts/reconciliation-register.md](./contracts/reconciliation-register.md) and exercised in
[quickstart.md](./quickstart.md).

---

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| **Constitution VIII deviation** — work performed on `epic/003-specification-engine` | The branch was already checked out; branching mid-analysis would fragment an untracked epic across two branches | Branching first is genuinely simpler and should have happened. Recorded as a lapse, not justified. It is the third occurrence; `G-08` cannot catch it because it checks name *format*, not correspondence — a check that compares branch to working epic is worth adding to EPIC-018 |
| **A second adapter family** (`agent-contract` alongside `engine-contract`) | Native §3 forbids merging them, and [`_shared/ai-native-architecture.md`](../_shared/ai-native-architecture.md) §A.3 shows the merge already exists in the tree | One combined contract is simpler and is what exists today. It makes `SpecKitEngine → Cursor` inexpressible, which is the exact configuration §3 names as required |
| **EPIC-027 produces no product capability** | §17 makes reconciliation the precondition for new implementation tasks | Going straight to implementation epics. Rejected because Finding A shows the amendment's own premises are partly false — three "existing" Rooms do not exist. Planning against a false premise mis-sizes the programme |

---

## Phase 0 / Phase 1 outputs

| Artifact | Status | Contents |
|---|---|---|
| [research.md](./research.md) | ✅ written | `R-AI-001`–`014` registered with what each blocks; 8 new `R-027-*` items; 5 answerable now and answered |
| [data-model.md](./data-model.md) | ✅ written | Reconciliation register entities; proposed platform entity deltas as *proposals* |
| [contracts/agent-gateway.md](./contracts/agent-gateway.md) | ✅ drafted | Provider-neutral agent contract — target design, not built |
| [contracts/project-execution-environment.md](./contracts/project-execution-environment.md) | ✅ drafted | PEE port widening `ContainerRuntime` |
| [contracts/reconciliation-register.md](./contracts/reconciliation-register.md) | ✅ written | The machine-readable register schema the conformance checks read |
| [quickstart.md](./quickstart.md) | ✅ written | 14 executable validation scenarios |

---

