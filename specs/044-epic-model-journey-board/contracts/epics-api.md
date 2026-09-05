# Contract — Epics, assignments and the stage reads (`EPIC-044`)

**Session**: 2026-09-05 · **Data model**: [../data-model.md](../data-model.md)

Every route is under the `v1` prefix, workspace-scoped by the session, and answers the
`FR-SHL-060` four states on the screens that read it. Writes require the project owner grant
(`OwnerGate`, `EPIC-042`); a writer without it receives `403 owner_grant_required`.

## 1. Session routes

| Route | Who | Body | Answer |
|---|---|---|---|
| `GET /v1/projects/{id}/epics` | member | — | `200` `Epic[]` in number order; `?status=active\|split\|closed` filters; each with `requirementCount`, `specificationCount` |
| `POST /v1/projects/{id}/epics` | owner | `{ title, description? }` | `201` `Epic` — number allocated, slug derived |
| `GET /v1/epics/{eid}` | member | — | `200` `Epic` with `requirements[]`, `specifications[]`, `children[]`, `parent?`, `decisions { createdBy, lastProcessed, decidedBy }` (`FR-EPB-063`, `FR-EPB-064`) |
| `PATCH /v1/epics/{eid}` | owner | `{ title?, description? }` | `200` `Epic`; `number` never changes; slug follows the title |
| `POST /v1/epics/{eid}/close` | owner | — | `200` `Epic` with `status: closed`, `closedAt`; `409 epic_not_active` for a split or closed Epic |
| `PUT /v1/requirements/{rid}/epic` | owner | `{ epicId: string \| null }` | `200` `Requirement`; `409 epic_not_active` when the target is split or closed; `404` for another project's Epic |
| `PUT /v1/specifications/{sid}/epic` | owner | `{ epicId: string \| null }` | `200` `Specification` |
| `GET /v1/epics/{eid}/stage` | member | — | `200` `EpicStage` (data-model §4) — PMI-DOC-007 §4.2 |
| `GET /v1/projects/{id}/epics/stages` | member | — | `200` `BoardRead` (data-model §4): every Epic's stage, `unbound`, `packageVersion`, `profile`, `columns` |

`Epic` shape: `{ id, projectId, number, slug, title, description, status, parentEpicId,
splitSuffix, createdAt, updatedAt, closedAt, requirementCount, specificationCount }`.

Every read that lists a project's Epics first runs decision reconciliation (`R-044-6`), so a
first run's children appear on the first read after the decision is recorded.

## 2. Existing reads whose content changes

| Read | Change |
|---|---|
| `GET /v1/projects/{id}/requirements` (`EPIC-007`) | rows gain `epicId`, `epicNumber`, `epicTitle` (null when unassigned) |
| `GET /v1/projects/{id}/specifications` (`EPIC-008`) | rows gain `epicId`, `epicNumber`, `epicTitle` |
| `GET /v1/projects/me/context` · `pmi.project.context` | `epics` from the entity, `epicSource: 'epic.entity'` |
| `GET /v1/projects/me/requirements?groupBy=epic` · `pmi.requirements.list` | groups by the entity |
| `GET /v1/projects/me/decomposition` · `pmi.project.decompose` | the entity's bundles |

No connector scope is added; the tool surface and its contract test (`EPIC-043`) are unchanged in
shape. `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md` gains a dated note on
`epicSource`.

## 3. Refusals

| Code | When |
|---|---|
| `owner_grant_required` (403) | a write without the grant |
| `epic_not_active` (409) | assigning to, or closing, a split or closed Epic |
| `validation_failed` (400) | empty title, title over 120 chars, `epicId` of another project |
| `not_found` (404) | an Epic, requirement or specification outside the caller's workspace |

## 4. Conformance and tests

- `backend/tests/contract/epics-api.spec.ts` — the route table above against `EpicsController`
  metadata, and the `BoardRead` shape.
- `backend/tests/integration/epics-api.spec.ts` — CRUD, allocation under concurrency (two creates
  in parallel receive distinct numbers), assignment rules, the grant, audit rows.
- `backend/tests/integration/epic-stages.spec.ts` — executions registered through a real
  `pmi-studio` server via the sequence harness against Epics of the composed application; the stage
  reads; unbound executions; `Implementing`/`Converged`; provisional records move nothing.
- `backend/tests/integration/decision-reconcile.spec.ts` — a recorded split creates children once.
- `backend/tests/integration/connector-reads.spec.ts` (extended) — `epicSource: 'epic.entity'`;
  another project's credential sees no Epics.
