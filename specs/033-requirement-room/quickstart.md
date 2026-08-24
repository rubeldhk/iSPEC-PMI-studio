# Quickstart: Requirement Room

**Epic**: `EPIC-033` · **Phase**: 1 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

How to prove this Epic works without reading its code. Every scenario maps to a success criterion.

Details are linked, not repeated: entities in [data-model.md](./data-model.md), interfaces in
[contracts/room-contract.md](./contracts/room-contract.md), decisions in
[research.md](./research.md).

---

## Prerequisites

- Node ≥ 22, `pnpm@9.15.9`; PostgreSQL reachable by `backend/prisma`.
- `pnpm install --frozen-lockfile` (`TS-003`).
- **Work in a worktree** — the plan records the concurrent-session gate as FAIL.

---

## Scenario 1 — Raw intent becomes an approved, immutable baseline

**Proves**: `SC-RQR-001`, `SC-RQR-006`, `FR-RQR-050`.

Submit unstructured intent; run intake, clarification, criteria, decision; baseline the set.

**Expected**: the baseline carries approver, rationale, timestamp, version, its member **version
ids** and a `setHash`. Nothing in it is a copy of requirement text (`R-033-5`).

---

## Scenario 2 — A baselined requirement cannot be edited in place

**Proves**: `SC-RQR-001`, `FR-RQR-051`, `RULE-02`.

Edit a requirement that is a member of an approved baseline.

**Expected**: `409`, carrying the Change Request affordance. Then verify the `setHash` is unchanged
— the refusal was not partial.

> **Mutation check, required at exit.** Add an in-place edit path and this must fail. `RULE-02` is
> the rule the Change Room's existence depends on.

---

## Scenario 3 — Every AI element carries exactly one epistemic label

**Proves**: `SC-RQR-002`, `FR-RQR-011`, `UX-0031`.

Run analysis over intent containing a known gap and a known ambiguity.

**Expected**: every element is `fact`, `inference`, `recommendation` or `open-question`. Then attempt
to construct an unlabelled element in a test.

**Expected**: **it does not compile** (`R-033-4`). The runtime assertion is a backstop, not the
guarantee.

> **Mutation check, required at exit.** Make `epistemic` optional and this must fail.

---

## Scenario 4 — Nothing baselines without measurable acceptance criteria

**Proves**: `SC-RQR-003`, `FR-RQR-030`–`FR-RQR-033`.

Attempt baseline with a requirement lacking acceptance criteria; then repeat under a recorded
exception.

**Expected**: refused, naming the requirement. Under an exception, it proceeds and the exception is
**enumerable from the baseline** without opening each requirement.

---

## Scenario 5 — Material decisions come with real options

**Proves**: `SC-RQR-005`, `FR-RQR-020`–`FR-RQR-023`.

Trigger a material decision.

**Expected**: two or more options, each with trade-offs, dependencies, risks and reasoning; each
marked a recommendation; **none pre-selected**. After deciding, the declined options are retained.

---

## Scenario 6 — No AI takes a requirement decision

**Proves**: `SC-RQR-004`, `FR-RQR-040`, `FR-RQR-041`.

Attempt a decision under an agent identity.

**Expected**: refused — and refused by a **database check constraint**, not only by a service branch
(`data-model.md` §4). `RULE-03`: AI recommends, humans and policy govern.

---

## Scenario 7 — A baseline is a selectable specification input

**Proves**: `SC-RQR-006`, `FR-RQR-060`–`FR-RQR-062`.

Baseline a set, start a specification workflow, select the baseline.

**Expected**: the specification records the baseline **version**. The reference is engine-agnostic —
nothing in the handoff names Spec Kit.

---

## Scenario 8 — The Room shows what is blocking it

**Proves**: `FR-RQR-073`, `UX-0032`.

Leave an open clarification and an unmet Evidence Contract item.

**Expected**: both appear in the Room header without opening another screen. The view is derived, so
answering the clarification changes it on the next read with nothing to invalidate.

---

## Scenario 9 — The Room cannot omit or invent a region

**Proves**: `SC-RQR-007`, `FR-RQR-070`, `FR-RQR-071`, `UX-0035`.

Two compile-time checks and one runtime one:

1. Remove a region from the Room's `RoomShell` usage → **does not compile**.
2. Add a seventh region → **nowhere to put it**.
3. Compare rendered region names against `packages/room-contract` → identical.

**Expected**: all three hold. This is the pattern `EPIC-034` and `EPIC-035` inherit (`R-033-3`), so
it is verified here rather than three times.

---

## Scenario 10 — The Room is its own workflow type

**Proves**: `SC-RQR-009`, `FR-RQR-001`, `FR-GEL-004`.

Attempt to transition a Requirement Room object under the Change Room's stages or authorities.

**Expected**: refused by `EPIC-030`'s `T944a`/`T944b`. Also assert `Execute` and `Verify` appear in
the progress projection as **omitted**, not absent (`FR-GEL-008`).

---

## Scenario 11 — An external stakeholder is told, not failed

**Proves**: `FR-RQR-004`, `UX-0002`.

Attempt access as an identity outside the workspace.

**Expected**: the Room states that external stakeholder review is not available, rather than
rendering and failing on click. `BR-0004` is `U-02` and unowned; no interim path exists by design.

---

## Scenario 12 — Constitution XI Tier 1: the Room is wired

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
const app = moduleRef.createNestApplication();
await app.init();
await request(app.getHttpServer()).post('/rooms/requirement/intake').expect(201);
```

**Expected**: passes. Then **remove `RequirementRoomModule` from `AppModule` and re-run — it must
fail.**

---

## Scenario 13 — Constitution XI Tier 2: the journey, by keyboard, against a running application

**Proves**: the tier this Epic owes, and `SC-RQR-008`.

Start the application. Carry unstructured intent through to an approved baseline **using only a
keyboard**, with focus visible at every step. Record a **run-generated** transcript.

**Expected**: a committed transcript naming the run, each step walked, and the outcome — passing its
conformance check. **Hand-written evidence is a constitution violation of the first order.**

`SC-RQR-008` requires the keyboard-only path, so this is a keyboard transcript or it discharges
nothing (`R-033-8`).

---

## Full gate before declaring the Epic done

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:governance
```

Then the mutation checks (Scenarios 2 and 3, plus the Tier 1 inversion in 12),
`/speckit-converge` clean, and an empty `defects/`.

**And one thing to restate rather than quietly drop**: `BR-0004` external stakeholder access remains
`U-02`'s. This Room's delivery does not close it.
