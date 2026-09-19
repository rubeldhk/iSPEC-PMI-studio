# Quickstart: Change Room

**Epic**: `EPIC-034` · **Phase**: 1 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

How to prove this Epic works without reading its code. Every scenario maps to a success criterion.

Details are linked, not repeated: entities in [data-model.md](./data-model.md), interfaces in
[contracts/change-contract.md](./contracts/change-contract.md), decisions in
[research.md](./research.md).

---

## Prerequisites

- Node ≥ 22, `pnpm@9.15.9`; PostgreSQL reachable by `backend/prisma`.
- `pnpm install --frozen-lockfile` (`TS-003`).
- **`EPIC-033` Phase 2 must be built** — `packages/room-contract` and `RoomShell` are imported, not
  derived (`R-034-3`).
- **Work in a worktree** — the plan records the concurrent-session gate as FAIL.

---

## Scenario 1 — Nothing changes an approved baseline except through this Room

**Proves**: `SC-CHR-001`, `FR-CHR-010`, `FR-CHR-011`, `RULE-02`.

Propose a modification to an approved baseline; then attempt implementation work that depends on the
undecided change.

**Expected**: the modification is recordable only as a Change Request **linked to that baseline**,
and the dependent work is refused until the change is decided.

> **Mutation check, required at exit.** Add a path that changes an approved baseline without a
> decided Change Request and this must fail. `EPIC-033` refuses the in-place edit; this Room is where
> the refusal leads, and without it `RULE-02` is a dead end.

---

## Scenario 2 — All eight impact areas are present, and unknown is one of them

**Proves**: `SC-CHR-002`, `FR-CHR-030`, `FR-CHR-032`, `FR-CHR-034`.

Raise a change against an artifact with known downstream dependents, in a project where the
architecture-violation check is unowned.

**Expected**: eight areas returned, always. Impacted areas list their items. The **architecture area
returns `unknown`** with the reason *"violation check not owned (`BR-0073`, `U-17`)"* — not a clean
panel.

> **Mutation check, required at exit.** Make an undeterminable area render as absent rather than
> `unknown` and this must fail. An absent row and a clean row are the same pixel.

---

## Scenario 3 — The impact view is composed, never rebuilt

**Proves**: `FR-CHR-031`, `R-034-1`.

Assemble an impact view, then assert by architecture test that this Room performs **no traversal of
its own** — `ImpactService` and `ChainTraversalService` do the walking.

**Expected**: passes, and the recorded `traversalDepth` is **25** — `DEFAULT_IMPACT_DEPTH`, adopted
from `EPIC-020` rather than invented.

---

## Scenario 4 — Options carry all six dimensions, including security

**Proves**: `SC-CHR-003`-adjacent, `FR-CHR-040`–`FR-CHR-042`.

Trigger a material change decision.

**Expected**: two or more options — **one option is a compile error**, the type is a minimum-length
tuple. Each states schedule, cost, quality, **security**, compatibility and delivery, or explicitly
marks a dimension `not-applicable`. Each is labelled `recommendation`; none is pre-selected.

---

## Scenario 5 — Baseline change stays human-approved under every policy

**Proves**: `SC-CHR-003`, `FR-CHR-050`, `FR-CHR-051`.

Set the most permissive tenant policy available and submit a material change.

**Expected**: authorized human approval required, and the refusal names the constraint. Then attempt
a decision under an agent identity.

**Expected**: refused by the **database check constraint**, not only the policy engine — the belt the
`EPIC-033` precedent established, so the fence holds even if a caller bypasses `EPIC-031`.

---

## Scenario 6 — An approved change re-baselines, and the old baseline is untouched

**Proves**: `SC-CHR-004`, `FR-CHR-060`, `FR-CHR-061`, `FR-CHR-063`.

Approve a change and apply it.

**Expected**: new artifact versions exist; the prior baseline is **byte-identical** to before and
names its successor; and `GET …/delta` returns a **set diff over member version ids** — added,
removed, version-changed — not two full versions and not a text diff (`R-034-4`).

---

## Scenario 7 — Re-plan is recorded, and nothing is destroyed

**Proves**: `SC-CHR-007`, `FR-CHR-062`, `FR-CHR-065`, and `R-034-2`'s trap.

Apply a change affecting a specification that already has tasks, some of them complete.

**Expected**: a `RePlanObligation` is **recorded**, naming what must change and why. **No task is
replaced. No completed task loses its state.** Then assert by architecture test that this Room does
**not import `TaskRegenerationService`**.

> **This is the scenario that exists because of a near-miss.** `TaskRegenerationService.regenerate()`
> is named exactly for this job and **replaces** the task list — `replaced: boolean`, *"existing when
> refused, the new list when replaced"*. Calling it would satisfy `FR-CHR-062`'s wording, pass its
> tests, and violate `BR-0154`. Executing a non-destructive revision is `U-12`'s.

---

## Scenario 8 — A change against a superseded baseline is rebased, explicitly

**Proves**: `SC-CHR-009`, `FR-CHR-013`, `FR-CHR-054`, `R-034-5`.

Approve change A against baseline v1. Then attempt to apply change B, also raised against v1.

**Expected**: B is **not** silently retargeted. It is rebased onto v2 as a recorded act, and
**re-decided because its impact view changed** — the test compares the snapshot stored with B's
decision against a view recomputed on v2.

`EPIC-030`'s first-commit-wins is deliberately not inherited: it settles which transition won, not
what a decision was made against.

---

## Scenario 9 — Closure answers four questions from its own record

**Proves**: `SC-CHR-006`, `SC-CHR-005`, `FR-CHR-070`–`FR-CHR-073`.

Close a change with its Evidence Contract unmet; then satisfy it and close again.

**Expected**: first refused, naming the unmet items. Then closed, and the record answers **what
changed, why, which tests and evidence validate it, and which baseline supersedes the old state** —
without reconstruction.

---

## Scenario 10 — An emergency change has fewer minutes, not fewer gates

**Proves**: `FR-CHR-021`, `ADR-0025` constraint 2.

Raise a change with the highest urgency and attempt to close a required gate by skipping it.

**Expected**: urgency is recorded on the request and changes no gate. The skip resolves to a recorded
exception or a violation — never a pass.

---

## Scenario 11 — A Defect Room transfer arrives whole, and can go back

**Proves**: `FR-CHR-012`, `BR-0057`, `R-034-6`.

Transfer an item from the Defect Room; then refuse it.

**Expected**: on arrival, context and evidence are preserved **by reference** — the `EPIC-032`
attestation keeps its single identity, not a copy with the same digest — and the origin is visible.
On refusal, it **returns** to the Defect Room with the refusal attached; it does not vanish between
two Rooms.

Exercised jointly with `EPIC-035` (`FR-DFR-074`), which specifies the same path from the other side.

---

## Scenario 12 — The Room cannot diverge from its siblings

**Proves**: `SC-CHR-008`, `SC-CHR-010`, `FR-CHR-080`, `FR-CHR-081`.

Three checks:

1. Region names compared against `packages/room-contract` → identical.
2. Remove a region from this Room's `RoomShell` usage → **does not compile**.
3. Attempt to transition a Change Room object under the Requirement Room's stages → refused by
   `EPIC-030`'s `T944a`.

**Expected**: all three hold. The first two hold because this Room **imports** the pattern rather
than deriving it (`R-034-3`).

---

## Scenario 13 — Constitution XI Tier 1: the Room is wired

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
const app = moduleRef.createNestApplication();
await app.init();
await request(app.getHttpServer()).post('/rooms/change/requests').expect(201);
```

**Expected**: passes. Then **remove `ChangeRoomModule` from `AppModule` and re-run — it must fail.**

---

## Scenario 14 — Constitution XI Tier 2: the journey, against a running application

**Proves**: the tier this Epic owes.

Start the application. Carry a change from request through impact, options, decision and
re-baseline. Record a **run-generated** transcript.

**Expected**: a committed transcript naming the run, each step walked and the outcome, passing its
conformance check. **Hand-written evidence is a constitution violation of the first order.**

The transcript must cover the **whole chain** — the failure mode here is a Room whose regions each
work and whose flow does not.

---

## Full gate before declaring the Epic done

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:governance
```

Then the mutation checks (Scenarios 1, 2, and the Tier 1 inversion in 13),
`/speckit-converge` clean, and an empty `defects/`.

**Three things to restate rather than quietly drop**: `BR-0154` re-plan remains `U-12`'s, `BR-0073`
architecture-violation flagging remains `U-17`'s, and `BR-0083` rationale queries remain `U-17`'s.
This Room's delivery closes none of them.
