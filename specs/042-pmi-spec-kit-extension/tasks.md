# Tasks: PMI Spec Kit Extension, Setup Skill and Constitution Sync

**Epic**: `EPIC-042` · **Module**: Workspace Bundle (M-13 Connector) + Governance (M-05) · **Branch**:
`epic/042-pmi-spec-kit-extension` · **Generated**: 2026-09-04

**Inputs**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/extension-and-hooks.md](./contracts/extension-and-hooks.md) ·
[contracts/governance-api.md](./contracts/governance-api.md) ·
[contracts/setup-skill.md](./contracts/setup-skill.md) · [quickstart.md](./quickstart.md)

**Task ID range**: `T1471`–`T1541`, **71 tasks** (`T1541` appended by the analysis remediation).

> **On the identifiers.** `G-26-15` requires task identifiers to be unique **across the corpus**.
> The corpus maximum before this Epic is `T1470` (`EPIC-043` Phase 9), so allocation starts at
> `T1471`, contiguous, with no suffix letters (`R-026-9`). The closure phase is pre-allocated
> (`T1532`–`T1540`), as `EPIC-041`'s analysis finding `I3` established.

**Delivery posture**: ▶ **PROCEEDING** — third Epic of the local-first replan (`D-47`), milestone
`M2`. Depends on `EPIC-041` and `EPIC-043` (both complete on their branches; this branch is cut
from `EPIC-043`'s). `EPIC-037`'s provisional intake is **reserved** and stays so; this Epic
produces provisional records and does not accept them (Assumption 1, confirmed).

**Session label**: `EPIC-042 PMI Spec Kit Extension` (Constitution VIII).

**Test statement** (Constitution V): every implementation task names the failing-first test task
that precedes it. This Epic's largest outputs are **documents machines read** — the manifest, the
three command prompts, the hook fragment, the setup skill, the invariant constitution text — and
each pairs with an **executable conformance check** in `packages/workspace-bundle/tests/` or
`backend/tests/contract/`. Four checks are **mutation-tested** at closure (`SC-EXT-001`,
`SC-EXT-004`, `SC-EXT-005`, `SC-EXT-009`) and one is **inverted** (`FR-EXT-003`). Whether a
conformance check blocks CI: **blocks**, for every check in this Epic.

**Feature map** (`F-042.n`, Constitution III): F-042.1 Setup — the bundle test project, the
schema, the scopes, the invariant text (Phase 1) · F-042.2 Foundational — constraints, policy,
render, drift classification, the two live tools (Phase 2) · F-042.3 Every command governed (US1)
· F-042.4 First-run decomposition (US2) · F-042.5 The constitution is what I wrote (US3) ·
F-042.6 The setup skill (US4) · F-042.7 Provisional operation (US5) · F-042.8 Polish · F-042.Z
Closure.

---

## Phase 1: Setup — F-042.1

**Purpose**: the bundle becomes a tested project at `0.2.0`; the schema, the scopes and the
invariant text exist so every story can build on them.

- [X] T1471 [P] Write the failing governance conformance check `tests/governance/workspace-bundle-project.spec.ts` — `vitest.workspace.ts` and the root `package.json` `test:unit` list a `workspace-bundle` project rooted at `packages/workspace-bundle/tests/`; `tests/governance/vitest-projects.spec.ts` maps it; `packages/workspace-bundle/package.json` has `version` `0.2.0` and a `test` script
- [X] T1472 Add the `workspace-bundle` project to `vitest.workspace.ts` and `package.json`, bump `packages/workspace-bundle/package.json` and `BUNDLE_VERSION` in `packages/workspace-bundle/src/index.ts` to `0.2.0`, and add the `yaml` dev dependency at the package for the tests (conformance: `tests/governance/workspace-bundle-project.spec.ts` T1471)
- [X] T1473 [P] Write the failing integration test `backend/tests/integration/governance-schema.spec.ts` (Testcontainers) — tables `project_constraints`, `decomposition_policies` (unique `projectId`, defaults `true`/`50`/`true`/`strict`/`1`), `constitution_renders` (unique `(projectId, digest)`); columns `workstation_connections.constitutionDigest`, `constitutionState`, `constitutionReportedAt`; `provisioning_records.firstRunMarkerWritten`; the enums; every index of `data-model.md` §1–§5
- [X] T1474 Add `ProjectConstraint`, `DecompositionPolicy`, `ConstitutionRender`, the three `WorkstationConnection` columns and the `ProvisioningRecord` column to `backend/prisma/schema.prisma`; write `backend/prisma/migrations/20260904150000_epic042_extension_constitution/migration.sql` (additive) (integration test: T1473)
- [X] T1475 [P] Extend `backend/tests/unit/connector/connector-scopes.spec.ts` and `backend/tests/architecture/connector-boundary.spec.ts` with failing expectations — `registeredConnectorScopes()` is **exactly** the thirteen scopes: the eleven of `EPIC-043` plus `constitution.read` and `decomposition.read`
- [X] T1476 Register `constitution.read` and `decomposition.read` in `backend/src/modules/connector/connector-scope.ts` (unit test: T1475)
- [X] T1477 [P] Write failing tests `packages/workspace-bundle/tests/constitution-text.spec.ts` — `governedExecutionSection('strict')` and `('provisional')` return the invariant text of `contracts/governance-api.md` §5 preceded by the `Offline mode: <mode>` line, byte-identical to `packages/workspace-bundle/constitution/governed-execution.md`; `constitutionHeader({ projectId, version, digest })` renders `contracts/governance-api.md` §4's header; `backend/tests/architecture/engine-independence.spec.ts` still passes with the text outside `backend/src`
- [X] T1478 Create `packages/workspace-bundle/constitution/governed-execution.md` and `packages/workspace-bundle/constitution/header.md`, and export `governedExecutionSection()` and `constitutionHeader()` from `packages/workspace-bundle/src/index.ts` (unit test: T1477) — `R-042-4`

**Checkpoint**: the bundle is tested at `0.2.0`; the schema, scopes and invariant text exist.

---

## Phase 2: Foundational — F-042.2 (blocking — constraints, policy, render, drift, the two live tools)

**Purpose**: everything every story rests on. The hooks refresh a constitution that must exist;
the setup skill reports a digest that must be classified; the first run reads a plan that must
be served; the screen edits records that must be stored.

- [X] T1479 [P] Write failing unit tests `backend/tests/unit/governance/project-constraint.service.spec.ts` — create (kind, title, body, order default = max + 1), edit (version + 1), reorder, retire (status only, never delete), list filtered by kind and status; `title` 1–120, `body` ≤ 20 000, kind outside the three → `policy_invalid`; an in-memory store
- [X] T1480 Implement `backend/src/modules/governance/project-constraint.service.ts` and `backend/src/modules/governance/project-constraint.store.ts` (interface, in-memory, Prisma) (unit test: T1479)
- [X] T1481 [P] Write failing unit tests `backend/tests/unit/governance/decomposition-policy.service.spec.ts` — `get` creates the defaults on first read; `put` validates ranges (`taskCeiling` 1–500, `offlineMode` in the two values) and increments `version`; one row per project
- [X] T1482 Implement `backend/src/modules/governance/decomposition-policy.service.ts` and `backend/src/modules/governance/decomposition-policy.store.ts` (interface, in-memory, Prisma) (unit test: T1481)
- [X] T1483 [P] Write failing unit tests `backend/tests/unit/governance/constitution-render.service.spec.ts` — the render has exactly the section order of `contracts/governance-api.md` §4 with `\n` endings and a trailing newline; an empty section keeps its heading and `_None recorded._`; retired entries are absent; the Steering section lists resolved documents broadest-first; the digest is SHA-256 with the header's digest field zeroed; a re-render with unchanged inputs inserts **no** new row; `classify(onDiskDigest)` returns `current | stale | drift | missing` per `data-model.md` §3; a constraint titled *Governed Execution* renders under its kind and the invariant section is untouched
- [X] T1484 Implement `backend/src/modules/governance/constitution-render.service.ts` and `backend/src/modules/governance/constitution-render.store.ts` (interface, in-memory, Prisma), using `governedExecutionSection()` and `constitutionHeader()` from `@pmi/workspace-bundle` and `resolveSteering` from `backend/src/modules/steering/steering-resolver.ts` (unit test: T1483) — `R-042-4`, `R-042-5`
- [X] T1485 [P] Write failing unit tests `backend/tests/unit/governance/decomposition-plan.service.spec.ts` — the plan of `data-model.md` §9 from `ProjectContextService` groups plus the policy; `firstRun` is true only when no completed `specify` execution exists for the project; `epicSource` passed through; nothing from another project
- [X] T1486 Implement `backend/src/modules/governance/decomposition-plan.service.ts` (unit test: T1485) — `R-042-7`, `R-042-8`
- [X] T1487 [P] Write the failing contract test `backend/tests/contract/governance-api.spec.ts` against the composed `AppModule` — the session routes of `contracts/governance-api.md` §1 with member and owner grants (`owner_grant_required` for a writer), validation refusals, `GET …/constitution` renders when no render matches; the connector routes of §2 behind `ConnectorAuthGuard` with `me`, the `state` classification from `onDiskDigest`, `pmi.health` accepting `constitutionDigest` and returning `constitutionState`; every write audited (`FR-EXT-063`)
- [X] T1488 Implement `backend/src/modules/governance/governance.controller.ts` (session), `backend/src/modules/governance/governance-connector.controller.ts` (`@UseGuards(ConnectorAuthGuard)`, `@ConnectorScope('constitution.read')` / `('decomposition.read')`), `backend/src/modules/governance/governance.module.ts`, and register it in `backend/src/app.module.ts` (conformance: `backend/tests/contract/governance-api.spec.ts` T1487)
- [X] T1489 Extend `backend/src/modules/connector/connector-reads.controller.ts`, `backend/src/modules/connector/workstation-connection.service.ts` and `backend/src/modules/connector/workstation-connection.store.ts` so `POST …/health` takes `constitutionDigest`, classifies it through `ConstitutionRenderService.classify` and stores the three columns; extend `GET /v1/projects/:id/workstation-connections` rows with them (conformance: `backend/tests/contract/governance-api.spec.ts` T1487; unit test: T1483)
- [X] T1490 [P] Extend `packages/mcp-server/tests/server.spec.ts` and `backend/tests/contract/mcp-tool-surface.spec.ts` with failing expectations — `tools/list` still names fourteen tools; `pmi.constitution.get` (`onDiskDigest?`) and `pmi.project.decompose` are **live** and translate to `GET /v1/projects/me/constitution` and `/decomposition`; `pmi.health` accepts `constitutionDigest`; `pmi.execution.sync`, `pmi.artifacts.sync`, `pmi.tasks.sync` still refuse `not_available_until` by name
- [X] T1491 Move the two tools from `packages/mcp-server/src/tools/reserved.ts` to `packages/mcp-server/src/tools/reads.ts`, add `constitutionDigest` to `pmi.health`'s input, and amend `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md` §2–§3 (unit test: T1490; conformance: `backend/tests/contract/mcp-tool-surface.spec.ts`) — `R-042-11`, `FR-EXT-060`–`062`
- [X] T1492 [P] Write the failing integration test `backend/tests/integration/connector-reads.spec.ts` (extend) — another project's credential gets nothing from `…/constitution` and `…/decomposition`; a revoked credential is refused; both reads write an audit entry naming the connector principal (`FR-EXT-064`, `FR-EXT-063`)
- [X] T1493 Wire the cross-project check and the audit calls in `backend/src/modules/governance/governance-connector.controller.ts` (integration test: T1492)

**Checkpoint**: a credential can read the rendered constitution and the decomposition plan through
the server; an owner can author constraints and a policy through the API; a health call
classifies an on-disk digest.

---

## Phase 3: User Story 1 — Every command I run is governed without my doing anything (P1) 🎯 MVP — F-042.3

**Goal**: the `pmi` extension content — manifest, `begin`, `finish`, `progress`, the registry
fragment — installed by provisioning and verified against the surface, with stock skills proved
untouched.

**Independent test**: Scenario 3 of the quickstart — a `plan` round trip through the server lands
on the timeline with input and output digests; Scenario 2 — ten stock digests unchanged after
installation.

- [X] T1494 [P] [US1] Write the failing test `packages/workspace-bundle/tests/extension-conformance.spec.ts` — `extension/extension.yml` parses and matches `contracts/extension-and-hooks.md` §1 (id `pmi`, version = `BUNDLE_VERSION`, `requires.speckit_version`, three commands with existing files, eighteen hooks each `optional: false` naming a provided command); every `pmi.*` tool name and every argument name in `commands/*.md` exists in `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md` (parsed); no engine or provider name; no request for a credential value; every `PMI ·` line matches the §3 vocabulary; `extensions-fragment.yml` lists every hook with `extension: pmi`, `enabled: true`, `optional: false`, no `condition`
- [X] T1495 [US1] Write `packages/workspace-bundle/extension/extension.yml` (content), `packages/workspace-bundle/extension/extensions-fragment.yml`, `packages/workspace-bundle/extension/commands/begin.md` (§4 sequence, without the first-run loop and the provisional path, which `T1506` and `T1523` add), `packages/workspace-bundle/extension/commands/finish.md` (§5) and `packages/workspace-bundle/extension/commands/progress.md` (§6) (conformance: `packages/workspace-bundle/tests/extension-conformance.spec.ts` T1494) — `R-042-1`, `R-042-3`
- [X] T1496 [P] [US1] Write failing tests `packages/workspace-bundle/tests/hook-fragment-merge.spec.ts` — `mergeExtensionsRegistry(existingYaml, fragment)` adds `pmi` to `installed` once, appends each hook entry only when no `{ extension: pmi, command }` entry exists for that event, leaves every other extension's entries byte-identical, is idempotent, and creates the file shape when the input is empty
- [X] T1497 [US1] Implement `mergeExtensionsRegistry()` and `extensionsFragment()` in `packages/workspace-bundle/src/index.ts` as string-level operations (no YAML dependency at runtime) (unit test: T1496)
- [X] T1498 [P] [US1] Write the failing test `packages/workspace-bundle/tests/stock-skills-immutable.spec.ts` — in a temp directory: `specify init --here --integration claude --script sh` at the pinned tag (skipped with a named reason when `uv` is absent on the host — never silently), copy the extension, merge the fragment, then assert the ten stock skill digests equal `.specify/integrations/claude.manifest.json`; record the observed digests in the test output (`SC-EXT-001`)
- [X] T1499 [US1] Make the worker's initialise step in `backend/src/modules/projects/provisioning.service.ts` copy the extension **content** (`extension.yml`, `commands/`) and merge `extensions-fragment.yml` into the project's `extensions.yml` registry through `mergeExtensionsRegistry()`, recording the files on the provisioning record (conformance: `packages/workspace-bundle/tests/stock-skills-immutable.spec.ts` T1498; unit test: T1496)
- [X] T1500 [P] [US1] Write the failing integration test `backend/tests/integration/governed-command-roundtrip.spec.ts` — through a real `pmi-studio` server over `InMemoryTransport` against the composed `AppModule`: the exact call sequence of `contracts/extension-and-hooks.md` §4 steps 2–3, 8 and §5 steps 4–5 for a `plan` command; the timeline shows one execution with `command: plan`, surface `mcp-client`, the input digests, a completion with `generatedArtifactDigests` and a comment; `not_available_until` from `artifacts.sync` does not prevent completion (`FR-EXT-016`); an execution left non-terminal is found by the next sequence's step 6 and completed as `failed` (`FR-EXT-018`)
- [X] T1501 [US1] Build the reusable **sequence harness** `packages/workspace-bundle/src/hook-sequences.ts` — `runBegin(client, dir, opts)`, `runFinish(client, dir, opts)`, `runProgress(…)` executing the documented sequences with the same tool calls and arguments the prompts instruct, used by `T1500` and by the `M2` transcript (integration test: T1500) — `R-042-12`
- [X] T1502 [P] [US1] Extend `backend/tests/integration/governed-command-roundtrip.spec.ts` with a failing left-open block — a `begin` after an interrupted command: the directory's `.pmi/last-execution` names a non-terminal execution → the sequence's step 6 completes it as `failed` with the comment `left open by an interrupted command` before registering; a terminal one is not touched (analysis `I2`)
- [X] T1503 [US1] Implement the left-open check in `packages/workspace-bundle/extension/commands/begin.md` step 6 and in `packages/workspace-bundle/src/hook-sequences.ts` (`.pmi/last-execution`) (integration test: T1502)

**Checkpoint**: a provisioned directory carries hooks that register and complete every governed
command; the stock skills are proved untouched; the sequences run against the composed
application.

---

## Phase 4: User Story 2 — My first specify produces one specification per Epic (P1) — F-042.4

**Goal**: the first-run loop in `begin.md`, the marker, the decision comment.

**Independent test**: Scenario 11 — three Epics, one above the ceiling, one confirmed split →
four `specify` executions, four directories, one `decomposition-decision` comment, marker gone.

- [X] T1504 [P] [US2] Write failing unit tests `backend/tests/unit/projects/project-files.spec.ts` (extend) — `writeFirstRunMarker(dir, { at, provisioningRecordId })` writes `.pmi/first-run` with one line; provisioning writes it after `.pmi/project.json` and records `firstRunMarkerWritten`
- [X] T1505 [US2] Implement `writeFirstRunMarker()` in `backend/src/modules/projects/project-files.ts` and call it from `backend/src/modules/projects/provisioning.service.ts` (unit test: T1504) — `R-042-8`
- [X] T1506 [US2] Extend `packages/workspace-bundle/extension/commands/begin.md` with §7 — the first-run loop: decompose read, the estimate request, the plan print, the split proposal and wait, the per-Epic register → stock flow → finish, the `decomposition-decision` comment, the marker removal, the summary line; and the stale-marker rule of `R-042-8` (conformance: `packages/workspace-bundle/tests/extension-conformance.spec.ts` T1494, extended with the loop's tool names and the comment body schema of `data-model.md` §8)
- [X] T1507 [P] [US2] Write the failing integration test `backend/tests/integration/decomposition-read.spec.ts` — `GET …/decomposition` for a project with three Epics (two under, one over a ceiling of 50 by requirement count as the test's stand-in estimate) returns the plan with `firstRun: true`; after one completed `specify` execution, `firstRun: false`; a project with no Epic and no baselined requirement returns empty `epics` and `unassigned` (`FR-EXT-048`)
- [X] T1508 [US2] Wire `DecompositionPlanService` to the execution timeline read for `firstRun` in `backend/src/modules/governance/governance.module.ts` (integration test: T1507)
- [X] T1509 [P] [US2] Extend `packages/workspace-bundle/src/hook-sequences.ts` tests in `backend/tests/integration/governed-command-roundtrip.spec.ts` with a failing first-run block — `runFirstRun(client, dir, { estimates, decisions })` performs §7 against the composed application: four registrations, four completions, one comment of type `decomposition-decision` whose body validates against `data-model.md` §8, the marker deleted
- [X] T1510 [US2] Implement `runFirstRun()` in `packages/workspace-bundle/src/hook-sequences.ts` (integration test: T1509)
- [X] T1511 [P] [US2] Write failing unit tests `packages/workspace-bundle/tests/first-run.spec.ts` (the decision-schema block) — the JSON schema for the comment body (`policyVersion`, `epic`, `estimate`, `ceiling`, `decision`, `children[]`, `decidedBy`); `rejected` has no children; child suffixes are `a`, `b`, … and unique
- [X] T1512 [US2] Export `decompositionDecisionSchema` (zod) from `packages/workspace-bundle/src/index.ts` and reference it from `begin.md` (unit test: T1511)

**Checkpoint**: the first run is a plan, a confirmation and a loop; the decision is on the
platform as a comment `EPIC-044` can read.

---

## Phase 5: User Story 3 — The constitution is what I wrote in PMI Studio (P1) — F-042.5

**Goal**: the Governance area with the Constraints screen; drift shown; refresh by the hook and
by provisioning.

**Independent test**: Scenarios 6, 7 and 8 — entries and policy on the screen → preview and
digest; `pmi.constitution.get` equals the preview; a hand edit reports drift and the screens say
*file differs*.

- [X] T1513 [P] [US3] Write failing frontend tests `frontend/tests/unit/pages/constraints.spec.tsx` — the Governance area is navigable; the Constraints page has a project selector, three filtered tables (principles, constraints, non-goals) with add, edit, reorder and retire, the policy form (four fields), a read-only preview with version and digest, the Governed Execution section marked *owned by PMI Studio*; four states; *file differs* appears when any connection's `constitutionState` is `drift`; a writer without the owner grant sees the forms disabled with the reason
- [X] T1514 [US3] Implement `frontend/src/pages/Constraints.tsx`, `GovernanceArea` in `frontend/src/shell/area-views.tsx`, flip `governance` to `delivered` in `frontend/src/shell/areas.ts`, and add `listConstraints`, `createConstraint`, `updateConstraint`, `reorderConstraint`, `retireConstraint`, `getPolicy`, `putPolicy`, `getConstitution` to `frontend/src/services/api.ts` (unit test: T1513) — `R-042-10`
- [X] T1515 [P] [US3] Extend `frontend/tests/unit/pages/project-executions.spec.tsx` with failing expectations — the Local workspace panel's connection rows show the constitution state and *file differs* with the last matched render version (`FR-EXT-067`)
- [X] T1516 [US3] Extend the connection rows in `frontend/src/pages/Projects.tsx` (unit test: T1515)
- [X] T1517 [P] [US3] Write the failing integration test `backend/tests/integration/constitution-render.spec.ts` — two principles, a constraint, a non-goal and a policy through the session routes → `GET …/constitution` content in §4 order with the invariant section byte-equal to `packages/workspace-bundle/constitution/governed-execution.md`; every edit changes the digest; a re-read with no change inserts no render; the Steering section carries the project's resolved steering documents (`SC-EXT-004`, `SC-EXT-009`)
- [X] T1518 [US3] Wire `ConstitutionRenderService` to `SteeringService` and the project scope in `backend/src/modules/governance/governance.module.ts` (integration test: T1517)
- [X] T1519 [P] [US3] Write the failing integration test `backend/tests/integration/constitution-drift.spec.ts` — `pmi.health` with the current digest → `current`; with an earlier render's digest → `stale`; with an unknown digest → `drift`; with `null` → `missing`; the connection row carries the state and time; a later `current` report clears it; `pmi.constitution.get` with `onDiskDigest` classifies the same way
- [X] T1520 [US3] Complete the drift path in `backend/src/modules/connector/connector-reads.controller.ts` and `backend/src/modules/governance/governance-connector.controller.ts` (integration test: T1519) — `R-042-5`
- [X] T1521 [P] [US3] Extend `backend/tests/unit/projects/provisioning.service.spec.ts` with failing expectations — provisioning writes `.specify/memory/constitution.md` from the current render (rendering one when none exists) after initialisation, and records it on the provisioning record (`FR-EXT-028`)
- [X] T1522 [US3] Have `backend/src/modules/projects/provisioning.service.ts` write the render through a `ConstitutionRenderPort` (unit test: T1521)

**Checkpoint**: an owner authors the constitution in PMI Studio; the file on every workstation is
a render whose state PMI Studio can name.

---

## Phase 6: User Story 4 — `/setup-PMIStudio` leaves me green or tells me exactly what to do (P1) — F-042.6

**Goal**: the full ten-step skill replacing the hand-off in place.

**Independent test**: Scenarios 9 and 10 — the table on a red machine and on a green one; the
workstation panel shows the connection.

- [X] T1523 [P] [US4] Write the failing test `packages/workspace-bundle/tests/setup-skill.spec.ts` — `skills/setup-PMIStudio/SKILL.md` frontmatter (`setup-PMIStudio`, user-invocable, `bundle-version: 0.2.0`); the ten checks of `contracts/setup-skill.md` §2 in order; every install command preceded by *show*; no request for a credential value and no `pmi_ct_`/`sk-` shape; only the three `.mcp.json` servers of §3 with `${VAR}` references; the six table states; installs only the toolkit, the extension and configuration; row 5 reads `requires.speckit_version` from `extension.yml` and confirms the pinned tag satisfies it, reporting `refused` naming both when it does not (`FR-EXT-004`, analysis `U1`) (`SC-EXT-005`)
- [X] T1524 [US4] Replace `packages/workspace-bundle/skills/setup-PMIStudio/SKILL.md` in place with the full skill (conformance: `packages/workspace-bundle/tests/setup-skill.spec.ts` T1523) — `R-042-9`
- [X] T1525 [P] [US4] Extend `packages/workspace-bundle/tests/bundle.spec.ts` with failing expectations — the skills half carries the full skill (ten checks), the extension half carries three commands and eighteen hooks, `BUNDLE_VERSION` is `0.2.0`
- [X] T1526 [US4] Update the bundle's `README`-style header comments in `packages/workspace-bundle/src/index.ts` and `packages/workspace-bundle/extension/extension.yml` to state that the content ships (unit test: T1525)
- [X] T1527 [P] [US4] Write failing unit tests `backend/tests/unit/connector/workstation-connection.spec.ts` (extend) — `pmi.health` from the setup skill records `extensionVersion`, `toolkitVersion` and the constitution state; a second call updates the same row
- [X] T1528 [US4] Confirm the store update path in `backend/src/modules/connector/workstation-connection.service.ts` (unit test: T1527)

**Checkpoint**: a developer runs one command and ends green or with exact instructions; PMI Studio
sees the workstation.

---

## Phase 7: User Story 5 — When PMI Studio is unreachable, I know exactly where I stand (P2) — F-042.7

**Goal**: strict refusal by default; provisional records where policy permits; the queue
submitted on reconnect.

**Independent test**: Scenarios 4 and 5.

- [X] T1529 [P] [US5] Write failing tests `packages/workspace-bundle/tests/provisional-record.spec.ts` — a record per `contracts/extension-and-hooks.md` §8 validates against the sync batch item schema in `packages/execution-registry-contract`; `governed` is `false`; the first event is `execution-sync-queued`; `readOfflineMode(constitutionText)` returns `strict` when the line is absent, malformed or says so, `provisional` only on the exact line
- [X] T1530 [US5] Export `provisionalRecordSchema` and `readOfflineMode()` from `packages/workspace-bundle/src/index.ts`, and extend `packages/workspace-bundle/extension/commands/begin.md` step 3 (strict refusal, provisional path step 9) and `commands/finish.md` step 5 (append locally, *(not governed)*), and step 5 of `begin.md` (queue submission, one line per outcome) (unit test: T1529; conformance: `packages/workspace-bundle/tests/extension-conformance.spec.ts` T1494) — `R-042-6`, `FR-EXT-050`–`056`
- [X] T1531 [US5] Extend `packages/workspace-bundle/src/hook-sequences.ts` and `backend/tests/integration/governed-command-roundtrip.spec.ts` with a failing strict/provisional block — with an unreachable platform URL and `strict`: no record written, the harness reports the refusal naming the address and the mode; with `provisional`: the file exists before the command runs, the completion is appended, and on reconnect the queue is submitted to `pmi.execution.sync` whose `not_available_until` keeps the file and is reported once (`SC-EXT-006`, `SC-EXT-007`) — then implement `runBeginOffline()` in the harness (integration test: T1500)

**Checkpoint**: offline behaviour is a policy the owner set, and every line about a provisional
execution says *not governed*.

---

## Phase 8: Polish & Cross-Cutting — F-042.8

- [X] T1532 Update `README.md` §Setup and `docs/operator-setup.md` — the extension's hooks, `/setup-PMIStudio`, the Constraints screen, the generated constitution and drift, offline mode, the first run (conformance: `tests/governance/readme-conformance.spec.ts`)
- [X] T1533 Write the failing Tier 2 harness `e2e/tests/epic-042-m2.spec.ts` — Playwright enters constraints, the policy and three Epics' requirements and provisions a project; the sequence harness (`packages/workspace-bundle/src/hook-sequences.ts`) runs a first run through a real `pmi-studio` server over stdio with one confirmed split, then a strict-mode refusal and a provisional record; Playwright asserts four `specify` executions on the timeline, the constitution file's digest equals the preview's, and the decision comment exists; writes the transcript record under `docs/uat/` (`EPIC-042-m2-transcript.md`, produced by the `T1537` run) naming the stack and stating that prompts were verified by conformance and sequences by this run (`R-042-12`, `SC-EXT-003`, `SC-EXT-008`)
- [X] T1534 Fill `specs/042-pmi-spec-kit-extension/quickstart.md` §Results with the render timing, the hook call counts and the transcript path

---

## Phase Z: Epic Closure (MANDATORY — Constitution IV, VI, VII, IX, XI, XII) — F-042.Z

- [X] T1535 Confirm every implementation task in `specs/042-pmi-spec-kit-extension/tasks.md` has a passing unit test or conformance check, by running `pnpm test:unit && pnpm test:contract && pnpm test:integration && pnpm test:arch` and recording the counts in `specs/042-pmi-spec-kit-extension/closure.md`
- [X] T1536 **Constitution XI Tier 1 (ALWAYS)** — `T1487`, `T1500`, `T1517` and `T1519` drive the governance routes, the hook sequences through a real server, the render and the drift path against the composed `AppModule` in `backend/src/app.module.ts` (integration tests: T1487, T1500, T1517, T1519); prove by inversion — remove `GovernanceModule` from `backend/src/app.module.ts` and observe `T1487` fail — and record the observation in `specs/042-pmi-spec-kit-extension/closure.md`
- [ ] T1537 **Constitution XI Tier 2** — run `e2e/tests/epic-042-m2.spec.ts` against the reference-local stack and commit `docs/uat/EPIC-042-m2-transcript.md`, run-generated, naming the stack; add a second section when a person runs the real agent against the same stack, which MUST include two consecutive `/setup-PMIStudio` runs with both tables and a clean `git status` after the second (`SC-EXT-010`, analysis `C1`) (integration test: T1533)
- [X] T1538 **Four mutation observations and one inversion recorded** in `specs/042-pmi-spec-kit-extension/closure.md`: `T1498` fails when the install appends a line to a stock skill (`SC-EXT-001`); `T1519` fails when `classify` returns `current` for every digest (`SC-EXT-004`); `T1523` fails when the skill prints the variable (`SC-EXT-005`); `T1517` fails when the render takes the Governed Execution text from a constraint entry (`SC-EXT-009`); `T1494` fails when a hook names `speckit.pmi.commit` (`FR-EXT-003`) — each restored and re-run green (unit tests: T1494, T1498, T1523; integration tests: T1517, T1519)
- [X] T1539 **Constitution XII** — record in `specs/042-pmi-spec-kit-extension/closure.md` that the commands producing this Epic ran **unregistered by hook** (the hook is this Epic's output) and that the `M2` transcript's executions are the **first automatically registered governed commands**; from the next Epic on, every governed command in a provisioned directory is registered by `speckit.pmi.begin`
- [ ] T1540 Run `/speckit-converge`; append any remaining work to `specs/042-pmi-spec-kit-extension/tasks.md`; triage `specs/042-pmi-spec-kit-extension/defects/` leaving no open record; regenerate `governance/epic-stage-register.md` with `pnpm register:update`; re-run `pnpm lint && pnpm -r typecheck && pnpm test && pnpm test:arch && pnpm test:governance`; then promote `local → dev` (no environment skipped) — **needs explicit authorisation naming the environment** — and publish `specs/042-pmi-spec-kit-extension/closure.md`: work completed, work deferred, and the recommended next task named as a concrete Spec Kit command (`/speckit-specify` for `EPIC-044`)
- [X] T1541 **ADRs and records** — confirm `adr/ADR-0030-local-first-execution-and-integration-contract.md` carries its 2026-09-04 `EPIC-042` amendment (`FR-EXT-070`) and `.specify/memory/constitution.md` reads version `1.6.1` with the Directory-contract sentence on generated constitutions (`FR-EXT-071`), and record both in `specs/042-pmi-spec-kit-extension/closure.md` (analysis `C2`)

> `T1541` was appended on 2026-09-04 by the `/speckit-analyze` remediation (finding `C2`); identifiers are never renumbered, so it sits after `T1540`.

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → Phase 3**: strict. The invariant text and the schema (Phase 1) are what
  the render and the reads need; the reads and the health classification (Phase 2) are what the
  hooks call.
- **Phase 3 (US1)** is the MVP: the extension content and the sequence harness. **Phase 4 (US2)**
  extends `begin.md` and the harness (`T1495` → `T1506`, `T1501` → `T1510`); **Phase 5 (US3)**
  needs Phase 2's services and can run in parallel with Phase 4; **Phase 6 (US4)** needs the
  health extension (`T1489`) and can run in parallel with Phases 4–5; **Phase 7 (US5)** extends
  `begin.md` and `finish.md` last (`T1506` → `T1530`), because both files change.
- Within a phase, every `[P]` test task may run before or alongside its neighbours; each
  implementation task waits for its named test and for the file-sharing task before it
  (`T1495` → `T1506` → `T1530`; `T1501` → `T1510` → `T1531`; `T1488` → `T1493` → `T1520`).

### Cross-Epic dependencies

| This Epic needs | From | State |
|---|---|---|
| provisioning, the bundle's installation half, `.mcp.json`, the credential | `EPIC-041` | delivered |
| the server, the reads, `pmi.health`, the workstation record, the reserved tools, the extensible scope registry | `EPIC-043` | delivered on `epic/043-pmi-integration-contract`, this branch's base |
| `resolveSteering` | `EPIC-019` | delivered |
| the sync batch shape; the provisional intake | `EPIC-037` | shape delivered; intake **reserved** (`FR-PIC-034`) — records queue until it ships |
| Epic as a product entity for child Epics | `EPIC-044` | later — the decision comment is what it consumes |

### Parallel Example: Phase 2

```text
T1479 · T1481 · T1483 · T1485 · T1487 · T1490 · T1492   (seven failing tests, different files)
then T1480 → T1482 → T1484 → T1486 → T1488 → T1489 → T1491 → T1493
```

### Parallel Example: Phase 3

```text
T1494 · T1496 · T1498 · T1500 · T1502   (five failing tests)
then T1495 → T1497 → T1499 → T1501 → T1503
```

## Implementation Strategy

1. **Phases 1–2 first** and commit: after them the two reserved tools are live, an owner can
   author a constitution through the API, and a health call classifies a digest.
2. **US1 next** — the extension content and the sequence harness — and stop to demonstrate
   Scenario 3 through a real server. That is the automatic registration `M2` rests on.
3. **US2, US3, US4** in that order; each is independently demonstrable and each is mostly
   markdown.
4. **US5** last among the stories, because it edits the two command files a third time.
5. **Polish and closure**: the transcript is the last thing written, because it is the only thing
   here that a person, not a test, will read first.

## Phase 9: Convergence

*Appended by `/speckit-converge` on 2026-09-05 (Constitution IV). Findings F1–F6 of that session; the Tier 2 transcript (`SC-EXT-008`) is already the open `T1537` and promotion the open `T1540`, neither duplicated.*

- [ ] T1542 [P] Extend `frontend/tests/unit/pages/constraints.spec.tsx` and `frontend/tests/unit/pages/project-executions.spec.tsx` with failing expectations — a connection whose `constitutionState` is `stale` shows *file differs* naming the render version its digest last matched (`matches render v2`), and a `drift` row says *no render* — then have `GET /v1/projects/{id}/workstation-connections` in `backend/src/modules/connector/connector-reads.controller.ts` resolve `constitutionRenderVersion` through the render store's `findByDigest` (contract test extended in `backend/tests/contract/governance-api.spec.ts`), add the field to `WorkstationConnection` in `frontend/src/services/api.ts`, and print it in `frontend/src/pages/Constraints.tsx` and `frontend/src/pages/Projects.tsx` (unit test: T1542) per FR-EXT-067 and `contracts/governance-api.md` §3 (partial) — **HIGH**
- [ ] T1543 [P] Extend `packages/workspace-bundle/tests/provisional-record.spec.ts` with a failing test — `runBegin` in provisional mode against a `.pmi` directory that cannot be written (a file where the `provisional` directory should be) writes nothing, prints `PMI · refused platform_unreachable: … provisional record could not be written at <path>` and reports `refused` — then implement the refusal in `packages/workspace-bundle/src/hook-sequences.ts` and add it to step 9 of `packages/workspace-bundle/extension/commands/begin.md` (conformance: `packages/workspace-bundle/tests/extension-conformance.spec.ts` T1543) per FR-EXT-050 and the edge case *provisional mode is permitted but the disk is not writable* (partial) — **MEDIUM**
- [ ] T1544 [P] Extend `backend/tests/integration/governed-command-roundtrip.spec.ts` with a failing first-run block — with a registered, non-terminal `specify` execution on the project, `runFirstRun` registers nothing and prints `PMI · refused first_run_in_progress: <executionId> is still open` — then implement the check in `runFirstRun` (`packages/workspace-bundle/src/hook-sequences.ts`, through `pmi.execution.history` or the `decompose` read's `openFirstRun` field added in `backend/src/modules/governance/decomposition-plan.service.ts`) and state it in *The first run* of `packages/workspace-bundle/extension/commands/begin.md` (integration test: T1544) per the edge case *two governed commands run concurrently in one directory* (partial) — **MEDIUM**
- [ ] T1545 [P] Extend `packages/workspace-bundle/tests/first-run.spec.ts` with a failing expectation — every completion the loop sends carries `completionComment` ending `(decomposition policy v<version>)` and the closing line names the policy version — then carry the plan's `policy.version` through `runFirstRun` in `packages/workspace-bundle/src/hook-sequences.ts` and step 4 and step 6 of *The first run* in `packages/workspace-bundle/extension/commands/begin.md` (unit test: T1545) per the edge case *the decomposition ceiling is changed while a first run is in progress* (partial) — **LOW**
- [ ] T1546 [P] Extend `frontend/tests/unit/pages/constraints.spec.tsx` with a failing expectation — when an active entry is titled *Governed Execution*, the preview shows a hint that the invariant section is PMI Studio's and the entry is filed under its own kind — then add the hint to `frontend/src/pages/Constraints.tsx` (unit test: T1546) per the edge case *the Governed Execution section is edited by hand in PMI Studio's own constraint entries* (partial) — **LOW**
- [ ] T1547 Record in `specs/042-pmi-spec-kit-extension/closure.md` the limitation FR-EXT-006 names — the toolkit offers no in-flight hook for `/speckit-implement`, so `speckit.pmi.progress` runs from the finish hook and the board moves late rather than never (`R-07`) — as assumption 17, with the sentence in `packages/workspace-bundle/extension/commands/progress.md` as its source (check: the closure record names `R-07`, `tests/governance/epic-stage/task-paths.spec.ts` G-26-14 on the paths it cites) per FR-EXT-006 (partial) — **LOW**
