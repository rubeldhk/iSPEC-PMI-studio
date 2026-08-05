# Implementation Plan: Unattended Runs, Team Review, Access Control & External Storage

**Epic**: `EPIC-002` | **Modules**: M-06 Workflow / M-13 Security & Governance / M-11 DevOps |
**Date**: 2026-08-05 | **Spec**: [spec.md](./spec.md)

**Tasks**: 87 · [tasks.md](./tasks.md) | **Posture**: ⏸ **HELD** (decision D-10) — product surface

**Shared design** — not duplicated here: [`../_shared/`](../_shared/)
([platform-spec](../_shared/platform-spec.md) · [system-design](../_shared/system-design.md) ·
[data-model](../_shared/data-model.md) · [schema](../_shared/schema.sql) ·
[platform-api](../_shared/contracts/platform-api.md) · [RAID](../_shared/raid-log.md))

**ADRs**: [ADR-0001](../../adr/ADR-0001-spec-kit-behind-engine-adapter.md) — the adapter pattern this
epic reuses for storage · [ADR-0004](../../adr/ADR-0004-one-way-external-storage-publishing.md)

> ## ⚠️ This is a retroactive plan
>
> **`tasks.md` was written before this plan existed** — 67 tasks on 2026-08-05, deduplicated to 68,
> then extended to **87** by the follow-up `/speckit-tasks` pass this plan triggered. That inverts the
> normal order and means those tasks never passed a Constitution Check until now. This plan therefore
> does two jobs: it records the technical context the tasks assumed, and it **reviews the existing
> task list**. Six gaps were found; **five are closed**, and **G-02.6 (split) remains open** as a
> governance decision.
>
> This is the largest instance of finding **C3** in the repository — 12 epics hold `tasks.md` with no
> `plan.md` — and at 45 requirements it is the one where the missing gate mattered most.

## Summary

Three loosely-coupled capability areas that arrived as one feature request:

1. **Unattended runs with batched team review** — a run that never pauses, records every question it
   would have asked along with its own suggested answer, marks everything derived from a guess as
   *provisional*, and hands the team one collective decision session.
2. **Per-artifact access control** — direct read/edit grants to named users; a deliberate, bounded
   advance on the SRS roadmap's Phase 3 governance.
3. **External file storage** — publish project artifacts one-way to Google Drive, Dropbox, or S3
   behind an interchangeable provider boundary.

The organising insight is that **an unattended run never decides**. It defers, marks, and carries on.
That is what makes this the programme's strongest expression of **PP-003 Human-in-the-Loop** and
**PP-016 Explainable AI** — both designed in before `PMI-DOC-003` existed.

## Scope

| Function | Tasks | What it delivers |
|---|---|---|
| F-02.1 Unattended run mode | 11 | Run modes, stop-point range, question deferral, provisional marking, **runs API** |
| F-02.2 Provisional approval override | 4 | Warn-and-override approval; attributed override records |
| F-02.3 Team review and answer submission | 15 | Sessions, draft answers, conflicts, atomic submission, authority |
| F-02.4 Re-run with submitted answers | 6 | Answer application, marking clearance, new-session rule, stale warnings |
| F-02.5 Artifact access control | 15 | Grants, enforcement, hiding, inheritance, last-editor guarantee, snapshots, **access API**, **integration tests** |
| F-02.6 External storage integration | 25 | Provider contract, connections, publish, failure taxonomy, switching, fixture, **storage + publish API**, **conformance suite**, **architecture test** |
| F-02.7 Interface | 6 | Review session, access grants, storage connections |
| Phase Z Epic closure | 5 | Per-epic gate, including the SRS back-fill **approval** gate (T404) |

**68 → 87 tasks** on 2026-08-05, closing G-02.3, G-02.4 and G-02.5 plus the storage conformance suite
and the provider-independence architecture test.

## Technical Context

Inherited from [`../_shared/plan.md`](../_shared/plan.md) — TypeScript on Node 22, NestJS, Prisma,
PostgreSQL 16, BullMQ + Valkey, React + Vite, Vitest, Testcontainers. Specific to this epic:

**A run is not a generation job.** EPIC-001's `GenerationJob` is one engine invocation. A `Run` here
spans *many* invocations across a user-selected range, survives questions, and carries an access
snapshot. Modelling them as one thing breaks both — [research.md](./research.md) **R-002-1**.

**Access control is a second authorisation layer, not a replacement.** EPIC-004's workspace scoping
(FR-002, `workspace_id` on every row) still runs first and still returns **404, not 403**. Per-artifact
grants narrow *within* a workspace. Two layers, evaluated in order — **R-002-2**.

**Storage providers reuse the engine adapter pattern.** `packages/storage-contract` mirrors
`packages/engine-contract`: plain-data contract, capability refusal, a deliberately trivial fixture
adapter, and an architecture test that fails the build if `backend/` names a provider. This is the
SRS's own instruction — *"Spec Kit becomes the first implementation, not the core dependency"* —
applied to storage. **R-002-3** and
[contracts/storage-provider-contract.md](./contracts/storage-provider-contract.md).

**Publishing is one-way and permanent** (ADR-0004), confirmed by clarification as a boundary rather
than a staged simplification. Nothing at a provider can alter a platform artifact.

**Access is evaluated against a snapshot taken when a run starts**, so a long unattended run cannot
half-apply a mid-flight permission change (FR-028). Unusual, and easy to implement wrongly —
**R-002-4**.

**Concurrency has two distinct guards**: answer conflicts within a review session (FR-013) and
concurrent publishes of one project (FR-040). Different mechanisms, different failure modes —
**R-002-6**.

**NEEDS CLARIFICATION**: none. The spec's five-question session of 2026-08-02 resolved every marker;
zero remain. The seven open technical questions are resolved in Phase 0.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes produced only via Spec Kit commands — no direct edits | PASS |
| II | Every requirement traces to a cited `SRS/` document; untraced items in Assumptions | ⚠️ **PASS WITH DEBT** — **two whole capability areas have no SRS source**: unattended runs (FR-001–FR-020) and third-party storage (FR-029–FR-040). Declared in the spec with a named back-fill owner and re-verified against the MPS drop. `T404` gates **approval**, not merely closure. The largest Constitution II debt in the programme |
| III | Work decomposed Epic → Feature → Task; Epic ID assigned and directory exists | PASS — 7 functions + closure, 87 tasks. ⚠️ See **G-02.6**: split candidate, and 87 tasks strengthens the case |
| IV | `/speckit-converge` scheduled as the Epic exit gate | PASS — `Phase Z` present in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit-test task, written to fail first | ✅ **PASS** — G-02.3 and G-02.4 closed 2026-08-05. Every controller now carries a unit test and a contract test |
| VI | `specs/002-team-review-access-storage/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session/clone labelled with the working Epic, or the first command | PASS — `tasks.md` declares `EPIC-002 Team Review & Storage`; this session is labelled `speckit-constitution` (its first command) and states so in its closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before this work started | PASS — 0 commits behind `origin/main`, verified 2026-08-04 |
| — | No other Claude session active on this checkout | ⚠️ **CANNOT ASSERT** — `002/tasks.md` and `018/tasks.md` appeared in this working tree mid-session, authored outside it. The single-session assumption did not hold today |
| — | Principle register present, deferrals argued (D-6) | PASS — 20/20 declared; 4 deferrals, each owned |
| — | **C-01 identifier collision** | ⚠️ **UNRESOLVED** — this epic's `FR-001`–`FR-040` collide with the platform set, and 68 task descriptions now cite them. Decision **D-1** owns the fix |

**Any FAIL blocks Phase 0.** No outright FAIL. **Three qualified gates** — II, V, and session
isolation — carried into Complexity Tracking rather than waved through.

**Post-design re-check (after Phase 1)**: **PASS**, with the same three qualifications. The design
strengthens two gates: the storage contract makes PP-015 provider-independence build-time enforceable
rather than asserted (mirroring what `T047` does for engines), and separating `Run` from
`GenerationJob` makes the access snapshot and the provisional-marking graph coherent. Gate II's debt
is **unchanged by design work** — only the project owner can discharge it.

## Gaps this plan records

Reviewing the pre-existing task list against the spec surfaced six things.

### G-02.1 · Duplicate closure sections — ✅ fixed 2026-08-05

`tasks.md` carried an `F-02.8 · Epic closure` section (T403–T406) *and* a `Phase Z · Epic closure`
block (T411–T414). **My error**: the Phase Z appender guarded on the literal string `"Phase Z"` and
did not see the differently-titled section. The two also wrote to different files —
`epic-closure-report.md` versus `closure.md` — and only `closure.md` is what EPIC-014 `F-11.2`
confirms.

✅ **Fixed.** `T403`, `T405`, `T406` removed as exact duplicates; **`T404` preserved** into Phase Z,
because the SRS back-fill approval gate exists nowhere else. 71 → 68 tasks.

### G-02.2 · No API contract existed for this epic's endpoints — ✅ closed by this plan

`_shared/contracts/platform-api.md` is EPIC-001's surface. This epic adds review sessions, access
grants, storage connections, and publishes — **none of which appear in any contract**. `T364` writes
contract tests for review endpoints that no contract defined.

✅ **Closed** — [contracts/platform-api-epic-002.md](./contracts/platform-api-epic-002.md) specifies
all four endpoint groups.

### G-02.3 · `T365` implements endpoints with no unit test — ✅ closed 2026-08-05

Every other controller in the programme carries both a unit test and a contract test — `T055`/`T054a`,
`T070`/`T069a`, `T083`/`T082a`. `T365` had only the contract test `T364`. A Constitution V gap.

✅ **Closed** — `T364a` adds the controller unit test; `T365` now cites both.

### G-02.4 · **No capability area had an API surface** — ✅ closed 2026-08-05

⚠️ **Worse than first recorded.** The original entry said access and storage lacked controllers. On
checking, **only one controller task existed in the entire epic** (`T365`, review) — runs (`F-02.1`)
had none either. All three capability areas were serviced by nothing.

Meanwhile `T400` built an access-grant UI and `T402` a storage connections page, both calling APIs
that no task created. Same class as finding **G1** in EPIC-012, three times over.

✅ **Closed** — nine tasks added: runs (`T415`–`T417`), access (`T418`–`T420`), storage connections
(`T421`–`T423`), publish (`T424`–`T426`), each with a unit test and a contract test.

### G-02.5 · No integration tests against a real database — ✅ closed 2026-08-05

`SC-007` — "zero artifacts visible to a user holding no grant" — is a claim about what the *database*
returns under a real query. That is exactly the argument EPIC-004 made for `T052` using Testcontainers
rather than a mock: a mocked repository passes while the real query leaks.

✅ **Closed** — `T427` (enforcement returns absence against real PostgreSQL), `T428` (last-editor
invariant under concurrent revocation), `T429` (concurrent-publish advisory lock).

### G-02.6 · This epic is a split candidate

Three capability areas, 8 functions, **87 tasks**, 45 requirements, 7 user stories. `F-02.5` and `F-02.6`
are explicitly independent of the run/review chain and of each other — the task file's own build order
says three developers could work in parallel. That is the shape **D-15** split EPIC-001 for and
**D-18** split EPIC-017 for.

**Recommended cut**: unattended runs + review (F-02.1–F-02.4, US1–US3) · access control (F-02.5, US4)
· external storage (F-02.6, US5–US7). Splitting is a governance decision, so this plan **recommends
but does not execute** it.

## Build order

```text
F-02.1 run mode ──► F-02.2 provisional approval ──► F-02.3 review ──► F-02.4 re-run

F-02.5 access control     (independent of the chain, and of storage)
F-02.6 storage contract ──► connections ──► publish ──► switching
                                    └──► F-02.7 interface ──► Phase Z closure
```

**The storage contract precedes every storage service**, and the fixture provider (`T396`) precedes
the real ones — the ordering EPIC-003 chose deliberately, for the same reason: it makes everything
above the adapter provably correct before the slowest, least certain component exists.

**Access control should land early despite being independent.** `F-02.6` publish must exclude
artifacts the publisher cannot access (FR-033), so storage silently depends on access being real.

## Design notes specific to this epic

**A provisional marking is a link, not a flag.** It joins an artifact to the *specific question* that
governs it, which is what lets FR-017 clear markings selectively when that question is answered. A
boolean would force regenerating everything.

**Conflicts block submission; they do not auto-resolve.** Two people answering differently is a
disagreement to surface, not a race to win. Last-write-wins would silently discard a colleague's
judgement — the opposite of what a review session is for.

**Hiding is not the same as refusing.** FR-024 requires an inaccessible artifact to be *absent* from
listings, not shown as a locked placeholder. A placeholder discloses existence — the same reasoning
behind EPIC-004's 404-not-403 rule.

**The last-editor guarantee is a system invariant, not a validation.** FR-027 must hold under
concurrent revocations, which means enforcing it in the same transaction as the revoke — not checking
first and revoking after.

**Publish failure reasons are a closed taxonomy.** FR-035 names five. The platform's existing job
failure enum deliberately has no `unknown` member, and this one must not either: a generic failure is
a defect.

**The republish preview is computed before anything is written** (FR-036). "Tell the user what will
change, then change it" is only true if the preview is not itself the first write.

## Risks carried by this epic

| Risk | Score | How this epic handles it |
|---|---|---|
| **Constitution II debt** — two capability areas unsourced | **high** | `T404` gates *approval*, not closure. The strongest control short of refusing to build |
| **R-02** AI cost | 9 | ⚠️ **Increased.** Unattended runs raise AI spend more than any other epic — a run proceeds through many invocations with no human checkpoint. PP-017's controls remain deferred to M-07 |
| **New — access control implemented as a filter, not a boundary** | high | `SC-007` is a database-level claim; **G-02.5** requires integration tests, mirroring EPIC-004 `T052` |
| **New — storage provider lock-in** | medium | Contract + fixture + architecture test, mirroring `T047`. Without the arch test this erodes exactly as engine independence would have |
| **New — `Run` conflated with `GenerationJob`** | medium | Settled in **R-002-1** before any task touches the schema |

## Phase 0 outputs

- [research.md](./research.md) — 7 decisions, 3 flagged ⚠️ as expensive to reverse

## Phase 1 outputs

- [data-model.md](./data-model.md) — 12 entities, the two-layer authorisation rule, state transitions
- [contracts/storage-provider-contract.md](./contracts/storage-provider-contract.md) — the provider
  boundary, capability set, failure taxonomy, and conformance suite
- [contracts/platform-api-epic-002.md](./contracts/platform-api-epic-002.md) — the four endpoint
  groups this epic adds (**closes G-02.2**)
- [quickstart.md](./quickstart.md) — 9 validation scenarios, V02-1 to V02-9

## Definition of done

- [ ] 87 tasks complete, every unit test passing (Constitution V)
- [ ] **SRS back-fill complete** for FR-001–FR-020 and FR-029–FR-040 (`T404`) — gates approval
- [ ] Quickstart **V02-1** to **V02-9** pass
- [ ] Integration tests green against a **real** PostgreSQL for access enforcement (G-02.5)
- [ ] `pnpm test:arch` green — no storage provider named outside the adapter layer
- [ ] Conformance suite green against the fixture provider and at least one real provider
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records

## Complexity Tracking

| Complexity / qualification | Why | Simpler alternative rejected because |
|---|---|---|
| `Run` separate from `GenerationJob` | A run spans many invocations, survives questions, and carries an access snapshot | Reusing `GenerationJob` needs a nullable parent, a mode flag, and a snapshot column on a table meaning "one engine invocation" — three concessions to avoid one table |
| A second authorisation layer over workspace scoping | FR-021–FR-028 need per-artifact grants; workspace scoping is per-tenant | Replacing workspace scoping with grants makes every existing query a permission query and puts SC-004 at risk |
| A storage contract package mirroring the engine contract | FR-030/FR-039 require interchangeable providers; SC-011 requires zero platform change | Calling provider SDKs directly from services makes SC-011 untestable and repeats the mistake ADR-0001 exists to prevent |
| **Gate II qualified** — two capability areas unsourced | The feature request is real; the SRS has not caught up | Refusing to plan until back-fill lands stalls an epic the owner asked for. `T404` converts the debt into an approval gate |
| ~~Gate V qualified~~ | ✅ Closed 2026-08-05 by the follow-up `/speckit-tasks` pass | — |
| **Session-isolation row unassertable** | Files authored outside this session appeared mid-turn | Asserting PASS would be false. Recorded as observed fact |
