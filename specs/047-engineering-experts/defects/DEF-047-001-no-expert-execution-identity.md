# DEF-047-001 — No identity to register an Expert run with `EPIC-037`, and no runner to run it in

**Epic**: `EPIC-047` · **Found**: 2026-10-09, implementing `T1935`/`T1936` · **Status**: Open ·
**Severity**: High (blocks `FR-EXP-060` in the composed application; no data at risk)

## What was found

`research.md` `R-047-3` planned to register every Expert run through
`ExecutionRegistryFacade.register`, treating `EPIC-037` as "on `main`, adapter immediately". The
facade requires `ExecutionIdentityRefs` — an authenticated principal, an agent identity
**snapshot**, a connector registration, a sponsor, and an `execution.register` **delegation**
(`packages/execution-registry-contract/src/contract.ts`, `connector-identity.ts`). Today these are
minted only for a **connector credential** (`EPIC-043`). Nothing mints them for a run the platform
itself dispatches, so an Expert run has no identity to register under.

The same gap exists one layer down: `AgentGateway.execute` needs an `ExecutionSession` (`EPIC-028`'s
container environment), and nothing provisions one for an Expert. `R-047-2` already recorded that no
gateway registry exists; this is the other half of the same absence.

## What was done instead

- `ExpertExecutions` is a port bound **refusing** (`503`, naming itself and this gap), alongside
  `ExpertGateways`. Dispatch refuses before anything executes — never runs unregistered
  (Constitution XII).
- `ExpertGateways.gatewaysFor` returns **runners** (`descriptor` + `run`), so whichever binding
  provides a gateway also owns provisioning its session. The dispatch logic never touches
  `ExecutionSession`.
- The route tests (`T1943`) replace both ports with in-test bindings that record every call
  (analysis finding I1), after asserting the composed defaults refuse.

## What closes it

An adapter that, for an Expert dispatch, registers (or reuses) an agent principal per Expert,
captures its identity snapshot, sponsors it with the dispatching user, and holds a delegation for
`execution.register` on the project — then calls `ExecutionRegistryFacade`. Together with a runner
binding over `EPIC-028`'s seam. Both belong in a follow-up task (or the Epic that productises agent
integration, `G-17`), and the closing report must name this defect as open if they are not built
here.
