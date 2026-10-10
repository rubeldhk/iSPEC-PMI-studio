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

---

## 2026-10-10 — Phase 9: the dependency adapters (`T1977`–`T1982`)

Unblocked when `EPIC-032` (#3), `EPIC-031` (#4) and `EPIC-038` (#5) merged to `main`. Three of the
five ports that refused are now bound to their owners; two still refuse.

| Port | Bound to | Adapter |
|---|---|---|
| `ContractApprovals` | `EPIC-031` — `DecisionEngine.decide`, and the repository's `get` / `resolutionOf` | `adapters/decisions.adapter.ts` |
| `EvidenceContracts` | `EPIC-032` — `ContractCatalog.get` | `adapters/evidence.adapter.ts` |
| `ContextAssembler` | `EPIC-038` — `AssemblyService.assemble` / `bindExecution` | `adapters/context.adapter.ts` |
| `ExpertGateways` | still refusing — `R-047-2` | — |
| `ExpertExecutions` | still refusing — `DEF-047-001` | — |

### Decisions taken

- **Workspace scope for a decision.** Every `EPIC-031` decision names a `projectId`; an Expert
  belongs to a workspace (`FR-EXP-008`). Submissions are scoped `workspace:<id>`, which no
  project-scoped steering rule matches and no real project id resembles. `EPIC-031` has no
  workspace-scoped decision of its own — a gap, recorded here and in the adapter where it is
  crossed.
- **The resolution is read, never cached.** The decision that resolved one wins; otherwise the
  decision itself — `auto-executed`/`approved` read as approved, `refused` as refused, `pending` as
  pending. A decision id `EPIC-031` cannot find is a fault, never *pending*. An `exception` outcome
  is unreachable for a gate-less decision and is never read as approved.
- **The author is `requestedBy`.** `EPIC-031` therefore refuses self-approval unless policy names
  the class (`FR-DPE-015`): the author of a contract does not approve it.
- **`EPIC-031`'s module now exports `DECISION_REPOSITORY`** — additive, read-only use. It offers no
  callback, and the engine has no read of its own.
- **The local `RiskBand` stays**, asserted identical to `@pmi/decision-contract`'s, value and type
  (`R-047-6`).

### Tests

| Suite | Result |
|---|---|
| `expert-adapter-decisions` / `-evidence` / `-context` (unit) | observed failing first (no module), then **25 passed** |
| All `expert-*` and `decision-*` unit tests | **335 passed** in 62 files |
| `experts-reachability` (composed, no database) | **7 passed**; the inversion in [mutation-proofs.md](./mutation-proofs.md) §3 fails 3 |
| Experts route tests (Testcontainers PostgreSQL) | **29 passed** in 5 files, including a new case registered under `task-completion@1`, submitted, decided `pending` at the `high` band and read back |

Two composed assertions changed meaning and were rewritten, not deleted: registering the fixture's
`implementation@1` is now **400 — a dangling reference** that `EPIC-032`'s catalog does not hold,
where it was `503`; and submitting no longer refuses `503`. Without a database the composed
`ContractApprovals` refuses on `EPIC-004`'s terms — no audit writer, so no decision is taken
(`FR-DPE-016`) — which the reachability test asserts as its proof of wiring.

### Still not done

`T1993` is no longer among them: the `BR-0101`/`BR-0105` owner annotations landed with
#6, approved by the Project Owner on 2026-10-10. What remains is `T1992` (Tier 2 transcript) and `DEF-047-001` — no Expert run can be dispatched while
`ExpertGateways` and `ExpertExecutions` refuse. Promotion, as above.

### Recommended next command

`/speckit-specify` for the `DEF-047-001` follow-up — an Expert execution identity over `EPIC-043`'s
principals and a runner over `EPIC-028`'s seam — or a defect task under this Epic.

---

## 2026-10-10 — Phase 15: `DEF-047-001`, an execution identity for an Expert run (`T2560`–`T2569`)

**`DEF-047-001` is resolved; its runner half is split out as `DEF-047-002`.** An Expert dispatch is
now registered with `EPIC-037` under the Expert's own identity, through the composed application.
Nothing yet executes it: no agent runtime is composed into the API process.

| Port | Before | Now |
|---|---|---|
| `ExpertExecutions` | refusing (`DEF-047-001`) | `adapters/executions.adapter.ts` over `ExecutionRegistryFacade`, `ExecutionTimelineService`, `EPIC-028`'s principal registry and snapshots, `EPIC-024`'s delegations |
| `ExpertGateways` | refusing (`R-047-2`) | `adapters/runners.adapter.ts` over `@pmi/agent-contract` / `@pmi/execution-contract`; refuses naming `DEF-047-002` while `EXPERT_AGENT_RUNTIME` is `null` |

### Decisions taken

- **One agent principal per *(Expert, sponsor)*.** `EPIC-028` freezes a principal's sponsor, so a
  principal cannot serve two; the mapping is `expert_principals`, first writer wins.
- **The sponsor must be able to edit the project.** `PrincipalDelegationService.delegate` grants
  without checking the sponsor's own authority, so the adapter checks first (`BR-0003`). A user who
  cannot is refused `403` before anything is minted or registered.
- **Surface `managed-sandbox`.** The registry has no "platform" surface; this is the platform's own
  sandbox and reads `managed` assurance.
- **The refs are stored per execution** (`expert_execution_identities`) because `EPIC-037`
  re-checks identity at completion and a stop cascade may complete a run from another process.
- **A non-governed command is refused before registration**, `400`. The real registry cannot register
  one, so the in-test `dispatch-refused` record for it no longer happens against `EPIC-037`.
- **An unattended completion is proposed as an event.** `proposeTransition` transitions a
  specification; an Expert run has none. `completion-proposed` is recorded and the execution left open
  for a person (`FR-EXP-063`). This departs from `R-047-3`, which named `proposeTransition`.
- **Three kinds join `EXPERT_GOVERNANCE_KINDS`** — `contract-version-in-force` and `run-failed`, which
  dispatch already recorded against the in-test double only, and `completion-proposed`.
- **A runner reports only what it observed**: no tool calls, no consumption and no output kinds,
  because the agent contract returns none. With the default contract's required `test-report`, a
  real run therefore ends `incomplete` until an adapter can report output kinds.

### Tests

| Suite | Result |
|---|---|
| `expert-event.spec.ts` (contract) | observed failing (4), then **58 passed** in the package |
| `expert-adapter-executions` / `-runners` (unit) | observed failing (no module), then **31 passed** |
| `experts-execution-identity` (PostgreSQL, composed) | **4 passed**; unbinding the adapter fails 3 (`mutation-proofs.md` §4) |
| Every Experts integration suite | reachability and dispatch route rewritten for the new truth; all pass |

### Still not done

`DEF-047-002` — needs an architecture decision; the defect records three options and recommends an API
launcher package outside `backend/src`. `T1992` stays red until a run can execute.

### Recommended next command

Decide `DEF-047-002`, then `/speckit-specify` for the API composition root (or an amendment to
`ADR-0030`) before any further Expert work.
