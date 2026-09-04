# Contract — the reads and the workstation connection (`EPIC-043`)

Behind the connector guard (same rules as `mounted-registry-api.md` §1). `{id}` in every route
must be the credential's project; any other id is `404`.

## 1. Health — `POST /v1/projects/{id}/health` · scope `health.write` (`R-043-8`)

```text
body    { extensionVersion?, toolkitVersion?, serverVersion? }
201     { projectId, contractVersion, apiVersion, serverVersion, connectedAt }
```

Creates or updates the credential's `workstation_connections` row. Idempotent; no
`Idempotency-Key` required (it is a heartbeat, not an execution event). Audited as
`connector.health` with the versions in `detail`.

## 2. Project context — `GET /v1/projects/{id}/context` · scope `project.read` (`R-043-9`)

```text
200 {
  projectId, name, agentIntegration, scriptType, provisioningState, rootPath,
  extensionVersion,            // the workspace bundle version the platform ships
  contractVersion,             // the execution contract version the platform speaks
  platformUrl,                 // PMI_PUBLIC_URL
  epics: [{ number, slug, name }],
  epicSource: 'unavailable-until-EPIC-044'   // until EPIC-044 supplies a source
}
```

Nothing from another project; nothing about the workspace beyond its id.

## 3. Requirements — `GET /v1/projects/{id}/requirements?groupBy=epic` · scope `requirements.read`

```text
200 {
  groups: [{
    epic: { number, slug, name } | 'unassigned',
    requirements: [{ id, reference, description, type, priority, status, baselineState }]   // baselineState is null until requirements link to baselines (EPIC-020 baselines are specification-level); baselineSource states it
  }],
  epicSource: 'unavailable-until-EPIC-044',
  baselineSource: 'unavailable-until-requirements-link-to-baselines'
}
```

Every active requirement appears exactly once; retired ones are omitted. `baselineState` is `null`
until a requirement can be linked to a baseline (`EPIC-020` baselines are specification-level; no
requirement link exists), and `baselineSource` says so. `groupBy` other than `epic` is `400`.

## 4. Whoami — unchanged from `EPIC-041`

`GET /v1/connector/whoami` and `GET /v1/connector/projects/{projectId}/whoami` · scope
`connector.whoami`.

## 5. What a connector can never reach

Any Room read, any approval, any grant, any workspace administration, any project other than the
credential's. The scope registry holds exactly the eleven scopes in `data-model.md` §8; a route
without a registered scope cannot be mounted behind the guard (the guard refuses to activate).
