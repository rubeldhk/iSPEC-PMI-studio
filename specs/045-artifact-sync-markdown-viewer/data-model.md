# Data Model: Artifact Sync and Markdown Viewer

**Epic**: `EPIC-045` · **Date**: 2026-09-05 · **Research**: [research.md](./research.md)

Three new tables, one nullable column, four projections. Nothing here is ever updated or deleted
through a route, tool or screen (`FR-ART-001`); the migration is additive.

## §1 · `artifact_versions` — content, once per digest (`R-045-1`)

*PMI-DOC-007 §3 sketched this as one `ArtifactFile` row per synced version; the spec calls the
concept an artifact version. Here it is `ArtifactVersion` — content once per digest — with the
per-execution history in §2–§3 (analysis `T1`).*

| Column | Type | Notes |
|---|---|---|
| `id` | text | uuid |
| `workspaceId` | text | FK `workspaces` |
| `projectId` | text | FK `projects` |
| `path` | text | relative to the project directory, e.g. `specs/003-reports/spec.md` (`R-045-9`) |
| `kind` | text | `spec \| plan \| tasks \| research \| data-model \| analysis \| quickstart \| contract \| checklist`; CHECK |
| `digest` | text | SHA-256 hex of `content`, recomputed by the platform (`FR-ART-004`) |
| `sizeBytes` | int | UTF-8 byte length |
| `content` | text | the file, verbatim |
| `firstExecutionId` | text | the execution whose sync first delivered it |
| `firstSyncedAt` | timestamp | |

Unique `(projectId, path, digest)` — the arbiter under concurrency (`FR-ART-006`): a second
insert of the same content reads the existing row back (`DEF-044-003`'s rule). Indexes
`(workspaceId)`, `(projectId, path)`.

## §2 · `artifact_syncs` — one row per sync

| Column | Type | Notes |
|---|---|---|
| `id` | text | uuid |
| `workspaceId`, `projectId` | text | scope |
| `executionId` | text | FK `executions`; the sync names it, the platform verifies it is this project's |
| `epicId` | text? | FK `epics`; resolved from the execution's input binding (`R-045-2`); null = *unbound* |
| `credentialId` | text | the connector credential that synced |
| `idempotencyKey` | text | sent, or derived `artifacts:<executionId>:<sha256 of sorted path=digest>` (`R-045-8`) |
| `createdCount`, `reusedCount`, `refusedCount` | int | the answer, kept |
| `syncedAt` | timestamp | |

Unique `(workspaceId, idempotencyKey)` — a replay returns the original outcome and writes
nothing. Indexes `(epicId, syncedAt desc)`, `(executionId)`.

## §3 · `artifact_sync_files` — the manifest

| Column | Type | Notes |
|---|---|---|
| `id` | text | uuid |
| `syncId` | text | FK `artifact_syncs` |
| `path` | text | as sent |
| `digest` | text | as sent |
| `outcome` | text | `created \| reused \| refused`; CHECK |
| `versionId` | text? | FK `artifact_versions`; null when refused |
| `refusalCode` | text? | `digest_mismatch \| path_not_in_artifact_set \| path_escapes_epic \| not_utf8 \| too_large \| credential_shape \| too_many_files`; CHECK |
| `refusalDetail` | text? | safe, never the content or the matched text (`FR-ART-053`) |

Unique `(syncId, path)`. Index `(versionId)`.

## §4 · `specifications.sourcePath` — the Epic's specification by sync (`R-045-4`)

| Column | Type | Notes |
|---|---|---|
| `sourcePath` | text? | the synced path whose versions feed this specification; null for every specification created another way |

Unique `(epicId, sourcePath)` where both non-null. Created with `lifecycleState = draft`,
`engineName`/`engineVersion` from the execution's agent identity snapshot (adapter; agent version
or model) or `connector`/contract version, `createdById` = the execution's initiator,
`ownerUserId` = the project owner. Versions: `SpecificationVersion` rows appended by
`appendIfChanged` (identical content adds nothing — `FR-ART-031`), `authoredById` = the
execution's initiator, `contentParsed` = the output parser's result or `{ parsed: false }`.

## §5 · Projections (never stored)

**Tree** (`GET /v1/epics/{eid}/artifacts`, `R-045-7`): for the Epic's syncs, newest first, group
manifest rows by `path` →

```text
{ path, kind, current: { versionId, digest, sizeBytes, sync: { executionId, command, outcome, at } } | null,
  notInLatestSync: boolean,
  versions: [{ versionId, digest, sizeBytes, firstSyncedAt,
               deliveredBy: [{ executionId, command, outcome, at, syncId }] }]  // newest first
}
```

`current` = the version of the newest sync that included the path, **ordered by `syncedAt` then
sync id**. A sync always precedes its execution's completion (the hook syncs, then completes), so
the spec's edge case — *two executions sync the same path within the same second; the current one
is the one whose execution completed later* — is satisfied by sync order without reading
completion times (analysis `I1`). `notInLatestSync` = the newest sync of the Epic did not include
the path. The tree query joins `artifact_sync_files` → `artifact_syncs` → `executions` and the
latest lifecycle event, so each entry carries the execution's command, outcome and time without
storing them on the sync (analysis `I2`, `R-045-7`). Refused manifest rows appear under `refusals`
(path, code, execution, at), never under `versions`.

**Content** (`GET /v1/artifacts/{vid}`): the version's row with `content`, plus `deliveredBy`.

**Reported-versus-synced** (`FR-ART-009`): for each execution of the Epic with an `output`
binding, `reportedNotSynced` = digests in the binding's `artifactDigest` list with no manifest row
of outcome `created | reused` for that execution; `syncedNotReported` = manifest digests the
binding does not list. Shown on the Epic detail as findings; never repaired.

**Specification by sync**: the specification list row for the Epic is `EPIC-044`'s row; the
detail's current version is the newest `SpecificationVersion` (`FR-ART-019`).

## §6 · The sync, step by step (`artifact-sync.service.ts`)

1. Guard: connector credential, scope `artifacts.sync`, `{projectId}` is `me` or the credential's
   project (existing guard).
2. `executionId` is an execution of this workspace and project, else `404 execution_unknown`.
3. Idempotency key: sent, or derived; an existing sync with the key → return its stored answer.
4. Resolve the Epic from the execution's input binding (`R-045-2`); unresolvable → `epicId = null`.
5. Per file, in the order sent: past `PMI_ARTIFACT_MAX_FILES` → `too_many_files`; path shape and
   artifact set (`R-045-9`) → `path_escapes_epic` / `path_not_in_artifact_set`; UTF-8 fatal decode
   → `not_utf8`; byte length > `PMI_ARTIFACT_MAX_BYTES` → `too_large`; credential shapes →
   `credential_shape`; recomputed digest ≠ stated → `digest_mismatch`. Otherwise insert the
   version; on the unique violation read the existing row (`reused`); else `created`.
6. Write the sync row and its manifest in one transaction with the version inserts.
7. If a `created` or `reused` file is the Epic's `spec.md` and `epicId` is set: find or create the
   specification by `(epicId, sourcePath)`, append a version if changed (§4).
8. Refusals → one `system` comment on the execution (`R-045-3`); audit
   `artifacts.sync` with counts and digests.
9. Answer `{ syncId, epicId, created, reused, refused[{ path, code }] }`.

## §7 · Audit actions

| Action | Detail |
|---|---|
| `artifacts.sync` | executionId, epicId, credentialId, created, reused, refused (codes), digests |
| `specification.create_from_sync` | specificationId, epicId, executionId, path, versionNumber |

## §8 · Invariants the tests hold

- One `artifact_versions` row per `(projectId, path, digest)` however many syncs (`SC-ART-002`).
- A sync record exists for every accepted request, including all-`reused` and all-`refused` ones.
- A version is never updated or deleted; the store exposes no such method (`FR-ART-001`).
- The tree query selects no `content` (`SC-ART-006`).
- A specification by sync has exactly one row per `(epicId, sourcePath)` (`FR-ART-030`).
