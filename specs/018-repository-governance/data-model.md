# Artifact Model: Repository Governance Process

**Epic**: `EPIC-018` | **Date**: 2026-08-04 | **Plan**: [plan.md](./plan.md)

> **This is an artifact model, not a data model.** This epic persists nothing to a database and adds
> no table to [`../_shared/schema.sql`](../_shared/schema.sql). Its "entities" are versioned files in
> the git repository. The structure below defines what each file must contain so that conformance is
> checkable — which is what makes Constitution V satisfiable under the plan's reading B.

---

## SteeringFile

One versioned statement of repository standards. Format specified in
[contracts/steering-file-format.md](./contracts/steering-file-format.md).

| Field | Where | Notes |
|---|---|---|
| `subject` | front matter | one of the ten subjects (FR-RGP-001) |
| `scope` | front matter | `repository` for all Phase 1 files |
| `version` | front matter | integer, incremented on meaningful change |
| `status` | front matter | `active` \| `superseded` |
| `owner` | front matter | one of the three programme roles — `tech-lead`, `product-owner`, `project-owner` (clarified 2026-08-05). An unowned standard is unmaintained; a file naming no role fails conformance |
| `last_reviewed` | front matter | ISO date. A file past 90 days is **reported, not failed** (clarified 2026-08-05, `FR-RGP-016`) |
| `standards[]` | body | each individually identifiable and checkable |

**Validation**:

- `subject` unique across active files — two active files on the same subject is two sources of truth.
- Each standard states a condition an artifact can be held against. "Write clean code" **fails**;
  "every exported function declares an explicit return type" **passes** (`FR-RGP-002`).
- No standard duplicates constitutional or template text verbatim; overlap is expressed as a link
  (`FR-RGP-004`, checked by `SC-RGP-003`).
- Where a standard conflicts with the constitution, **the constitution wins** and the steering file is
  corrected (`FR-RGP-005`). There is no scenario in which steering overrides governance.

**State transitions**: `active → superseded`. Superseded files are retained, not deleted — the same
treatment the platform gives retired requirements (FR-006).

---

## ArtifactLocation

One row of the layout mapping. The mapping is **one document**, not one file per row.

| Field | Notes |
|---|---|
| `artifact_type` | e.g. specification, plan, task list, ADR, contract, research, defect record |
| `path` | its one documented home |
| `governing_standard` | which standard governs its content — `PMI-DOC-000` for repository documents (D-16) |
| `migration_note` | populated only when the current location differs from the target |
| `d13_dependency` | true when this path is touched by the deferred module re-cut (`FR-RGP-008`) |

**Validation**:

- Every artifact type present in the repository has **exactly one** location (`SC-RGP-004`).
- Every `migration_note` is recorded **before** the migration executes (`SC-RGP-005`) — a migration
  discovered after the fact is a broken cross-reference discovered by someone else.
- A row with `d13_dependency = true` records the dependency and does **not** resolve it.

---

## TemplateConformanceRecord

The result of checking one template against `PMI-DOC-000`.

| Field | Notes |
|---|---|
| `template` | `spec-template.md`, `plan-template.md`, `tasks-template.md` |
| `standard` | `PMI-DOC-000` §4 |
| `required_sections_present[]` | |
| `deviations[]` | each with the missing section and a stated reason |

**Validation**: every template is checked; zero unexamined (`SC-RGP-006`). A deviation without a
reason is a defect, not a deviation.

⚠️ **This record is the evidence for decision D-4**, which this epic deliberately does not settle
(R-018-5). It enumerates the gap so D-4 becomes answerable.

---

## TraceabilityConvention

One stated link rule. Collectively these form the repository's traceability model, governed by
`PMI-DOC-000` and the eventual resolution of **D-2** (`FR-RGP-013`).

| Field | Notes |
|---|---|
| `source_type` → `target_type` | e.g. task → unit-test task |
| `required` | whether the link must exist |
| `crosses_epic_boundary` | whether the link may point outside its epic |

**Validation**:

- Every required link is checkable (`SC-RGP-008`).
- Cross-epic links are **explicit**. The 2026-08-03 analysis found `T081 → T073` and `T101 → T095`
  crossing epic boundaries correctly but invisibly to per-epic convergence — this field exists so
  that class of link is declared rather than inferred.

---

## GovernanceIndex

One document naming every governance artifact. Built **last** — it indexes the rest.

| Field | Notes |
|---|---|
| `artifact`, `purpose`, `path`, `version` | |
| `constitution_i_exempt` | whether this path is exempt from the Spec Kit command gate |

**Validation**: answers "what governs this repository?" from a single document (`SC-RGP-007`). The
exemption column matters: Constitution I exempts `.specify/**` and `specs/**`, and artifacts created
outside those paths need their status decided explicitly rather than assumed.

---

## What this epic does not model

- **No database entities.** Nothing here reaches `_shared/schema.sql` or `data-model.md`.
- **No product Steering Engine entities.** `SteeringScope`, `SteeringDocument`, and
  `SteeringApplication` belong to [EPIC-017](../017-enhancement-model/data-model.md). They share a
  name with `SteeringFile` and nothing else: one is a row in a multi-tenant product, the other is a
  file in this repository.

## Constitution V testability note

Five checks are mechanically executable against the file tree, with no database and no model —
which is what makes the plan's reading B viable rather than aspirational:

1. Subject coverage — all ten subjects present or absence reasoned (`SC-RGP-002`)
2. Overlap — no verbatim duplication of constitution or template text (`SC-RGP-003`)
3. Location coverage — every artifact type mapped exactly once (`SC-RGP-004`)
4. Template conformance — every template checked, every deviation reasoned (`SC-RGP-006`)
5. Link rules — every required link expressed as a checkable rule (`SC-RGP-008`)
6. Review currency — no steering file past its 90-day interval unreported (`SC-RGP-009`)

Two criteria are **not** mechanically checkable and are honest about it: `SC-RGP-001` (someone new can
name the standards) needs a person, and `SC-RGP-007` (one index answers the question) is a judgement.
Both are validated in [quickstart.md](./quickstart.md) by a human walkthrough, not by a check
pretending to be one.
