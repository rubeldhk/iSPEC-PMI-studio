# Quickstart: Evidence Store & Evidence Contracts

**Epic**: `EPIC-032` · **Phase**: 1 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

How to prove this Epic works without reading its code. Every scenario maps to a success criterion.

Details are linked, not repeated: entities in [data-model.md](./data-model.md), interfaces in
[contracts/evidence-contract.md](./contracts/evidence-contract.md), decisions in
[research.md](./research.md).

---

## Prerequisites

- Node ≥ 22, `pnpm@9.15.9`; PostgreSQL reachable by `backend/prisma`.
- `pnpm install --frozen-lockfile` (`TS-003`).
- **Work in a worktree** — the plan records the concurrent-session gate as FAIL, discharged as
  `EPIC-030` was.

---

## Scenario 1 — "Done" does not complete anything

**Proves**: `SC-EVS-001`, `FR-EVS-030` — the requirement the whole differentiator rests on.

Attach a Contract with one unmet item, then declare completion.

```bash
pnpm test:integration
```

**Expected**: refused, naming the unmet item. Note the refusal arrives as a `Result`, not an
exception — a refusal a caller can `catch` is a refusal a caller can drop.

> **Mutation check, required at exit.** Add a bypass permitting completion with an unmet Contract
> and this must fail. `ADR-0022` quotes the source rule in five words: *"An agent reporting 'done'
> is not sufficient."*

---

## Scenario 2 — Work knows what it must prove before it starts

**Proves**: `SC-EVS-003`, `FR-EVS-020`, `FR-EVS-021`.

Declare a Contract for a work class; create work of that class; request its unmet items.

**Expected**: the Contract is attached at creation with every item unmet, and the unmet set returns
in **one** query without opening individual evidence.

---

## Scenario 3 — A Contract cannot be weakened under work in flight

**Proves**: `FR-EVS-023`, `FR-EVS-024`.

With work in flight, publish a new Contract version that removes an item.

**Expected**: **refused at load**. The in-flight work is still judged against the version it began
under. A gate that can be lowered by whoever is standing at it is not a gate.

---

## Scenario 4 — Every attestation says where it came from

**Proves**: `SC-EVS-002`, `FR-EVS-010`–`FR-EVS-013`.

Record one attestation of each `predicateType` and read them back.

**Expected**: each names source, time, attested artifact and **version**, and carries integrity
metadata. Then submit an attestation with **no subject digest**.

**Expected**: refused — and note it is refused three times over: the tuple type is non-empty, the
column is `NOT NULL`, and the in-toto schema requires it (`R-032-1`).

---

## Scenario 5 — Presence is not validity

**Proves**: `SC-EVS-006`, `SC-EVS-007`, `FR-EVS-014`, `FR-EVS-034`, `FR-EVS-012`.

Three cases, one expectation:

1. Reference evidence, then remove it from the external store → **unresolvable**.
2. Store evidence, then corrupt the payload → **integrity-failed**.
3. Attest version `v1`, then ask about `v2` → **not evidence for the current version**.

**Expected**: all three leave the Contract item **unmet**. They are distinguishable in the item's
state — a reader can tell *nobody produced it* from *it was produced and cannot be trusted* — and
identical to the gate.

---

## Scenario 6 — Nine kinds of proof behave like one kind of thing

**Proves**: `SC-EVS-004`, `FR-EVS-001`, `FR-EVS-002`.

Exercise every evidence type `BR-0140` names against **one** gate.

**Expected**: all satisfy through the same mechanism. A Contract item accepting two
`predicateType`s is met by either.

---

## Scenario 7 — A specialist tool contributes, and PMI Studio analyses nothing

**Proves**: `SC-EVS-005`, `FR-EVS-040`–`FR-EVS-043`, and `ADR-0022`'s decided boundary.

Contribute a `vulns/v0.2` attestation from a simulated scanner through the adapter path.

**Expected**: it satisfies its Contract item with **zero** analysis performed by PMI Studio, and the
record names the contributing tool and its version. *"Generic deep code review is an integration,
consuming external evidence. PMI Studio does not build a review engine."*

---

## Scenario 8 — `EPIC-015`'s suites are producers, not competitors

**Proves**: `FR-EVS-050`, and the boundary `R-032-6` established.

Run one of `EPIC-015`'s existing validation suites and assert its result lands as a
`test-result/v0.1` attestation.

**Expected**: it satisfies a Contract item. **Nothing is re-run by this Epic.** `EPIC-015` is built
and closed — *"every task here is a test"* — and `BR-0080` requires validation *"with the validation
evidence retained"*; retention is the half this Epic supplies.

---

## Scenario 9 — An unreachable store refuses

**Proves**: `SC-EVS-009`, `FR-EVS-035` (clarified 2026-08-22).

Point `EvidenceStorage` at a failing provider and declare completion.

**Expected**: **refused**. An unevaluated Contract is not a satisfied one, and an outage must not
become a window where "done" needs no proof.

> This completes the set: `EPIC-030` `FR-GEL-041`, `EPIC-031` `FR-DPE-050`, and this. Three
> substrate Epics, one failure direction.

---

## Scenario 10 — Evidence is not a side channel around access control

**Proves**: `FR-EVS-015`, `FR-EVS-016`.

Read an attestation whose attested artifact the caller may not read; then attempt a cross-workspace
read.

**Expected**: `403` and refusal respectively. A scan result naming a file someone cannot open is a
disclosure with better formatting.

---

## Scenario 11 — An empty Contract is visible, not silent

**Proves**: `FR-EVS-026`.

Publish a Contract with zero items and no `zeroItemPolicyRef`.

**Expected**: refused by the conformance check. Then add the policy reference and assert it loads —
the emptiness is now a recorded decision rather than an omission.

---

## Scenario 12 — Constitution XI Tier 1: the store is actually wired

**Proves**: the reachability gate.

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
const app = moduleRef.createNestApplication();
await app.init();
await request(app.getHttpServer()).post('/evidence').expect(201);
```

**Expected**: passes. Then **remove `EvidenceModule` from `AppModule` and re-run — it must fail.**

**Tier 2 does not apply**, and by rule rather than judgement: the *Evidence & Compliance* area needs
the compliance half, which is `U-09` and unowned, and `UX-0060` forbids building an area before its
Epic is declared (`R-032-8`).

---

## Full gate before declaring the Epic done

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:governance
```

Then the mutation checks (Scenarios 1 and 3, plus the Tier 1 inversion in 12),
`/speckit-converge` clean, and an empty `defects/`.

**And one thing that must NOT be claimed**: `ADR-0022` is **not** converged by this Epic. It stays
Open awaiting `U-09`.
