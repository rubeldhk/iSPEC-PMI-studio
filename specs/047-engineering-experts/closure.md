# EPIC-047 Engineering Experts — closing report

**Date**: 2026-10-09 · **Branch**: `epic/047-engineering-experts` · **Stage**: implemented to
the extent its dependencies allow; **not** promotable (see *Not done*).

## Work completed

| Phase | Tasks | Delivered |
|---|---|---|
| 1 Setup | `T1900`–`T1902` | Defect intake; `ExpertsModule` registered in `app.module.ts` in the change that created it |
| 2 Foundational | `T1903`–`T1916`, `T1990`/`T1991` | Types; ports bound **refusing**; in-memory and PostgreSQL stores; migration `20261009090000_epic047_experts` (6 tables, CHECKs, two immutability triggers); `AgentDescriptor.enforceableLimits?`; event type `expert-governance-recorded`; authoring authority over `EPIC-024` grants |
| 3 US1 Registry | `T1917`–`T1928` | Contract validation naming every gap; dangling references; approval status derived from `EPIC-031`, never stored; register / version / submit / retire / compare; routes |
| 4 US2 Dispatch | `T1929`–`T1944`, `T1988`/`T1989` | Contract and actor authority; model selection with recorded fallback; registration before any check, refusals as events on the execution; tool observation; expected outputs; context through `EPIC-038`'s port; unattended runs propose, never complete |
| 5 US3 Delegation | `T1945`–`T1957`, `T1986`/`T1987` | Policy (absent = none), contract `delegatesTo`, depth, fan-out, cycles; authority intersected down the chain; own linked session (not a re-run); stop-by-parent cascade; tree read; policy routes |
| 6 US4 Limits | `T1958`–`T1964` | Narrowing; enforceability per runner; clarified default posture; time enforced by abort; consumption charged up the chain; late breaches |
| 7 US5 Assignment | `T1965`–`T1972` | Capability match; risk gate through `EPIC-031`; append-only history; retired assignee reads as needing reassignment; dispatch by task |
| 8 US6 Screen | `T1973`–`T1976` | `/experts` — view-only registry, versions and comparison, runs with inline delegation tree, enforced vs. not enforced limits in words; area promoted, `EPIC-036` counts updated |
| 10 Polish | `T1983`, `T1984`, `T1985` | Both required mutation proofs applied, observed and reverted (`mutation-proofs.md`); `R-047-15` targets measured and met; this report |

**Tests**: backend unit 3350 passed (Experts: 147 in 29 files); Experts integration 57 passed in
10 files (Testcontainers, run serially); architecture (gated) 301 passed; frontend 1135 passed;
package suites for `agent-contract` and `execution-registry-contract` pass.

## Not done, and why

| Item | Why | What closes it |
|---|---|---|
| **Phase 9 — `T1977`–`T1982`** | Blocked by design (`R-047-13`): `EPIC-031` (#4), `EPIC-032` (#3) and `EPIC-038` (#5) are open pull requests | Merge them, then `/speckit-implement EPIC-047 for T1977–T1982` |
| **`DEF-047-001`** | No execution identity exists for a platform-dispatched run, and nothing provisions a runner's session, so `ExpertExecutions` and `ExpertGateways` stay bound refusing. **In this deployment no Expert run can be dispatched**; every success path is proven through in-test bindings | An identity adapter over `EPIC-043`'s principals and a runner over `EPIC-028`'s seam — a follow-up task or the `G-17` Epic |
| **`T1992` — Tier 2 transcript** | Needs real Experts and real runs on a running stack; refused for the reasons above. Declared in `governance/known-red.json` and gated out of `test:arch:gated` | After Phase 9 and `DEF-047-001` |
| **`T1993` — SRS owner annotations** | Changes the requirements source of truth; needs the Project Owner's sign-off (Constitution II) | Owner approval, then a one-line edit per requirement |
| **Promotion** | Constitution VII; needs explicit authorisation naming the environment | — |

## Decisions taken during implementation

- **`ExpertGateways` returns runners, not `AgentGateway`s.** `AgentGateway.execute` needs an
  `EPIC-028` `ExecutionSession` nothing provisions for an Expert (`DEF-047-001`); a runner owns its
  own provisioning, so dispatch never touches it.
- **The unowned ports live in one holder (`EXPERT_PORTS`)**, read at call time. Phase 9 rebinds
  them there, and route tests replace them visibly after asserting the composed default refuses —
  without `@nestjs/testing`, which the repository does not have.
- **Token and cost limits refuse on every current runner** under the clarified default (`R-047-7`):
  no provider can stop mid-run on them. A contract that wants to run anyway must say `proceed`,
  and the limit then reads *unenforceable*, never *enforced*.
- **Assignments store `standing` or `pending-decision`**; whether a pending one came to stand or
  was refused is read from its decision, like contract approval.
- **A task records neither the capabilities it needs nor a risk band**, so the assigner states
  both and both are written into the assignment's rule. A task-level declaration would be better
  and belongs to `EPIC-046`'s model.
- **References are checked at registration**, so two Experts that delegate to each other must be
  registered one-sided and joined by a second version — as the delegation route test does.

## Cross-Epic notes

- `EPIC-036`'s area counts now read **7 / 2 / 9 / 0** here. `EPIC-038` (#5) makes the same move
  for Context and `EPIC-031` (#4) for the Decision Inbox; **whichever merges second must recount**.
- `governance/known-red.json`, `package.json` and `README.md` gain a known-red entry; `EPIC-038`
  adds its own to the same three files, so they will conflict textually on merge.
- `packages/execution-registry-contract` now has 30 event types (`CONTENT_EVENTS` 5).

## Recommended next command

`/speckit-converge EPIC-047` — then, once #3, #4 and #5 merge, `/speckit-implement EPIC-047 for
T1977–T1982`.

---

## 2026-10-09 — Convergence implemented, and amendments `A-047-1` / `A-047-2`

**Branch**: `epic/047-engineering-experts` · **Base**: `5af0831` · not pushed.

### Convergence (`T2000`–`T2015`, Phase 11) — all eight pairs done, test first

| Pair | What changed |
|---|---|
| `T2000`/`T2001` | A failure after the session row exists is a **failed run**, never `dispatch-refused`: the session ends `failed`, `run-failed` is recorded, the execution closes `failed` (once), delegates stop, and the error carries the execution id |
| `T2002`/`T2003` | The parent is marked ended **before** its cascade; a delegate admitted but recorded after its parent ended re-checks and stops without running; `endSession` returns whether it won, so only the winner records and closes |
| `T2004`/`T2005` | `expert_sessions.actorId` (migration `20261009100000_epic047_session_actor`): the root run's actor, inherited by delegates; targets checked against it; another user cannot delegate under the session. Pre-existing rows get `''`, which matches no user (fails closed) |
| `T2006`/`T2007` | Consumption charged on every exit path (a stopped delegate still charges what it reported); ancestor charges are one atomic `UPDATE` (`chargeLimit`), so concurrent siblings both land; time records the elapsed milliseconds |
| `T2008`/`T2009` | A delegate's token, cost and resource limits are capped at the smallest remaining budget across its ancestors (added where it had none), recorded as `limit-narrowed`; a chain with nothing left delegates nothing |
| `T2010`/`T2011` | The screen compares **any** two versions (two pickers), shows all twelve elements including context policy and workspace requirements, and reads any version's contract even when none is approved |
| `T2012`/`T2013` | Registration now precedes reading the effective version, so a `ContractApprovals` fault is a `dispatch-refused` on a registered execution (still `503`); the version in force, when not the newest, is recorded as `contract-version-in-force` |
| `T2014`/`T2015` | Request limits that are not finite positive numbers, or not limits at all, are refused `400` before registration |

### Amendment `A-047-1` — `memoryPolicy: governed-knowledge` (`T2016`–`T2022`)

Approved by the Project Owner on 2026-10-09 as `EPIC-048`'s clarification Q1 = A. `FR-EXP-020`
now admits `governed-knowledge`: the Expert may submit learning candidates to `EPIC-048` and receive
approved knowledge only through context; no private memory; changing it is a new contract version.
Delivered: `MEMORY_POLICIES`, the validation message, migration
`20261009110000_epic047_memory_governed_knowledge` (CHECK replaced), the frontend type and a
plain-words description, quickstart Q2 (`session` still `400`; `governed-knowledge` `201`) and
`data-model.md`. **No `EPIC-048` behaviour is built**: a `governed-knowledge` Expert dispatches
exactly like a `none` one (asserted), and no learning port exists in this Epic. Matches `A-047-1`
as written in `EPIC-048`'s `contracts/learning-contract.md` §6 and `research.md` `R-048-10`.

### Amendment `A-047-2` — which Expert ran an execution (`T2023`/`T2024`, `FR-EXP-064`)

`ExpertsModule` exports `EXPERT_PROVENANCE`:
`forExecution(workspaceId, executionId) → {expertId, contractVersionId, contractVersion, memoryPolicy} | null`,
read from the session record each time, answering with the version the session **started** under;
another workspace or a non-Expert execution reads `null`.

### Tests (2026-10-09/10)

- Backend Experts unit: **190 passed in 38 files** (was 147 in 29).
- Experts integration, one file at a time (Testcontainers): **63 passed in 10 files** —
  constraints 16, store 8, registry 8, dispatch 8, delegation 3, delegation policy 4, limits 4,
  assignment 5, performance 4, reachability 3.
- Architecture `experts-mutation-proofs`: 3 passed. Frontend Experts: **13 passed in 3 files**.
- Governance project: 1107 passed; 2 failed, both in `accessibility-record.spec.ts` (`EPIC-029`'s
  known red, excluded by `test:governance:gated`).
- Backend and frontend `tsc --noEmit` clean; ESLint clean on the 31 changed TypeScript files.

### Still open

- `T1977`–`T1982` (blocked on `EPIC-031`/`032`/`038` merging), `T1992` (Tier 2 transcript), and
  `DEF-047-001` — unchanged from the report above.
- `T1993` — the SRS owner annotations for `BR-0101`/`BR-0105` were not edited in this pass; the
  edit was refused by the session's permission check and is left for the main session.

### Merge notes

Two new migrations after `20261009090000_epic047_experts`. `ExpertsStore` gained `chargeLimit` and
`noteUnreported`, and `endSession` now returns `Promise<boolean>` — any other implementation of the
interface must follow. `ExpertSession` gained a required `actorId`. No change to
`governance/known-red.json`, `package.json`, `README.md` or the `EPIC-036` area counts.
