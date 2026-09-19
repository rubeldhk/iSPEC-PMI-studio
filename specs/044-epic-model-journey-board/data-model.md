# Data Model — EPIC-044 Epic Model and Spec Journey Board

**Session**: 2026-09-05 · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

Additive only, in the style every Epic since `EPIC-004` has used: one new table, two nullable
columns, one projection that is never stored, and one configuration document that moves.

## 1. `epics` (`R-044-5`, `FR-EPB-020`–`FR-EPB-026`)

| Column | Type | Rule |
|---|---|---|
| `id` | uuid | |
| `workspaceId` | text, FK `workspaces` | universal column; indexed |
| `projectId` | text, FK `projects` | |
| `number` | int | allocated by the platform: `max(number) + 1` for the project inside the create transaction; **never reused**; unique `(projectId, number)` |
| `slug` | text | derived from the title at creation (`kebab-case`, ASCII, ≤ 40 chars); editable with the title; on a child, the recorded slug, suffixed `-<number>` on collision |
| `title` | text, 1–120 chars | |
| `description` | text | may be empty |
| `status` | text, CHECK `active \| split \| closed` | `split` is set only by decision processing; `closed` by an owner; neither accepts a new assignment |
| `parentEpicId` | text?, FK `epics` (self-relation `parent`/`children`, nullable, no unique) | set on a child created from a decision |
| `splitSuffix` | text? (`^[a-z]$`) | the letter the decision recorded; with the parent's number it resolves the hook's `targetId` `7a` (`R-044-3`) |
| `decisionCommentId` | text? | the `decomposition-decision` comment that created this child; unique `(decisionCommentId, splitSuffix)` makes processing idempotent |
| `lastDecisionCommentId` | text? | on a parent: the last decision processed for it (confirmed, edited or rejected) |
| `createdById` | text | the owner |
| `createdAt` / `updatedAt` | timestamps | |
| `closedAt` | timestamp? | |

Indexes: `(workspaceId)`, `(projectId, status)`, `(parentEpicId)`. Audit: every write records
`epic.create | epic.update | epic.close | epic.split` with before/after (`FR-EPB-028`).

## 2. Columns added (`FR-EPB-023`, `FR-EPB-025`)

| Table | Column | Rule |
|---|---|---|
| `requirements` | `epicId text?` FK `epics`, indexed `(projectId, epicId)` | at most one Epic; assignment refused when the Epic is `split` or `closed`; a retired requirement keeps its Epic; audit `requirement.assign_epic` with before/after |
| `specifications` | `epicId text?` FK `epics`, indexed `(projectId, epicId)` | set when a specification is created by an execution bound to an Epic, or by an owner; audit `specification.assign_epic` |

## 3. The stage configuration (`R-044-2`, `FR-EPB-011`)

Canonical: `packages/epic-stage/epic-stage.config.json`. Mirror, asserted byte-identical by
`G-44-01`: `governance/epic-stage.config.json`. Changes to the document:

- every entry of `stages` gains `reachedBy`: `specify`, `clarify`, `checklist`, `plan`, `tasks`,
  `analyze`; `Ready` has `reachedBy: null` (it is the readiness verdict);
- a new key `productStages`: `[{ order: 8, name: "Implementing", reachedBy: "implement",
  evidence: "the latest implement execution is registered, started, blocked or completed
  partially-completed", next: "/speckit-converge" }, { order: 9, name: "Converged", reachedBy:
  "converge", evidence: "the latest converge execution completed and its completion comment names
  tasks.md neither as changed nor as new, and no implement was registered after it", next: "—" }]`;
- a new key `readinessProfiles`: `{ "repository": "dor", "customer": "none" }` — the product
  evaluates no condition until a later Epic defines them (`FR-EPB-046`).

`stages` keeps exactly seven entries (`G-26-01`). The product profile is `stages ++ productStages`.

## 4. `EpicStage` — a projection, never a table (`R-044-3`, `R-044-4`, `FR-EPB-001`–`FR-EPB-009`)

```text
EpicStage {
  epicId, number, slug, title, status
  stage: 'Not started' | <stage name>          — highest contiguous stage of the product profile
  missing: string[]                             — predecessors not reached below a present stage (FR-EPB-006)
  unrecognised: string[]                        — commands of its executions the configuration does not list, first-seen order; derive nothing (spec §Edge Cases — the stage configuration changes; T1617)
  last: { executionId, command, outcome, at } | null   — the newest execution bound to the Epic, whatever its outcome
  next: string | null                           — the stage's configured next; null for Converged and for closed/split
  readiness: { verdict: 'Ready' | 'Not ready' | 'n/a', note?: 'no readiness conditions configured', failing: string[] }
  running: { executionId, since } | null        — a non-terminal execution
  derivedFrom: 'executions'
}
BoardRead {
  epics: EpicStage[]                            — number order
  unbound: { executionId, command, targetId, registeredAt }[]   — targetType epic, no matching Epic (FR-EPB-008)
  packageVersion: string                        — @pmi/epic-stage (FR-EPB-012)
  columns: string[]                             — Not started, then the product profile in order (the screen names no stage)
  profile: 'product'
}
```

**Evidence rule** (`evidenceFromExecutions`): a stage with `reachedBy` is present when any
execution of that command is `completed` (for `implement`, also `partially-completed`);
`Implementing` when the latest `implement` is `registered | started | blocked | partially-completed`;
`Converged` when the latest `converge` is `completed`, its completion comment matches neither
`/Changed:[^.]*tasks\.md/` nor `/New:[^.]*tasks\.md/`, and no `implement` was registered after
its completion. `failed`, `cancelled`, `timed-out` are evidence of nothing. Provisional records
never reach the platform as executions.

**Contiguity rule** (`deriveStageFromEvidence`): the highest stage whose every predecessor (by
`order`, skipping `Ready`) is present; present stages above a gap are listed in `missing` as the
gap they sit above. `Ready` is layered: at `Analyzed` or higher, `resolveReadiness` with the
profile's failures — empty for `customer` — yields the verdict and the note.

**Binding rule**: an execution belongs to the Epic whose `number` equals its input `targetId`, or,
for `targetId` matching `^(\d+)([a-z])$`, to the child whose parent has that number and whose
`splitSuffix` is that letter. Anything else with `targetType = 'epic'` is `unbound`.

## 5. Decision processing (`R-044-6`, `FR-EPB-026`, `FR-EPB-064`)

Input: a `decomposition-decision` comment (`EPIC-042` data-model §8 — `policyVersion`, `epic
{number, slug, name}`, `estimate`, `ceiling`, `decision`, `children[{suffix, slug, estimate,
requirements[]}]`, `decidedBy`), validated with `validateDecompositionDecision`.

| Decision | Effect | Idempotence |
|---|---|---|
| `confirmed` / `edited` | one child per recorded child in suffix order: next free number, recorded slug, `parentEpicId`, `splitSuffix`, `decisionCommentId`; the recorded requirements (by `reference`) move from parent to child; parent `status = split`, `lastDecisionCommentId` | unique `(decisionCommentId, splitSuffix)`; a second pass finds the children and does nothing |
| `rejected` | parent `lastDecisionCommentId` set; nothing created | the id already recorded |
| body invalid | parent finding *decision unreadable: <errors>* on the detail; nothing created | re-evaluated on every read until the comment is fixed or superseded |

Unassigned or unknown references in a child's `requirements` are reported on the child and
skipped; the child is still created.

## 6. Reads the connector already exposes — content changes only (`FR-EPB-060`–`FR-EPB-062`)

| Read | Before | After |
|---|---|---|
| `pmi.project.context` | `epics: []`, `epicSource: 'unavailable-until-EPIC-044'` | active and split Epics `{ number, slug, name }` in number order, `epicSource: 'epic.entity'` |
| `pmi.requirements.list?groupBy=epic` | one group `unassigned` | one group per Epic in number order (`epic: { number, slug, name }`) plus `unassigned`; `epicSource: 'epic.entity'` |
| `pmi.project.decompose` | epics `[]` | the entity's Epics with their decomposable bundles; `openFirstRun`, `firstRun`, `policy` unchanged |

Type of `epicSource` widens to `'unavailable-until-EPIC-044' | 'epic.entity'`; the shape is
otherwise unchanged (`FR-PIC-043`).

## 7. Audit actions added (`FR-EPB-028`)

`epic.create | epic.update | epic.close | epic.split | requirement.assign_epic |
specification.assign_epic | decomposition.reconcile` — each with actor, project, target id,
outcome, and before/after for edits and assignments.

## 8. Files on the developer's machine

None change. The hooks keep writing `targetId` as the Epic number or number+suffix; the
directory names stay `specs/<NNN>[suffix]-<slug>/`.
