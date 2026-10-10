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
