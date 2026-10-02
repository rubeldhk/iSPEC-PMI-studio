# Research: Artifact Sync and Markdown Viewer

**Epic**: `EPIC-045` · **Date**: 2026-09-05 · **Spec**: [spec.md](./spec.md) (clarified 2026-09-05)

Thirteen decisions. Context7 was available in this session; the two external libraries this Epic
adds were verified against current documentation and their library IDs are recorded for
`/speckit-implement` and `/speckit-converge`. Everything else is decided from the repository.

## R-045-1 — Storage: content once per digest, history per execution

**Decision**: three tables. `artifact_versions` holds content **once per (project, path,
digest)** — id, workspace, project, path, kind, digest, size, content, first synced at, the
execution that first delivered it; unique on `(projectId, path, digest)`. `artifact_syncs` holds
one row per sync — workspace, project, execution, the Epic the execution resolved to (nullable:
*unbound*), credential, idempotency key, synced at; unique on `(workspaceId, idempotencyKey)`.
`artifact_sync_files` holds the manifest — sync, path, digest, outcome (`created | reused |
refused`), the version (null when refused), the refusal code and a safe reason. No update or
delete path exists for any of the three.

**Rationale**: `FR-ART-001` says one row per digest and *a re-sync of an unchanged file creates
no row*; `US3` needs *what a given execution produced* even when nothing changed. Only a content
row plus a per-execution manifest satisfies both. The tree and the current version are
projections over the manifest (R-045-7).

**Alternatives considered**: one row per sync with content (duplicates every unchanged `spec.md`
on every command — rejected); content keyed by digest alone across projects (a cross-project
read could confirm a digest exists — rejected on `FR-ART-050`); reusing `execution_artifacts`
(`EPIC-037`'s role/reference/digest table has no content and belongs to the registry — left as
is; the sync writes nothing there).

**Docs consulted**: none needed (Prisma additive tables and unique indexes are the pattern
`EPIC-044` used).

## R-045-2 — The Epic is the execution's, resolved as the board resolves it

**Decision**: at sync time the platform reads the execution's **input binding** (`targetType =
'epic'`, `targetId`) and resolves it with `bindExecutions` from `@pmi/epic-stage` against the
project's Epics — a number, or a parent number plus split suffix — exactly as `EpicStageService`
does. No Epic id or number is accepted in the sync arguments; a path is never parsed for an
Epic. Unresolvable → the sync's `epicId` is null and its files are *unbound* (`FR-ART-007`).

**Rationale**: `FR-ART-003`, `FR-EPB-008`, `FR-EPB-026`; one resolution rule for the board and
the store (`R-06`'s spirit).

**Alternatives considered**: `epicNumber` in the arguments (the reserved schema allows it
optionally; ignored on purpose, and the contract note says so); parsing `specs/007-intake` — breaks
on hand-made directories and renamed slugs.

**Docs consulted**: none needed.

## R-045-3 — Per-file refusal with a closed code vocabulary, recorded on the execution

**Decision**: each file is judged independently: `digest_mismatch`, `path_not_in_artifact_set`,
`path_escapes_epic`, `not_utf8`, `too_large`, `credential_shape`, `too_many_files` (files past the
limit, in the order sent). The sync answers `201` with `{ created, reused, refused[] }`; the
refused entries are also written as **one** `system` comment on the execution by a `service`
author (`platform:artifacts`), body = the coded list, never the content and never the matched
credential text. Whole-sync refusals are only the connector guard's (`404` absence for another
project, scope, credential) and `execution_unknown` (`404`) when the execution id is not this
project's.

**Rationale**: clarified 2026-09-05 (per-file); `FR-ART-044` wants the refusal on the timeline;
`system` is a type the registry admits today (`DEF-044-002` taught not to invent one);
`FR-ART-053` forbids echoing the matched text.

**Alternatives considered**: a new comment type `artifact-refusal` (a vocabulary change in
`EPIC-037`'s registry and its CHECK — unnecessary); an audit row only (invisible on the
timeline).

**Docs consulted**: none needed.

## R-045-4 — The synced `spec.md` becomes the Epic's specification through a port

**Decision**: the artifacts module owns a `SpecificationSyncPort` with two operations:
`findByEpicSource(workspaceId, epicId, path)` and `createFromSync({ epic, path, content,
provenance, ownerUserId })`, plus `appendVersionIfChanged(specificationId, content, provenance)`.
The specifications module implements it: create = one transaction inserting a `Specification`
(bound to the Epic, `lifecycleState = draft`, `engineName`/`engineVersion` from provenance,
`createdById`/`updatedById` = the execution's initiator id, `ownerUserId` = the project owner)
and its first `SpecificationVersion` (`contentRaw` = the file, `contentParsed` = the existing
output parser's result or `{ parsed: false }`, `authoredById` = the execution's initiator id);
append = `SpecificationVersionService.appendIfChanged`, which already skips identical content.
One additive nullable column `specifications.sourcePath` (the synced path that feeds it) makes
*the Epic's specification created this way* findable without a heuristic; `(epicId, sourcePath)`
is unique where not null.

**Provenance**: `engineName` = the execution's `AgentIdentitySnapshot.adapter`, `engineVersion`
= its `agentVersion` or, absent, its `model`; when the execution carries no snapshot,
`engineName = 'connector'` and `engineVersion` = the execution's `contractVersion`. Values come
from rows, so the backend names no provider (`EPIC-041`'s scan).

**Rationale**: clarified 2026-09-05 (Assumption 1); `FR-ART-030` to `FR-ART-034`; `FR-EPB-025`'s
hand-off; `EPIC-005`'s `FR-014`/`R-007` (verbatim content, who and when). `commitGeneration`
is coupled to a generation job and an ownership bootstrap for a *sponsor* — the sync has neither
a job nor a human requester, so it gets its own narrow create rather than a fake job.

**Alternatives considered**: reuse `commitGeneration` with a synthetic job (lies to the job
ledger); mark the specification by `engineName` (a heuristic); a separate *synced specification*
entity (two notions of specification — the drift the replan forbids).

**Docs consulted**: none needed.

## R-045-5 — The renderer: `react-markdown` + `remark-gfm`, no raw HTML, no remote fetch

**Decision**: `react-markdown` (a React component rendering markdown to React elements without
`dangerouslySetInnerHTML`) with `remark-gfm` for tables, task lists and strikethrough. **No
`rehype-raw`**: by default `react-markdown` escapes raw HTML, which is exactly `FR-ART-021`. A
`urlTransform` wraps the library's `defaultUrlTransform` (which already blocks `javascript:` and
other unsafe protocols, allowing `http`, `https`, `mailto`, `tel` and relative paths) and returns
`null` for every `src`, so no image, frame or object can fetch; the `img` component renders the
alternative text; the `a` component opens relative sibling links inside the viewer and external
links with `rel="noopener noreferrer"` and no referrer; the `input` component (GFM task lists)
renders disabled. An unknown fenced language falls through to the default `code` block with the
language named (`FR-ART-023`). The rendering size limit is a frontend configuration constant
(2 MiB) with a raw-text fallback (`FR-ART-025`).

**Rationale**: `FR-ART-020` to `FR-ART-025`; one dependency family, from the maintainers of the
markdown ecosystem the toolkit itself uses; React elements, not an HTML string, so the sanitising
step is structural rather than a regex; `SC-ART-004`'s mutation (replace the `urlTransform` with
the identity) is one line to flip and observe.

**Alternatives considered**: `marked` + `DOMPurify` (an HTML string set into the DOM — a second
sanitiser to keep configured, and the very path we want absent); `markdown-it` (same shape);
`rehype-sanitize` as an added layer (only meaningful with `rehype-raw`, which we do not use;
kept as the recorded fallback should raw HTML ever be admitted).

**Docs consulted**: Context7 `/remarkjs/react-markdown` — *raw HTML is escaped by default;
`skipHtml` removes it; `allowedElements`/`disallowedElements`/`unwrapDisallowed`; `urlTransform`
and `defaultUrlTransform`; `components` overrides; `remarkPlugins: [remarkGfm]`*. Context7
`/rehypejs/rehype-sanitize` — *`defaultSchema` (GitHub style), `a` allows `href` only, tag list*
(recorded for the fallback). `remark-gfm` is documented in the `react-markdown` README consulted
above; no separate lookup was needed.

## R-045-6 — One module, two controllers, the guard borrowed

**Decision**: `backend/src/modules/artifacts/` — `artifact.store.ts` (`ARTIFACT_STORE`; Prisma
under `DATABASE_URL`, in-memory otherwise; asserted by `durable-stores.spec.ts`),
`artifact-sync.service.ts` (validate, resolve the Epic, store, manifest, comment, audit,
specification port), `artifact-read.service.ts` (tree, versions, content, reported-versus-synced),
`artifacts-sync.controller.ts` (`@Controller('projects')`, `@UseGuards(ConnectorAuthGuard)`,
`@Post(':projectId/artifacts/sync')`, `@ConnectorScope('artifacts.sync')`),
`artifacts.controller.ts` (session: `GET epics/:eid/artifacts`, `GET artifacts/:vid`),
`artifacts.module.ts` importing `ConnectorModule` (the guard and scope registry),
`EpicStoresModule` (the Epics for binding), `ExecutionsModule` (the comment service),
`SpecificationsModule` (the port's implementation), `AuditModule`, `ProjectsModule` (the owner).
The execution's binding, snapshot and output digests are read by one raw query, as
`EpicStageService` reads evidence — the registry is consumed, not changed.

**Route collisions checked** (`DEF-044-001`): `POST projects/:projectId/artifacts/sync` shares
no path with `ConnectorReadsController`'s GETs or any session route; `GET epics/:eid/artifacts`
sits beside `EpicsController`'s `epics/:eid` and `epics/:eid/stage` in the same `@Controller()`
style; `GET artifacts/:vid` is new. `ArtifactsModule` is registered after `EpicsModule` in
`app.module.ts`; the integration tests drive both routes through the composed application.

**Rationale**: `R-044-7`'s pattern; the guard is `ConnectorModule`'s and is reused, never
copied; the scope registry gains `artifacts.sync` (fourteen scopes; `connector-boundary.spec.ts`
updated from thirteen).

**Alternatives considered**: put the sync route in `ConnectorReadsController` (a write in a
reads controller, and the artifacts module would then depend on nothing of its own).

**Docs consulted**: none needed.

## R-045-7 — The tree and the current version are projections over the manifest

**Decision**: the tree read runs one query — manifest rows joined to their syncs for the Epic,
newest sync first — and groups in memory by path: per path, the versions in the order of their
first appearance (newest first), each with every execution that delivered that digest; the
*current* version is the one in the latest sync that included the path; a path absent from the
latest sync of the Epic is marked `notInLatestSync`. Content is never selected in the tree
query. The *reported-versus-synced* finding compares the execution's output digests (the
comma-joined `artifactDigest` of the `output` binding) with the digests of its manifest.

**Rationale**: `FR-ART-011` to `FR-ART-014`, `FR-ART-009`; `SC-ART-006` (a 50 × 20 tree under
two seconds is trivial when content stays out of the query).

**Alternatives considered**: a `current` flag maintained on write (a mutable column on an
immutable store — rejected).

**Docs consulted**: none needed.

## R-045-8 — The tool goes live with the hook unchanged; the idempotency key is derived

**Decision**: `pmi.artifacts.sync` moves from `RESERVED_TOOLS` to a live `ARTIFACT_TOOLS` spec
(`mutating: true`, route `POST /v1/projects/me/artifacts/sync`) with the argument shape the
reserved schema already validates plus an optional `idempotencyKey`. The shipped hook sends
`{ executionId, files }` and nothing else (`FR-ART-046`); the platform derives the key when
absent as `artifacts:<executionId>:<sha256 of the sorted path=digest manifest>`, so a retried
hook replays the original outcome and a changed manifest is a new sync.

**Rationale**: `FR-ART-006`, `FR-ART-040`; `EPIC-037`'s rule that every mutating tool carries a
key, met without editing `speckit.pmi.finish` or `hook-sequences.ts`.

**Alternatives considered**: require the key (changes the hook — out of scope); no key (a retry
would re-run validation and re-write the manifest; harmless for versions, noisy for comments).

**Docs consulted**: none needed.

## R-045-9 — The artifact set is imported from the workspace bundle

**Decision**: the platform imports `ARTIFACT_FILES` from `@pmi/workspace-bundle` (the hook's own
list: `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `analysis.md`,
`quickstart.md`) and applies the same two folders (`contracts/`, `checklists/`, `.md` only), so
the platform and the hook cannot disagree about the set. A path is accepted only as
`specs/<one directory>/<name>` or `specs/<one directory>/(contracts|checklists)/<name>.md`, with
no `..`, no leading `/`, no backslash. The kind is the file's base name for the seven, `contract`
or `checklist` for the folders.

**Rationale**: clarified 2026-09-05 (Assumption 4); `FR-ART-002`, `FR-ART-008`; one source, as
`epic.service.ts` already imports `validateDecompositionDecision` from the same package.

**Alternatives considered**: a second configuration document in the backend (a mirror to keep
equal, as `G-44-01` had to); any `.md` under the directory (widening without a hook that sends
it).

**Docs consulted**: none needed.

## R-045-10 — Limits are environment configuration with stated defaults

**Decision**: `PMI_ARTIFACT_MAX_BYTES` (default `1048576`), `PMI_ARTIFACT_MAX_FILES` (default
`200`), read once at module construction and documented in `.env.example`, README §Setup and the
operator guide; the render limit `2097152` bytes is a named constant in the frontend's viewer
configuration. UTF-8 is verified by decoding with the fatal flag; the credential-shape patterns
are `EPIC-043`'s scrubbing patterns, imported, not retyped.

**Rationale**: `FR-ART-008`, `FR-ART-025`, `FR-ART-053`; the operator guide already documents
the local-workspace variables the same way.

**Alternatives considered**: hard-coded limits (the spec says configuration).

**Docs consulted**: none needed.

## R-045-11 — Evidence: Tier 1 through the real hook, concurrency proved first; Tier 2 the M3 second half

**Decision**: Tier 1 — `backend/tests/integration/artifact-sync.spec.ts` drives `runFinish`
through a real `pmi-studio` server against the composed `AppModule` (the sequence the shipped hook
performs), then reads the tree and content through the session routes; it includes **two
simultaneous syncs of the same content** and **a retried sync with the same key**, asserting
`201` for all and one version per (path, digest) — written before the service exists
(`DEF-044-003` applied in advance). Contract tests cover the route shapes and refusal codes; unit
tests cover validation, the Epic resolution, the manifest and the projections over in-memory
stores; the frontend tests render the hostile corpus. Tier 2 — `e2e/tests/epic-045-m3.spec.ts`:
a governed run on the reference-local stack, then a person without a checkout reads `spec.md`,
`plan.md` and `tasks.md` and picks an earlier version; the transcript lands in
`docs/uat/EPIC-045-m3-transcript.md`.

**Rationale**: Constitution XI; `SC-ART-002`, `SC-ART-003`, `SC-ART-004`.

**Alternatives considered**: proving the sync against the in-memory store only (the stub-proved
loop `EPIC-042` had to re-prove in `EPIC-044`).

**Docs consulted**: none needed.

## R-045-12 — Governance records

**Decision**: `governance/repository-layout.md` registers `backend/src/modules/artifacts/` and
`frontend/src/design/components/MarkdownViewer.tsx` when they exist (first tasks of their
phases), and this Epic's directory already. `specs/_shared/dependencies.md` gains `D-31`
(`react-markdown`) and `D-32` (`remark-gfm`) **at this step** (`FR-ART-061`), with the sanitising
strategy stated beside them. `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md`
gains a dated note moving `pmi.artifacts.sync` to *live* at implement time (`FR-ART-045`). No ADR
amendment is owed: `ADR-0030` already states that the directory is the substrate for content
and PMI Studio the record; this Epic implements that sentence.

**Rationale**: `FR-ART-060`, `FR-ART-061`; the layout check requires a registered path to exist.

**Docs consulted**: none needed.

## R-045-13 — The viewer is one design-system component used in two places

**Decision**: `MarkdownViewer` (design system: tokens, focus order, the four states of its host)
renders a string; `EpicFiles` (a page-level section on the Epic detail) owns the tree, the
selected path, the version picker and the header (execution, digest, *not current*); the
specification detail page renders its current version's `contentRaw` with the same
`MarkdownViewer`, so the specification list's row opens the same rendering (`FR-ART-019`) without
a second component. Selection state lives in the URL query (`?file=…&version=…`) so a version
can be linked and reloaded.

**Rationale**: clarified 2026-09-05 (Assumption 2); `FR-ART-011`, `FR-ART-019`; PMI-DOC-005
component rules.

**Alternatives considered**: a Files view under Specifications (a second host of the same
component; the clarification chose one place with two ways in).

**Docs consulted**: none needed.
