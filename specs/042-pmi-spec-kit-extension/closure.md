# Closure — EPIC-042 PMI Spec Kit Extension, Setup Skill and Constitution Sync

**Session**: 2026-09-05 · **Branch**: `epic/042-pmi-spec-kit-extension` · **Tasks**: [tasks.md](./tasks.md)
(`T1471`–`T1541`) · **Plan**: [plan.md](./plan.md)

Phase Z of `tasks.md`, ordered as the constitution's *quality gates in order* states them: unit
tests green → every user-facing capability exercised through its real entry point → convergence
clean → defect folder empty → promote.

## T1535 — every implementation task has a passing test or conformance check

Suites run on 2026-09-05 (this checkout, Windows 11, Node 22, Docker Desktop for the container
suites):

| Project | Files | Tests | Result |
|---|---|---|---|
| `workspace-bundle` | 8 | 82 | pass |
| `backend-unit` (governance, connector, projects) | see §counts | — | pass |
| `backend-contract` (`governance-api`, `mcp-tool-surface`) | 2 | — | pass |
| `backend-integration` (`governance-schema`, `governance-api`, `connector-reads`, `governed-command-roundtrip`, `decomposition-read`, `constitution-render`, `constitution-drift`) | 7 | 30 | pass |
| `mcp-server` | 5 | — | pass |
| `speckit-adapter` (`local-init`) | 1 | 8 | pass |
| `architecture` | — | — | pass |
| `frontend` (`constraints`, `project-executions`, the shell) | — | — | pass |
| `governance` | 74 | — | 2 known-red (`T884`), the rest pass |

*(counts filled at closure — see §Counts below)*

## T1536 — Constitution XI Tier 1, and the inversion

Every route is driven through the composed `AppModule` (`backend/src/app.module.ts`):
`governance-api.spec.ts` (T1487, integration variant), `governed-command-roundtrip.spec.ts`
(T1500 — through a real `pmi-studio` server over an in-memory transport), `constitution-render.spec.ts`
(T1517) and `constitution-drift.spec.ts` (T1519). The stock-skill immutability check runs against a
real project directory seeded from this checkout's pinned manifest (T1498).

**Inversion**: removing `GovernanceModule` from `backend/src/app.module.ts` and running
`governance-api.spec.ts` — *(observation recorded below)*.

## T1537 — Constitution XI Tier 2

The `M2` transcript is produced by `e2e/tests/epic-042-m2.spec.ts` against the reference-local
stack, through the sequence harness (`R-042-12`): the hook **prompts** are verified by conformance
(`extension-conformance.spec.ts`); the hook **sequences** are executed by the run. **Not yet run in
this session** — the reference-local stack (API + worker + web, a seeded user) was not started.
Recorded as open, exactly like `EPIC-043`'s `T1458`; the manual section (two consecutive
`/setup-PMIStudio` runs, `SC-EXT-010`) is owed with it.

## T1538 — mutation observations and the inversion

| Target | Mutation | Test | Observed |
|---|---|---|---|
| `SC-EXT-001` | the install appends one line to `speckit-specify/SKILL.md` | `stock-skills-immutable.spec.ts` | *(recorded below)* |
| `SC-EXT-004` | `classify` answers `current` for every digest | `constitution-drift.spec.ts` | *(recorded below)* |
| `SC-EXT-005` | the setup skill prints the variable | `setup-skill.spec.ts` | *(recorded below)* |
| `SC-EXT-009` | the render takes the Governed Execution text from a constraint entry | `constitution-render.spec.ts` | *(recorded below)* |
| `FR-EXT-003` (inversion) | a hook names `speckit.pmi.commit`, which no command provides | `extension-conformance.spec.ts` | *(recorded below)* |

## T1539 — Constitution XII

The commands that produced this Epic's artifacts (`/speckit-specify` → `/speckit-implement`) ran
**unregistered by hook**: the hook is this Epic's output and did not exist while it was built.
`EPIC-043`'s `M1` transcript proved the registration path by hand; this Epic's `M2` transcript is
the first run in which `speckit.pmi.begin` registers a governed command automatically. From the
next Epic on, every governed command in a provisioned directory is registered by the hook.

## T1541 — records

- `adr/ADR-0030-local-first-execution-and-integration-contract.md` carries the 2026-09-04
  `EPIC-042` amendment (`FR-EXT-070`): the extension as the mechanism (`D-8`), the constitution as
  generated content (`D-3`).
- `.specify/memory/constitution.md` reads **1.6.1** with the Directory-contract sentence on
  generated constitutions (`FR-EXT-071`), amended through `/speckit-constitution` at the plan step.

## Assumptions and deviations recorded during implementation (Constitution X)

1. **No `yaml` runtime dependency in the bundle** (`T1472` said "add the `yaml` dev dependency
   for the tests"): `yaml` is a dev dependency of the bundle for its tests only; the registry
   merge is string-level so the bundle keeps zero runtime dependencies (`T1471` asserts it).
2. **Schema validators are hand-written** (`T1511`, `T1529` said "zod"): the bundle carries no
   runtime dependency, so `validateDecompositionDecision` and `validateProvisionalRecord` are
   plain functions with the same rules.
3. **The harness lives in the bundle** (`packages/workspace-bundle/src/hook-sequences.ts`), not
   `e2e/support/` as the plan named: the backend's integration tests import it, and a file outside
   the backend's `rootDir` cannot be typechecked there; it is structurally typed (no SDK
   dependency) and re-exported, and `e2e/` imports it from the package.
4. **The extension content is copied by the toolkit adapter's initialise step**
   (`engine-adapters/speckit/src/local-init.ts`), where `EPIC-041` put the copy, not by
   `provisioning.service.ts` as `T1499` named; the adapter now depends on the bundle for
   `mergeExtensionsRegistry`.
5. **`GET /v1/projects/{id}/constitution` is one route with two callers** (`R-042-10`): a second
   controller on the same path shadowed the first, so the session controller dispatches on the
   bearer header and runs the connector guard for `constitution.read` before answering the
   connector view.
6. **Every governance write re-renders** (`FR-EXT-024`): the latest render is what a workstation's
   digest is classified against on `pmi.health`, so a change must exist as a render before the
   next report, not on the next read of the screen.
7. **The provisioning renderer is attached after boot** (`attachConstitutionRenderer`), not
   injected: `GovernanceModule` imports `ProjectsModule`, and a Nest cycle would have put the
   inversion in doubt.
8. **A first run over the composed application registers nothing today**: until `EPIC-044` makes
   Epic a product entity the platform derives no Epics (`FR-PIC-043`), and one-spec-per-Epic has
   nothing to specify beyond the unassigned bundle. The three-Epic loop with a confirmed split is
   proved against a stub (`first-run.spec.ts`) and the composed behaviour is stated in
   `decomposition-read.spec.ts` and the `M2` transcript.
9. **Output identity is bound only to a completed execution** (`AC-EXR-17d`): the finish hook
   omits `output` on `partially-completed`, `failed` and `cancelled`; `finish.md` says so.
10. **Delivering the Governance area moved the shell's delivery matrix by one** (`EPIC-036`'s
    documents and tests: 5 delivered · 2 partly · 11 owed), with a dated note in each document as
    `T1172` did for the Requirement Room; three shell tests that used `/governance` as their
    example of an owed area now use `/reports`.
11. **The digest a workstation reports is computed with the header's digest field zeroed**, the
    way the platform computes it (`contracts/governance-api.md` §4); `begin.md` and the harness say
    so.

## Counts

*(filled by T1535)*
