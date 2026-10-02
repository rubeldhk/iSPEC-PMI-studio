# DEF-044-002 — the registry refused the `decomposition-decision` comment EPIC-042's hooks record

**Epic**: `EPIC-044` | **Raised**: 2026-09-05 | **Status**: CLOSED 2026-09-05

**Originating task**: `EPIC-042` `T1498` (the first-run decision record) and `EPIC-037` `T886` (the
comment vocabulary) · found while executing `T1593` (decision reconciliation through the real server)
**Severity**: HIGH — a confirmed split in a real first run recorded no decision; the decision was
lost silently and `EPIC-044`'s reconciliation had nothing to read

## Expected

The first-run flow's step 5 (`packages/workspace-bundle/extension/commands/begin.md`,
`specs/042-pmi-spec-kit-extension/contracts/extension-and-hooks.md` §7) records a confirmed or
rejected split as `pmi.execution.comment { commentType: 'decomposition-decision', body: <JSON> }`;
`specs/042-pmi-spec-kit-extension/data-model.md` §8 names the type. `EPIC-044` `FR-EPB-060`–
`FR-EPB-061` read those comments to create the split children.

## Actual

The registry's comment vocabulary (`COMMENT_TYPES` in
`backend/src/modules/executions/execution-comment.service.ts`, mirrored by the CHECK constraint
`execution_comments_type_vocabulary` in migration `20260827160000_epic037_execution_registry`) was
`completion | clarification | review | decision | system`. The service refused the hook's comment
with `RegistryRefusedError`; the hook sequence treats a refused comment as a non-fatal step, so the
first run completed and the decision vanished. `EPIC-042` could not see it: its first-run test
(`packages/workspace-bundle/tests/first-run.spec.ts`) proves the loop against a stub client that
accepts any tool call, which `EPIC-042`'s closure recorded as assumption 8 — the first time the
decision reached a real server was `T1593`.

## Resolution

Additive, in the registry's own vocabulary rather than by renaming the hook's type: the `EPIC-042`
contract, data model, hooks, harness and the `EPIC-044` reader all name `decomposition-decision`,
and `decision` already means something else (a human decision on a review). Changes:

- `backend/src/modules/executions/execution-comment.service.ts` — `COMMENT_TYPES` gains
  `'decomposition-decision'` (six values).
- `backend/prisma/migrations/20260905130000_epic044_decision_comment_type/migration.sql` — drops
  and re-creates `execution_comments_type_vocabulary` with the sixth value; no row changes.
- `backend/tests/unit/executions/comments.spec.ts` — the vocabulary pin names six types.
- `specs/037-governed-execution-registry/data-model.md` — dated note on the `commentType` line.

`backend/tests/integration/decision-reconcile.spec.ts` (`T1593`) now drives the decision through
the real server and reads the children back, so a refused decision cannot vanish unseen again.

## Lesson

A vocabulary enforced in two places (code and a CHECK) and proved by a stub that accepts everything
is the `DEF-005-001` class again: built, tested, called by nothing real. Any Epic that introduces a
value into another Epic's closed vocabulary owes one test through the composed application.
