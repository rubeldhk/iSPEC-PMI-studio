# Data Model: Enhancement Model for Spec-Driven Engineering

**Epic**: `EPIC-017` | **Date**: 2026-08-04 | **Plan**: [plan.md](./plan.md)

Extends [`../_shared/data-model.md`](../_shared/data-model.md) — it does not replace it. Universal
rules from that document apply here unchanged: every row carries `workspace_id`, `created_at/by`,
`updated_at/by`, and every read passes through the workspace-scoping helper (EPIC-004 T014).

**Ten new entities, one widened enumeration, one new tenancy table.**

---

## Tenancy extension

### Organization *(new — R-017-1)*

The scope above workspace. **This is the only change to existing tenancy.**

| Field | Notes |
|---|---|
| `id` | |
| `name` | required, unique |
| `created_at/by`, `updated_at/by` | universal |

**Relationship**: `Workspace` gains **`organization_id`** (required). No other table changes.
Organization is reachable from any artifact by one join: `artifact → workspace → organization`.

**Validation**: a workspace belongs to exactly one organization. Deleting an organization with
workspaces is refused.

⚠️ **This is the epic's one migration-sensitive change.** Cheap before workspace rows exist, a data
migration afterwards. See build order in [plan.md](./plan.md).

---

## Steering

### SteeringScope

A resolved position in the four-level hierarchy. Not a table of its own if the scope can be expressed
as a discriminated reference — see validation below.

| Field | Notes |
|---|---|
| `id` | |
| `scope_type` | `organization` \| `workspace` \| `project` \| `product` |
| `scope_ref` | identifier of the organization, workspace, project, or product |
| `workspace_id` | universal; for organization scope, the owning workspace set is derived |

**Validation**: exactly one `scope_ref` valid for the declared `scope_type`. Scope paths are strictly
ordered `organization → workspace → project → product`; a narrower scope must resolve to a parent in
the next level up.

### SteeringDocument

| Field | Notes |
|---|---|
| `id` | |
| `subject` | one of the ten named subjects (FR-ENH-002) |
| `scope_id` | → SteeringScope |
| `content` | the guidance text |
| `version` | integer, incremented on each meaningful change |
| `status` | `active` \| `retired` |
| `workspace_id` + universal columns | |

**Validation**: `(subject, scope_id, version)` unique. Retiring is a status change, never a delete —
consistent with FR-006's treatment of retired requirements. Edit history is append-only, modelled the
way `RequirementVersion` already is in `_shared/data-model.md`.

**State transitions**: `active → retired`. A retired document may not be edited; a new version starts
from `active`.

### SteeringApplication

The provenance record. Written **at generation time**, never recomputed (see plan design notes).

| Field | Notes |
|---|---|
| `id` | |
| `artifact_id` + `artifact_type` | the generated specification or task set |
| `steering_document_versions` | the exact set that constrained this generation |
| `overrides` | narrower-scope wins recorded as `{winning, overridden}` pairs (FR-ENH-005) |
| `applied_at` | |

**Validation**: an artifact generated while steering existed MUST have exactly one
SteeringApplication. An artifact generated with no steering in scope has one with an empty set —
**not** a missing row, which is what makes SC-ENH-001's "zero unknown provenance" checkable.

---

## Living specifications

`Specification` (existing, `_shared/data-model.md`) gains:

| Field | Notes |
|---|---|
| `currency_status` | `current` \| `stale` |
| `stale_reason` | what changed upstream, populated when marked stale |
| `reconciled_at` / `reconciled_by` | cleared on going stale, set on reconciliation |

**Validation**: a specification in lifecycle state `baselined` may be marked stale but MUST NOT be
edited — reconciliation forks a new `draft` (FR-ENH-007, consistent with FR-011a).

**Interaction with FR-032**: the platform already flags a specification out of date when a *source
requirement* changes. `currency_status` generalises that to any upstream artifact. These are the same
concept at two scopes and MUST NOT become two independent flags — one field, wider trigger.

---

## Dependency and impact

### DependencyEdge *(separate from TraceabilityLink — R-017-3)*

| Field | Notes |
|---|---|
| `id` | |
| `source_id` + `source_type` | the dependent artifact |
| `target_id` + `target_type` | what it depends on |
| `dependency_type` | classification of the dependency |
| `workspace_id` + universal columns | |

**Validation**: `(source, target, dependency_type)` unique — duplicates refused. Self-edges refused.
**Cycles refused, including multi-hop** (FR-ENH-011, SC-ENH-009) — detection runs on the path, not
only the direct edge. Source and target must share a workspace.

**Indexes**: both directions, matching EPIC-011's rationale — both traversals are first-class.

### ImpactResult

Computed, not stored. Shape returned by an impact request:

| Field | Notes |
|---|---|
| `origin` | the artifact whose change was proposed |
| `affected[]` | each with `artifact`, `path[]`, `distance` |
| `bounded` | true when the depth limit truncated the traversal (FR-ENH-010) |

**Validation**: `bounded = true` MUST be returned rather than silently truncating. A result that is
incomplete and does not say so reads as completeness — the failure mode this field exists to prevent.

---

## Review gates

### Role

| Field | Notes |
|---|---|
| `id`, `name` | one of the twelve named roles (FR-ENH-023) |
| `responsibility` | what it reviews or authors |
| `permitted_artifact_types[]` | what it may act on |

### ReviewGate

| Field | Notes |
|---|---|
| `id` | |
| `transition` | the lifecycle transition gated (from EPIC-009's six-state machine) |
| `required_roles[]` | → Role |
| `blocking` | whether findings block advancement pending decision |

**Validation**: `transition` must be one of the permitted transitions of the M08 six-state lifecycle.
✅ **That permitted set is now enumerated** in `FR-011` — eight transitions across six endpoints — resolving finding **A1** from the
2026-08-03 analysis. The gate model is fully validatable.

### GateOutcome *(append-only)*

| Field | Notes |
|---|---|
| `id` | |
| `specification_id`, `gate_id` | |
| `roles_run[]` | including any that were unavailable |
| `findings[]` | → ReviewFinding |
| `human_decision` | `approved` \| `rejected` \| **null while undecided** |
| `decided_by`, `decided_at` | |
| `overridden_findings[]` | findings present at approval |

**Validation**: `human_decision` null means the transition MUST NOT proceed (FR-ENH-014,
SC-ENH-004). No update or delete path exists — enforced the way `audit_entries` already are, in code
and by database trigger (EPIC-004 F-13.1). An unavailable role yields a **failed** gate, never a pass
(FR-ENH-016).

### ReviewFinding

| Field | Notes |
|---|---|
| `id`, `gate_outcome_id` | |
| `role_id` | which role raised it — required (SC-ENH-005) |
| `location` | the part of the specification concerned — required |
| `severity`, `message` | |

**Validation**: a finding without `role_id` or `location` is **malformed output**, treated as role
unavailability. This mirrors `ValidationFinding`'s existing rule (EPIC-009 T117).

---

## Product traceability

### TraceabilityLink *(widened, not replaced — R-017-7)*

`link_type` widens from the two Phase 1 edge types to the **twelve chain link types**: vision, goals,
capabilities, requirements, specifications, architecture, planning, tasks, code, tests, release,
operations.

⚠️ **Breaking assertion**: EPIC-011 `T077a` asserts `TraceabilityLink` permits **only** the two Phase 1
types. It fails the build the moment this enumeration widens. Updating it is a task of this epic, not
a surprise for whoever runs the suite.

**Validation**: chain links remain acyclic and system-written. Traversal reports the **first missing
link type** rather than a silently shortened chain (FR-ENH-022, SC-ENH-007).

### StructureDefinition

The twenty-one-section structure as versioned data, not a stored skeleton (R-017-6).

| Field | Notes |
|---|---|
| `id`, `version` | |
| `sections[]` | ordered, each with name and required flag |
| `applies_to` | **product outputs only** — D-16 |

**Validation**: conformance is checked and reported as findings reusing the FR-023 shape. It does
**not** govern this repository's documents.

---

## Entity relationship summary

```text
Organization 1──n Workspace 1──n Project 1──n Specification
                                                   │
SteeringScope 1──n SteeringDocument                │
       │                   └──n SteeringApplication ─┘  (provenance, write-once)
       └── scope_type: organization | workspace | project | product

Specification 1──n GateOutcome 1──n ReviewFinding n──1 Role
      │                └── human_decision: null blocks the transition
      │
      ├──n DependencyEdge──► any artifact        (user-maintained, cyclic-checked)
      └──n TraceabilityLink──► any artifact      (system-written, acyclic, 12 types)
```

## Constitution V testability note

Five behaviours here are **pure functions** and unit-testable without a database or a model:
steering resolution and override records, cycle detection, impact path construction, gate arbitration
(does this outcome permit advancement?), and structure conformance. That is what makes the
Constitution V gate genuinely satisfiable for this epic rather than nominally.

Three behaviours need a **real database** and belong in integration tests with Testcontainers, for
the reason EPIC-004 gives about mocking: the recursive impact query, the append-only trigger on
`GateOutcome`, and workspace scoping across the new organization join.
