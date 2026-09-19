# EPIC-045 — Artifact Sync and Markdown Viewer: Epic closing report

**Task**: `T1675`–`T1681` (this record; the promotion `T1680` also names is **not** performed — see
*Work not done*) · **Session**: 2026-09-05 · **Constitution IX**

**Status**: `Implemented` — 64 of 66 tasks complete; **two open, each named below with its reason**
(`T1677` the Tier 2 run against a stack; `T1680` the converge pass and the promotion). Every
implementation task carries a unit test, contract test, integration test, architecture test or
conformance check observed failing before its implementation and passing after (Constitution V).

## What the Epic delivered — milestone M3, second half

Since `EPIC-042` the finish hook of every governed command has called `pmi.artifacts.sync` and the
platform has answered *not available until EPIC-045*. This Epic makes the tool **live** and gives
the content a home and a screen — **without editing the hook**, which is what reserving the tool
was for.

| Phase | Tasks | What it established |
|---|---|---|
| 1 Setup | `T1620`–`T1628` | Three tables and one column, additive; the store whose unique indexes are the arbiter; the fourteenth connector scope; `react-markdown` 10.1.0 and `remark-gfm` 4.0.1 pinned exactly, licences read, `D-31`/`D-32` ticked |
| 2 Foundational | `T1629`–`T1640` | The artifact set imported from the bundle; seven per-file refusal codes; the sync service (data-model §6 step by step); the specification port; the connector route behind `EPIC-043`'s guard; `pmi.artifacts.sync` live, `RESERVED_TOOLS` down to two |
| 3 US2 | `T1641`–`T1645` | The unbound case end to end; reported-versus-synced findings; the read service as projections over the manifest, loading no content; the two limits documented |
| 4 US1 | `T1646`–`T1653`, `T1682`, `T1683` | `MarkdownViewer` — one renderer, raw HTML escaped, every `src` dropped; the three API reads; the Files section on the Epic detail with selection in the address; the board's unbound group names each sync's files |
| 5 US3 | `T1654`–`T1657`, `T1684`, `T1685` | The version picker, *Not the current version*, the `notInLatestSync` marker, the slug-differs note; ten versions retrievable; the tree measured |
| 6 US4 | `T1658`–`T1661` | The synced `spec.md` becomes the Epic's specification through the port, versions appended only on change; the specification detail renders through the same viewer and says where it came from |
| 7 US5 | `T1662`–`T1666` | The hostile corpus and the six safety properties over every fixture; zero network requests during render; the boundary check that keeps one renderer and no raw-HTML path |
| 8 Polish | `T1667`–`T1674` | The `M3` second-half harness (authored); the hook proved unedited against the live shape; README §Setup, the operator guide and `.env.example`; the tool-surface note; the layout records; `EPIC-044`'s hand-off discharged |
| Z Closure | `T1675`, `T1676`, `T1678`, `T1679`, `T1681` | This report, the counts, the inversion, seven mutation observations, the Constitution XII record, the records |

## What it deliberately did not do

- **Nothing edits a synced version.** No route, tool or screen updates or deletes one; the store
  exposes no such method and `artifact.store.spec.ts` asserts the absence rather than assuming it.
- **The Epic never comes from the path.** `specs/007-intake/spec.md` synced by an execution bound to
  Epic 3 belongs to Epic 3 (`T1632`). A directory name is a fact about a developer's disk.
- **The hook is unchanged** (`FR-ART-046`). `T1668` asserts it: the arguments are still
  `{ executionId, files }`, the digests still travel on the completion, and the finish sequence
  prints **no** new line, because the prompt specifies none.
- **A connector credential cannot read.** `artifacts.sync` is a write scope with no read beside it;
  the three reads are session routes (`T1641`, `T1637`).

## Found on the way

| Finding | What was true | What is true now |
|---|---|---|
| `ArtifactsModule` crashed the composition root with no error message | `@UseGuards(ConnectorAuthGuard)` instantiates the guard in the CONSUMING module's injector, so `TrustedPrincipalFactory` must resolve there; it did not. Nest's `abortOnError` defaults to true, so the process **aborted** instead of reporting — the integration suite read it as *Worker exited unexpectedly*, which looks like a flake and is not one | `AgentsModule` is imported by `ArtifactsModule`, with a comment saying it is for the guard and not for this module's own code (`ExecutionsModule` imports it for the same reason). Diagnosed by re-running `NestFactory.create` with `abortOnError: false` |
| The in-memory store's summary read went through the content read | `versionSummariesByIds` was `versionsByIds(...).map(summarise)`. Harmless in memory — and it made the spy in `artifact-read.service.spec.ts` see a content load, so the `SC-ART-006` rule could not be asserted at all | The two are independent reads. Found by the test that exists to find it, which is the outcome that test was written for |
| `T1645` named `backend/.env.example` | This repository has no `backend/`-local example file; the artifact limits belong in the root `.env.example` operators copy. `G-26-14` caught the ticked task naming a path that does not exist | The task text names the real file; the limits are documented there, in README §Setup and in the operator guide, with `T1669`'s conformance check holding all three |
| `T1633`'s task text named an illustrative path as if it were a repository path | `specs/003-reports/notes.txt` is the example of a refused file, not a file here | Reworded to *a stray `notes.txt`*; `G-26-14` green |
| The findings test tried to edit an execution binding | `execution_target_bindings` is immutable by trigger (`EPIC-037`), so fabricating a reported-versus-synced mismatch by `UPDATE` failed — correctly | The mismatch is produced the way a real one arises: sync one set, complete naming another. Which is also *why* `FR-ART-009` reports rather than repairs |
| `DEF-045-001` — the API's request-body limit refused any real Epic's set (found in the branch review) | Nothing configured a body limit, so the framework default of about 100 KB applied ahead of both documented artifact limits; a 150 KB file answered `500 internal_error`; every integration fixture was a few bytes | `core/http-body.ts`: the application is created with `bodyParser: false` and `PMI_ARTIFACT_SYNC_BODY_BYTES` (default 16 MiB) is the JSON limit, in `main.ts` and the test helper alike; the parser's refusal is `413 payload_too_large`; documented in `.env.example`, README and the operator guide; a 150 KB file and a 20-file oversized body are integration cases. CLOSED |
| `DEF-045-002` — the specification step raced and was not retry-safe (found in the branch review) | Step 7 ran after the sync row; two first syncs of one Epic's `spec.md` answered `500`/`201`, and the loser's retry replayed past the step forever; raw-SQL violations arrive as `P2010`+`23505`, which the helper did not recognise; the in-memory port tolerated the duplicate | The specification step runs before the sync row; insert-and-read-back on `(epicId, sourcePath)`; `appendVersionIfChanged` retries a `versionNumber` collision; `isUniqueViolation` recognises the raw shapes; the in-memory port enforces the index. Two simultaneous first syncs answer `201`/`201` and leave one specification with two versions. CLOSED |

## Constitution XI Tier 1 — proved by inversion (`T1676`)

`T1633`, `T1641`, `T1656` and `T1658` drive the sync through the **shipped finish sequence** and a
real `pmi-studio` server (in-memory MCP transport) against the composed `AppModule`, and the reads
through their routes. Eighteen scenarios, including two simultaneous syncs and a replayed key.

Inversion, observed 2026-09-05: with `ArtifactsModule` removed from `backend/src/app.module.ts`,
`artifact-sync.spec.ts`'s first scenario failed with **`404` on `GET /v1/epics/{id}/artifacts`** —
the routes vanish and the hook's sync has nothing to answer it. Restored; 27 tests green across
`artifact-sync.spec.ts` and `artifacts-schema.spec.ts`.

## The mutation observations (`T1678`)

Seven applied, each to the working tree, with the named test run and the source restored. **Two did
not fail as `quickstart.md` predicted**, and both differences are recorded rather than smoothed
over — they say something true about where each guarantee actually lives.

| Proof | The mutation | The test did not survive it |
|---|---|---|
| `SC-ART-002` | `PrismaArtifactStore.createVersion` reads first and inserts second | **RED** — as `500`, not as two versions: the unique index refuses the second insert and the raw `P2002` escapes. `DEF-044-003`'s exact failure mode |
| `SC-ART-002` | the sync skips the idempotency-key lookup | **GREEN — survived.** The lookup is an optimisation; the arbiter is the unique `(workspaceId, idempotencyKey)` index and `recordSync`'s read-back |
| `SC-ART-002` | *and* `recordSync` stops catching the violation | **RED** — both concurrency tests answer `500`. This pair locates the guarantee: it is in the schema, not in the service |
| `SC-ART-004` | `urlTransform` replaced by the identity | **RED on `links.md`** (a `javascript:` href survives). `images.md` stayed green — the `img` override independently prevents any `src` |
| `SC-ART-004` | the `components.img` override removed | **RED** — `images.md`: the alternative text is gone |
| `SC-ART-004` | both together | **RED, four tests** — including *zero network requests* and *no element with a `src`* |
| `FR-ART-053` | the credential-shape check removed | **RED** — `created: 1` where `0` was expected; the file carrying the token was stored |

## Constitution XII — execution registration (`T1679`)

The commands that produced this Epic ran **unregistered by hook**. This repository is not a
PMI-managed project: it has no `.pmi/project.json`, so `speckit.pmi.begin` refuses `not_provisioned`
and no execution row exists for the `specify`, `plan`, `tasks`, `analyze` or `implement` that built
it. Recorded here as `EPIC-042` and `EPIC-044` recorded it, not waived.

What *is* registered is the evidence: every execution inside `artifact-sync.spec.ts` and inside
`e2e/tests/epic-045-m3.spec.ts` is registered by `speckit.pmi.begin` through a real `pmi-studio`
server, and its files are synced by `speckit.pmi.finish`. Those syncs are **the first content a
governed command has ever left in PMI Studio** — before this Epic the tool answered
*not available until EPIC-045* and the platform held nothing a command wrote.

## Measured (`quickstart.md` §Results)

- **`SC-ART-006` tree read**: an Epic with 50 files × 20 versions answered in **281 ms** (first
  run) and **57 ms** warm, against a bound of 2 000 ms. The read selects no content.
- **`SC-ART-005`**: ten syncs of a changing file produced ten retrievable versions; every one's
  content re-hashed to its stored digest.
- **`SC-ART-006` render half** and **`SC-ART-003`**: *authored, not yet measured* — no stack.

## The counts (`T1675`)

Whole-project suites, 2026-09-05, after the last change:

| Suite | Files | Tests | Result |
|---|---|---|---|
| `backend-unit` + `backend-contract` + `architecture` + `mcp-server` + `workspace-bundle` + `epic-stage` | 377 | 3 698 passed, 5 skipped | **1 failed** — `T999u`, pre-existing (below) |
| `frontend` | 93 | 1 026 passed | **green** |
| `governance` | 77 | 1 069 passed | **2 failed** — `T884`, pre-existing (below) |
| `backend-integration` (this Epic's two files) | 2 | 27 passed | **green** |
| `pnpm -r typecheck` | — | — | **green** |
| `eslint` over every file this Epic touched | — | — | **green** |

**This Epic's own tests**: 144 backend unit (six files), 38 contract (two files), 27 integration
(two files), 18 mcp-server, 6 workspace-bundle, 70 `markdown-viewer`, 9 `no-raw-html`, 23
`epic-files`, plus extensions to `epic-detail`, `journey-board`, `Specification`, `api`,
`durable-stores`, `connector-boundary`, `connector-scopes`, `connector-auth.guard`,
`universal-columns`, `dependency-register`, `readme-conformance` and `mcp-tool-surface`.

**Three failures are pre-existing and untouched by this Epic**, confirmed against `git log` —
neither file nor its subject was modified here:

- `T999u` (`architecture`) — `specs/035-defect-room/tier2-transcript.md` has never been committed;
  `EPIC-035` left it, as its own closure records.
- `T884` ×2 (`governance`) — `docs/accessibility/EPIC-029-manual-pass.md` does not exist; only the
  `.DRAFT.md` beside it does, since `EPIC-029`.

**Two unhandled rejections** in `frontend/tests/unit/shell-traceability-route.spec.tsx` are likewise
pre-existing: that file's own API stub has never carried `listEpics`, which `Requirements.tsx` calls
on mount. Every test in the file passes; the rejections are noise that predates this Epic.

## Repairs this Epic made to checks it broke, and one it should have

Three whole-project checks failed on this Epic's first full run, and each was right to:

- `T1359`/`T1416` — two more places pin the connector-scope count. Both raised to **fourteen**;
  `connector-auth.guard.spec.ts` had used `artifacts.sync` as its example of an *unregistered*
  scope, which this Epic made permanent, so the example moved to `tasks.sync` (`EPIC-046`'s,
  reserved and still unclaimed).
- `T1330` — the `ARTIFACT_STORE` factory hid the seam behind a `configured()` helper; the check
  reads the factory body and requires `DATABASE_URL` in it, so a reader sees the decision. Inlined.
- **`T012a` — `artifact_sync_files` carried no `workspaceId` and no creation timestamp.** This was a
  real omission in `data-model.md` §3, not a checker quirk: the manifest's tenancy derived from its
  sync, and a tenancy that exists only as a join cannot be enforced by row-level security later
  without moving data (`FR-002`). The column, its index and a `createdAt` were added to the
  migration, the model and the store, and `T1620` now asserts them.

## Assumptions taken autonomously (Constitution X)

1. **`AgentsModule` is imported by `ArtifactsModule`.** `T1638` listed six imports and not this one;
   the guard cannot be constructed without it. Added with the reason in a comment.
2. **The read service and its controller were built in Phase 2 rather than Phase 3.** `T1637`'s
   contract test covers all four routes and is a Phase 2 task, so the reads had to exist for it to
   pass. `T1642`/`T1643`/`T1644` are recorded against their Phase 3 numbers.
3. **`ArtifactsModule` was created at `T1624` rather than `T1638`.** `T1622`'s architecture check
   names `artifacts/artifacts.module.ts` and is a Phase 1 task; the module was created with only the
   store binding, and `T1638` added the controllers and imports.
4. **The limits are documented in the root `.env.example`.** See *Found on the way*.
5. **The `img` override and `urlTransform` are both kept** although either alone stops an image
   being fetched. The mutation observations show the redundancy; it is retained deliberately —
   defence in depth on the one property that has no second chance.
6. **`contentParsed` is `{ parsed: false }` for every synced specification.** The output parser
   expects an engine result object, not raw markdown; feeding it a file would be a lie about what
   produced the structure. The port takes a parser it does not currently receive.

## Work not done, and why

- **`T1677` — the Tier 2 run of `e2e/tests/epic-045-m3.spec.ts` and its transcript
  `docs/uat/EPIC-045-m3-transcript.md`.** No reference-local stack was available in this session.
  The harness is authored, not measured; **`SC-ART-003` is *authored, not yet measured***, and so is
  the render half of `SC-ART-006`.
- **`T1680` — the converge pass, and the promotion `local → dev`.** The converge is the next command
  (below). The promotion is performed only on an instruction naming the environment; none was given.

## Recommended next task

`/speckit-converge for EPIC-045` — then, if it appends nothing, run `T1677` against a stack.

## The branch review (2026-09-05, after the first converge)

Seven findings, two of them reproduced against the composed application before they were named.
Fixed on the branch: the request-body limit (`DEF-045-001`, HIGH), the specification step's race
and retry hole (`DEF-045-002`, HIGH), the content read's one-query-per-execution fan-out (now three
statements however many executions the project has, held by a spy in `review-fixes.spec.ts`), a
caller-supplied idempotency key reused with a different payload (now `409 idempotency_conflict`; a
replay must be the same request — the unit test that asserted the old behaviour was corrected), a
refusal detail that named a vendor (now *a vendor API key*), the literal NUL byte in the validation
source (now an escape, so tooling reads the file as text), and `findByEpicSource` relabelling the
execution's initiator as the project owner (now `null`, the type widened). Left as recorded:
versions inserted before the sync row can be orphaned if the sync row's write fails for a reason
other than the unique index — immutable, reused by a later sync, untidy rather than wrong.

After the fixes: `backend-unit` 372, `backend-contract` 307, `architecture` 290 (`T999u` the
pre-existing red), `readme-conformance` 29 with the third variable required, the four Epic
integration suites 37 of 37 including the four new cases, typecheck clean.

## The records (`T1681`)

- `specs/_shared/dependencies.md` — `D-31` `react-markdown` **10.x** (pinned `10.1.0`) and `D-32`
  `remark-gfm` **4.x** (pinned `4.0.1`), both **☑ verified**: the licence files shipped in each
  package were read (MIT, Espen Hovlandsdal and Titus Wormer respectively). Held by
  `tests/governance/dependency-register.spec.ts`, which also refuses `rehype-raw` and `dompurify`.
- `governance/repository-layout.md` — `backend/src/modules/artifacts/`,
  `frontend/src/design/components/MarkdownViewer.tsx`, `frontend/src/pages/EpicFiles.tsx` and
  `frontend/tests/fixtures/hostile-markdown/` all registered under *Paths that must not break*.
- `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md` — the live tool documented in
  §2 with its route, scope and answer shape; §3 down to two reserved rows; a dated amendment naming
  `EPIC-045`. Held by `backend/tests/contract/mcp-tool-surface.spec.ts` (`T1671`).
- `specs/044-epic-model-journey-board/closure.md` — the `FR-EPB-025` hand-off recorded **discharged**
  by `FR-ART-030`, naming the two tests that prove it (`T1674`).
- `specs/045-artifact-sync-markdown-viewer/defects/` — `DEF-045-001` and `DEF-045-002`, both
  CLOSED; no open record.
