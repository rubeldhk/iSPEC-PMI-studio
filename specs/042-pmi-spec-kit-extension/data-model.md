# Data Model — EPIC-042 PMI Spec Kit Extension, Setup Skill and Constitution Sync

**Session**: 2026-09-04 · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

Three new tables, two new columns, two new scopes, and four files under a project directory.
Additive migration `<ts>_epic042_extension_constitution`. Names follow PMI-DOC-007 §3; the plan
may rename, not remove.

## 1. New table — `project_constraints` (`R-042-4`, `FR-EXT-021`)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `workspaceId` | fk → workspaces | scoping (`FR-EXT-064`) |
| `projectId` | fk → projects | |
| `kind` | enum `principle \| constraint \| non_goal` | the three headings |
| `title` | text | the `###` heading |
| `body` | text | markdown under the heading |
| `order` | int | ascending within kind |
| `version` | int | incremented on every edit; the render names the max version it saw |
| `status` | enum `active \| retired` | retired entries are not rendered |
| `createdById`, `createdAt`, `updatedAt` | | |

Indexes: `(workspaceId, projectId, kind, order)`; `(projectId, status)`.

## 2. New table — `decomposition_policies` (`R-042-6`, `R-042-7`, `FR-EXT-040`, `FR-EXT-051`)

One row per project, created on first read with the defaults.

| Column | Type | Default | Notes |
|---|---|---|---|
| `projectId` | fk → projects, **unique** | | |
| `workspaceId` | fk → workspaces | | |
| `oneSpecPerEpic` | boolean | `true` | `D-4` |
| `taskCeiling` | int | `50` | `D-4` |
| `splitRequiresConfirmation` | boolean | `true` | `D-4` |
| `offlineMode` | enum `strict \| provisional` | `strict` | Assumption 3 confirmed; `BR-0202` |
| `version` | int | `1` | incremented on every change; rendered into the constitution |
| `updatedById`, `updatedAt` | | | |

## 3. New table — `constitution_renders` (`R-042-4`, `R-042-5`, `FR-EXT-024`)

Append-only. One row per distinct render; a render whose digest equals the latest row's is not
inserted.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `workspaceId`, `projectId` | fks | |
| `version` | int | monotonic per project; the header's *constitution version* |
| `digest` | char(64) | SHA-256 of `content`; **unique per project** |
| `content` | text | the exact bytes written |
| `inputs` | jsonb | `{ constraintsMaxVersion, policyVersion, steeringDocumentIds[] }` — what produced it |
| `renderedById` | fk → users, nullable | null when rendered by provisioning or a connector read |
| `renderedAt` | timestamptz | |

Indexes: `(projectId, version desc)`; unique `(projectId, digest)`.

**Classification of an on-disk digest** (`R-042-5`), one rule used by `pmi.health`,
`pmi.constitution.get` and the screens:

```text
null                         → missing
= latest render's digest     → current
= any earlier render's digest → stale
otherwise                    → drift
```

## 4. New columns — `workstation_connections` (`R-042-5`, `FR-EXT-067`)

| Column | Type | Notes |
|---|---|---|
| `constitutionDigest` | char(64), nullable | as last reported by the workstation |
| `constitutionState` | enum `current \| stale \| drift \| missing`, nullable | classified at report time |
| `constitutionReportedAt` | timestamptz, nullable | |

## 5. New column — `provisioning_records` (`R-042-8`)

| Column | Type | Notes |
|---|---|---|
| `firstRunMarkerWritten` | boolean, default `false` | the `.pmi/first-run` write is part of the provisioning record's file list |

## 6. Connector scopes registered by this Epic (`R-042-11`)

`constitution.read` (`GET /v1/projects/{id}/constitution`), `decomposition.read`
(`GET /v1/projects/{id}/decomposition`). The registry's expected list in
`connector-boundary.spec.ts` becomes thirteen.

## 7. Files under a project directory (`R-042-6`, `R-042-8`)

| Path | Written by | Read by | Shape |
|---|---|---|---|
| `.specify/memory/constitution.md` | provisioning; `/setup-PMIStudio`; `speckit.pmi.begin` | the agent; the hooks (offline mode line) | `contracts/governance-api.md` §4 |
| `.pmi/first-run` | provisioning | `speckit.pmi.begin` (deleted after the loop) | one line: ISO time, provisioning record id |
| `.pmi/provisional/<executionId>.json` | `speckit.pmi.begin`, appended by `finish` | `speckit.pmi.begin` (submitted, then deleted on acceptance) | one `POST /v1/executions/sync` batch item |
| `.specify/extensions.yml` | provisioning / setup skill (merge) | the stock skills | Spec Kit hook registry |
| `.specify/extensions/pmi/` | provisioning / setup skill | Spec Kit | `extension.yml`, `commands/*.md` |

No credential value is ever written under the directory (`FR-LPW-024`, `FR-EXT-036`).

## 8. The execution comment that records a split (`R-042-7`, `FR-EXT-045`)

`commentType: 'decomposition-decision'`, body (JSON, validated by the hook's conformance test):

```json
{
  "policyVersion": 3,
  "epic": { "number": 7, "slug": "requirement-intake", "name": "Requirement Intake" },
  "estimate": 68, "ceiling": 50,
  "decision": "confirmed",
  "children": [
    { "suffix": "a", "slug": "intake-capture", "estimate": 31, "requirements": ["REQ-0012", "REQ-0013"] },
    { "suffix": "b", "slug": "intake-review",  "estimate": 37, "requirements": ["REQ-0014"] }
  ],
  "decidedBy": "the person in the agent session (name as typed)"
}
```

`decision` ∈ `confirmed | edited | rejected`; `children` is empty for `rejected`.

## 9. The decomposition plan (projection, not a table) (`R-042-7`)

```text
DecompositionPlan {
  firstRun: boolean                       — no completed `specify` execution for the project
  policy: { oneSpecPerEpic, taskCeiling, splitRequiresConfirmation, offlineMode, version }
  epics: [{ number, slug, name, requirements: [{ reference, description, type, priority, baselineState }] }]
  unassigned: [ requirement… ]
  epicSource: 'requirements.grouping' | 'epic.entity'   — FR-PIC-043, unchanged
}
```

## 10. Audit actions added (`FR-EXT-063`)

`constraint.create | constraint.update | constraint.reorder | constraint.retire`,
`policy.update`, `constitution.render`, `constitution.read`, `decomposition.read`,
`workstation.constitution_reported` — each with actor (user or connector principal), project,
target id and outcome.
