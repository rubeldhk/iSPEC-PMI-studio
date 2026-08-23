# Quickstart: Governed Engineering Loop

**Epic**: `EPIC-030` · **Phase**: 1 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

How to prove this Epic works, end to end, without reading its code. Every scenario maps to a success
criterion and is runnable from a clean checkout.

Details live elsewhere and are linked rather than repeated: entity shapes in
[`data-model.md`](./data-model.md), interfaces in
[`contracts/loop-contract.md`](./contracts/loop-contract.md), decisions in
[`research.md`](./research.md).

---

## Prerequisites

- Node ≥ 22, `pnpm@9.15.9` (repository `packageManager`).
- A PostgreSQL instance reachable by `backend/prisma` — the same one the existing
  `backend-integration` suite uses.
- `pnpm install` with a frozen lockfile (`TS-003`).

```bash
pnpm install --frozen-lockfile
```

---

## Scenario 1 — A workflow type this Epic's code does not name runs end to end

**Proves**: `SC-GEL-001` — a new governed workflow needs **zero** lines of new engine code.

1. Add `packages/loop-contract/workflows/example-review.json` declaring any subset of the eight
   stages.
2. Insert the tenant row supplying authorities for its transitions.
3. Drive an object through every declared stage over the HTTP routes.

```bash
pnpm test:integration
```

**Expected**: the object reaches `Outcome`; `git diff --stat backend/src` shows **no change**. The
test asserts this, so a future change that requires engine edits for a new workflow type fails
rather than being noticed later.

---

## Scenario 2 — State cannot be written except by a transition

**Proves**: `SC-GEL-002`, `FR-GEL-010`.

```bash
pnpm test:integration
```

**Expected**: the direct-write attempt is refused. The test is written to fail first against a build
where the write path is open, per Constitution V.

---

## Scenario 3 — A completed loop reconstructs from audit alone

**Proves**: `SC-GEL-005`, `FR-GEL-013`.

Drive an object to `Outcome`, then rebuild its history from `LoopTransition` rows **with
`LoopObject.currentStage` withheld**, and assert the reconstruction equals the live object's stage.

**Expected**: identical. This is what makes `currentStage` a cache rather than a second source of
truth (`data-model.md §6`).

---

## Scenario 4 — The audit store goes away and the loop refuses

**Proves**: `SC-GEL-009`, `FR-GEL-041` — the fail-closed guarantee.

1. Point the audit writer at a failing handle.
2. Attempt a transition.

**Expected**: the transition is **refused**, and the object's stage is unchanged when read back —
because both writes shared one database transaction (`R-030-2`).

> **Mutation check, required at exit.** Split the two writes so audit failure no longer rolls the
> transition back, and this scenario must fail. A fail-closed test that passes against a
> fail-open build is decoration (Constitution V).

---

## Scenario 5 — Two transitions race and exactly one wins

**Proves**: `SC-GEL-011`, `FR-GEL-015`.

Issue two `POST /loop/objects/:id/transitions` concurrently with the same `expectedVersion`.

**Expected**: one returns `accepted`; the other returns **`409 Conflict`** carrying `wonBy`. Both are
recorded as `LoopTransition` rows. Repeat under load and assert **zero** pairs where both succeed.

---

## Scenario 6 — An automated transition with no rule cannot be configured

**Proves**: `SC-GEL-004`, `FR-GEL-031`, `RULE-11`.

Add a workflow file with `"trigger": {}` — a trigger carrying no rule id.

```bash
pnpm test:arch
```

**Expected**: the conformance check **fails at load**, naming the file and the transition. Not a
runtime warning — `FR-GEL-031` requires the refusal when the configuration is read.

---

## Scenario 7 — A required gate cannot be passed by omission

**Proves**: `SC-GEL-008`, `FR-GEL-021`.

Attempt a transition whose configuration declares a required gate, with no outcome recorded for it.

**Expected**: refused. The only reachable results are `refused`, `exception` and `violation`.

> **Mutation check, required at exit.** Add a fifth `satisfied-by-default` branch and this scenario
> must fail.

---

## Scenario 8 — A tenant cannot add a stage

**Proves**: `FR-GEL-009` (clarified 2026-08-22).

Attempt to write a tenant configuration row whose `stages` differ from the programme file.

**Expected**: refused. Stages come from the file; the tenant row supplies authorities, gates and
triggers only.

---

## Scenario 9 — A configuration change without approval does not load

**Proves**: `SC-GEL-010`, `FR-GEL-016` (clarified 2026-08-22).

Load a configuration with `approvedBy` absent.

**Expected**: refused at load. Then enumerate the tenant-reachable configuration surface and assert
**no** path sets or lowers the approval requirement — verified by enumeration, not by inspecting
defaults.

---

## Scenario 10 — Constitution XI Tier 1: the loop is actually wired

**Proves**: the reachability gate, and the defect class Principle XI was ratified over.

```bash
pnpm test:integration
```

The test bootstraps the **real composition root** and drives a transition over the real HTTP route:

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
const app = moduleRef.createNestApplication();
await app.init();
await request(app.getHttpServer()).post('/loop/objects/…/transitions').expect(201);
```

**Expected**: passes. Then **remove `LoopModule` from `AppModule` and re-run — it must fail.** That
inversion is the whole point: a test importing `LoopModule` directly would still pass, which is why
`R-030-8` requires `AppModule`.

> **This Epic sets the backend Tier 1 precedent.** No `createNestApplication` test exists in the
> repository today — verified, not assumed. Later backend Epics copy this file.

---

## Full gate before declaring the Epic done

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:governance
```

Then, per the Epic Exit Criteria in [`spec.md`](./spec.md): the four mutation checks
(`FR-GEL-021`, `FR-GEL-041`, `FR-GEL-016`, plus the Tier 1 inversion above), `/speckit-converge`
clean, and an empty `defects/`.

**Tier 2 does not apply** — this Epic delivers no user-facing journey. Loop progress becomes visible
when a Room renders it (`EPIC-033`–`035`).
