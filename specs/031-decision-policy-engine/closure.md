# EPIC-031 — Decision & Policy Engine: Epic closing report

**Tasks**: `T716`–`T799` and the scoped slice `T1196`–`T1200` · **Session**: 2026-10-08 ·
**Constitution IX**

**Status**: `Implemented` — **92 of 97 tasks complete; five open, each named under *Work not done***
(`T787`, `T791`, `T796`, `T798`, `T799`). Worked in the dedicated worktree
`.claude/worktrees/epic-031-decision-policy-engine` (`T716`), fast-forwarded to `main` at `22d51db`.

## What the Epic delivered

`ADR-0025`'s risk-adaptive policy engine: every governed action is classified by **policy, never by
a model**, banded low / medium / high, and decided — auto-executed, approved under satisfied gates,
held for an authorized human, or refused — with an explanation stored beside every outcome, allowed
and blocked alike. The high band cannot be configured away, automation may ask for a high-band action
and never take one, and every source that cannot be read refuses.

| Phase | Tasks | What it established |
|---|---|---|
| 1 Setup | `T716`–`T720` | `packages/decision-contract`, registered in the workspace, `test:unit`, `T537`'s map and the layout record |
| 2 Foundational | `T721`–`T738`, `T728a`/`b` | Three bands and no `unknown`; the `BR-0005` record published for `U-02`; decide types with a non-optional explanation; four ports that refuse; the `EPIC-019` steering adapter and a `risk-classification` subject; four append-only tables and their fences; the initial ruleset and its conformance check; the independence check; the module, registered |
| 3 US1 — MVP | `T739`–`T744` | The classifier — most-restrictive default, floor overriding any rule; the policy loader refusing at load; the enumeration of every tenant-reachable configuration; `POST /decisions` |
| 4 US2 | `T745`–`T751` | Band treatment; audit on every outcome; self-approval refused unless policy names the class; approve |
| 5 US3 | `T752`–`T763` | The Inbox — derived at read time, role-aware, naming what blocks; `GET /inbox`; the page with four states, keyboard operation and focus management; in navigation; metrics |
| 6 US4 | `T764`–`T770` | The explanation — stored, never recomputed; precedence quoted verbatim; `GET …/explanation` |
| 7 US5 | `T771`–`T775` | A proposal retained beside the effective class and never merged; disagreement visible |
| 8 US6 | `T776`–`T780` | Gates — `satisfied` only from a provider; recorded, expiring exceptions; fail closed |
| 9 US7 | `T780a`–`T780f` | Automation only where policy names it, citing the firing rule; actor kind recorded |
| N Polish | `T781`–`T788` | Fail-closed through the composed app; four mutation proofs; performance measured |
| Z Closure | `T789`–`T797` | This report; the Tier 2 harness and its check; `ADR-0025` closed; the handovers; the defects |

## The quickstart, scenario by scenario (`T788`)

| Scenario | Executed by | Result |
|---|---|---|
| 1 — the high band cannot be configured away | `decision-high-band-fence.spec.ts` (enumeration), `decision-policy-loader.spec.ts`, HTTP `400` in `decision-reachability.spec.ts` | pass |
| 2 — low-risk work executes, and leaves a record | `decision-auto-execute-record.spec.ts`, `decision-evaluator.spec.ts` | pass |
| 3 — every decision explains itself | `decision-explanation.spec.ts`; HTTP explanation in `decision-reachability.spec.ts` | pass |
| 4 — an AI may propose and never assign | `decision-proposed-class.spec.ts`, `decision-proposal-disagreement.spec.ts` | pass |
| 5 — unclassified gets the most restrictive band | `decision-classifier.spec.ts`, `decision-explanation.spec.ts` | pass |
| 6 — steering conflict resolves, and says how | `decision-steering-adapter.spec.ts`, `decision-precedence.spec.ts` | pass |
| 7 — unreadable rules refuse | `decision-fail-closed.spec.ts` (composed app, 50 of 50), `decision-evaluator.spec.ts` | pass |
| 8 — an unsatisfied gate never reads satisfied | `decision-gates.spec.ts`, `decision-exception.spec.ts`; HTTP `409` | pass |
| 9 — self-approval refused unless policy says | `decision-self-approval.spec.ts`; HTTP `403` then `200` | pass |
| 10 — the Inbox follows the role, and does not remember | `decision-inbox-projection.spec.ts`, `decision-inbox-role.spec.ts` (two real sessions) | pass |
| 11 — XI Tier 1 | `decision-reachability.spec.ts`, and `T785` below | pass |
| 12 — XI Tier 2 | `e2e/tests/epic-031-inbox.spec.ts` | **authored, not run** — see `T791` |

## The four mutation observations

| Task | Mutation | Observed |
|---|---|---|
| `T782` | load-time refusal of a lowered high band removed from `policy.loader.ts` | **The enumeration survived it.** `loadPolicy` also normalises the loaded policy's high band to `human-approval`, a second fence. The refusal itself is caught by `decision-policy-loader.spec.ts` (2 failed). With **both** fences removed the enumeration fails and names the breaches (`release.promote by human → auto-executed`), so it is load-bearing for the pair. Reverted |
| `T783` | `explanation` made optional in `types.ts` | `decision-explanation.spec.ts` **passed** (7) — a type change has no runtime effect. The contract package's typecheck **failed** (`TS2578: Unused '@ts-expect-error'` in `types.spec.ts`), which is the type-level fence doing its job; the `NOT NULL` half is `decision-constraints.spec.ts`. Reverted |
| `T784` | a `satisfied`-by-default branch for an absent gate provider | `decision-gates.spec.ts`: **1 failed**. Reverted |
| `T785` | `DecisionModule` removed from `app.module.ts` | `decision-reachability.spec.ts`: **18 of 18 failed**. Reverted |

## Measured performance (`T786`, `R-031-6`)

Composed application, PostgreSQL 16 in Testcontainers, developer machine (`decision-performance.spec.ts`):

| Measure | Target | Measured |
|---|---|---|
| decide, excluding gate providers | p95 < 40 ms | **25.2 ms** alone · **49.1 ms** beside another suite |
| `POST /v1/decisions` end to end | p95 < 120 ms | **40.8 ms** |
| `GET /v1/inbox` with 500+ open items | p95 < 250 ms | **139.8 ms** |
| throughput, one workspace | ≥ 50 / s | **265 / s** |

## Found on the way

- **The data model's high-band fence would have made an agent's refused request unrecordable**
  (`DEF-031-006`). Narrowed: automation may ask — `pending` or `refused` — and never take.
- **`/decisions` is shared with `EPIC-016`'s ADR routes** (`DEF-031-003`): `GET /decisions/metrics`
  answered `404` because `GET /decisions/:id` reads it as an ADR id.
- **The Decision Inbox area moved to `delivered`**, which moved the counts `EPIC-036`'s documents and
  shell tests pin: 6 → 7 delivered, 10 → 9 owed, with a dated note in each document as `EPIC-046` did.
- **`NavigationDrawer.spec.tsx` is load-sensitive**: it failed once in a full frontend run and
  passed alone and on rerun (1,141 tests). The drawer now renders one more area within `waitFor`'s
  default window. Recorded, not changed.

## Defects

| Record | Status |
|---|---|
| [`DEF-031-001`](./defects/DEF-031-001-risk-classification-subject-and-whole-document-precedence.md) — an eleventh steering subject; one document wins whole | DEFERRED to `EPIC-019` |
| [`DEF-031-002`](./defects/DEF-031-002-no-authority-model.md) — "authorized" means any other workspace human | DEFERRED to `U-02` |
| [`DEF-031-003`](./defects/DEF-031-003-http-surface.md) — three route deviations; the `/decisions` namespace | CLOSED |
| [`DEF-031-004`](./defects/DEF-031-004-gate-provider-unbound.md) — no `GateProvider`, so medium-band gates are violations | DEFERRED to `EPIC-021` |
| [`DEF-031-005`](./defects/DEF-031-005-scope-order-divergence.md) — `SCOPE_ORDER` lacks repository and path (`T795`) | DEFERRED to `EPIC-019` |
| [`DEF-031-006`](./defects/DEF-031-006-data-model-as-built.md) — the high-band fence and approval-as-a-new-row | CLOSED |

## Records

- **`T793`** — `ADR-0025`'s *Open* line closed: classification lives in the `BR-0070` steering hierarchy.
- **`T794`** — the `BR-0005` contract is published in `packages/decision-contract/src/authority.ts`
  with `U-02` named as its adopter; adopting it is an import.
- **`T795`** — the `SCOPE_ORDER` gap handed to `EPIC-019` as `DEF-031-005`.

## Work not done, and why

- **`T791` — the Tier 2 transcript.** `e2e/tests/epic-031-inbox.spec.ts` is authored and writes
  `docs/uat/EPIC-031-inbox-transcript.md` itself; it has **not been run**. No reference stack was
  running, and the run needs a seeded user's password. Its check, `T792`, is registered in
  `governance/known-red.json` beside `T884` and `T999u`, so the obligation is asserted on every push.
- **`T787` — composing with `EPIC-030`'s budget.** `LoopService` calls none of its seam providers
  (`EPIC-032` `DEF-032-006`), so there is no loop transition that invokes this engine to measure.
  This Epic's share is measured: decide at 25.2 ms p95.
- **`T796` — `/speckit-converge`.** The requester's command.
- **`T798` — the full suite.** Green except the decide-latency target under contention; see *Gates*.
- **`T799` — promotion `local → dev`.** Gated on an instruction naming the environment.

**Not converged, and worth knowing.** The Requirement Room still decides through the scoped slice's
`BandedPolicyProvider` (`modules/policy/`), which records no decision and no explanation. Routing its
`POLICY_PROVIDER` through this engine changes its behaviour — a high-band baseline would wait
`pending` for a second human instead of being permitted to the human who asked — so it is left for
`/speckit-converge` to raise and for the Project Owner to decide.

## Gates (`T798`)

`pnpm typecheck` 0 errors · `pnpm lint` 0 errors (the same 7 warnings as `main`, none in files this
Epic touched) · `pnpm test:unit` **5,372 passed** · `pnpm test:arch:gated` 324 passed after one fix —
`T560` refused the word `cursor`, a loop variable in `evaluator.ts` that is also an AI provider's
name; renamed · `pnpm test:governance` **1,106 passed**, 2 failed — both `T884`, the declared
known-red · frontend 1,141 passed (one load-sensitive drawer test, above) · `node
scripts/known-red.mjs`: `T884`, `T999u` and the new `T792` all red, as declared.

Integration — every decision suite and the four reachability suites, two at a time: **82 passed, 1
failed**. The failure is `decision-performance.spec.ts`'s decide latency: **49.1 ms p95 beside another
suite**, against 25.2 ms alone and a 40 ms target. **`T798` therefore stays open** — the same shape as
`EPIC-032`'s rollup: met in isolation, missed under the contention a CI runner provides. A decide is
four PostgreSQL round trips (policy read, explanation and decision in one transaction, audit); caching
the tenant policy per request is the obvious first cut, and it is a decision, not a tolerance to loosen.

**Recommended next**: `/speckit-converge EPIC-031`.
