# Repository Layout

**Epic**: [`EPIC-018`](../specs/018-repository-governance/) · **Requirements**: `FR-RGP-006` to
`FR-RGP-008` · **Version**: 1 · **Checks**: `G-05`, `G-05d`

Where each kind of artifact lives, and which standard governs its content. One artifact type, one
location — two locations is two places to look and one place to forget.

This document **reconciles** the layout proposed in the source enhancement document with the
structure this repository already uses. Where they differ, the existing structure wins for now and
the difference is recorded below as a proposal. Migrating 65 tracked files to make a document tidy
is how cross-references break.

## Artifact location map

| Artifact type | Location | Governing standard | Status |
|---|---|---|---|
| Constitution | `.specify/memory/constitution.md` | itself | current |
| Repository templates | `.specify/templates/` | `PMI-DOC-000` §4 (D-16) | current |
| Spec Kit commands | `.claude/skills/` | Spec Kit | current |
| Source requirements (SRS) | `SRS/` | `PMI-DOC-000` | current |
| Epic specification | `specs/<epic>/spec.md` | `PMI-DOC-000` §4 | current |
| Epic plan | `specs/<epic>/plan.md` | `document-structure.md` | current |
| Epic task list | `specs/<epic>/tasks.md` | `document-structure.md` | current |
| Epic research | `specs/<epic>/research.md` | `document-structure.md` | current |
| Epic artifact model | `specs/<epic>/data-model.md` | `document-structure.md` | current |
| Interface contract | `specs/<epic>/contracts/` | `document-structure.md` | current |
| Quickstart / validation guide | `specs/<epic>/quickstart.md` | `document-structure.md` | current |
| Requirements checklist | `specs/<epic>/checklists/` | Spec Kit | current |
| Defect record | `specs/<epic>/defects/` | Constitution VI | current |
| Epic closure report | `specs/<epic>/closure.md` | `closing-report.md` | current |
| Cross-epic shared design | `specs/_shared/` | `PMI-DOC-000` | current |
| Decision register | `specs/srs-alignment.md` | `PMI-DOC-000` §5 | current |
| Epic index and build order | `specs/README.md` | — | current |
| Architecture decision record | `adr/` | `PMI-DOC-000` §9 | current |
| Governance artifact | `governance/` | this epic | current |
| Steering file | `governance/steering/` | `steering-file-format.md` | current |
| Governance conformance check | `tests/governance/` | Constitution V | current |
| Architecture test | `backend/tests/architecture/` | Constitution V | current |
| Backend service | `backend/src/` | `coding-standards.md` | current |
| Worker | `worker/src/` | `coding-standards.md` | current |
| Engine contract | `packages/engine-contract/` | `ADR-0001` | current |
| Engine adapter | `engine-adapters/<name>/` | `ADR-0001` | current |
| Database schema | `backend/prisma/` | `_shared/data-model.md` | current |
| CI workflow | `.github/workflows/` | — | current |
| Knowledge base | `knowledge/` | — | proposed, not applied |

## Spec Kit folder mapping

Spec Kit's own conventions and this repository's structure agree on the essentials and differ on
naming. The mapping:

| Spec Kit concept | This repository | Note |
|---|---|---|
| Feature directory | `specs/<nnn>-<slug>/` | One directory per **epic**, not per feature. Features are `F-<epic>.<n>` sections inside `tasks.md`. |
| `spec.md`, `plan.md`, `tasks.md` | same names | unchanged |
| Memory | `.specify/memory/` | constitution only |
| Templates | `.specify/templates/` | governed by `PMI-DOC-000`, not by Spec Kit defaults (D-16) |
| Active feature pointer | `.specify/feature.json` | set per session |

The one substantive divergence: Spec Kit's "feature" maps to this programme's **epic**. That was a
deliberate choice — MPS Volume 6 §1 places epics below modules, and one directory per feature would
have produced several hundred directories. It is recorded here because the vocabulary mismatch is
otherwise a standing source of confusion.

## Proposed migrations

Everything in this section is **proposed, not applied**. Nothing below has been executed by this
epic, and no path in the map above has moved.

| Proposal | Current | Proposed target | Blocked by |
|---|---|---|---|
| Knowledge base directory | — | `knowledge/` | M-10 capability scope; no owning epic yet |
| Module-aligned spec grouping | `specs/<nnn>-<slug>/` flat | grouped under module | **D-13** |
| Typed requirement identifiers | `FR-###`, `FR-RGP-###` | `REQ-nnnn` per `PMI-DOC-000` §3 | **D-1**, **D-9** |
| Thirteen-section templates | current template sections | `PMI-DOC-000` §4 structure | **D-4** — see [`template-conformance.md`](./template-conformance.md) |

Each proposal is recorded **before** any migration executes (`SC-RGP-005`). A migration discovered
after the fact is a broken cross-reference discovered by someone else.

## D-13 dependency

Decision **D-13** — the deferred re-cut of the epic set into 18 modules — touches the same paths
this document maps. It is recorded in
[`specs/srs-alignment.md`](../specs/srs-alignment.md) and remains **open**.

**No module-path change is applied by this epic.** `FR-RGP-008` requires this document to record the
dependency rather than resolve it, and the temptation runs the other way: it is natural to tidy
module paths while writing a layout document, and doing so would silently pre-empt a decision that
was deferred on purpose.

Paths both decisions touch:

- `specs/<nnn>-<slug>/` — every epic directory. D-13 would regroup these under module directories.
- `specs/README.md` — the epic index and build order, which D-13 would rewrite.
- `specs/_shared/` — shared design, which D-13 may split per module.
- Every relative link from `specs/<epic>/**` into `../_shared/` and `../../adr/`.

That last one is the reason to be careful. A relative link is only as stable as the depth of the
file holding it, and this repository has already broken 16 of them once by moving checklists one
level deeper without updating `../_shared/` to `../../_shared/`. A module re-cut changes the depth
of every epic directory at once.

## Paths that must not break

Every path below is referenced by other tracked files. Any re-cut must update every reference in the
same change, and check `G-05d` compares this list against the directories actually on disk — so a
path added or removed without updating this document fails the build.

- `specs/_shared/`
- `specs/srs-alignment.md`
- `specs/README.md`
- `adr/`
- `.specify/memory/constitution.md`
- `.specify/templates/`
- `specs/001-platform-foundation/`
- `specs/002-team-review-access-storage/`
- `specs/003-specification-engine/`
- `specs/004-workspace-tenancy-audit/`
- `specs/005-identity-signin/`
- `specs/006-project-management/`
- `specs/007-requirement-intelligence/`
- `specs/008-spec-authoring-generation/`
- `specs/009-spec-lifecycle-versioning/`
- `specs/010-specification-interface/`
- `specs/011-traceability/`
- `specs/012-workflow-tasks/`
- `specs/013-engine-api-selection/`
- `specs/014-devops-release/`
- `specs/015-qa-validation/`
- `specs/016-architecture-decision-records/`
- `specs/017-enhancement-model/`
- `specs/018-repository-governance/`
- `specs/019-steering-engine/`
- `specs/020-living-specifications/`
- `specs/021-review-gates-roles/`
- `specs/022-product-traceability/`
- `specs/023-unattended-runs-review/`
- `specs/024-artifact-access-control/`
- `specs/025-external-storage-publishing/`

## Deliberately not covered here

- **What each document must contain** — [`document-structure.md`](./document-structure.md) and
  [`template-conformance.md`](./template-conformance.md).
- **Which links between artifacts are required** — [`traceability-convention.md`](./traceability-convention.md).
- **The standards applying to code in these directories** — [`steering/`](./steering/).
