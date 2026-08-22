# Quickstart: Decision & Policy Engine

**Epic**: `EPIC-031` · **Phase**: 1 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

How to prove this Epic works without reading its code. Every scenario maps to a success criterion.

Details are linked, not repeated: entities in [data-model.md](./data-model.md), interfaces in
[contracts/decision-contract.md](./contracts/decision-contract.md), decisions in
[research.md](./research.md).

---

## Prerequisites

- Node ≥ 22, `pnpm@9.15.9`; PostgreSQL reachable by `backend/prisma`.
- `pnpm install --frozen-lockfile` (`TS-003`).
- **Work in a worktree** — the plan's Constitution Check records the concurrent-session gate as
  FAIL, discharged the way `EPIC-030` was.

---

## Scenario 1 — The high band cannot be configured away

**Proves**: `SC-DPE-001`, `FR-DPE-012` — `ADR-0025` constraint 1, the fence the whole model rests on.

Enumerate **every tenant-reachable policy setting** and assert no combination moves a baseline
change, a release promotion or a **loop instance configuration change** out of human approval.

```bash
pnpm test:integration
```

**Expected**: refused, each naming the constraint that fenced it. The test enumerates the
configuration surface rather than inspecting defaults — the difference between proving a fence
exists and observing that nobody has climbed it yet.

> **Mutation check, required at exit.** Remove the load-time refusal and this must fail.

---

## Scenario 2 — Low-risk work executes with no human, and still leaves a record

**Proves**: `SC-DPE-005`, `FR-DPE-016` — *low risk means no human in the loop, not no record*.

Submit a low-band action under a permitting policy.

**Expected**: executes with no approval step; afterwards the audit trail carries the action, its
band, the policy version and its evidence reference.

---

## Scenario 3 — Every decision explains itself, allowed as well as blocked

**Proves**: `SC-DPE-002`, `FR-DPE-040`.

Request an explanation for a refused consequential action, then for an **allowed** one.

**Expected**: both name policy version, matched rule, risk class and authority. Then assert that a
decision **cannot be written without one** — the `NOT NULL` foreign key of
[data-model.md](./data-model.md) §3 and the non-optional `explanation` of the contract §3.

> **Mutation check, required at exit.** Make `explanation` optional and this must fail.
> `ADR-0025`: *"An unexplainable allow is a defect."*

---

## Scenario 4 — An AI may propose a class and may never assign one

**Proves**: `SC-DPE-003`, `FR-DPE-003`.

Submit an action carrying `proposedClass: 'low'` for a target policy classifies as high.

**Expected**: `effectiveClass` is `high`; `proposedClass` is retained separately; the disagreement is
visible rather than reconciled. The two fields are distinct in the contract precisely so this cannot
be merged away.

---

## Scenario 5 — An unclassified action type gets the *most* restrictive band

**Proves**: `FR-DPE-004`.

Submit an action type no steering rule matches.

**Expected**: `high`. Not `low`, and not an `unknown` band — the contract has three members and no
fourth (§1). Every capability added after this Epic ships arrives guarded.

---

## Scenario 6 — Steering conflict resolves, and says how

**Proves**: `FR-DPE-005`, `FR-DPE-042`, and the `R-031-1` reuse.

Author two `risk-classification` steering documents at different scopes that disagree.

**Expected**: the decision resolves by `resolveSteering()`'s precedence, and
`explanation.precedenceResolution` **quotes** the `SteeringOverride` rather than restating it. No
second precedence implementation exists — asserted by the architecture test.

---

## Scenario 7 — Unreadable rules refuse; they do not permit

**Proves**: `SC-DPE-007`, `FR-DPE-050`, `R-031-5`.

Point the steering source at a failing store, then submit a governed action.

**Expected**: **refused**, with the reason recorded. This is the in-process meaning of fail-closed:
the engine has no network hop, so what fails is its inputs.

> This is also where **Cedar's `skip on error` was rejected** (`R-031-2`). Under that semantics an
> erroring rule is skipped and does not affect the result — which here would silently drop a
> `forbid`.

---

## Scenario 8 — An unsatisfied gate never reads as satisfied

**Proves**: `SC-DPE-006`, `FR-DPE-013`.

Evaluate a decision whose required gate is unsatisfied, with no exception.

**Expected**: refuse, or proceed-under-recorded-exception. Enumerate every reachable result and
assert `satisfied` is not among them.

> **Mutation check, required at exit.** Add a satisfied-by-default path and this must fail.

---

## Scenario 9 — Self-approval is refused unless policy says otherwise

**Proves**: `FR-DPE-015`.

Have the requester approve their own request.

**Expected**: refused by default; permitted only where policy allows it for that action class, and
the permission appears **in the explanation** rather than only in the policy.

---

## Scenario 10 — The Inbox follows the role, and does not remember

**Proves**: `SC-DPE-004`, `FR-DPE-022`, `FR-DPE-024`.

Read `/inbox`, change the reader's role, read again. Decide an item elsewhere, read again.

**Expected**: the visible set follows the new role; the decided item is gone. Both hold because the
Inbox is **derived at read time** (`R-031-4`) — there is no queue row to go stale.

---

## Scenario 11 — Constitution XI Tier 1: the engine is actually wired

**Proves**: the reachability gate.

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
const app = moduleRef.createNestApplication();
await app.init();
await request(app.getHttpServer()).post('/decisions').expect(201);
```

**Expected**: passes. Then **remove `DecisionModule` from `AppModule` and re-run — it must fail.**
The pattern is `EPIC-030`'s `R-030-8`, copied rather than reinvented.

---

## Scenario 12 — Constitution XI Tier 2: the journey, against a running application

**Proves**: the tier `EPIC-030` did not owe and this Epic does.

Start the application, open the Decision Inbox, act on an approval, and record a **run-generated**
transcript.

**Expected**: a committed transcript naming the run, the journey walked and the outcome, passing its
conformance check. **Hand-written evidence is a constitution violation of the first order** — the
`SC-AGT-001` and `EPIC-029` `T900a`/`T900b` precedent.

---

## Full gate before declaring the Epic done

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:governance
```

Then the four mutation checks (Scenarios 1, 3, 8, and the Tier 1 inversion in 11),
`/speckit-converge` clean, and an empty `defects/`.
