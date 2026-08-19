# DEF-001-003 — sixteen completed tasks name file paths that do not exist

**Epic**: `EPIC-001` (six instances) · **EPIC-026** (one) · **EPIC-028** (nine); corrections land in all three
**Raised**: 2026-08-19 | **Status**: **CLOSED — FIXED 2026-08-19**
**Found by**: `/speckit-implement` step 9, verifying that a ticked box corresponds to a real artifact
**Severity**: **MEDIUM** — the work exists and is tested; the trace to it is broken

## What was found

Resolving every repository path named by a completed task, across all 28 Epics: **318 paths checked,
16 absent.**

The first sweep covered only the five Epics at `Ready` or better and found seven. Widening the guard
to the whole tree found nine more, all in EPIC-028. **The narrow sweep was the mistake** — it scoped
the search to where the register said work was finished, when the fault has nothing to do with
readiness. Recorded because the first number in this file was 7 and was wrong.

| Task | Names | Actually at |
|---|---|---|
| `T157` | `backend/tests/unit/observability/logging.spec.ts` | `packages/observability/tests/unit/logging.spec.ts` |
| `T158` | `backend/src/core/observability/logger.ts` | `packages/observability/src/logger.ts` |
| `T159` | `backend/tests/unit/observability/correlation.spec.ts` | `packages/observability/tests/unit/correlation.spec.ts` |
| `T160` | `backend/src/core/observability/correlation.ts` | `packages/observability/src/correlation.ts` |
| `T163` | `backend/tests/unit/observability/metrics.spec.ts` | `packages/observability/tests/unit/metrics.spec.ts` |
| `T164` | `backend/src/core/observability/metrics.ts` | `packages/observability/src/metrics.ts` |
| `T506` | `tests/governance/epic-stage/waiver-readiness.spec.ts` | split across `readiness.spec.ts` and `waivers.spec.ts` |
| `T548` | `packages/execution-contract/tests/unit/generation-profile.spec.ts` | `validation.spec.ts` — *"permits exactly the AI provider endpoint, matching ADR-0002"* |
| `T552` | `packages/agent-contract/tests/unit/capabilities.spec.ts` | `contract.spec.ts` — `AGENT_CAPABILITIES`, `assertAgentCapabilities` |
| `T563`, `T587` | `agent-adapters/fixture/src/fixture.agent.ts` | `agent-adapters/fixture/src/index.ts` |
| `T564` | `agent-adapters/claude/src/claude.agent.ts` | `agent-adapters/claude/src/index.ts` |
| `T573`, `T646a` | `execution-providers/docker/src/docker.provider.ts` | `execution-providers/docker/src/index.ts` |
| `T578`, `T579`, `T580` | `egress-validation` / `policy-capability` / `credential-validation` `.spec.ts` | all three consolidated into `validation.spec.ts` — `GENERATION_EGRESS_PROFILE`, `assertEgressProfile`, `assertCredentialRef` |

**Every one was verified individually, by reading the destination rather than inferring it.** Two
patterns account for all sixteen: work that became a workspace package addressed through `index.ts`,
and several planned spec files that consolidated into one.

**This is not unbuilt work.** Nothing here needs implementing. What is wrong is the trace: someone
following `T158` to `backend/src/core/observability/logger.ts` finds nothing and would reasonably
conclude the task was ticked without being done.

## Why the existing checks did not catch it

`DOR-08` pairs a task with its test and would have caught a missing test — but these tasks carry
explicit `(unit test: T157)` references, so pairing succeeded on the reference without anyone
resolving the path beside it. The check reads the *claim*, and the claim is well-formed. Same shape
as the recurring finding this repository keeps meeting: **a check that names the right condition and
cannot observe it** — pairing is observed, existence is not.

## A second, smaller thing

`backend/src/core/observability/` exists on disk as an **empty directory**, left behind when the code
moved to `packages/`. Git does not track empty directories, so it is present in local working trees
and absent from every checkout — the same mechanism as `DEF-026-005`, found an hour earlier and
harmless here. Removed.

## The fix

`tasks.md` in EPIC-001, EPIC-026 and EPIC-028 now names where the work actually is. The task text is
otherwise untouched, and **no checkbox changed**: the work was complete before this record and is
complete after. Nothing here was implemented, because nothing here was missing.

## The guard

`G-26-14` resolves every repository path named by a completed task, across every Epic, and fails
when one does not exist. Two exclusions, both reachable and both load-bearing: spec-relative paths
(`../_shared/schema.sql` resolves from the Epic directory, and reporting it from the root produced
two false positives on the first run), and citations of packages outside this tree
(`@nestjs/common/...`), which would make the check noisy enough to be muted.

A third exclusion was written and removed. It skipped paths containing `*`, but the matching regex
has no `*` in its character class, so the condition could never be true — **a guard that guarded
nothing**, which is the same shape as the faults this suite exists to catch. Its own test exposed it
by asserting the exclusion fired, and finding it never did.
