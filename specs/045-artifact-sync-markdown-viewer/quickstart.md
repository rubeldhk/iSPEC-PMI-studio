# Quickstart: Artifact Sync and Markdown Viewer

**Epic**: `EPIC-045` · **Date**: 2026-09-05 · [plan.md](./plan.md) · [contracts/](./contracts/)

How to see the Epic work end to end, and what it must show. Implementation lives in `tasks.md`.

## Prerequisites

- Docker for the integration project (Testcontainers PostgreSQL 16); `DOCKER_UNAVAILABLE=1` skips
  it honestly.
- For Tier 2: the reference-local stack (README §Setup), a seeded owner, the checkout so the
  `pmi-studio` server runs from source.

## Scenarios

1. **A governed completion syncs** — register a `specify` execution bound to Epic 3 through a
   real `pmi-studio` server; run the finish sequence with a `spec.md`; `GET /v1/epics/{e3}/artifacts`
   lists `spec.md`, kind `spec`, one version, current, produced by that execution
   (`SC-ART-001`).
2. **Unchanged twice, changed once** — finish again unchanged: `reused: 1`, still one version;
   change the file and finish: two versions, the new one current (`FR-ART-001`, `FR-ART-031`).
3. **Two at once, one retried** — fire two syncs of the same content simultaneously and one
   replay with the same key: three `201`s, one version, two sync records plus the replay's
   stored answer (`FR-ART-006`, `SC-ART-002`).
4. **One bad file** — a sync with a good `plan.md` and a `notes.txt`: `created: 1`,
   `refused: [{ path: 'specs/003-reports/notes.txt', code: 'path_not_in_artifact_set' }]`; a
   `system` comment on the execution names the refusal (`FR-ART-004`, `FR-ART-044`).
5. **A credential in a file** — content containing a `pmi_ct_` token: `credential_shape`, nothing
   stored, the comment names the shape and not the text (`FR-ART-053`).
6. **Unbound** — an execution bound to Epic 99: the sync is stored with `epicId: null`;
   `GET /v1/projects/{id}/artifacts/unbound` lists it; no Epic's tree shows it (`FR-ART-007`).
7. **The specification by sync** — after scenario 1 the specification list shows one
   specification under Epic 3 at *Specified*; after scenario 2 it has two versions
   (`FR-ART-030` to `FR-ART-033`, `SC-ART-007`).
8. **Reported, not synced** — complete an execution whose output digests name a digest never
   synced: the Epic's findings list it (`FR-ART-009`).
9. **The tree and the viewer** — open the Epic detail: Files lists the tree; open `spec.md`:
   rendered read-only with the header; pick the earlier version: content changes, header says not
   current, digest matches (`US1`, `US3`).
10. **Hostile markdown** — render the corpus: no script, no `src`, no blocked scheme, HTML as
    text, unknown fence as code (`SC-ART-004`).
11. **Not in the latest sync** — a file synced once and absent later stays listed with the
    marker (`FR-ART-014`).
12. **Cross-project** — another project's credential syncing or reading: `404` absence
    (`FR-ART-050`).

## Running the checks

```bash
pnpm vitest run --project backend-unit backend/tests/unit/artifacts
pnpm vitest run --project backend-contract backend/tests/contract/artifacts-api.spec.ts backend/tests/contract/mcp-tool-surface.spec.ts
pnpm vitest run --project backend-integration backend/tests/integration/artifact-sync.spec.ts
pnpm vitest run --project architecture
pnpm vitest run --project frontend frontend/tests/unit/design/markdown-viewer.spec.tsx frontend/tests/unit/pages/epic-files.spec.tsx
pnpm vitest run --project mcp-server
pnpm register:update
```

Tier 2: `pnpm --filter e2e exec playwright test tests/epic-045-m3.spec.ts` against the running stack;
the transcript is written to `docs/uat/EPIC-045-m3-transcript.md`.

## Mutation observations owed at closure

| Target | Mutation | Expected |
|---|---|---|
| `SC-ART-002` | the store ignores the unique violation and inserts a second version | `artifact-sync.spec.ts` scenario 3 red (two versions) |
| `SC-ART-002` | the sync skips the idempotency-key lookup | the retried sync creates a second sync record — red |
| `SC-ART-004` | `urlTransform` replaced by the identity | `markdown-viewer.spec.tsx` `images.md`/`links.md` red |
| `SC-ART-004` | the `img` component override removed | `images.md` red (an `img` with `src`) |
| `FR-ART-053` | the credential-shape check removed | scenario 5 red (content stored) |

## Results

**Measured on 2026-09-05**, by `backend/tests/integration/artifact-sync.spec.ts` against a real
PostgreSQL 16 (Testcontainers) with the composed `AppModule`:

| What | Bound | Measured |
|---|---|---|
| `SC-ART-006` tree read — an Epic with **50 files x 20 versions** (1 000 manifest rows) | < 2 000 ms | **281 ms** first run, **57 ms** on a warm database |
| `SC-ART-005` — ten syncs of a changing file | ten retrievable versions | **10**, and every version's content re-hashed to its stored digest |
| `SC-ART-002` — two simultaneous syncs plus one replayed key | three `201`s, one version, two sync records | **as specified** |

The tree read is an order of magnitude inside its bound because it selects **no content**: the
projection is manifest x sync x execution with `versionSummariesByIds` supplying size and digest.
The figure to watch on a larger corpus is that one, not the content read, which is always one row.

**Render half of `SC-ART-006`** (a 500 KiB file on the reference-local stack): **not measured** —
it is recorded by `e2e/tests/epic-045-m3.spec.ts`, which is authored and has not been run against a
stack in this session. See the transcript note below.

**Transcript**: `docs/uat/EPIC-045-m3-transcript.md` — **absent**. `e2e/tests/epic-045-m3.spec.ts`
(`T1667`) is authored; no reference-local stack was available in this session, so `SC-ART-003` is
*authored, not yet measured*. Running the harness writes the transcript; nothing else does.

## Mutation observations (performed 2026-09-05)

Every one was applied to the working tree, the named test run, the failure observed, and the source
restored. Two of the five did not fail the way this document predicted, and both differences are
recorded rather than smoothed over — they say something true about where the guarantee lives.

| Target | Mutation | Predicted | Observed |
|---|---|---|---|
| `SC-ART-002` | `PrismaArtifactStore.createVersion` reads first and inserts second, instead of inserting and reading back on the unique violation | scenario 3 red (two versions) | **RED** — but as `500`, not as two versions: the unique index still refuses the second insert and the raw `P2002` escapes. Exactly `DEF-044-003`'s failure mode |
| `SC-ART-002` | the sync skips the idempotency-key lookup | the retried sync creates a second sync record | **GREEN — survived.** The early lookup is an optimisation; the arbiter is the unique `(workspaceId, idempotencyKey)` index, and `recordSync` still read the stored row back |
| `SC-ART-002` | *and* `recordSync` stops catching the violation — neither layer dedupes | — | **RED** — both concurrency tests answer `500`. This is the mutation that locates the guarantee: it is in the schema, not in the service |
| `SC-ART-004` | `urlTransform` replaced by the identity | `images.md` and `links.md` red | **RED on `links.md`** (a `javascript:` href survives). `images.md` stayed green: the `components.img` override independently prevents any `src` — two mechanisms, either sufficient |
| `SC-ART-004` | the `components.img` override removed | `images.md` red | **RED** — the alternative text is gone |
| `SC-ART-004` | both of the above together | — | **RED, four tests** — including *zero network requests* and *no element with a `src`*, which is the pair nothing else guards |
| `FR-ART-053` | the credential-shape check removed | scenario 5 red (content stored) | **RED** — `created: 1` where `0` was expected; the file with the token was stored |

**Constitution XI Tier 1, by inversion**: with `ArtifactsModule` removed from
`backend/src/app.module.ts`, `artifact-sync.spec.ts`'s first scenario failed with `404` on
`GET /v1/epics/{id}/artifacts` — the routes vanish and the hook's sync has nothing to answer it.
Restored; green again.

## Counts

See `closure.md` §*The counts*.

**After the branch review (2026-09-05)**: `DEF-045-001` (a real Epic's set could not be synced under
the framework's default body limit) and `DEF-045-002` (the specification step raced and was not
retry-safe) fixed and covered by four new integration cases — a 150 KB file syncs; a 20-file body
above 16 MiB is `413 payload_too_large`; two simultaneous first syncs of a new Epic's `spec.md` both
answer `201` and leave one specification with two versions; a reused key with a different payload is
`409 idempotency_conflict`. The four Epic integration suites: 37 of 37.
