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

*(filled at closure: the measured timings of `SC-ART-006`, the transcript path, the mutation
observations, the counts)*
