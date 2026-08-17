# Implementation Plan: Enhancement Model for Spec-Driven Engineering

**Epic**: `EPIC-017` | **Modules**: M-01 / M-04 | **Date**: 2026-08-04 | **Spec**: [spec.md](./spec.md)

**Tasks**: none — **parent design** (ruling D-18); 88 tasks live in EPIC-019/020/021/022 ·
**Posture**: ⏸ **HELD** (decision D-10) — product capability

**Shared design** — not duplicated here: [`../_shared/`](../_shared/)
([platform-spec](../_shared/platform-spec.md) · [system-design](../_shared/system-design.md) ·
[data-model](../_shared/data-model.md) · [schema](../_shared/schema.sql) ·
[engine contract](../_shared/contracts/specification-engine.md))

**Sibling**: [EPIC-018 Repository Governance Process](../018-repository-governance/plan.md) — the
process half, proceeding independently

**Rulings that shaped this plan**: **D-16** (authority layered by artifact population), **D-17**
(product/process split), and the 2026-08-04 phase-authority ruling (target state does not move the
roadmap). All three in [srs-alignment.md](../srs-alignment.md) Part 7.

## Summary

Five product capabilities that turn a specification store into a governed engineering system:
steering that constrains generation before it runs, specifications that stay current, a dependency
graph that makes change safe, review gates that put a human in front of findings, and a twelve-link
product traceability chain.

The defining planning finding is that **this epic is not one epic**. Eleven functions across two
modules, clustering into four independently valuable groups, is the shape EPIC-001 had at 215 tasks
before D-15 split it. The recommendation below is to split *before* generating tasks, not after.

## ✅ Split executed — ruling D-18, 2026-08-04

The recommendation below was taken. This plan is now the **parent design**; each child carries a thin
plan referencing it, the same `_shared/` pattern already in use for the platform.

| Child epic | Functions | Tasks | Why it stands alone |
|---|---|---|---|
| [**EPIC-019** Steering Engine](../019-steering-engine/) | F-17.1 – F-17.3 | T225–T250, T246a (27) | Delivers value with nothing else built. The only part touching the tenancy model, so it lands near EPIC-004's migration rather than paying for a second one |
| [**EPIC-020** Living Specifications & Impact](../020-living-specifications/) | F-17.4 – F-17.6 | T251–T272 (22) | Depends on specifications existing (EPIC-008/009), not on steering or gates |
| [**EPIC-021** Review Gates & Roles](../021-review-gates-roles/) | F-17.7, F-17.8, F-17.11, **F-17.12** | T273–T295 (23) | Depends on the lifecycle (EPIC-009); carries the entire PP-017 cost exposure |
| [**EPIC-022** Product Structure & Traceability](../022-product-traceability/) | F-17.9, F-17.10 | T296–T311 (16) | 🔀 Extends EPIC-011's link model rather than standing fully alone — **kept as a fold candidate**, since folding into EPIC-011 stays cheap while both are held and unimplemented |

**87 tasks across four epics** at the split (**88** since `T246a` was added on 2026-08-09), against
the ~70 estimated below. The estimates were low mainly in
F-17.2 and F-17.3, where the engine-contract extension and its three conformance cases were folded
into the function totals rather than counted.

**Ordering constraint**: EPIC-019 must land first. F-17.1 adds a tenancy scope above workspace — a
column while no workspace rows exist, a data migration afterwards.

## Scope

> ⚠️ **Historical estimates, superseded.** The per-function figures below were written *before* the
> split, when `/speckit-tasks` had not yet run. `/speckit-tasks` has since produced **88 real tasks**
> in the four child epics — see the split table above for the authoritative counts. The table is kept
> because the variance between estimate and outcome is what justified the split.

Each figure assumes the mandatory paired unit-test task (Constitution V).

| Function | Est. tasks | What it delivers |
|---|---|---|
| F-17.1 Steering scopes and hierarchy | ~6 | The organization tier above workspace; four-scope inheritance |
| F-17.2 Steering content and versioning | ~6 | Create, edit, version, retire; edit history |
| F-17.3 Steering application and provenance | ~8 | Steering reaches the engine; provenance stamped on every artifact; conflict resolution and override records |
| F-17.4 Living specification currency | ~6 | Stale marking, reconciliation, baseline-safe behaviour |
| F-17.5 Dependency graph | ~6 | Dependency edges distinct from derivation links; cycle detection |
| F-17.6 Impact analysis | ~6 | Multi-hop traversal, paths, bounded results |
| F-17.7 Review gate configuration | ~4 | Gates on lifecycle transitions, required roles |
| F-17.8 Gate execution and human decision | ~10 | Findings, the human-decision requirement, overrides, unavailable-role handling |
| F-17.9 Product specification structure | ~4 | The twenty-one-section structure for product outputs |
| F-17.10 Product traceability chain | ~8 | Twelve link types, bidirectional traversal, first-missing-link reporting |
| F-17.11 Reviewing and authoring roles | ~6 | Twelve roles with responsibilities and permitted artifact types |

**Estimated total: ~70 tasks.** That estimate is itself an argument for the split.

**Excluded** — moved out by the 2026-08-04 clarification: Enterprise Knowledge Graph and Persistent
AI Memory (→ M-10, Phase 2, with User Story 6 and `FR-ENH-017`–`019`); Prompt Registry and Model
Registry (→ M-07); Agent Marketplace (→ its approved module); repository layout, steering files, and
Spec Kit mapping (→ EPIC-018).

## Technical Context

Inherited from [`../_shared/plan.md`](../_shared/plan.md) — TypeScript on Node 22, NestJS, Prisma,
PostgreSQL 16, BullMQ + Valkey, React + Vite, Vitest. Specific to this epic:

**The tenancy model has to grow a level.** The platform carries `workspace_id` on every row from the
first migration (FR-002, EPIC-004 T013). FR-ENH-001 requires an *organization* scope above workspace.
This is the most expensive decision in the epic and it is **cheap only while no row exists** — see
[research.md](./research.md) **R-017-1**.

**Steering must not become a Spec Kit prompt.** The obvious implementation — inject steering text
into the agent prompt — puts engine-specific knowledge outside the adapter and regresses PP-006. The
contract must carry steering as structured input. **R-017-2** and
[contracts/steering-contract.md](./contracts/steering-contract.md).

**Dependency edges are not derivation links.** `TraceabilityLink` (EPIC-011 T078) records what an
artifact was *generated from*. Impact analysis needs what an artifact *depends on*. Conflating them
returns generation history instead of blast radius. **R-017-3**.

**Impact analysis is a graph query on a relational store**, against a target of 500 specifications per
project. Recursive traversal in the database, traversal in the application, and a materialised closure
table are genuinely different answers with different write costs. **R-017-5**.

**Reviewing roles run without the AI platform.** M-07 stayed deferred, so there is no model selection,
no cost optimisation, and no shared prompt registry. Twelve roles per gated transition against a
single model is the cost profile. **R-017-4** — and this is why RAID **R-02** must be re-scored.

**NEEDS CLARIFICATION**: none remaining. The three that blocked this epic were resolved on
2026-08-04; the seven open technical questions are resolved in Phase 0.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes in this plan will be produced only via Spec Kit commands — no direct edits | PASS |
| II | Every requirement traces to a cited `SRS/` document; untraced items listed in Assumptions | PASS — every `FR-ENH-###` cites `SRS/enhancement_module/`; zero untraced |
| III | Work is decomposed Epic → Feature → Task; Epic ID assigned and `specs/<epic-id>/` exists | PASS — 11 functions defined, **with the caveat that 11 functions is itself the argument for the split above** |
| IV | `/speckit-converge` is scheduled as the Epic exit gate before any promotion | PASS — discharged **per child**: each of EPIC-019/020/021/022 carries its own `Phase Z · Epic closure` (T247–T250, T269–T272, T292–T295, T308–T311). EPIC-017 has no closure of its own and is closed when all four children are |
| V | Every implementation task will carry a mandatory unit-test task, written to fail first | PASS — the estimates above assume it |
| VI | `specs/017-enhancement-model/defects/` exists and is the sole intake for defects | PASS |
| VII | Changes land in the local Claude repo first; promotion follows local → dev → stage → prod | PASS |
| VIII | Session/clone is labelled with the working Epic, or the first command | PASS — this session is labelled `speckit-constitution` (its first command); the terminal title is not settable from inside the session, so the label is stated in the closing report, as Principle VIII requires |
| IX | This run will close with a Work Completed + Recommended Next Task report | PASS |
| — | Repository was synced from GitHub before this work started | PASS — **0 commits behind `origin/main`**, verified 2026-08-04 |
| — | No other Claude session is active on this checkout (else: work in a separate clone) | PASS — single session; not independently verifiable, asserted by the operator |
| — | **PMI-DOC-003 Principle Conformance register present, deferrals argued and owned** (D-6) | PASS — 20/20 declared in [spec.md](./spec.md); 4 deferrals, **zero contested** after the 2026-08-04 rulings |
| — | **D-16 honoured** — the 21-section structure and 12-link chain scoped to product outputs | PASS — `FR-ENH-020`/`FR-ENH-021` carry the scope note; no repository document is affected |
| — | **Phase authority honoured** — M-07, M-09, M-10 not pulled forward | PASS — checked against the Adoption Register; `FR-ENH-017`–`019` left vacant rather than implemented here |

**Any FAIL blocks Phase 0.** No FAIL. One caveat recorded under gate III and carried into Complexity
Tracking.

⚠️ **Honest qualification of the sync row**: it states divergence from the remote, which is clean.
It is *not* a statement that the work is committed — 41 files are uncommitted in this working tree,
including this plan.

**Post-design re-check (after Phase 1)**: **PASS.** No gate weakened by the design. Two are
*strengthened*: PP-006 engine independence gains an explicit contract boundary for steering — the
place it was most likely to erode — and Constitution V gains a real target, because steering
resolution, cycle detection, and gate arbitration are pure functions, unit-testable without invoking
a model. Gate III's caveat *survived* the design: Phase 1 confirmed the eleven functions cluster into
four groups that share almost no entities.

## Build order

```text
F-17.1 steering scopes ──► F-17.2 content ──► F-17.3 application + provenance

F-17.5 dependency graph ──► F-17.6 impact analysis
              └─────────────► F-17.4 living specifications
                              (needs edges to know what changed upstream)

F-17.11 roles ──► F-17.7 gate configuration ──► F-17.8 gate execution

F-17.9 product structure ──► F-17.10 product traceability chain
```

**Steering scopes come first and alone.** F-17.1 changes the tenancy model. Landing after data exists
costs a migration; landing before costs a column. Nothing else in the epic should start until that
decision is taken.

**The dependency graph precedes living specifications**, deliberately. "What changed upstream" is a
question about the dependency graph. Building currency detection first means inventing a second,
weaker traversal and then deleting it.

**Roles precede gates.** A gate names the roles that must run; building gate configuration against
roles that do not exist produces a configuration model with nothing to configure.

## Design notes specific to this epic

**Steering resolution is a pure function.** Given a set of steering documents and a scope path, the
resolved set and the override records are deterministic. Keeping it pure is what makes SC-ENH-001
testable without generating anything.

**Provenance is recorded at application time, not read time.** The steering versions that constrained
a generation are stamped on the artifact when it is produced. Recomputing later returns *current*
steering, not the steering that applied — the difference between provenance and a guess.

**Gate outcomes are append-only.** A gate outcome records what the roles said and what the human
decided, including findings overridden. Editing it would destroy exactly the audit value that makes
PP-016 Explainable AI true here rather than asserted.

**An unavailable role fails the gate.** This mirrors the platform's existing failure taxonomy
(FR-026): unavailability is a named outcome, never a silent pass. Skipping "the reviewer that timed
out" is precisely how a governed action quietly becomes ungoverned.

**Bounded impact results say that they are bounded.** An unbounded traversal on a dense graph is a
denial of service against the user's own project; a silently truncated one is worse, because it reads
as completeness.

**The twelve-link chain widens `TraceabilityLink` rather than adding a second link table.**
**R-017-7** records why, and what it costs.

## Risks carried by this epic

| Risk | Score | How this epic handles it |
|---|---|---|
| **R-02** AI cost unbounded per job | **9 → must be re-scored** | ⚠️ **Increased by this epic.** Twelve roles per gated transition with M-07's optimisation controls deferred. Containment is the platform's per-job caps alone (FR-025). Re-scoring is an exit criterion, not a suggestion |
| **R-05** Engine independence erodes under delivery pressure | 6 | Steering enters through the contract, not the prompt (R-017-2); the architecture test (T047, T142) still fails the build |
| **New — organization tier lands late** | high | F-17.1 sequenced first. If this epic is deferred past EPIC-004's data landing, the cost changes from a column to a migration |
| **New — impact analysis does not scale** | medium | R-017-5 picks a strategy against the 500-specification target before implementation, not after |
| **New — steering duplicates existing validation** | medium | Steering constrains *generation*; validation findings (FR-023) assess *output*. Held distinct in the data model |

## Phase 0 outputs

- [research.md](./research.md) — 7 decisions, 3 flagged ⚠️ as expensive to reverse

## Phase 1 outputs

- [data-model.md](./data-model.md) — 10 entities, relationships, validation rules, and the
  `TraceabilityLink` extension
- [contracts/steering-contract.md](./contracts/steering-contract.md) — how steering reaches an engine
  without naming one
- [contracts/review-role-contract.md](./contracts/review-role-contract.md) — the review capability,
  its findings shape, and the unavailable-role rule
- [quickstart.md](./quickstart.md) — 8 runnable validation scenarios, V17-1 to V17-8

## Definition of done

EPIC-017 carries no tasks; it is done when all four children are. Each item below names the child
that discharges it.

- [ ] All **88** tasks complete, every unit test passing (Constitution V) — EPIC-019 (27),
      EPIC-020 (22), EPIC-021 (23), EPIC-022 (16)
- [ ] Quickstart **V17-1** to **V17-8** pass — V17-1–3 (EPIC-019), V17-4–6 (EPIC-020),
      V17-7–8 (EPIC-021). **EPIC-022 has no quickstart scenario by design**: the twelve-link chain
      cannot be validated until the code, test, release and operations epics exist to link to
      (quickstart §Not covered here). Its exit rests on unit tests plus `T308`–`T311`
- [ ] `pnpm test:arch` green — no engine-specific reference introduced by steering or roles
      (EPIC-019 `T246a`; the pre-existing `T047`/`T142` check does **not** cover prompt assembly)
- [ ] RAID **R-02** re-scored with the twelve roles in scope — EPIC-021 `T291`
- [ ] `/speckit-converge` reports no unbuilt work — per child: `T248`, `T270`, `T293`, `T309`
- [ ] `defects/` has no open records — per child: `T249`, `T271`, `T294`, `T310`

## Complexity Tracking

> No Constitution Check violations. Recorded below is deliberate complexity a reviewer would
> otherwise challenge.

| Complexity | Why needed | Simpler alternative rejected because |
|---|---|---|
| A fourth tenancy scope above workspace | FR-ENH-001 requires organization-level steering, and steering that cannot span workspaces is not organizational | Reusing workspace as the top scope makes every multi-workspace organization restate its standards per workspace — the exact drift steering exists to remove |
| Dependency edges separate from derivation links | Impact analysis and provenance answer different questions | One table with a type discriminator makes every impact query filter by type and every provenance query risk returning dependencies; the two have different cardinality and different lifetimes |
| Eleven functions in one epic | The source document presents them as one model, and specifying them together kept the scope reviewable in one place | Splitting during `/speckit-specify` would have hidden the total scope across four documents before anyone saw it whole — **which is why the split is recommended now, having seen it** |
| Gate outcomes stored append-only alongside findings | PP-016 requires the reasoning to survive, not only the verdict | Storing the final decision alone makes "why was this approved over four findings?" unanswerable three months later |
