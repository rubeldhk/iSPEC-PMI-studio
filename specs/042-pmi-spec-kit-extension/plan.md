# Implementation Plan: PMI Spec Kit Extension, Setup Skill and Constitution Sync

**Epic**: `EPIC-042` · **Branch**: `epic/042-pmi-spec-kit-extension` · **Date**: 2026-09-04

**Spec**: [spec.md](./spec.md) (clarified 2026-09-04) · **Research**: [research.md](./research.md)

**SRS References**: `SRS/PMI-DOC-007_Local_First_Replan_v1.0` §2.2 (steps 3–5), §2.3, §3 (the
three `042` models), §4.1–4.2 (the two `042` tools and routes), §5 (extension, hook map, setup
skill, generated constitution, decomposition algorithm), §6, §7 (`EPIC-042` brief), §9.2, §9.3
(`LR-04`–`LR-06`), §11 (`R-02`, `R-03`, `R-04`, `R-07`, `R-08`), §12 (`D-3`, `D-4`, `D-8`) ·
`SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` §6.4 (`BR-0037`), §6.8 (`BR-0070`,
`BR-0072`), §6.13 (`BR-0122`), §6.22 (`BR-0196`, `BR-0198`, `BR-0201`, `BR-0202`) ·
`SRS/PMI-DOC-004B` §5.2 (`O-3`, `O-5`, `O-6`)

**Input**: Feature specification from `specs/042-pmi-spec-kit-extension/spec.md`

## Summary

`EPIC-041` installed an extension with no content and a setup skill that only hands off.
`EPIC-043` built the server the extension will call and reserved the two tools whose content is
this Epic's. What remains is almost entirely **documents that machines read**: a manifest, three
command prompts, a hook fragment, a skill, a rendered constitution — plus the small platform
surface that feeds them (constraints, a policy, renders, two reads) and one screen.

The plan is four layers, each resting on the one below:

1. **The governance records** (`R-042-4`, `R-042-5`, `R-042-7`, `R-042-11`): three tables,
   a deterministic render whose invariant section is exported by the bundle, drift classified on
   the platform from what a workstation reports, the decomposition plan as a projection, and the
   two reserved tools made live under two new scopes.
2. **The bundle content** (`R-042-1`, `R-042-2`, `R-042-3`, `R-042-6`, `R-042-9`): the `pmi`
   extension — manifest, `begin`/`finish`/`progress`, the hook fragment — and the full
   `/setup-PMIStudio`, both as agent prompts that ship no script, both checked by executable
   conformance tests, with stock-skill immutability proved by digest on an installed project.
3. **The screen** (`R-042-10`): the Governance area delivered with the Constraints page —
   entries, policy, preview, digest, *file differs*.
4. **The evidence** (`R-042-12`): the `M2` transcript produced by a harness that executes the
   documented hook sequences through a real server, because a prompt cannot be run by a test
   runner; the prompts themselves are verified by conformance.

The plan closes two governance obligations at this step: `ADR-0030` is amended (`FR-EXT-070`) and
the repository constitution goes to `1.6.1` through `/speckit-constitution` (`FR-EXT-071`,
`R-042-13`).

## Technical Context

**Language/Version**: TypeScript 5.7, Node ≥ 22 (`ADR-0003`). The bundle content is Markdown and
YAML; the invariant constitution text is Markdown exported by a TypeScript function.

**Primary Dependencies**: NestJS 10, Prisma 5.22, React, Vitest 2.1, Playwright (unchanged).
**No new runtime dependency.** `@pmi/workspace-bundle` (existing, private) goes to `0.2.0` and
gains a `constitution/` export; `@pmi/mcp-server` moves two tools from reserved to live and adds
no dependency. The YAML the bundle ships is read in tests by the `yaml` package already in the
tree; the backend does not parse YAML (the hook-fragment merge is the setup skill's, on the
user's machine, and the provisioning merge is a string-level append verified by test).

**Storage**: PostgreSQL 16 via Prisma. **Three new tables** (`project_constraints`,
`decomposition_policies`, `constitution_renders`), **three new columns** on
`workstation_connections`, **one** on `provisioning_records`. Additive migration
`<ts>_epic042_extension_constitution`. On the user's machine: `.pmi/first-run`,
`.pmi/provisional/*.json`, `.pmi/last-execution`, the constitution file.

**Testing**: Vitest — `workspace-bundle` (a new project: extension conformance, stock-skill
immutability against a real `specify init`, hook-fragment merge, setup-skill text, provisional
record shape), `backend-unit` (render service, digest classification, policy defaults, plan
projection), `backend-contract` (`governance-api.md`; `mcp-tool-surface.md` amended),
`backend-integration` (Testcontainers: constraints and policy routes with grants, render and
drift, decomposition read, cross-project refusals, the governed-command round trip through the
server), `architecture` (`connector-boundary` list grows by two; `engine-independence` still
green with the invariant text outside `backend/src`; `mcp-server-boundary` unchanged),
`frontend` (Constraints page four states, filters, preview; connection rows with *file
differs*), `e2e` (`M2` transcript, `R-042-12`).

**Target Platform**: Linux server for the API; Windows, macOS and Linux developer machines for
the extension, the skill and the files under the project directory.

**Project Type**: web service (API + web) plus **bundle content** that runs inside the user's
agent.

**Performance Goals**: a render for a project with 50 entries and 20 steering documents completes
in under **100 ms**; a `begin` hook adds under **three** tool calls to a governed command in the
common (current, no queue, no left-open) case.

**Constraints**: no stock skill file changed (`FR-EXT-001`); no script shipped (`FR-EXT-003`);
`backend/src` names no engine (the invariant text lives in the bundle — `R-042-4`); no credential
value anywhere (`FR-EXT-036`); the surface stays `EPIC-043`'s plus two live tools
(`FR-EXT-060`–`062`); drift never overwritten silently (`FR-EXT-026`).

**Scale/Scope**: one policy row per project; constraints in the tens; renders in the hundreds
per project over its life; one provisional file per offline command.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes produced only via Spec Kit commands | **PASS** — the `ADR-0030` amendment is a governance record this command writes as `FR-EXT-070` directs; the constitution PATCH is made through `/speckit-constitution` as `FR-EXT-071` directs; no application code is written at the plan step |
| II | Every requirement traces to a cited `SRS/` document | **PASS** — PMI-DOC-007 is in `SRS/`; three requirements rest on provisional `LR-` identifiers with the `BR-` back-fill recorded under Assumptions |
| III | Epic → Feature → Task; `specs/042-pmi-spec-kit-extension/` exists | **PASS** |
| IV | `/speckit-converge` scheduled as the Epic exit gate | **PASS** — in the Exit Criteria |
| V | Every implementation task carries a failing-first unit test; document outputs carry a conformance check | **PASS** — planned in `/speckit-tasks`; the manifest, commands, fragment and skill are documents checked by executable conformance tests (`contracts/extension-and-hooks.md` §9, `contracts/setup-skill.md` §5); four mutation observations are owed (`quickstart.md`) |
| VI | `specs/042-pmi-spec-kit-extension/defects/` is the sole defect intake | **PASS** — created at this step, tracked in git |
| VII | local → dev → stage → prod, no environment skipped | **PASS** — the bundle version is recorded on every provisioning record; publication of `@pmi/mcp-server` remains `EPIC-043`'s promotion condition |
| VIII | Session labelled with the working Epic | **PASS** — branch `epic/042-pmi-spec-kit-extension` |
| IX | Every stop ends with an executable next action | **PASS** |
| X | Decision questions batched into one questionnaire | **PASS** — five asked at once on 2026-09-04, all recommendations accepted, no follow-up round |
| XI | Tier 1 always; Tier 2 for a journey | **PASS** — Tier 1: every route through the composed `AppModule`; every tool through a real MCP client; the stock-skill check against a real `specify init`; Tier 2: the `M2` transcript by the sequence harness, with the honest statement that prompts are verified by conformance and sequences by the run (`R-042-12`) |
| XII | Governed commands registered in PMI Studio before executing | **PARTIAL → PASS at closure** — see Complexity Tracking: this Epic *is* the hook that registers commands; the commands that build it run before it exists. `EPIC-043`'s `M1` transcript proved the path; this Epic's `M2` transcript is the first run in which the hooks register the commands |
| — | Repository synced from GitHub before work started | **PASS** — `origin/main` is behind local; nothing to integrate |
| — | No other Claude session active on this checkout | **PASS** |

**Post-Phase 1 re-check**: unchanged. The design added two gate considerations and resolved
both: the invariant constitution text names the toolkit's command prefix and therefore cannot
live in `backend/src` (`R-042-4` puts it in the bundle, which the backend imports as a function);
and the hooks cannot be executed by a test runner (`R-042-12` verifies the prompts by conformance
and the sequences by a harness, and says so in the transcript).

## Project Structure

### Documentation (this feature)

```text
specs/042-pmi-spec-kit-extension/
├── spec.md                          clarified 2026-09-04
├── plan.md                          ← this file
├── research.md                      R-042-1 … R-042-13
├── data-model.md                    3 tables, 4 columns, 2 scopes, the project-directory files, the split comment
├── contracts/
│   ├── extension-and-hooks.md       manifest · registry fragment · begin/finish/progress sequences · first-run loop · provisional record
│   ├── governance-api.md            constraints · policy · constitution (session + connector) · decomposition · the rendered shape · invariant text
│   └── setup-skill.md               the ten checks · .mcp.json entries · the table
├── quickstart.md                    14 scenarios, mutation targets
├── checklists/requirements.md
└── defects/                         Constitution VI intake
```

### Source Code (repository root)

```text
packages/workspace-bundle/                              → 0.2.0 (R-042-11)
├── extension/
│   ├── extension.yml                CONTENT: commands + hooks (R-042-1)
│   ├── commands/begin.md            speckit.pmi.begin — contracts/extension-and-hooks.md §4, §7
│   ├── commands/finish.md           speckit.pmi.finish — §5
│   ├── commands/progress.md         speckit.pmi.progress — §6
│   └── extensions-fragment.yml      the registry fragment provisioning and the skill merge — §2
├── constitution/
│   ├── governed-execution.md        the invariant text (FR-EXT-020)
│   └── header.md                    the generated-file header template
├── skills/setup-PMIStudio/SKILL.md  REPLACED: the full ten-step skill (R-042-9)
├── src/index.ts                     + governedExecutionSection(), constitutionHeader(), extensionsFragment(), mergeExtensionsRegistry()
└── tests/
    ├── extension-conformance.spec.ts   manifest ⇔ commands ⇔ tool surface; vocabulary; no engine, no credential
    ├── stock-skills-immutable.spec.ts  real specify init + install → ten digests unchanged (SC-EXT-001)
    ├── hook-fragment-merge.spec.ts     idempotent, foreign entries untouched
    ├── setup-skill.spec.ts             ten checks in order; never prints the variable (SC-EXT-005)
    └── provisional-record.spec.ts      §8 shape validates against the sync batch schema

backend/src/modules/governance/                          NEW module (R-042-4, R-042-5, R-042-7)
├── governance.module.ts
├── project-constraint.service.ts + .store.ts            entries: create/edit/reorder/retire, versioned
├── decomposition-policy.service.ts + .store.ts          one row per project, defaults on first read
├── constitution-render.service.ts + .store.ts           deterministic render; digest; classify(onDiskDigest)
├── decomposition-plan.service.ts                        the projection over ProjectContextService + the policy
├── governance.controller.ts                             session routes: constraints · policy · constitution
└── governance-connector.controller.ts                   GET /v1/projects/:id/constitution · /decomposition behind the guard

backend/src/modules/connector/
├── connector-scope.ts               + constitution.read, decomposition.read
├── connector-reads.controller.ts    health: + constitutionDigest in, constitutionState out
└── workstation-connection.service.ts + .store.ts  + the three columns
backend/src/modules/projects/project-files.ts   + writeFirstRunMarker(); provisioning writes the constitution render (FR-EXT-028)
backend/src/modules/projects/provisioning.service.ts + first-run marker, constitution file, extension content copy
backend/prisma/schema.prisma · migrations/<ts>_epic042_extension_constitution/migration.sql

packages/mcp-server/src/tools/reads.ts     + pmi.constitution.get · pmi.project.decompose
packages/mcp-server/src/tools/reserved.ts  − the two above
specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md   amended (FR-EXT-062)

frontend/src/shell/areas.ts               governance → delivered, element GovernanceArea (R-042-10)
frontend/src/shell/area-views.tsx         + GovernanceArea
frontend/src/pages/Constraints.tsx        entries · policy · preview · digest · file-differs
frontend/src/pages/Projects.tsx           connection rows: + constitution state
frontend/src/services/api.ts              + listConstraints · createConstraint · updateConstraint · retireConstraint · getPolicy · putPolicy · getConstitution
frontend/tests/unit/pages/constraints.spec.tsx

backend/tests/unit/governance/*.spec.ts
backend/tests/contract/governance-api.spec.ts · mcp-tool-surface.spec.ts (amended)
backend/tests/integration/{constitution-render,constitution-drift,decomposition-read,governed-command-roundtrip}.spec.ts · connector-reads.spec.ts (extended)
backend/tests/architecture/connector-boundary.spec.ts (list of thirteen)
e2e/tests/epic-042-m2.spec.ts             the M2 transcript via the sequence harness (R-042-12)
vitest.workspace.ts · package.json        + workspace-bundle project
adr/ADR-0030 (amended) · .specify/memory/constitution.md (1.6.1, via /speckit-constitution)
```

**Structure Decision**: governance records get their **own backend module** rather than living in
`connector/` or `projects/`, because they have a human owner surface (the Constraints screen)
and a connector read surface, and neither should import the other's controller. The bundle owns
every piece of text the toolkit reads, including the invariant constitution section, so the
backend imports a function and never contains the toolkit's name (`R-042-4`).

## Phase 0 — Research

[research.md](./research.md) resolves thirteen decisions: `R-042-1` the extension's shape and
mandatory hooks (Context7-verified); `R-042-2` stock-skill immutability by digest;
`R-042-3` commands as prompts with no script; `R-042-4` the deterministic render and where the
invariant lives; `R-042-5` drift reported by the workstation and classified by the platform;
`R-042-6` offline mode from the file and contract-shaped provisional records; `R-042-7` the
decomposition plan, the agent's estimate and the decision as a comment; `R-042-8` the first-run
marker; `R-042-9` the ten-step skill; `R-042-10` the Governance area; `R-042-11` the two live
tools and scopes; `R-042-12` the `M2` transcript by harness; `R-042-13` the governance records
this step writes.

No `NEEDS CLARIFICATION` remains: the five judgement calls were confirmed on 2026-09-04.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — the three tables, the columns, the classification rule,
  the scopes, the files under the project directory, the split comment, the plan projection.
- [contracts/extension-and-hooks.md](./contracts/extension-and-hooks.md) — the manifest, the
  registry fragment, the three command sequences, the first-run loop, the provisional record,
  the conformance tests.
- [contracts/governance-api.md](./contracts/governance-api.md) — session and connector routes,
  the two tools, the health extension, the rendered shape, the invariant text, refusals.
- [contracts/setup-skill.md](./contracts/setup-skill.md) — the ten checks, the `.mcp.json`
  entries, the table, the tests.
- [quickstart.md](./quickstart.md) — fourteen scenarios and the mutation observations owed.

## Governance records written by this step (`R-042-13`)

- `adr/ADR-0030` — amendment 2026-09-04 (`FR-EXT-070`): the extension is the mechanism for
  PMI-aware commands (`D-8`); the constitution is generated content (`D-3`).
- `.specify/memory/constitution.md` — `1.6.0 → 1.6.1` PATCH through `/speckit-constitution`
  (`FR-EXT-071`): the Directory contract states that a PMI-managed project's constitution file is
  generated and not hand-edited.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Gate XII PARTIAL — the commands producing this Epic run unregistered | This Epic **is** the registration hook; until it ships, nothing registers a command automatically | Registering by hand through the server for each command that builds this Epic is possible after `EPIC-043` and is *not* the automatic path this Epic delivers; the honest row is *the `M2` transcript is the first automatically registered run* |
| A fifth backend module (`governance/`) | Two owner surfaces (screen, connector read) over three records with their own lifecycle | Folding into `connector/` makes a human screen import connector code; into `projects/` makes provisioning own a render pipeline; rejected |
| Hook sequences verified by a harness, not by running the prompts | Prompts execute only inside an agent; a test runner cannot host one | Claiming a prompt "was run" because its text was read would be evidence Constitution XI forbids; the harness executes the same calls and the transcript says so |

## Related Documents

- `specs/041-local-project-workspace/` — provisioning, the bundle's installation half, the
  hand-off skill, `.mcp.json`, the credential
- `specs/043-pmi-integration-contract/` — the server, the reads, the reserved tools, the
  workstation record, the tool-surface contract this Epic amends
- `specs/037-governed-execution-registry/contracts/execution-contract.md` — registration,
  completion, comments, the sync batch
- `specs/019-steering-engine/` — steering resolution the Steering section renders
- `adr/ADR-0030` (amended by this plan) · `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` §5
