# Implementation Plan: Artifact Sync and Markdown Viewer

**Epic**: `EPIC-045` · **Branch**: `epic/045-artifact-sync-markdown-viewer` · **Date**: 2026-09-05

**Spec**: [spec.md](./spec.md) (clarified 2026-09-05) · **Research**: [research.md](./research.md)

**SRS References**: `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` §2.2 (step 7), §2.3
(source-of-truth boundaries), §3 (`ArtifactFile`), §4.1–4.2 (`pmi.artifacts.sync`,
`POST /v1/projects/{id}/artifacts/sync`, `GET /v1/epics/{id}/artifacts`, `GET /v1/artifacts/{id}`),
§5.1 (principle 5), §5.2 (hook map), §6 (Epic detail: file tree, viewer, version picker), §7
(`EPIC-045` brief), §8 (`M3`), §9.3 (`LR-09`), §10 (one new dependency), §11 (`R-04`, `R-05`) ·
`SRS/PMI-DOC-004B` §5.2 (`O-9`) · `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md`
`BR-0003`, `BR-0035`, `BR-0141`, `RULE-10`

**Input**: Feature specification from `specs/045-artifact-sync-markdown-viewer/spec.md`

## Summary

Since `EPIC-042` the finish hook of every governed command calls `pmi.artifacts.sync` with the
Epic's files and their digests, and the platform answers *not available until `EPIC-045`*. This
Epic makes the tool live and gives the content a home and a screen: every synced file becomes an
immutable version keyed by its digest, bound to the execution and through it to the Epic; the
Epic detail shows the files as a tree and renders any version read-only with a picker naming the
execution that produced it; the synced `spec.md` becomes the Epic's specification, so the list
`EPIC-044` decorated has rows in local-first mode. The directory stays authoritative for content;
PMI Studio is its mirror and the record of which execution wrote what.

The plan is four layers:

1. **The store and the sync** (`R-045-1` to `R-045-4`, `R-045-8` to `R-045-10`): three tables
   and one column, a new `artifacts/` module whose connector route reuses `EPIC-043`'s guard, the
   Epic resolved from the execution's binding with `@pmi/epic-stage`, per-file refusal with a
   closed code vocabulary recorded on the execution, the specification created through a port,
   the tool moved from reserved to live with the hook untouched.
2. **The reads** (`R-045-7`): the tree, the content and the unbound syncs as session routes; the
   current version, *not in the latest sync* and the reported-versus-synced finding as
   projections over the manifest.
3. **The screens** (`R-045-5`, `R-045-13`): one `MarkdownViewer` in the design system — raw HTML
   escaped, no remote fetch, a hostile corpus in the repository — hosted by the Epic detail's
   Files section and by the specification detail.
4. **The evidence** (`R-045-11`, `R-045-12`): Tier 1 through the real finish sequence against the
   composed `AppModule`, with the concurrent and retried syncs written before the service exists;
   Tier 2 the `M3` second-half transcript; the dependency register and the layout records.

## Technical Context

**Language/Version**: TypeScript 5.7, Node ≥ 22 (`ADR-0003`).

**Primary Dependencies**: NestJS 10, Prisma 5.22, React 18, Vitest 2.1, Playwright (unchanged).
**Two new frontend runtime packages from one family**: `react-markdown` (the renderer) and
`remark-gfm` (tables, task lists, strikethrough) — recorded as `D-31` and `D-32` in
`specs/_shared/dependencies.md` at this step (`FR-ART-061`), versions pinned at implement time
against the current majors that support React 18; Context7 library IDs `/remarkjs/react-markdown`
(and `/rehypejs/rehype-sanitize` as the recorded fallback should raw HTML ever be admitted). No
backend dependency is added: digests are `node:crypto`, the artifact set is imported from
`@pmi/workspace-bundle`, the Epic resolution from `@pmi/epic-stage`.

**Storage**: PostgreSQL 16 via Prisma. **Three new tables** (`artifact_versions`,
`artifact_syncs`, `artifact_sync_files`), **one nullable column** (`specifications.sourcePath`).
Additive migration `<ts>_epic045_artifacts`. Content is stored as text once per digest (≤ 1 MiB
per file by configuration); no object store is introduced.

**Testing**: Vitest — `backend-unit` (validation per refusal code, Epic resolution, manifest and
projections, the specification port), `backend-contract` (`artifacts-api.md`; `mcp-tool-surface`
with one fewer reserved row), `backend-integration` (Testcontainers: the real finish sequence
through a real `pmi-studio` server; two simultaneous syncs and a retry; a changed file; reads;
the specification by sync; unbound; cross-project absence), `architecture` (`durable-stores`
gains `ARTIFACT_STORE`; `connector-boundary` fourteen scopes; `engine-independence` and
`agent-independence` unchanged), `mcp-server` (the live tool's translation), `frontend`
(`MarkdownViewer` over the hostile corpus; `EpicFiles`; the specification detail through the same
component), `governance` (layout registration), `e2e` (`M3` second half).

**Target Platform**: Linux server for the API; the browser for the viewer.

**Project Type**: web service (API + web) plus one MCP tool made live.

**Performance Goals**: the tree of an Epic with 50 files × 20 versions lists in under **2 s**; a
500 KiB file renders in under **2 s** on the reference-local stack (`SC-ART-006`); a sync of 200
files at the size limit completes within the connector's request timeout.

**Constraints**: nothing edits, overwrites or deletes a synced version (`FR-ART-001`,
`FR-ART-010`); the Epic comes from the execution's binding, never the path (`FR-ART-003`); the
hooks are unchanged (`FR-ART-046`); the backend names no toolkit or provider (provenance values
come from rows); no new comment type in the registry (`system` is used); no connector read of
artifacts (`FR-ART-043`); the sync is idempotent under concurrency before it is anything else
(`FR-ART-006`).

**Scale/Scope**: tens of Epics per project; nine to thirty files per Epic; one sync per governed
command; versions accrue at the rate of commands — hundreds per Epic over its life.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes produced only via Spec Kit commands | **PASS** — this step writes the plan artifacts and the dependency-register entries `FR-ART-061` directs; no application code |
| II | Every requirement traces to a cited `SRS/` document | **PASS** — PMI-DOC-007 is in `SRS/`; one requirement rests on the provisional `LR-09` with the `BR-` back-fill recorded under Assumptions |
| III | Epic → Feature → Task; `specs/045-artifact-sync-markdown-viewer/` exists | **PASS** |
| IV | `/speckit-converge` scheduled as the Epic exit gate | **PASS** — in the Exit Criteria |
| V | Every implementation task carries a failing-first unit test; document outputs carry a conformance check | **PASS** — planned in `/speckit-tasks`; the hostile corpus is a repository fixture with tests; five mutation observations are owed (`quickstart.md`) |
| VI | `specs/045-artifact-sync-markdown-viewer/defects/` is the sole defect intake | **PASS** — created at the specify step, in the git index |
| VII | local → dev → stage → prod, no environment skipped | **PASS** — the migration is additive; the tool's move from reserved to live is one release |
| VIII | Session labelled with the working Epic | **PASS** — branch `epic/045-artifact-sync-markdown-viewer` |
| IX | Every stop ends with an executable next action | **PASS** |
| X | Decision questions batched into one questionnaire | **PASS** — five asked at once on 2026-09-05, all recommendations accepted, no follow-up round |
| XI | Tier 1 always; Tier 2 for a journey | **PASS** — Tier 1: the sync through the real finish sequence and a real `pmi-studio` server against the composed `AppModule`, the reads through their routes, the viewer over the corpus; Tier 2: the `M3` second-half transcript on the reference-local stack (`R-045-11`) |
| XII | Governed commands registered in PMI Studio before executing | **PASS in design, PARTIAL in practice** — this Epic *consumes* completions and binds artifacts to them; the commands that build it run in this repository, which is not a PMI-managed project, so they are not registered by hook. Recorded, as `EPIC-042` and `EPIC-044` did |
| — | Repository synced from GitHub before work started | **PASS** — `origin/main` is behind local; nothing to integrate |
| — | No other Claude session active on this checkout | **PASS** |

**Post-Phase 1 re-check**: unchanged. The design raised three gate considerations and resolved
each: the sync is a write hidden inside a hook's completion path and must be idempotent under
concurrency — the unique index is the arbiter and the concurrent test is written first
(`DEF-044-003`'s lesson, `R-045-1`, `R-045-11`); the refusal must reach the timeline without a
new comment type — `system` by a `service` author (`R-045-3`); the specification entity must be
created without a generation job — a narrow port, not a synthetic job (`R-045-4`).

## Project Structure

### Documentation (this feature)

```text
specs/045-artifact-sync-markdown-viewer/
├── spec.md                          clarified 2026-09-05
├── plan.md                          ← this file
├── research.md                      R-045-1 … R-045-13
├── data-model.md                    three tables · one column · four projections · the sync step by step · audit
├── contracts/
│   ├── artifacts-api.md             the connector operation · session reads · refusal codes · what changes elsewhere · tests
│   └── viewer-contract.md           where · the tree · the header · rendering rules · states · the hostile corpus
├── quickstart.md                    12 scenarios, mutation targets
├── checklists/requirements.md
└── defects/                         Constitution VI intake
```

### Source Code (repository root)

```text
backend/src/modules/artifacts/                          NEW module (R-045-1 … R-045-4, R-045-6, R-045-7)
├── artifacts.module.ts · artifacts.tokens.ts           ARTIFACT_STORE; imports Connector, EpicStores, Executions, Specifications, Audit, Projects
├── artifact.store.ts                                   versions · syncs · manifest; Prisma (unique-violation read-back) + in-memory (same index)
├── artifact-set.ts                                     path shape, the set from @pmi/workspace-bundle ARTIFACT_FILES, kind (R-045-9)
├── artifact-validation.ts                              the seven per-file codes; UTF-8; size; credential shapes (EPIC-043's patterns) (R-045-3, R-045-10)
├── artifact-sync.service.ts                            data-model.md §6 — execution lookup, Epic resolution, store, comment, specification port, audit
├── artifact-read.service.ts                            tree · content · unbound · reported-versus-synced (R-045-7)
├── specification-sync.port.ts                          SpecificationSyncPort (interface; in-memory for tests)
├── artifacts-sync.controller.ts                        POST projects/:projectId/artifacts/sync — ConnectorAuthGuard, scope artifacts.sync
└── artifacts.controller.ts                             GET epics/:eid/artifacts · GET artifacts/:vid · GET projects/:id/artifacts/unbound

backend/src/modules/specifications/specification-sync.service.ts   NEW — implements the port: create (one transaction) + appendIfChanged (R-045-4)
backend/src/modules/specifications/specifications.module.ts        exports the implementation
backend/src/modules/connector/connector-scope.ts                    + artifacts.sync
backend/src/modules/executions/…                                    unchanged — read by one query; comment added through ExecutionCommentService
backend/prisma/schema.prisma · migrations/<ts>_epic045_artifacts/migration.sql
backend/src/app.module.ts                                           + ArtifactsModule (after EpicsModule)
backend/.env.example · README.md §Setup · docs/operator-setup.md    PMI_ARTIFACT_MAX_BYTES, PMI_ARTIFACT_MAX_FILES

packages/mcp-server/src/tools/artifacts.ts             NEW — the live pmi.artifacts.sync (R-045-8)
packages/mcp-server/src/tools/reserved.ts              − pmi.artifacts.sync
packages/mcp-server/src/server.ts                      registers ARTIFACT_TOOLS as live

frontend/src/design/components/MarkdownViewer.tsx      NEW — react-markdown + remark-gfm; urlTransform; components img/a/input; size fallback (R-045-5)
frontend/src/config/viewer.ts                          RENDER_LIMIT_BYTES
frontend/src/pages/EpicFiles.tsx                        NEW — tree · header · picker · refusals · findings · states (R-045-13)
frontend/src/pages/EpicDetail.tsx                       + the Files section; URL selection
frontend/src/pages/SpecificationDetail.tsx              renders contentRaw through MarkdownViewer (FR-ART-019)
frontend/src/services/api.ts                            + getEpicArtifacts · getArtifactVersion · getUnboundArtifacts
frontend/tests/fixtures/hostile-markdown/*.md           the corpus (viewer-contract.md §6)
frontend/tests/unit/design/markdown-viewer.spec.tsx · pages/epic-files.spec.tsx · pages/{epic-detail,specification-detail}.spec.tsx (extended)

backend/tests/unit/artifacts/*.spec.ts
backend/tests/contract/artifacts-api.spec.ts · mcp-tool-surface.spec.ts (reserved rows: two)
backend/tests/integration/artifact-sync.spec.ts         the real finish sequence; concurrent + retried syncs first
backend/tests/architecture/durable-stores.spec.ts       + ARTIFACT_STORE
backend/tests/architecture/connector-boundary.spec.ts   fourteen scopes
packages/mcp-server/tests/…                             the live tool's translation
e2e/tests/epic-045-m3.spec.ts                           the M3 second-half transcript (R-045-11)
specs/043-…/contracts/mcp-tool-surface.md               dated note: live as of EPIC-045
specs/_shared/dependencies.md                           D-31 react-markdown · D-32 remark-gfm (written at this step)
governance/repository-layout.md                         + backend/src/modules/artifacts/ · MarkdownViewer (at implement time)
```

**Structure Decision**: artifacts get their **own backend module** with a **stores-only token**
because three things write or read them — the connector's sync, the Epic detail, the
specification detail — and the module must depend on Epics, executions and specifications without
any of them depending back; the specification entity is reached through a **port implemented by
the specifications module**, so the artifacts module never touches specification tables; the
**renderer is one design-system component** with two hosts, so there is exactly one rendering to
keep safe (`R-045-13`).

## Phase 0 — Research

[research.md](./research.md) resolves thirteen decisions: `R-045-1` content once per digest with
a manifest per execution; `R-045-2` the Epic from the execution's binding; `R-045-3` per-file
refusal codes recorded as a `system` comment; `R-045-4` the specification through a port;
`R-045-5` the renderer (Context7-verified: raw HTML escaped by default, `defaultUrlTransform`,
`components`, `remark-gfm`); `R-045-6` the module and the borrowed guard; `R-045-7` projections
over the manifest; `R-045-8` the tool live with a derived idempotency key; `R-045-9` the artifact
set imported from the bundle; `R-045-10` limits as configuration; `R-045-11` Tier 1 and Tier 2;
`R-045-12` the records; `R-045-13` one component, two hosts.

No `NEEDS CLARIFICATION` remains: the five judgement calls were confirmed on 2026-09-05.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — `artifact_versions`, `artifact_syncs`, `artifact_sync_files`,
  `specifications.sourcePath`, the four projections, the sync step by step, audit actions,
  invariants.
- [contracts/artifacts-api.md](./contracts/artifacts-api.md) — the connector operation, three
  session reads, refusal codes, what changes elsewhere, tests.
- [contracts/viewer-contract.md](./contracts/viewer-contract.md) — where, the tree, the header,
  the rendering rules, the states, the hostile corpus, tests.
- [quickstart.md](./quickstart.md) — twelve scenarios and the mutation observations owed.

## Governance records written by this step (`R-045-12`)

- `specs/_shared/dependencies.md` — `D-31` `react-markdown`, `D-32` `remark-gfm`, with the
  sanitising strategy (no `rehype-raw`; `urlTransform` drops every `src`; `defaultUrlTransform`
  blocks unsafe schemes) stated beside them (`FR-ART-061`).
- `governance/repository-layout.md` — the module and the component are registered when the
  directories exist (first tasks of their phases), not now: the layout check requires a registered
  path to exist. The Epic's directory was registered at the specify step.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Gate XII PARTIAL — the commands producing this Epic run unregistered | This repository is not a PMI-managed project; the hooks run only in provisioned directories | Provisioning this repository as its own project is `EPIC-042`'s stated out-of-scope; the honest row is *recorded*, as before |
| Two new runtime packages | `react-markdown` renders to React elements without an HTML string; `remark-gfm` is the tables and task lists every `tasks.md` uses | One package that emits HTML needs a second sanitiser and the `dangerouslySetInnerHTML` path the spec wants absent; hand-rolling a markdown parser is a larger surface than the dependency |
| A port between two modules for one entity | The synced `spec.md` must become a `Specification` without a generation job or a human sponsor | Reusing `commitGeneration` with a synthetic job lies to the job ledger; a second *specification* entity is the drift the replan forbids |
| Three tables where the replan sketched one | `ArtifactFile` per version duplicates unchanged content on every command and cannot answer *what did execution X deliver* when nothing changed | One table cannot hold both "content once" and "history per execution"; the manifest is the smaller of the two additions |

## Related Documents

- `specs/044-epic-model-journey-board/` — Epics, the binding resolution, the board's unbound
  group, the specification list's columns, `DEF-044-003`
- `specs/042-pmi-spec-kit-extension/` — the finish hook that syncs; `hook-sequences.ts`'s
  `ARTIFACT_FILES` and `runFinish`
- `specs/043-pmi-integration-contract/` — the connector guard, scopes, refusal vocabulary, the
  reserved tool
- `specs/037-governed-execution-registry/contracts/execution-contract.md` — bindings, comments,
  completion with output digests
- `specs/005-specification-generation/` — the specification and version entities
- `adr/ADR-0030` · `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` §2.3, §3, §4, §7
