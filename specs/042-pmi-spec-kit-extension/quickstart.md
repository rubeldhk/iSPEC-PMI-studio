# Quickstart — EPIC-042 PMI Spec Kit Extension, Setup Skill and Constitution Sync

**Session**: 2026-09-04 · **Plan**: [plan.md](./plan.md)

Fourteen scenarios. Each names the stack it runs on (README §Setup: **reference local** or
**containerised**) and the test that automates it. Nothing here is implementation; it is what a
person or a test does to see the Epic hold.

## Prerequisites

- `EPIC-041` and `EPIC-043` on the stack: a provisioned project, a credential copied once,
  `PMI_STUDIO_TOKEN` in the shell that starts the agent, the checkout override
  `PMI_MCP_SERVER_COMMAND` for the reference-local stack.
- For the hook scenarios without an agent: the sequence harness in `e2e/` (`R-042-12`).

## Scenarios

| # | Scenario | Stack | Automated by |
|---|---|---|---|
| 1 | The bundle's manifest, three commands and hook fragment validate; every tool and argument they name exists in the surface | any | `packages/workspace-bundle/tests/extension-conformance.spec.ts` |
| 2 | Initialise a temp project at the pinned tag, install the extension, merge the fragment: the ten stock skill digests equal the manifest | any | `stock-skills-immutable.spec.ts` (`SC-EXT-001`) |
| 3 | Run `/speckit-plan` in a provisioned directory: the timeline shows one `plan` execution with input digests, a completion with output digests and a comment; no file outside the Epic changed | reference local | `e2e/tests/epic-042-m2.spec.ts` (sequence harness), `backend/tests/integration/governed-command-roundtrip.spec.ts` |
| 4 | Make the platform unreachable, offline mode `strict`: the begin hook prints the refusal naming the address and the mode; nothing runs, nothing changes | reference local | `e2e/tests/epic-042-m2.spec.ts` §strict (`SC-EXT-006`) |
| 5 | Offline mode `provisional`, platform unreachable: a record with a client-generated id and `execution-sync-queued` exists before the command runs; every line says *(not governed)*; on reconnect the queue is submitted and the reserved refusal is reported once | reference local | `e2e/tests/epic-042-m2.spec.ts` §provisional, `provisional-record.spec.ts` (`SC-EXT-007`) |
| 6 | Enter two principles, one constraint, one non-goal and a policy on the Constraints screen: the preview shows them in order with the invariant section; the digest changes on every edit | reference local | `frontend/tests/unit/pages/constraints.spec.tsx`, `backend/tests/integration/constitution-render.spec.ts` (`SC-EXT-004`) |
| 7 | `pmi.constitution.get` returns the preview's content and digest; the Governed Execution section equals the bundle's invariant byte-for-byte | any | `backend/tests/contract/governance-api.spec.ts` (`SC-EXT-009`; mutation: alter one render's section → red) |
| 8 | Edit the file by hand; call `pmi.health` with its digest: state `drift`; the project screen and the Constraints screen show *file differs*; write the current render; the next report clears it | reference local | `backend/tests/integration/constitution-drift.spec.ts`, `frontend/tests/unit/pages/project-executions.spec.tsx` (extended) |
| 9 | Run `/setup-PMIStudio` on a machine without `uv`: red row 2 with the instruction, later rows `skipped`, table printed | reference local (manual, recorded in the transcript) | `setup-skill.spec.ts` for the text; transcript for the run |
| 10 | Run `/setup-PMIStudio` green: toolkit at the pinned tag, extension verified, `.mcp.json` gains `context7` and `github` with `${VAR}` references only, row 10 shows the project id; the workstation panel shows the connection | reference local | transcript; `bundle.spec.ts` |
| 11 | First run over three Epics, one above the ceiling: the plan prints three lines with estimates and one split proposal; after confirming, four `specify` executions, four directories, one `decomposition-decision` comment, marker gone | reference local | `e2e/tests/epic-042-m2.spec.ts` §first-run (`SC-EXT-003`, `SC-EXT-008`) |
| 12 | Second `/speckit-specify` after the first run is a single-Epic run; `decompose` reports `firstRun: false` | reference local | same |
| 13 | A project with no Epic and no baselined requirement: the begin hook prints *nothing to decompose*, names where to add requirements, writes nothing | any | `backend/tests/integration/decomposition-read.spec.ts`, harness |
| 14 | `pmi.constitution.get` and `pmi.project.decompose` return nothing for another project's credential; `artifacts.sync` and `tasks.sync` still refuse by name | any | `backend/tests/integration/connector-reads.spec.ts` (extended), `packages/mcp-server/tests/server.spec.ts` |

## Running the checks

```bash
pnpm --filter @pmi/workspace-bundle test
npx vitest run --project backend-unit backend/tests/unit/governance --project backend-contract backend/tests/contract/governance-api.spec.ts backend/tests/contract/mcp-tool-surface.spec.ts --project backend-integration backend/tests/integration/constitution-render.spec.ts backend/tests/integration/constitution-drift.spec.ts backend/tests/integration/decomposition-read.spec.ts backend/tests/integration/governed-command-roundtrip.spec.ts --project mcp-server --project frontend frontend/tests/unit/pages/constraints.spec.tsx --project architecture
```

```bash
E2E_STACK="reference local" npx playwright test e2e/tests/epic-042-m2.spec.ts
```

## Mutation observations owed at closure

| Target | Mutation | Expected |
|---|---|---|
| `SC-EXT-001` | the install step appends one line to `speckit-specify/SKILL.md` | `stock-skills-immutable.spec.ts` red |
| `SC-EXT-004` | the render service skips the digest comparison and reports `current` for every report | `constitution-drift.spec.ts` red |
| `SC-EXT-005` | the setup skill prints `$PMI_STUDIO_TOKEN` | `setup-skill.spec.ts` red |
| `SC-EXT-009` | the render service takes the Governed Execution text from a constraint entry instead of the bundle | `governance-api.spec.ts` red |
| `FR-EXT-003` (inversion) | a hook in the manifest names `speckit.pmi.commit`, which no command file provides | `extension-conformance.spec.ts` red |

## Results

### Recorded 2026-09-05 (`T1534`)

- **Render time** (plan §Performance Goals, bound 100 ms): a project with 50 entries and 20
  resolved steering documents renders in **0.81 ms** on average over 20 runs (in-memory stores,
  this checkout; measured with a throwaway unit test, not committed). The digest comparison that
  decides *unchanged → no new row* is part of that figure.
- **Hook call counts** (plan §Performance Goals, bound: under three added tool calls in the common
  case): `speckit.pmi.begin` adds **two** tool calls when the file is current, no queue waits and
  nothing is left open (`pmi.health`, `pmi.execution.register`); a stale or missing file adds one
  (`pmi.constitution.get`); each queued provisional record adds one (`pmi.execution.sync`); a
  left-open execution adds two (`pmi.execution.history`, `pmi.execution.complete`).
  `speckit.pmi.finish` adds two (`pmi.artifacts.sync`, `pmi.execution.complete`), three after
  `tasks` and `implement` (`pmi.tasks.sync`), plus one `pmi.execution.appendEvent` per task
  ticked during `implement`. Counted from `packages/workspace-bundle/src/hook-sequences.ts`, which
  performs the same calls the prompts instruct.
- **Scenarios 1–8, 11–14** automated and green in this session (see `closure.md` §T1535 for the
  suite counts). Scenario 11's three-Epic split runs against a stub client (`first-run.spec.ts`):
  the composed application derives no Epics until `EPIC-044` (`FR-PIC-043`), so a first run over
  it registers nothing and says so (`decomposition-read.spec.ts`).
- **Scenarios 9 and 10** (the setup skill on a red and on a green machine) and the **M2
  transcript** (`e2e/tests/epic-042-m2.spec.ts`, `docs/uat/EPIC-042-m2-transcript.md`) need the
  reference-local stack running; not run in this session — open under `T1537`, as `EPIC-043`'s
  `T1458` is.
- **Mutation observations**: see `closure.md` §T1538.
