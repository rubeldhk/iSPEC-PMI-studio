# Contract: the artifact sync and the artifact reads

**Epic**: `EPIC-045` · **Date**: 2026-09-05 · [data-model.md](../data-model.md) · [research.md](../research.md)

## §1 · The connector operation (`FR-ART-040`, `FR-ART-041`)

**MCP** `pmi.artifacts.sync` (live; formerly reserved in `EPIC-043` `mcp-tool-surface.md` §3):

```text
arguments: { contractVersion?, executionId: string, files: [{ path, digest, content }], idempotencyKey? }
route:     POST /v1/projects/me/artifacts/sync        scope artifacts.sync        mutating
answer:    { syncId, epicId: string | null, created: number, reused: number,
             refused: [{ path, code, detail? }] }                                 201
```

`epicNumber`, which the reserved schema tolerated, is ignored and documented as such (`R-045-2`).
The idempotency key is derived when absent (`R-045-8`); a replay with the same key returns the
stored answer with `201` and writes nothing.

**Refusals** (connector vocabulary, `FR-PIC-002`): `invalid_connector_credential` · `scope_required`
· `404` absence for another project (`{projectId}` not `me` or the credential's) ·
`execution_unknown` (`404`; the execution is not this project's) · a schema failure before any of
these. **Per-file codes** (in `refused[]`, `201`): `digest_mismatch`, `path_not_in_artifact_set`,
`path_escapes_epic`, `not_utf8`, `too_large`, `credential_shape`, `too_many_files`. `detail` never
carries content or a matched credential text.

**Side effects**: the manifest (`data-model.md` §3); a `system` comment on the execution listing
the refusals, author type `service`; the Epic's specification created or extended for `spec.md`
(§4); audit `artifacts.sync`.

## §2 · Session reads (`FR-ART-042`, `FR-ART-051`)

| Route | Who | Answer |
|---|---|---|
| `GET /v1/epics/{eid}/artifacts` | project member | `200` `{ epicId, files: Tree[], refusals: [...], findings: { reportedNotSynced: [{ executionId, digest }], syncedNotReported: [...] } }` — no content (`data-model.md` §5) |
| `GET /v1/artifacts/{vid}` | project member | `200` `{ versionId, path, kind, digest, sizeBytes, content, firstSyncedAt, deliveredBy: [...] }` |
| `GET /v1/projects/{id}/artifacts/unbound` | project member | `200` the syncs with `epicId = null` and their files (`FR-ART-007`) |

An Epic or version of another workspace is `404` absence. No session write exists. A connector
credential receives `404` on every read (`FR-ART-043`).

## §3 · Universal rules

Every route scoped by workspace and project (`FR-ART-050`); errors through `toErrorBody` with the
class code in `error.code` and the specific code in `details.code`; every sync audited
(`FR-ART-052`); the connector scope registry gains `artifacts.sync` (fourteen scopes).

## §4 · What changes elsewhere

| Where | Change |
|---|---|
| `packages/mcp-server/src/tools/reserved.ts` | `pmi.artifacts.sync` removed from `RESERVED_TOOLS` |
| `packages/mcp-server/src/tools/artifacts.ts` (new) | the live `ToolSpec` (`R-045-8`) |
| `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md` | dated note: the tool is live as of `EPIC-045`; §3 keeps `pmi.execution.sync` and `pmi.tasks.sync` |
| `backend/tests/contract/mcp-tool-surface.spec.ts` | fourteen tools listed unchanged; reserved rows two |
| `backend/tests/architecture/connector-boundary.spec.ts` | fourteen scopes |
| `backend/src/modules/connector/connector-scope.ts` | `registerConnectorScope('artifacts.sync')` |

## §5 · Tests that hold this contract

- **Contract** `backend/tests/contract/artifacts-api.spec.ts`: route table; the answer shapes;
  every per-file code produced by one bad file each; the derived key; `404` for another workspace
  on the reads; no connector read.
- **Integration** `backend/tests/integration/artifact-sync.spec.ts`: the real finish sequence
  (`runFinish`) through a real `pmi-studio` server against the composed `AppModule`; **two
  simultaneous syncs** and a **retried sync** (`FR-ART-006`, written first); a changed file makes a
  second version; the tree and content reads; the specification by sync on the specification
  list; the unbound case; the reported-versus-synced finding.
- **Unit** `backend/tests/unit/artifacts/*.spec.ts`: validation per code; the Epic resolution
  through `bindExecutions`; the manifest and projections over in-memory stores; the specification
  port over in-memory specification stores.
- **Architecture**: `durable-stores.spec.ts` gains `ARTIFACT_STORE`; `engine-independence` and
  `agent-independence` still green (provenance values come from rows).
