# DEF-008-001 — the failure taxonomy has no reason for "the artifact could not be stored"

**Epic**: `EPIC-008` | **Raised**: 2026-08-20 | **Status**: **CLOSED — DEFERRED to `EPIC-003` 2026-08-20** (`T191`)
**Originating task**: `T080` (generation orchestration) · found while writing `T074`
**Severity**: LOW — no requirement fails; one failure is reported under a neighbouring reason

## Expected

`FR-026` / `SC-005`: every non-success terminal state names a **specific** reason, and the taxonomy
has deliberately no `unknown` member — *"a generic failure is a defect, not a fallback"*
(`packages/engine-contract/src/index.ts`).

## Actual

`ENGINE_FAILURE_REASONS` has eight members, all of them about the **engine**:

```text
engine_unavailable · engine_error · malformed_output · empty_output
timeout · cancelled · input_too_large · empty_selection
```

The generation path has a ninth way to fail that is not an engine failure at all: the engine
succeeded, the output parsed, provenance stamped — and the **commit** failed (deadlock, connection
loss, constraint violation). `GenerateSpecificationService.run()` reports that as `engine_error`,
which is the closest member of a closed enum and is nonetheless **untrue**: the engine did not
error, and an operator reading the job will look in the wrong place.

## Reproduction

```ts
store.failNextCommit(new Error('deadlock'));
const outcome = await service.run(order);
// outcome.failureReason === 'engine_error'   ← the engine ran perfectly
```

Covered by `backend/tests/unit/specifications/generation-links.spec.ts`
("stores nothing at all when the commit fails"), which asserts the *safety* property — nothing
partial survives — and deliberately does not assert the reason, because the reason is wrong.

## Why it was not fixed in place

1. **The enum is not this epic's.** `@pmi/engine-contract` is `EPIC-003`'s, and the API contract
   states the rule explicitly: *"the one exception is `job_failure_reason`, where a new member is a
   genuine behavioural change and must be documented in this contract before release"*
   (`specs/_shared/contracts/platform-api.md`). Adding a member here would be an undocumented
   behavioural change to a published contract, made by an epic that does not own it.
2. **Three places move together.** The contract enum, `core/failure-taxonomy.ts` (which is a
   `Record<EngineFailureReason, string>` and therefore a compile error until updated — by design),
   and the `JobFailureReason` enum in `schema.prisma` plus its migration.
3. **Nothing is unsafe today.** `SC-006` holds either way: the failure path writes the terminal
   state and nothing else. What is wrong is the *label*, not the behaviour.

## Options

| | Option | Consequence |
|---|---|---|
| A | Add `persistence_error` to the taxonomy | Correct label; a contract change across three files plus a migration, owned by EPIC-003 |
| B | Leave it as `engine_error` permanently | An operator diagnosing a database problem is sent to the engine logs |
| C | Rethrow and leave the job `running` | Worse: a job stuck in a live state is invisible to `SC-005` entirely |

## Recommendation

**Option A, owned by `EPIC-003`.** It is the epic that owns `@pmi/engine-contract` and the
`FR-026` taxonomy, and it is the only place the four changes can be made as one coherent edit with
the contract documentation updated alongside.

## Deferral

Deferred to **EPIC-003** with the owner named, per decision `D-6`, and closed here on that
decision — the same disposition `DEF-004-001` took, and the one `DOR-11` recognises:
*"deferred-with-an-owner is a decision … treating it as open would punish recording the
decision."* Recorded in `specs/008-spec-authoring-generation/closure.md` under `T191`.
