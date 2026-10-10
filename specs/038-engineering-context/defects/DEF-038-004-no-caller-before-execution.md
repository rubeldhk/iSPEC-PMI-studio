# DEF-038-004 — nothing assembles a package before a governed AI execution runs

**Epic**: `EPIC-038` | **Raised**: 2026-10-08 | **Status**: DEFERRED to `EPIC-037`
**Originating task**: `T1806` (convergence finding `FR-CTX-030`) · **Severity**: MEDIUM

## Finding

`FR-CTX-030` requires a Context Package to be assembled **before** governed AI execution. The only
caller of `AssemblyService` is `POST /context/packages`. No execution path asks for one.

That is not an omission inside this Epic so much as a fact about where execution happens. AI runs
**outside** the platform — a local CLI, an IDE extension, a managed sandbox — and is *registered*
with `EPIC-037` (`surface`: `local-cli`, `ide-extension`, `managed-sandbox`, …). There is no
in-process "run the model" step here to call into. The caller `FR-CTX-030` needs is the connector
that registers the execution, and the registration contract is `EPIC-037`'s.

## What this Epic delivered toward it

The seam that caller uses is built and proven against PostgreSQL in
`backend/tests/integration/context-before-execution.spec.ts` (`T1805`):

- `POST /context/packages` accepts an `executionId`, and the package is bound to it by a foreign
  key to `executions` (`T1266`);
- the execution lists what it was given (`GET /context/packages?executionId=`);
- an id naming no execution is refused with a `400` in words, not recorded;
- the package is deleted with its execution (`FR-CTX-066`) — observed, not assumed.

## Why deferred

Making assembly a step of registration — or of the connector's begin hook — changes `EPIC-037`'s
contract and every connector that implements it. That is `EPIC-037`'s decision. Until it is made,
`FR-CTX-030` holds only for a caller that chooses to ask, and the closing report says so.

Note that while `EmbeddingPort` is unowned (`R-038-1`), such a caller would receive `503` in every
deployment — so wiring it now would make every governed execution's first step refuse. The two
gaps should close in that order: a provider first, then the caller.
