# EPIC-032 — Evidence Store & Evidence Contracts: Epic closing report

**Tasks**: `T855a`–`T863k`, plus the scoped slice `T1201`–`T1204` · **Session**: 2026-10-07 ·
**Constitution IX**

**Status**: `Closed` *(2026-10-10)* — every task complete except **`T862g`** and **`T1796`**, both
deferred to `EPIC-030` by [`DEF-032-006`](./defects/DEF-032-006-loop-consumes-none-of-its-seams.md)
and named under *Work not done*. Merged to `main` through PR #3. *(Was, 2026-10-07: 83 of 87 complete;
`T862g`, `T863g`, `T863i`, `T863k` open.)* Worked in the dedicated worktree `.claude/worktrees/epic-032-evidence-store-contracts`
(`T855a`), fast-forwarded to `main` at `22d51db` before starting.

## What the Epic delivered

`BR-0144` and `RULE-05`, the requirement the product's differentiator rests on: **a declaration of
completion is a request to be judged, never a judgement.** Governed work is bound to an Evidence
Contract when it is created; completion is refused, with every unmet item named, until typed and
trustworthy evidence for the right artifact version exists; every attempt is recorded.

| Phase | Tasks | What it established |
|---|---|---|
| 1 Setup | `T855a`–`T855e` | `packages/evidence-contract` — the sixth `*-contract` package, registered in `vitest.workspace.ts`, `test:unit`, `T537`'s map and the layout record |
| 2 Foundational | `T856a`–`T856s` | The in-toto Statement types with a non-empty `subject` and an at-least-one-algorithm digest; the nine-kind predicate registry; the Contract with no `met` field; the gate result whose refusal cannot be empty; three ports that refuse when absent; the `EPIC-025` storage adapter; the migration and its three fences; four Contract definitions and their conformance check; the independence check; the reachability test |
| 3 US1 — MVP | `T857a`–`T857h` | The module, registered; derived status; the completion gate as a `Result`; `POST /evidence/:workRef/complete` answering `409` with the unmet list; refuse-on-unreachable |
| 4 US2 | `T858a`–`T858h` | Weakening refused at load while work is in flight; binding at creation with the version fixed; zero-item Contracts visible; `GET …/unmet`; re-evaluation on arrival as a new attempt |
| 5 US3 | `T859a`–`T859k` | Append-only persistence; integrity re-checked on every read; unresolvable references; version-scoped matching; `EPIC-024` access, refused before anything is written |
| 6 US4 | `T860a`–`T860g` | External tools only through the `AttestationSource` port; version-less contributions refused; `EPIC-015` reports as producers; no analysis engine; the rollup |
| 7 US5 | `T861a`–`T861e` | All nine `BR-0140` kinds, stored and referenced, through one call and one gate; multi-type items; `GET …/status` |
| N Polish | `T862a`–`T862i` | Fail-closed in two layers; four mutation proofs; performance measured; retention asserted; quickstart mapped |
| Z Closure | `T863a`–`T863j` | This report, the records, the defects |

## The quickstart, scenario by scenario (`T862i`)

Each scenario is recorded as the executable test that performs it. All ran green on 2026-10-07 —
the integration ones against PostgreSQL 16 in Testcontainers and the real `AppModule`.

| Scenario | Executed by |
|---|---|
| 1 — "Done" does not complete anything | `evidence-reachability.spec.ts` (HTTP: `409` with `['tests-pass','reviewed']`, then `200`); `evidence-completion-gate.spec.ts` |
| 2 — Work knows what it must prove before it starts | `evidence-binding.spec.ts`; reachability `POST /evidence/bindings` → every item unmet |
| 3 — A Contract cannot be weakened under work in flight | `evidence-contract-loader.spec.ts` |
| 4 — Every attestation says where it came from | `evidence-attestation-store.spec.ts`, `evidence-contribution.spec.ts` |
| 5 — Presence is not validity | `evidence-integrity.spec.ts`, `evidence-unresolvable.spec.ts`, `evidence-superseded.spec.ts` |
| 6 — Nine kinds of proof behave like one kind of thing | `evidence-all-types.spec.ts` (`SC-EVS-004`, `T863f`) |
| 7 — A specialist tool contributes, PMI Studio analyses nothing | `evidence-contribution.spec.ts`, `evidence-no-review-engine.spec.ts` |
| 8 — `EPIC-015`'s suites are producers | `evidence-from-qa-suite.spec.ts` (HTTP) |
| 9 — An unreachable store refuses | `evidence-fail-closed.spec.ts` — PostgreSQL stopped under the app's own gate: 50 of 50 refused |
| 10 — Not a side channel around access control | `evidence-access.spec.ts` (HTTP, `EPIC-024`'s real service) |
| 11 — An empty Contract is visible | `evidence-zero-item.spec.ts` |
| 12 — XI Tier 1: the store is wired | `evidence-reachability.spec.ts`, and `T862e` below |

## The four mutation observations

| Task | Mutation | Observed |
|---|---|---|
| `T862b` | gate returns `ok` with an unmet Contract | `evidence-completion-gate.spec.ts`: **4 failed**, 3 passed. Reverted |
| `T862c` | weakening check disabled in the loader | `evidence-contract-loader.spec.ts`: **2 failed** (both refusal cases). Reverted |
| `T862d` | gate returns `ok` when the Contract cannot be evaluated | `evidence-fail-closed.spec.ts`: **2 failed** — both layers. Reverted |
| `T862e` | `EvidenceModule` removed from `app.module.ts` | `evidence-reachability.spec.ts`: **12 of 12 failed**. Reverted |

## Measured performance (`T862f`, `R-032-7`)

p95 in milliseconds, developer machine, PostgreSQL 16 in Testcontainers, through the real Prisma
repository and gate (`evidence-performance.spec.ts`):

| Measure | Target | Measured |
|---|---|---|
| evidence write | < 60 | **7.0** |
| Contract evaluation at the gate, 50 items | < 150 | **11.6** |
| unmet-items query | < 100 | **12.8** |
| rollup, 10,000 evidence items | < 500 | **178.0** *(was 408.6 alone, 529.5 beside another suite, 599 on CI — see below)* |

**The rollup failed first, at 3,820 ms**, because it evaluated each piece of work with its own
queries. Batching the scope into one evidence query brought it to 1,076 ms, and reading that scope
with column-selected parameterised SQL instead of the query builder brought it to 409 ms. The margin
is the thinnest of the four and should be re-measured on CI hardware.

**The rollup was rebuilt after CI measured 599 ms** (PR #3, Auto-fix). Profiled: 309 ms of 470 was
reading 10,000 full rows, and 118 ms was re-hashing every payload. The rollup now reads only what a
status needs — the database extracts the predicate's `result` (`FR-EVS-036`) — and uses the
write-time integrity verdict rather than re-hashing (`assessForRollup`). That is a deliberate split:
the rollup is a report; the rows are append-only by trigger; and the completion gate and the status
route, which decide, still re-verify every payload on every read. Measured afterwards: **178 ms**.

## Found on the way

- **The integration test found a hole in the migration's own fence.** `CHECK ((a) OR (b))` with
  `storage` NULL evaluates to NULL, and PostgreSQL *accepts* a CHECK that is NULL — so the "neither
  stored nor referenced" row fence 2 exists to refuse went straight in. The same hole was in the
  `attachedTo` check. Both now wrap in `COALESCE(…, false)`; the NULL cases are asserted.
- **Binding wrote a row and then answered `404`.** Work about an unreadable specification was
  created, then refused on the status read. Access is now checked before anything is written.
- **A `FAILED` test result met "tests pass"** — `DEF-032-004`, the most serious finding; an interim
  rule is implemented and needs ratification.
- **This worktree's `argon2` prebuild segfaults on Windows** (exit 139 at `require`), which made
  every integration suite die with *"Worker exited unexpectedly"* before running a test. The main
  checkout carries a locally compiled `build/Release`; copying it into the worktree's
  `node_modules` fixed it. Environment only — nothing committed — but any new worktree on this
  machine will hit it.

## Tests that were not observed failing first

Constitution V asks for a test seen failing before its implementation. These passed on their first
run because the behaviour had already been built for an earlier phase's end-to-end flow, and are
recorded rather than claimed: `T858c`, `T858e`, the `T858h` cases, `T859a`, `T859c` (except fence 2,
which failed and found the hole above), `T859d`, `T859f`, `T859h`, `T859i`, `T860a`, `T860c`,
`T860f`, `T861a`, `T861c`, `T856r`. Each carries a self-check or a planted case proving it *can*
fail, and the four mutation proofs cover the guarantees that matter most.

## Defects

| Record | Status |
|---|---|
| [`DEF-032-001`](./defects/DEF-032-001-schema-evolved-not-replaced.md) — the slice's tables, evolved not replaced | CLOSED |
| [`DEF-032-002`](./defects/DEF-032-002-http-surface-differs-from-contract.md) — sixth route; 404 not 403 | CLOSED |
| [`DEF-032-003`](./defects/DEF-032-003-governed-artifact-types-hardcoded.md) — governed types known by convention | DEFERRED to `EPIC-024` |
| [`DEF-032-004`](./defects/DEF-032-004-failed-test-result-satisfied-items.md) — a FAILED test result met an item | Rule ratified as `FR-EVS-036`; residual DEFERRED to `EPIC-039` |
| [`DEF-032-005`](./defects/DEF-032-005-contract-digest-required-all-algorithms.md) — digest required all three algorithms | CLOSED |
| [`DEF-032-006`](./defects/DEF-032-006-loop-consumes-none-of-its-seams.md) — the loop reads none of its seams | DEFERRED to `EPIC-030` |
| [`DEF-035-002`](../035-defect-room/defects/DEF-035-002-reproduction-write-never-reached-the-schema.md) — raised against `EPIC-035` | CLOSED — fixed on this branch |

## What this Epic deliberately does not claim (`T863c`, `T863d`)

- **`ADR-0022` is not converged.** It stays Open on `U-09` — the compliance verdict (`BR-0143`) and
  spec/code convergence (`BR-0036`) are unowned, and `evidence-independence.spec.ts` fails if this
  Epic declares a verdict type. *"The differentiator is now owned"* would be the overstatement.
- **Constitution XI Tier 2 is not applicable.** The *Evidence & Compliance* area needs the compliance
  half, which is `U-09`, and `UX-0060` forbids building an area before its Epic is declared.
- **The Rooms are not yet converged onto work-class Contracts.** `EPIC-033` and `EPIC-034` still read
  the slice's Room-scoped Contracts through `isSatisfied`; `EPIC-035`'s `EvidenceStore` and
  `TestExecution` ports are still unbound, so known-red `T999u` is unchanged.

## Work not done, and why

- **`T862g` — the composed budget. Deferred to `EPIC-030`.** `EPIC-031` is now built (PR #4,
  `POST /v1/decisions` 40.8 ms p95), but the loop calls neither it nor this gate
  ([`DEF-032-006`](./defects/DEF-032-006-loop-consumes-none-of-its-seams.md)), so no composed path
  exists to time. Measured separately — transition 0.06 ms, decide 40.8 ms, gate 11.6 ms — the
  shares sum to about 52 ms against 270 ms. That sum is recorded, not reported as the measurement.
- **`T1796` — the loop's Evidence seam. Deferred to `EPIC-030`**, same defect: an adapter bound to a
  token nothing reads would be built and called by nothing.

`T863g`, `T863i` and `T863k` were discharged on 2026-10-09/10 — see *Convergence — second pass*,
*Gates — 2026-10-09 re-run* and *Promotion*, below.

## Convergence — Phase 8 (`T1796`–`T1800`, 2026-10-08)

`/speckit-converge` found five gaps; four are closed, one is blocked on `EPIC-030`.

| Task | Outcome |
|---|---|
| `T1798` — attached evidence in the status projection (`FR-EVS-027`, US3/AC1) | **Done.** `GET …/status` now lists each attestation's source, time, attested artifact and version, integrity, resolution, whether it reports failure and whether it is current — never the payload |
| `T1800` — a missing field fails, not reads blank (`SC-EVS-002`) | **Done.** The mapper refuses a row missing a provenance field; migration `20261008090000` adds the two CHECKs that were missing |
| `T1797` — the Defect Room's `EvidenceStore` | **Done.** Binding it first surfaced [`DEF-035-002`](../035-defect-room/defects/DEF-035-002-reproduction-write-never-reached-the-schema.md) — no reproduction could be written to PostgreSQL (no `steps` in the domain; `affectedBehaviourRef` written into `affectedBehaviour`), hidden because the unbound store refused first. Fixed on this branch, then bound; reproduction evidence now lands in the evidence store. `T999u` stays red on its other two ports |
| `T1796` — the loop's Evidence seam | **Blocked**, [`DEF-032-006`](./defects/DEF-032-006-loop-consumes-none-of-its-seams.md): `LoopService` consumes none of its seam tokens and records `gates: []`, so every `evidence-complete` gate resolves to `violation`. An adapter on a token nothing reads would be built and called by nothing |
| `T1799` — ratify or remove the `declaresFailure` rule | **Ratified** 2026-10-08 as `FR-EVS-036`; code unchanged |

## Gates (`T863i`)

`pnpm typecheck` 0 errors · `pnpm lint` 0 errors (7 warnings, none in files this Epic touched) ·
`pnpm test:unit` 5,379 passed · `pnpm test:arch:gated` 330 passed · `pnpm test:governance` 1,100
passed, 2 failed — both `T884`, the declared known-red.

`pnpm test:integration`, run alongside the governance suite: 873 passed, 5 failed, 22 files failed —
17 of them at setup with Testcontainers timeouts (*port 5432 not bound*, *health check not healthy*,
hook timeouts) and the 5 failed tests all timing assertions. **Re-run on their own, two files at a
time, 21 of those 22 files pass (224 tests).** The one that does not is this Epic's own
`evidence-performance.spec.ts`: the 10,000-item rollup measured **529 ms** with a second suite
running beside it, against 408 ms alone and a 500 ms target.

**`T863i` therefore stays open.** The rollup target is met in isolation and missed under
contention, which is what a CI runner provides. Either the rollup gets faster (the remaining cost is
reading and re-digesting 10,000 payloads) or the target is re-stated for a scope a reader actually
opens — a decision, not a tolerance to loosen quietly.

## Convergence — second pass (`T863g`, Phase 9, 2026-10-09)

Every `FR-EVS-001`–`052`, `SC-EVS-001`–`009`, the US1–US5 acceptance scenarios and the edge cases
were re-assessed against the code. Two partial, LOW gaps; both closed:

| Task | Outcome |
|---|---|
| `T1994` — a weakened Contract refused at load was invisible (`FR-EVS-024`, US2/AC4) | **Done.** `ContractCatalog.refusals()` had no reader outside its own test. `loadCatalog` now reports each refusal, and `EvidenceModule` logs it naming the work class, both versions, the reasons and `FR-EVS-024`. The test failed first, 3 of 3 |
| `T1995` — a contribution naming a foreign `workspaceId` (`FR-EVS-016`, edge case) | **Test only.** The behaviour already held — the controller strips the field and the service writes under the session's workspace — so the test passed on first run. Shown able to fail by a temporary mutation (service reading the body's `workspaceId`: 1 of 2 failed), reverted. *Refusing* such a body rather than ignoring the field needs a cross-workspace lookup, which is `EPIC-001`/`004`'s boundary; recorded, not built |

## Gates — 2026-10-09 re-run (`T863i`)

`pnpm lint && pnpm typecheck && pnpm test && pnpm test:governance`, run while four other agents ran
suites on the same machine: **7,998 passed, 7 failed, 20 files failed** of 784.

- **Two files are the declared known-reds**: `T999u` (architecture, one test) and `T884` (governance, two tests).
- **The other 18 files are integration**, failing at Testcontainers setup or on timing. **Each was
  re-run on its own, one file at a time: 17 pass outright** — 306 tests — plus
  `evidence-reachability` (13) and `evidence-access` (5) re-run after the converge change.
- **`evidence-performance.spec.ts` failed 2 of 4 on its first solo run, while another agent's
  suites were still running, and passed 4 of 4 when re-run**: write **15.0 ms**, 50-item evaluation
  **13.9 ms**, unmet **12.0 ms**, 10,000-item rollup **138.4 ms** p95, against 60 / 150 / 100 / 500.

The 2026-10-07 open question — rollup met alone, missed under contention — is closed by the
2026-10-08 rebuild (*Measured performance*): 138 ms leaves 3.6× headroom. `T863i` is discharged.

## Promotion (`T863k`)

There is no `dev` environment in this repository — `.github/workflows/` holds `ci.yml` and the
nightly engine job, and nothing deploys. **Promotion here is the merge to `main`**, through PR #3,
on the Project Owner's instruction of 2026-10-09 (*"close out EPIC-032 and merge it"*). No
environment was skipped because none exists past `main`. The Delivery Board was not refreshed by
this run; it is stale by this merge.

**Recommended next**: rebase `EPIC-031` (PR #4) on `main` and merge it — it consumes Evidence
Contracts. Then `EPIC-038` (PR #5), then `EPIC-047`. `EPIC-030` owns `DEF-032-006`, which holds
`T862g` and `T1796`.
