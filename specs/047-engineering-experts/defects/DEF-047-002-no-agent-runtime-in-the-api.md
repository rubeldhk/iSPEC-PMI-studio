# DEF-047-002 — No agent runtime is composed into the API process

**Epic**: `EPIC-047` · **Found**: 2026-10-10, implementing `T2566` for `DEF-047-001` · **Status**: Open ·
**Severity**: High (no Expert run can be dispatched in the composed application; no data at risk)

## What was found

`DEF-047-001` had two halves. The first — an execution identity for a platform-dispatched run — is
built and bound (`T2561`–`T2564`). The second — a runner over `EPIC-028`'s seam — is built
(`adapters/runners.adapter.ts`, `T2566`) but **has nothing to run with in the API process**:

- The runner needs concrete `AgentGateway`s and a `ProjectExecutionEnvironment`. `backend/src` may
  name neither: `agent-independence.spec.ts` forbids importing `@pmi/agent-adapter-*` or
  `@pmi/execution-provider-*`, dynamic imports of them, provider names and container runtimes;
  `eslint.config.js` forbids the same and any import of `@pmi/worker`.
- The API's only entry point is `backend/src/main.ts`, inside those rules. There is **no
  composition root outside `backend/src`** for the API, the way `worker/` is one for the worker.
- The worker does compose agents (`worker/src/agent-composition.ts`) and Docker
  (`execution-composition.ts`), but dispatch runs in the API request and awaits the run.

So `EXPERT_AGENT_RUNTIME` is bound to `null`, and `ExpertGateways` refuses `503` naming this defect.
Registration now works: a refused dispatch is recorded on a real `EPIC-037` execution and closed
`cancelled`.

## What closes it — a decision first

This is an architecture choice, so it is recorded rather than taken here.

| Option | What it means | Cost |
|---|---|---|
| **A. An API launcher package** (recommended) | A new workspace package, outside `backend/src`, that composes the agent registry and execution environment and starts `AppModule` with `EXPERT_AGENT_RUNTIME` overridden — the worker's pattern, applied to the API | One package, one ADR amendment (`ADR-0030`), the entrypoint pointed at it. No rule relaxed |
| B. Dispatch through the queue | Dispatch registers and checks in the API, then enqueues the run; the worker executes it with its existing composition and reports back | Dispatch becomes asynchronous: its response, the time limit, the stop cascade and the route tests all change |
| C. Relax the boundary | Let `backend/src` import the adapters | Reverses `FR-AGT-004`/`FR-AGT-009`; rejected by this programme's own rules |

## Evidence

- `backend/tests/unit/expert-adapter-runners.spec.ts` — the runner, fully specified against an
  in-test gateway and environment.
- `backend/tests/integration/experts-execution-identity.spec.ts` — a runtime overridden in the test
  runs end to end through the composed application; without one, dispatch refuses naming this
  defect after the run is registered.
