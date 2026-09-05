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
| `backend-unit` (whole project) | 296 | 2689 | 2685 pass, 4 not run on this host (`T832`, see §Counts), 0 fail |
| `backend-contract` (whole project) | 24 | 242 | pass |
| `backend-integration` (`governance-schema`, `governance-api`, `connector-reads`, `governed-command-roundtrip`, `decomposition-read`, `constitution-render`, `constitution-drift`) | 7 | 30 | pass |
| `mcp-server` | 6 | 48 | pass |
| `speckit-adapter` (whole project) | 12 | 175 | pass |
| `architecture` | 24 | 289 | 274 pass, 5 skipped, 1 known-red (`T999u`, `EPIC-035`'s Tier 2 transcript — predates this Epic) |
| `frontend` (whole project) | — | 864 | pass |
| `governance` | 75 | 1048 | 1046 pass, 2 known-red (`T884`, `EPIC-029`'s manual pass — predates this Epic) |

Three regressions surfaced by the whole-project runs were fixed in this phase and are recorded as
assumptions 14–16 below: `T1352` (the file-set contract gained the first-run marker), `T012a`
(the three new tables needed a `workspaceId` index and an entry in the expected set) and `T864a`
(the harness wrote a task-identifier shape). `G-26-14` found ticked tasks naming the harness at the
plan's path (`e2e/support/`) rather than where assumption 3 put it; the task lines now name the
file that exists.

## T1536 — Constitution XI Tier 1, and the inversion

Every route is driven through the composed `AppModule` (`backend/src/app.module.ts`):
`governance-api.spec.ts` (T1487, integration variant), `governed-command-roundtrip.spec.ts`
(T1500 — through a real `pmi-studio` server over an in-memory transport), `constitution-render.spec.ts`
(T1517) and `constitution-drift.spec.ts` (T1519). The stock-skill immutability check runs against a
real project directory seeded from this checkout's pinned manifest (T1498).

**Inversion (observed 2026-09-05)**: with `GovernanceModule` commented out of
`backend/src/app.module.ts`, `tests/integration/governance-api.spec.ts` went red — `POST
…/constraints` answered `404` instead of `201` and `GET …/constitution` `404` instead of `200`
(two failures). The line was restored from the commit and the suite is green again.

## T1537 — Constitution XI Tier 2

The `M2` transcript is produced by `e2e/tests/epic-042-m2.spec.ts` against the reference-local
stack, through the sequence harness (`R-042-12`): the hook **prompts** are verified by conformance
(`extension-conformance.spec.ts`); the hook **sequences** are executed by the run. **Not yet run in
this session** — the reference-local stack (API + worker + web, a seeded user) was not started.
Recorded as open, exactly like `EPIC-043`'s `T1458`; the manual section (two consecutive
`/setup-PMIStudio` runs, `SC-EXT-010`) is owed with it.

## T1538 — mutation observations and the inversion

All observed on 2026-09-05; each mutation was reverted and the suite re-run green.

| Target | Mutation | Test | Observed |
|---|---|---|---|
| `SC-EXT-001` | the install step (the test's `installExtension`, the copy-and-merge the adapter performs) appends one line to `speckit-specify/SKILL.md` | `stock-skills-immutable.spec.ts` | **red** — *"speckit-specify/SKILL.md changed by the installation"* and the idempotence check, 2 failures |
| `SC-EXT-004` | `classifyOnDiskDigest` returns `current` for every non-null digest | `constitution-drift.spec.ts` | **red** — *"expected 'current' to be 'stale'"* |
| `SC-EXT-005` | a line `echo $PMI_STUDIO_TOKEN` appended to the skill | `setup-skill.spec.ts` | **red** — *"never asks for, prints or writes a credential value"* |
| `SC-EXT-009` | first attempt: the section takes a constraint's body **only when one is titled Governed Execution** — did **not** bite (the suite creates no such entry); second, stronger mutation: the section always takes the first entry's body instead of the bundle's invariant | `constitution-render.spec.ts` | first: green (mutation too weak, recorded); second: **red** — the byte-equality with `governedExecutionSection('provisional')` failed |
| `FR-EXT-003` (inversion) | `before_converge` names `speckit.pmi.commit`, which no command file provides | `extension-conformance.spec.ts` | **red** — the manifest check and the fragment check, 2 failures |

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
12. **The stock-skill immutability check pins the pre-install digests, not the toolkit's
    manifest, when seeded from this repository**: this checkout's stock skills carry governance
    edits (Constitution X), so their digests differ from the toolkit's manifest by design; the
    property under test — installation moves none — holds either way, and a real
    `specify init` layer (`PMI_STOCK_SKILLS_REAL_INIT=1`) compares against the toolkit's manifest.
13. **Stale historical figures in `EPIC-036`'s two `T1172` notes were neutralised** ("these
    figures followed it (superseded by the EPIC-042 note below)") because the documented-registry
    check counts every non-`Corrected` claim; the history remains in git.
14. **The first-run marker joined `EPIC-041`'s file-set contract** (`T1352`, `FR-LPW-011`): the
    prepare step now writes four files, so `specs/041-local-project-workspace/contracts/project-files.md`
    carries a dated section for `.pmi/first-run` and the contract test asserts four. Found by the
    whole-project `backend-contract` run, not by this Epic's own tests.
15. **`decomposition_policies` and `constitution_renders` gained a `(workspaceId, projectId)`
    index** (`T012a`, `FR-002`): both are tenant-scoped and the universal-columns check requires
    an index on `workspaceId` for every such table; `renderedAt` is registered as the render's
    creation timestamp. The migration file was edited in place — it has run nowhere but this
    branch's containers.
16. **The harness no longer writes a task-identifier shape** (`T864a`, `FR-ESK-025`): `tickedTasks`
    takes the first token after a ticked checkbox and the partially-completed rule looks for any
    unticked item; the identifier's shape is the platform's configuration, which the bundle —
    installed into other people's projects — has no business restating.

## Counts

Whole-project runs on 2026-09-05 after the fixes above (`pnpm -r typecheck` clean; `npx eslint .`
reports 20 errors, all in files this Epic did not touch or in `.claude/worktrees` copies — the one
in a file this Epic edited, `frontend/tests/unit/shell/surface-states.spec.tsx` line 43, dates
from 2026-08-24):

| Project | Files | Tests |
|---|---|---|
| `workspace-bundle` | 8 passed | 82 passed |
| `speckit-adapter` | 12 passed | 175 passed |
| `mcp-server` | 6 passed | 48 passed |
| `backend-unit` | 295 passed of 296 | 2685 passed of 2689; the four not run are `T832` in `backend/tests/unit/auth/composition.spec.ts`, whose worker exits at boot on this host: the probe's placeholder `DATABASE_URL` reaches a live PostgreSQL on port 5432 that rejects its credentials during the engine-registration load (`backend/src/modules/engines/registered-engines.ts`, untouched by this Epic — the same four are unaccounted for in the run taken before the fixes). Host-dependent and pre-existing; nothing failed |
| `backend-contract` | 24 passed | 242 passed |
| `backend-integration` (this Epic's seven suites) | 7 passed | 30 passed |
| `architecture` | 22 passed, 1 failed (`T999u`, pre-existing) | 274 passed, 5 skipped, 1 failed |
| `frontend` | all passed | 864 passed |
| `governance` | 74 passed, 1 failed (`T884`, pre-existing) | 1046 passed, 2 failed |
