# Quickstart — EPIC-044 Epic Model and Spec Journey Board

**Session**: 2026-09-05 · **Plan**: [plan.md](./plan.md)

Twelve scenarios. Each names the stack it runs on (README §Setup: **reference local** or
**containerised**) and the test that automates it. Nothing here is implementation.

## Prerequisites

- `EPIC-041`, `EPIC-043` and `EPIC-042` on the stack: a provisioned project, a credential, the
  `pmi-studio` server reachable from the sequence harness (`@pmi/workspace-bundle`).
- For the extraction scenarios: this repository's `governance/epic-stage-register.md` as committed
  before the first task of this Epic.

## Scenarios

| # | Scenario | Stack | Automated by |
|---|---|---|---|
| 1 | Regenerate the register before and after the extraction: byte-identical; the 32 governance specs importing the stage modules pass unchanged | any | `tests/governance/epic-stage/register.spec.ts`, the governance project (`SC-EPB-002`) |
| 2 | The two configuration files are byte-identical; `stages` has seven entries with `reachedBy`; `productStages` has two | any | `tests/governance/epic-stage-config-mirror.spec.ts` (`G-44-01`), `packages/epic-stage/tests/config.spec.ts` |
| 3 | Create three Epics; numbers 1, 2, 3; two parallel creates receive distinct numbers; a closed Epic keeps its number and the next is 4 | containerised | `backend/tests/integration/epics-api.spec.ts` |
| 4 | Assign four requirements to two Epics; move one; the Epic list shows counts and an *unassigned* group; assignment to a closed Epic is refused | containerised | same; `frontend/tests/unit/pages/epic-list.spec.tsx` |
| 5 | `pmi.project.context`, `pmi.requirements.list?groupBy=epic` and `pmi.project.decompose` return the entity's Epics with `epicSource: 'epic.entity'`; another project's credential sees none | containerised | `backend/tests/integration/connector-reads.spec.ts` (extended) |
| 6 | Register and complete `specify` for Epic 1 and `specify`+`plan` for Epic 2 through the harness; the board read shows *Not started* / *Specified* / *Planned* with last and next; the derivation for 50 Epics and 500 generated executions runs under 50 ms | containerised · any | `backend/tests/integration/epic-stages.spec.ts`; `packages/epic-stage/tests/evidence-executions.spec.ts` |
| 7 | A `failed` `plan` after a completed `clarify` leaves *Clarified* and shows the failure as last; an unfinished `implement` shows *Implementing · running since*; a `converge` whose comment names `tasks.md` leaves the stage; one that does not moves to *Converged*; a later `implement` returns to *Implementing* | containerised | `epic-stages.spec.ts`, `evidence-executions.spec.ts` |
| 8 | A queued provisional record for an Epic moves nothing on the board | containerised | `epic-stages.spec.ts` (`SC-EPB-007`) |
| 9 | A `decomposition-decision` comment (confirmed, two children) creates two child Epics with the next numbers, the recorded requirements and a parent link, once even when read twice; a rejected decision creates nothing | containerised | `backend/tests/integration/decision-reconcile.spec.ts` (`SC-EPB-006`) |
| 10 | The board: columns in order, cards with number, title, stage, last, next, readiness note, an unbound group, filters, four states, the footer naming the package version | any | `frontend/tests/unit/pages/journey-board.spec.tsx` |
| 11 | The specification list shows Epic and Stage columns; *no Epic* for an unassigned specification; an owner assigns it | any | `frontend/tests/unit/pages/specification-list.spec.tsx` (extended) |
| 12 | **M3, first half**: create Epics and assign requirements in the UI; run the first run through the harness with one confirmed split; the board shows every Epic at *Specified* with `/speckit-clarify` next and the children present | reference local | `e2e/tests/epic-044-m3.spec.ts` → `docs/uat/EPIC-044-m3-transcript.md` (`SC-EPB-003`) |

## Running the checks

```bash
npx vitest run --project epic-stage --project governance
```

```bash
npx vitest run --project backend-unit backend/tests/unit/epics --project backend-contract backend/tests/contract/epics-api.spec.ts --project backend-integration backend/tests/integration/epics-api.spec.ts backend/tests/integration/epic-stages.spec.ts backend/tests/integration/decision-reconcile.spec.ts backend/tests/integration/connector-reads.spec.ts --project frontend frontend/tests/unit/pages/epic-list.spec.tsx frontend/tests/unit/pages/journey-board.spec.tsx --project architecture
```

```bash
E2E_STACK="reference local" npx playwright test e2e/tests/epic-044-m3.spec.ts
```

## Mutation observations owed at closure

| Target | Mutation | Expected |
|---|---|---|
| `SC-EPB-001` | `evidenceFromExecutions` counts a `failed` execution as completed | `evidence-executions.spec.ts` red |
| `SC-EPB-001` | `deriveStageFromEvidence` returns the highest present stage regardless of gaps | `derive.spec.ts` red **and** the register drift check red |
| `SC-EPB-006` | reconciliation ignores `decisionCommentId` when checking for existing children | `decision-reconcile.spec.ts` red (duplicates) |
| `SC-EPB-002` (inversion) | the governance shim computes the stage with a local copy of the rule that skips `Checklisted` | the register drift check red |

## Results

*(filled at closure by the Phase Z tasks)*
