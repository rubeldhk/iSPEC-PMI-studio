# Tasks: Artifact Sync and Markdown Viewer

**Epic**: `EPIC-045` · **Module**: Specifications (M-04) + Integration (M-09) · **Branch**:
`epic/045-artifact-sync-markdown-viewer` · **Generated**: 2026-09-05

**Inputs**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/artifacts-api.md](./contracts/artifacts-api.md) ·
[contracts/viewer-contract.md](./contracts/viewer-contract.md) · [quickstart.md](./quickstart.md)

**Task ID range**: `T1620`–`T1685`, **66 tasks** (`T1682`–`T1685` appended by the analysis
remediation).

> **On the identifiers.** `G-26-15` requires task identifiers to be unique **across the corpus**.
> The corpus maximum before this Epic is `T1619` (`EPIC-044` Phase 9), so allocation starts at
> `T1620`, contiguous, with no suffix letters (`R-026-9`). The closure phase is pre-allocated
> (`T1675`–`T1681`), as `EPIC-041`'s analysis finding `I3` established.

**Delivery posture**: ▶ **PROCEEDING** — fifth Epic of the local-first replan (`D-7`), the
second half of milestone `M3`. Depends on `EPIC-043`, `EPIC-042` and `EPIC-044` (all complete on
their branches; this branch is cut from `EPIC-044`'s). The hooks are **not changed**
(`FR-ART-046`): the shipped `speckit.pmi.finish` already calls the tool this Epic makes live.

**Session label**: `EPIC-045 Artifact Sync and Markdown Viewer` (Constitution VIII).

**Test statement** (Constitution V): every implementation task names the failing-first test task
that precedes it. This Epic's **document** outputs — `.env.example`, README §Setup, the operator
guide, the `EPIC-043` tool-surface note, the layout registrations — pair with the existing
conformance checks (`readme-conformance.spec.ts`, `mcp-tool-surface.spec.ts`, the layout check).
Five checks are **mutation-tested** at closure (`SC-ART-002` ×2, `SC-ART-004` ×2, `FR-ART-053`)
and the sync is **proved concurrent before the service exists** (`T1633`, the `DEF-044-003`
lesson). Whether a conformance check blocks CI: **blocks**, for every check in this Epic.

**Feature map** (`F-045.n`, Constitution III): F-045.1 Setup — schema, store, scope, the renderer
dependency (Phase 1) · F-045.2 Foundational — the artifact set, validation, the sync service, the
tool live, the specification port (Phase 2) · F-045.3 Every completion syncs once and immutably
(US2) · F-045.4 I read the Epic's files without a checkout (US1) · F-045.5 Earlier versions and
what an execution produced (US3) · F-045.6 The synced `spec.md` is the Epic's specification (US4)
· F-045.7 Rendering is safe and honest (US5) · F-045.8 Polish · F-045.Z Closure.

> **Phase order and priority.** `US1` and `US2` are both `P1`; `US2` (the sync) is built first
> because `US1` (reading) has nothing to read until files are stored. Each phase still ends in a
> state a person can demonstrate.

---

## Phase 1: Setup — F-045.1

**Purpose**: the tables exist and a store binds to them; the connector scope exists; the renderer
dependency is pinned and recorded; the module directory is registered.

- [X] T1620 [P] Write the failing integration test `backend/tests/integration/artifacts-schema.spec.ts` (Testcontainers) — tables `artifact_versions` (unique `(projectId, path, digest)`, CHECK on `kind`), `artifact_syncs` (unique `(workspaceId, idempotencyKey)`, nullable `epicId` FK `epics`, FK `executions`), `artifact_sync_files` (unique `(syncId, path)`, CHECK on `outcome` and `refusalCode`, nullable `versionId`); nullable `specifications.sourcePath` with a unique `(epicId, sourcePath)` index; the migration is additive (data-model.md §1–§4)
- [X] T1621 Add `ArtifactVersion`, `ArtifactSync`, `ArtifactSyncFile` and `Specification.sourcePath` to `backend/prisma/schema.prisma`; write `backend/prisma/migrations/20260906090000_epic045_artifacts/migration.sql` (integration test: T1620)
- [X] T1622 [P] Extend `backend/tests/architecture/durable-stores.spec.ts` with a failing entry — `artifacts/artifacts.module.ts` binds `ARTIFACT_STORE` to `PrismaArtifactStore` under `DATABASE_URL` and to `InMemoryArtifactStore` otherwise
- [X] T1623 [P] Write failing unit tests `backend/tests/unit/artifacts/artifact.store.spec.ts` — `createVersion` returns `{ row, created: true }`; the same `(projectId, path, digest)` again returns the existing row with `created: false` **including when the two calls run concurrently**; the in-memory store throws a `P2002`-shaped error on the unique index exactly as the database does and the Prisma store reads the existing row back on that error; `recordSync` refuses a second sync with the same `(workspaceId, idempotencyKey)` by returning the stored one; no method updates or deletes a version (data-model.md §8)
- [X] T1624 Create `backend/src/modules/artifacts/artifacts.tokens.ts` and `backend/src/modules/artifacts/artifact.store.ts` (`ArtifactStore` interface; `InMemoryArtifactStore` enforcing both unique indexes; `PrismaArtifactStore` with unique-violation read-back and a manifest written in one transaction) (unit test: T1623; architecture test: T1622)
- [X] T1625 [P] Extend `backend/tests/architecture/connector-boundary.spec.ts` with a failing expectation — the scope registry lists **fourteen** scopes including `artifacts.sync`
- [X] T1626 Register `artifacts.sync` in `backend/src/modules/connector/connector-scope.ts` (architecture test: T1625)
- [X] T1627 [P] Write the failing governance conformance check in `tests/governance/dependency-register.spec.ts` (extend) — `frontend/package.json` lists `react-markdown` and `remark-gfm` at pinned exact majors and `specs/_shared/dependencies.md` carries `D-31` and `D-32` with a verified licence mark; **no** `rehype-raw` and **no** `dompurify` anywhere in `frontend/package.json`
- [X] T1628 Add `react-markdown` and `remark-gfm` to `frontend/package.json` (current majors supporting React 18, exact pins), install, tick the `Verified` column of `D-31`/`D-32` in `specs/_shared/dependencies.md` after reading the package licences; register `backend/src/modules/artifacts/` in `governance/repository-layout.md` once `T1624` created it (conformance: T1627; layout check)

**Checkpoint**: tables, a durable store, the scope and the renderer dependency exist; nothing
syncs yet.

---

## Phase 2: Foundational — F-045.2 (blocking — the artifact set, validation, the sync service, the tool live, the specification port)

**Purpose**: the sync can be performed end to end through the real hook before any screen exists;
its concurrency is proved first.

- [X] T1629 [P] Write failing unit tests `backend/tests/unit/artifacts/artifact-set.spec.ts` — the accepted paths are `specs/<one dir>/<name>` for the seven names of `ARTIFACT_FILES` from `@pmi/workspace-bundle` and `specs/<one dir>/(contracts|checklists)/<name>.md`; `..`, a leading `/`, a backslash, a second directory level and `notes.txt` are refused with `path_escapes_epic` or `path_not_in_artifact_set`; the kind is derived (`spec`, `plan`, `tasks`, `research`, `data-model`, `analysis`, `quickstart`, `contract`, `checklist`) (`R-045-9`)
- [X] T1630 [P] Write failing unit tests `backend/tests/unit/artifacts/artifact-validation.spec.ts` — each of the seven codes produced by one bad file: `digest_mismatch` (recomputed SHA-256 differs), `not_utf8` (fatal decode fails), `too_large` (bytes above `PMI_ARTIFACT_MAX_BYTES`, default 1 MiB), `credential_shape` (`pmi_ct_…`, `sk-…`, `Bearer …` — `EPIC-043`'s patterns imported, the detail never containing the matched text), `too_many_files` (the file past `PMI_ARTIFACT_MAX_FILES`, default 200); a good file yields `{ ok: true, digest, sizeBytes, kind }` (`R-045-3`, `R-045-10`)
- [X] T1631 Implement `backend/src/modules/artifacts/artifact-set.ts` and `backend/src/modules/artifacts/artifact-validation.ts` with the limits read from the environment once (unit tests: T1629, T1630)
- [X] T1632 [P] Write failing unit tests `backend/tests/unit/artifacts/artifact-sync.service.spec.ts` over in-memory stores — data-model.md §6 step by step: an unknown execution is `execution_unknown` (404); the Epic is resolved from the execution's input binding through `bindExecutions` (a number; a `7a` child; unresolvable → `epicId: null`); a first sync creates versions and a manifest of `created`; the same content again is `reused` with no new version; a changed file is a second version; one bad file among good ones is `refused` in the manifest with the good ones stored; the idempotency key is derived as `artifacts:<executionId>:<sha256 of sorted path=digest>` when absent and a replay returns the stored answer; two concurrent syncs of the same content both succeed with one version; refusals produce **one** `system` comment by author `platform:artifacts` (type `service`) naming codes and paths and never content; every sync is audited `artifacts.sync` with counts and digests (`FR-ART-001` to `FR-ART-009`, `FR-ART-052`, `FR-ART-053`)
- [X] T1633 [P] Write the failing integration test `backend/tests/integration/artifact-sync.spec.ts` against the composed `AppModule` — register a `specify` execution bound to Epic 3 through a real `pmi-studio` server (in-memory MCP transport) and run `runFinish` from `@pmi/workspace-bundle` with a `spec.md` on disk: the hook's line reports the sync and the platform holds one version bound to the execution and the Epic; **two simultaneous** `POST /v1/projects/me/artifacts/sync` requests with the same content and a **third with the same idempotency key** all answer `201` and leave exactly one version and two sync records (`FR-ART-006`, `SC-ART-002`); a changed `spec.md` makes a second version; another project's credential is `404` (`FR-ART-050`); a stray `notes.txt` beside the Epic's set is refused per file and a `system` comment appears on the execution (`FR-ART-044`). **Written before `T1634`–`T1637` exist** (the `DEF-044-003` lesson)
- [X] T1634 Implement `backend/src/modules/artifacts/artifact-sync.service.ts` — execution lookup by one raw query (input binding, agent identity snapshot, output digests, `R-045-6`), Epic resolution with `bindExecutions`, validation, store, manifest, comment through `ExecutionCommentService`, audit (unit test: T1632)
- [X] T1635 [P] Write failing unit tests `backend/tests/unit/artifacts/specification-sync.spec.ts` — `SpecificationSyncPort`: `findByEpicSource` finds by `(epicId, sourcePath)`; `createFromSync` creates a specification bound to the Epic with `sourcePath`, `lifecycleState: draft`, provenance from the snapshot (`adapter`; `agentVersion` or `model`) or `connector`/contract version, `createdById` = the execution's initiator, `ownerUserId` = the project owner, and its first version with `contentRaw` verbatim and `contentParsed` from the output parser or `{ parsed: false }`; `appendVersionIfChanged` adds a version only for new content; a child Epic (`7a`) gets its own specification (`FR-ART-030` to `FR-ART-034`, `R-045-4`)
- [X] T1636 Create `backend/src/modules/artifacts/specification-sync.port.ts` (interface + in-memory) and `backend/src/modules/specifications/specification-sync.service.ts` (Prisma: one transaction for the create; `SpecificationVersionService.appendIfChanged` for later versions); export it from `backend/src/modules/specifications/specifications.module.ts`; call the port from `artifact-sync.service.ts` for an Epic-bound `spec.md` (unit test: T1635)
- [X] T1637 [P] Write the failing contract test `backend/tests/contract/artifacts-api.spec.ts` — the route table of `contracts/artifacts-api.md` §1–§2 (`POST projects/:projectId/artifacts/sync` guarded with scope `artifacts.sync`; `GET epics/:eid/artifacts`; `GET artifacts/:vid`; `GET projects/:id/artifacts/unbound`); the answer shapes; each per-file code from one bad file; the derived key; `404` for another workspace on the reads; a connector credential refused on every read (`FR-ART-043`); error bodies through `toErrorBody`
- [X] T1638 Implement `backend/src/modules/artifacts/artifacts-sync.controller.ts` (`@Controller('projects')`, `@UseGuards(ConnectorAuthGuard)`, `@Post(':projectId/artifacts/sync')`, `@ConnectorScope('artifacts.sync')`) and `backend/src/modules/artifacts/artifacts.module.ts` importing `ConnectorModule`, `EpicStoresModule`, `ExecutionsModule`, `SpecificationsModule`, `AuditModule`, `ProjectsModule`; register `ArtifactsModule` in `backend/src/app.module.ts` after `EpicsModule` (contract test: T1637; integration test: T1633)
- [X] T1639 [P] Write failing tests `packages/mcp-server/tests/artifacts-tool.spec.ts` — `pmi.artifacts.sync` is listed as a **live** tool translating to `POST /v1/projects/me/artifacts/sync` with `executionId`, `files[]` and an optional `idempotencyKey`, `mutating: true`; `epicNumber` is accepted and dropped; it is no longer in `RESERVED_TOOLS`; the server still lists fourteen tools; `pmi.execution.sync` and `pmi.tasks.sync` still refuse `not_available_until`
- [X] T1640 Create `packages/mcp-server/src/tools/artifacts.ts` (`ARTIFACT_TOOLS`), remove the entry from `packages/mcp-server/src/tools/reserved.ts`, register the live spec in `packages/mcp-server/src/server.ts`; add the dated note to `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md` (§3 keeps two reserved rows) and adjust `backend/tests/contract/mcp-tool-surface.spec.ts` if it counts reserved rows (unit test: T1639; conformance: `backend/tests/contract/mcp-tool-surface.spec.ts`)

**Checkpoint**: `runFinish` through a real server stores the Epic's files once, concurrently
safe; the Epic's `spec.md` is a specification; nothing reads them yet.

---

## Phase 3: User Story 2 — Every completion syncs the Epic's markdown set, once and immutably (P1) — F-045.3

**Goal**: the shipped hook's call succeeds against the real platform and the store tells the
truth about every file, including the ones it refused and the ones the completion claimed.

**Independent test**: quickstart scenarios 1–6 and 8 through `artifact-sync.spec.ts`.

- [X] T1641 [P] [US2] Extend `backend/tests/integration/artifact-sync.spec.ts` with failing expectations — the unbound case (an execution bound to Epic 99: the sync is stored with `epicId: null`, listed by `GET /v1/projects/{id}/artifacts/unbound`, absent from every Epic's tree — `FR-ART-007`); a completion whose output digests name a digest never synced yields `findings.reportedNotSynced` on the Epic read and a synced digest the completion did not report yields `syncedNotReported` (`FR-ART-009`); a file synced with a credential shape is refused, nothing stored, the comment names the shape only (`FR-ART-053`)
- [X] T1642 [P] [US2] Write failing unit tests `backend/tests/unit/artifacts/artifact-read.service.spec.ts` — over in-memory stores: the tree groups the Epic's manifest by path with versions newest first, each version's `deliveredBy` listing every execution that delivered that digest; `current` is the version of the newest sync that included the path; `notInLatestSync` when the newest sync omitted the path; refusals listed separately; the content read returns the version with `deliveredBy`; the unbound read; the reported-versus-synced comparison against the output binding's comma-joined digests; the tree never loads content (a spy on the store) (`R-045-7`, data-model.md §5)
- [X] T1643 [US2] Implement `backend/src/modules/artifacts/artifact-read.service.ts` — tree, content, unbound, findings — as projections over the manifest (unit test: T1642)
- [X] T1644 [US2] Implement `backend/src/modules/artifacts/artifacts.controller.ts` — `GET epics/:eid/artifacts`, `GET artifacts/:vid`, `GET projects/:id/artifacts/unbound`, member-scoped through `EpicService.locate`/the project gate, `404` absence for another workspace (contract test: T1637; integration test: T1641)
- [X] T1645 [US2] Document `PMI_ARTIFACT_MAX_BYTES` and `PMI_ARTIFACT_MAX_FILES` in the repository-root `.env.example` (this repository has no `backend/`-local one) with their defaults and one line each on what a refusal looks like to the hook (conformance: `tests/governance/readme-conformance.spec.ts`, which `T1669` extends to require both variable names in README §Setup)

**Checkpoint**: every quickstart scenario that needs no screen passes through the composed
application and the real hook sequence.

---

## Phase 4: User Story 1 — I read the Epic's files without a checkout (P1) — F-045.4

**Goal**: the Epic detail shows the tree and renders a file read-only, naming the execution.

**Independent test**: quickstart scenario 9 (first half) through `epic-files.spec.tsx` and the
detail's extended test.

- [X] T1646 [P] [US1] Write failing unit tests `frontend/tests/unit/design/markdown-viewer.spec.tsx` (rendering half) — headings, paragraphs, lists, task lists (checkboxes disabled), tables, block quotes, fenced code with the language named, emphasis and links render from a fixture; an unknown fenced language renders as a code block naming the language; a file above `RENDER_LIMIT_BYTES` renders as raw text with the reason and offers no *render anyway* control (`FR-ART-017`, `FR-ART-023`, `FR-ART-025`)
- [X] T1647 [US1] Create `frontend/src/config/viewer.ts` (`RENDER_LIMIT_BYTES = 2097152`) and `frontend/src/design/components/MarkdownViewer.tsx` — `react-markdown` with `remarkPlugins: [remarkGfm]`, no `rehype-raw`, `urlTransform` wrapping `defaultUrlTransform` and returning null for every `src`, `components` for `img` (alternative text in a marked span), `a` (relative sibling → `onOpenSibling(path)`; external → `target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"`), `input` (disabled); tokens from `components.css`; register the component in `governance/repository-layout.md` (unit test: T1646; layout check)
- [X] T1648 [P] [US1] Extend `frontend/src/services/api.ts` types and methods with failing expectations first in `frontend/tests/unit/services/api.spec.ts` (extend) — `getEpicArtifacts(epicId)` → `GET /epics/{id}/artifacts`, `getArtifactVersion(versionId)` → `GET /artifacts/{id}`, `getUnboundArtifacts(projectId)` → `GET /projects/{id}/artifacts/unbound`; the `ArtifactTree`, `ArtifactVersion`, `ArtifactFinding` types of data-model.md §5
- [X] T1649 [US1] Implement the three methods and types in `frontend/src/services/api.ts` (unit test: T1648)
- [X] T1650 [P] [US1] Write failing unit tests `frontend/tests/unit/pages/epic-files.spec.tsx` — the tree grouped by folder with kind, size, short digest and the producing execution (command · outcome · time); opening a file renders it through `MarkdownViewer` with the header (path, kind, digest, execution, *Version n of m*); the empty state names the first command (*the first completed specify produces `spec.md`*); loading, error and partial states in words; **no** control named edit, save, upload, rename or delete; the sentence *the project directory is authoritative; PMI Studio is a mirror*; a relative sibling link opens that file; a link to a path with no version says *no synced version* (`FR-ART-010` to `FR-ART-012`, `FR-ART-015` to `FR-ART-018`)
- [X] T1651 [US1] Create `frontend/src/pages/EpicFiles.tsx` — tree, header, viewer host, selection in the URL query `?file=&version=` (unit test: T1650)
- [X] T1652 [P] [US1] Extend `frontend/tests/unit/pages/epic-detail.spec.tsx` with failing expectations — the *Files* section is present below Stage; a failure of the artifacts read leaves the rest of the detail standing and the section states the error
- [X] T1653 [US1] Mount `EpicFiles` in `frontend/src/pages/EpicDetail.tsx` below the Stage section, reading the query from the router (unit test: T1652)

**Checkpoint**: a stakeholder reads `spec.md` under its Epic in PMI Studio — `US1` demonstrable.

---

## Phase 5: User Story 3 — I pick an earlier version and see what a given execution produced (P2) — F-045.5

**Goal**: history is a picker, not storage.

**Independent test**: quickstart scenarios 9 (second half) and 11 through `epic-files.spec.tsx`.

- [X] T1654 [P] [US3] Extend `frontend/tests/unit/pages/epic-files.spec.tsx` with failing expectations — the version picker lists versions newest first, each with command, outcome, time and digest; a version delivered by two executions lists both against one entry; choosing an earlier version renders its content, the header says **Not the current version** and shows that version's digest; `?version=` in the URL reloads the same version; a `notInLatestSync` file is listed with the marker and still opens; refusals and the reported-versus-synced findings are listed under the tree naming the execution (`FR-ART-013`, `FR-ART-014`, `FR-ART-016`, `FR-ART-009`)
- [X] T1655 [US3] Implement the picker, the header states, the marker and the findings list in `frontend/src/pages/EpicFiles.tsx` (unit test: T1654)
- [X] T1656 [P] [US3] Extend `backend/tests/integration/artifact-sync.spec.ts` with failing expectations — ten syncs of a changing `spec.md` produce ten versions retrievable through `GET /v1/artifacts/{vid}`, each content's recomputed digest equal to the stored one (`SC-ART-005`); a file synced once and omitted later is `notInLatestSync` in the tree (`FR-ART-014`); a tree of 50 files × 20 versions answers in under 2 s, the elapsed time printed (`SC-ART-006`)
- [X] T1657 [US3] Tune `backend/src/modules/artifacts/artifact-read.service.ts` and `artifact.store.ts` for the tree query (manifest ⋈ syncs, no content column, one statement) until `T1656` holds (integration test: T1656)

**Checkpoint**: `US3` demonstrable; the timing figure recorded for quickstart §Results.

---

## Phase 6: User Story 4 — The synced `spec.md` is the Epic's specification (P2) — F-045.6

**Goal**: the specification list has rows in local-first mode, and the detail renders the same
document the Epic detail does.

**Independent test**: quickstart scenario 7 through `artifact-sync.spec.ts`, and the
specification detail's extended test.

- [X] T1658 [P] [US4] Extend `backend/tests/integration/artifact-sync.spec.ts` with failing expectations — after the first `spec.md` sync the session `GET /v1/projects/{id}/specifications` lists one specification under Epic 3 with the Epic's stage (`FR-ART-033`); after a changed sync it has two versions and the current one is the new content; an unchanged sync adds none; a `7a` child's sync creates the child's specification, not the parent's (`FR-ART-034`); the provenance names the execution's agent identity (`FR-ART-032`); `specification.create_from_sync` is audited (`SC-ART-007`)
- [X] T1659 [US4] Wire the port call and the audit in `backend/src/modules/artifacts/artifact-sync.service.ts` and the Prisma implementation in `backend/src/modules/specifications/specification-sync.service.ts` until `T1658` holds (integration test: T1658)
- [X] T1660 [P] [US4] Extend `frontend/tests/unit/pages/Specification.spec.tsx` with a failing expectation — the current version's `contentRaw` renders through `MarkdownViewer` (a heading in the content is a heading element; raw HTML in it is text), and a specification with a `sourcePath` shows *synced from `<path>` by execution `<id>`* (`FR-ART-019`)
- [X] T1661 [US4] Render the current version through `MarkdownViewer` in `frontend/src/pages/Specification.tsx` and show the source line when `sourcePath` is present; expose `sourcePath` on the specification detail read in `backend/src/modules/specifications/specifications-read.service.ts` and the `Specification` type in `frontend/src/services/api.ts` (unit test: T1660)

**Checkpoint**: `US4` demonstrable; the specification list is no longer empty for local-first
projects.

---

## Phase 7: User Story 5 — Rendering is safe and honest (P3) — F-045.7

**Goal**: untrusted markdown cannot execute or fetch; nothing is silently dropped.

**Independent test**: quickstart scenario 10 through `markdown-viewer.spec.tsx` over the corpus.

- [X] T1662 [P] [US5] Write the hostile corpus `frontend/tests/fixtures/hostile-markdown/{script,links,images,html,fences,relative,large}.md` per `contracts/viewer-contract.md` §6 (`large.md` generated by the test above `RENDER_LIMIT_BYTES`)
- [X] T1663 [P] [US5] Extend `frontend/tests/unit/design/markdown-viewer.spec.tsx` (safety half) with failing expectations over the corpus — no `script` element; no attribute starting `on`; no `href` whose scheme is `javascript`, `data` or `vbscript`; no element with a `src`; no `iframe`, `object` or `embed`; raw HTML present as text; the unknown fence present as code; every hostile construct's text still present (nothing dropped); a spy on `fetch` and on image loading records **zero** requests during render (`FR-ART-020` to `FR-ART-024`, `SC-ART-004`)
- [X] T1664 [US5] Close every gap `T1663` finds in `frontend/src/design/components/MarkdownViewer.tsx`; document the sanitising strategy in the component's header comment and in `specs/_shared/dependencies.md` `D-31` if it changed (unit test: T1663)
- [X] T1665 [P] [US5] Write the failing boundary check `frontend/tests/unit/design/no-raw-html.spec.ts` (collected by the existing `frontend` vitest project) — no file under `frontend/src/` imports `rehype-raw` or uses `dangerouslySetInnerHTML`; `frontend/src/design/components/MarkdownViewer.tsx` is the only importer of `react-markdown` (`FR-ART-061`: no second renderer)
- [X] T1666 [US5] Keep the boundary clean in `frontend/src/` — remove any second importer or raw-HTML use the check finds (architecture test: T1665)

**Checkpoint**: `US5` demonstrable; the corpus and its two mutation targets are in the repository.

---

## Phase 8: Polish & Cross-Cutting — F-045.8

- [X] T1667 [P] Write the failing `M3` second-half harness `e2e/tests/epic-045-m3.spec.ts` (Playwright; the run writes its transcript under `docs/uat/`, naming the stack — the transcript itself is `T1677`'s) — a governed `specify` on the reference-local stack through the real `pmi-studio` server over stdio and the shipped finish sequence; then a signed-in member with no checkout opens the Epic detail, reads `spec.md`, opens `plan.md` after a `plan`, picks the earlier `spec.md` version, and the digest shown equals the file's (`SC-ART-003`); the transcript also records the time to render a generated 500 KiB markdown file on the stack (`SC-ART-006`, render half)
- [X] T1668 [P] Extend `packages/workspace-bundle/tests/first-run.spec.ts` with a failing expectation — against a stub that answers the live shape `{ syncId, epicId, created, reused, refused }`, `runFinish` completes, the digests still travel on the completion's output binding, and its lines carry **no** new sync line (the finish prompt specifies none: only refusals and the completion are printed); against the old `not_available_until` refusal it still prints the one information line. `packages/workspace-bundle/src/hook-sequences.ts` and `packages/workspace-bundle/extension/commands/finish.md` are **not edited** (`FR-ART-046`); if the expectation fails, the platform's answer shape is what changes
- [X] T1669 Update `README.md` §Setup (a subsection *Artifact sync and the markdown viewer (EPIC-045)*: what is synced, what is not, the two variables, that the directory stays authoritative, where to read files) and `docs/operator-setup.md` (an `EPIC-045` paragraph: the migration, the two variables, the derived idempotency key, what a refused file looks like on the timeline) (conformance: `tests/governance/readme-conformance.spec.ts`)
- [X] T1670 Fill `specs/045-artifact-sync-markdown-viewer/quickstart.md` §Results — the tree and render timings, the transcript path or its absence, the counts
- [X] T1671 [P] Write the failing conformance extension in `backend/tests/contract/mcp-tool-surface.spec.ts` — the contract document's §3 lists exactly two reserved tools and its dated note names `EPIC-045` for `pmi.artifacts.sync`; the server's live tools include it — then confirm green after `T1640` (conformance: `backend/tests/contract/mcp-tool-surface.spec.ts`)
- [X] T1672 [P] Extend `backend/tests/architecture/engine-independence.spec.ts` coverage by running it and `agent-independence.spec.ts` against the new module; if either names a provider through a test fixture string, move the string to a fixture file — the production code must already be clean (architecture test: existing scans)
- [X] T1673 Register `frontend/src/pages/EpicFiles.tsx` and `frontend/tests/fixtures/hostile-markdown/` in `governance/repository-layout.md` (conformance: `tests/governance/layout.spec.ts`)
- [X] T1674 Record in `specs/044-epic-model-journey-board/closure.md` §Work not done that the `FR-EPB-025` hand-off is discharged by `FR-ART-030` (a dated line), and in `specs/045-artifact-sync-markdown-viewer/spec.md` nothing (the spec is not edited by implement)

---

## Phase Z: Epic Closure (MANDATORY — Constitution IV, VI, VII, IX, XI, XII) — F-045.Z

- [X] T1675 Confirm every implementation task in `specs/045-artifact-sync-markdown-viewer/tasks.md` has a passing unit test or conformance check, by running the whole-project suites (`pnpm test:unit && pnpm test:contract && pnpm test:integration && pnpm test:arch && pnpm test:governance`) and recording the counts in `specs/045-artifact-sync-markdown-viewer/closure.md`
- [X] T1676 **Constitution XI Tier 1 (ALWAYS)** — `T1633`, `T1641`, `T1656` and `T1658` drive the sync through the real finish sequence and a real `pmi-studio` server against the composed `AppModule` in `backend/src/app.module.ts`, and the reads through their routes (integration tests: T1633, T1641, T1656, T1658); prove by inversion — remove `ArtifactsModule` from `backend/src/app.module.ts` and observe `T1633` red (the hook's sync answers `404` and the reads vanish) — and record it in `specs/045-artifact-sync-markdown-viewer/closure.md`
- [ ] T1677 **Constitution XI Tier 2** — run `e2e/tests/epic-045-m3.spec.ts` against the reference-local stack and commit the run-generated transcript under `docs/uat/` (`EPIC-045-m3-transcript.md`) naming the stack (`SC-ART-003`)
- [X] T1678 **Five mutation observations recorded** in `specs/045-artifact-sync-markdown-viewer/closure.md`: `T1623`/`T1633` fail when the store ignores the unique violation and when the idempotency lookup is skipped (`SC-ART-002`); `T1663` fails when `urlTransform` is the identity and when the `img` override is removed (`SC-ART-004`); `T1630`/`T1641` fail when the credential-shape check is removed (`FR-ART-053`)
- [X] T1679 **Constitution XII** — record in `specs/045-artifact-sync-markdown-viewer/closure.md` that the commands producing this Epic ran **unregistered by hook** (this repository is not a PMI-managed project) and that the `M3` transcript's executions are registered by `speckit.pmi.begin` and their files synced by `speckit.pmi.finish` — the first content a governed command leaves in PMI Studio
- [ ] T1680 Run `/speckit-converge`; append any remaining work to `specs/045-artifact-sync-markdown-viewer/tasks.md`; triage `specs/045-artifact-sync-markdown-viewer/defects/` leaving no open record; regenerate `governance/epic-stage-register.md` with `pnpm register:update` (twice); re-run `pnpm lint && pnpm -r typecheck && pnpm test && pnpm test:arch && pnpm test:governance`; then promote `local → dev` (no environment skipped) **only on an instruction naming the environment**
- [X] T1681 **Records** — confirm `specs/_shared/dependencies.md` carries `D-31`/`D-32` verified, `governance/repository-layout.md` registers the module, the component, the page and the corpus, and `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md` carries the dated note; record all three in `specs/045-artifact-sync-markdown-viewer/closure.md`
- [X] T1682 [P] [US2] Extend `frontend/tests/unit/pages/journey-board.spec.tsx` with failing expectations — each entry of the *unbound executions* group names how many files its sync stored (from `getUnboundArtifacts`) and links to them; an unbound execution with no sync says *no files synced*; a failure of the unbound-artifacts read leaves the board standing and the group states it (`FR-ART-007`, analysis `C1`)
- [X] T1683 [US2] Show the unbound files in the board's unbound group in `frontend/src/pages/JourneyBoard.tsx` through `getUnboundArtifacts` (unit test: T1682)
- [X] T1684 [P] [US3] Extend `frontend/tests/unit/pages/epic-files.spec.tsx` with a failing expectation — when the Epic's slug differs from a directory name in its synced paths, the tree groups by the path and shows *directory `003-reports` · the Epic's slug is now `reporting`*; when they agree, no note (`FR-ART-035`, analysis `C2`)
- [X] T1685 [US3] Implement the slug-differs note in `frontend/src/pages/EpicFiles.tsx` (unit test: T1684)

> `T1682`–`T1685` were appended on 2026-09-05 by the `/speckit-analyze` remediation (findings `C1`,
> `C2`); identifiers are never renumbered, so they sit after `T1681`. `T1682`/`T1683` execute in
> Phase 4 after `T1649`; `T1684`/`T1685` execute in Phase 5 alongside `T1654`/`T1655`.

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → Phase 3**: strict. The tables and the store (Phase 1) are what the sync
  (Phase 2) writes; the concurrent integration test `T1633` is written in Phase 2 **before**
  `T1634`–`T1638` and stays red until the controller is mounted, so the race is proved absent
  rather than assumed.
- **Phase 3 (US2)** completes the sync's reads on the backend; **Phase 4 (US1)** is the first
  screen and needs `T1644` and `T1649`; **Phase 5 (US3)** extends Phase 4's page and the read
  service; **Phase 6 (US4)** needs `T1636` and can run in parallel with Phases 4–5 on the backend
  half; **Phase 7 (US5)** extends the component `T1647` created and can run in parallel with
  Phases 5–6.
- Within a phase, every `[P]` test task may run before or alongside its neighbours; each
  implementation task waits for its named test and for the file-sharing task before it
  (`T1634` → `T1636` → `T1659`; `T1647` → `T1664`; `T1651` → `T1655`; `T1643` → `T1657`).

### Cross-Epic dependencies

| This Epic needs | From | State |
|---|---|---|
| the connector guard, scopes, refusal vocabulary, the reserved tool's schema, the `pmi-studio` server | `EPIC-043` | delivered |
| `speckit.pmi.finish` calling `pmi.artifacts.sync` with `{ executionId, files }`; `ARTIFACT_FILES`; `runFinish`; the completion's output digests | `EPIC-042` | delivered; unchanged here |
| Epics, `bindExecutions`, the board's unbound group, `EpicService.locate`, the specification list's Epic and stage columns, the Epic detail page | `EPIC-044` | delivered on `epic/044-epic-model-journey-board`, this branch's base |
| execution records, input/output bindings, agent identity snapshots, `ExecutionCommentService` with the `system` type | `EPIC-037` | delivered |
| `Specification`, `SpecificationVersion`, `SpecificationVersionService.appendIfChanged`, the output parser | `EPIC-005` | delivered |
| `tasks.md` parsing into tasks | `EPIC-046` | out of scope here |

### Parallel Example: Phase 2

```text
T1629 · T1630 · T1632 · T1633 · T1635 · T1637 · T1639   (seven failing tests, different files)
then T1631 → T1634 → T1636 → T1638 → T1640
```

### Parallel Example: Phase 4

```text
T1646 · T1648 · T1650 · T1652   (four failing tests)
then T1647 → T1649 → T1651 → T1653
```

## Implementation Strategy

1. **Phases 1–2 first** and commit after `T1638`: the real hook's sync succeeds against the
   composed application and the concurrent case is green — the one proof that must come before
   any screen.
2. **US2's reads** (Phase 3), then **US1** (Phase 4) and stop to demonstrate a stakeholder reading
   `spec.md` in PMI Studio.
3. **US3** on top of the page; **US4** on the backend half in parallel.
4. **US5** last among the stories, because the corpus and its mutation targets are what closure
   observes; then polish and closure. The transcript is the last thing written, because it is the
   only thing here that a person, not a test, will read first.
