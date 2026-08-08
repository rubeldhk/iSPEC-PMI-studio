# Closing Report: EPIC-018 Repository Governance Process

**Session**: `EPIC-018 Repository Governance` · **Branch**: `epic/018-repository-governance` ·
**Date**: 2026-08-07 (committed 2026-08-08)

Written against [`governance/closing-report.md`](../../governance/closing-report.md), the format
this epic defines. Tasks `T407`–`T410` are discharged by the sections below.

## Work Completed

**32 of 34 tasks complete.** The 31 planned tasks (`T312`–`T336`, `T407`–`T410`, `T433`, `T434`)
plus `T444` from convergence. Two remain open and are named under *Deferred*.

| Task group | Outcome | Evidence |
|---|---|---|
| F-18.1 steering files (`T312`–`T320`, `T433`, `T434`) | done | 10 files under `governance/steering/`, 1 config; checks `G-01`–`G-04b`, `G-07` |
| F-18.2 layout (`T321`–`T326`) | done | `governance/repository-layout.md`, `governance/README.md`; checks `G-05`, `G-05b`, `G-05d` |
| F-18.3 templates (`T327`–`T331`) | done | `template-conformance.md`, `document-structure.md`, `traceability-convention.md`; checks `G-06`, `G-06b`–`G-06d` |
| F-18.4 process artifacts (`T332`–`T335`) | done | `session-labelling.md`, `closing-report.md`; checks `G-08`, `G-09` |
| Phase Z closure (`T336`, `T407`–`T410`) | done | CI step wired; this document |
| Convergence `T444` | done | `G-02b` version-increment check |
| Convergence `T445`, `T446` | **not done** | see *Deferred* |

The epic produced **26 files**: 10 steering files plus a register index, 6 governance documents, 1
configuration file, 9 check suites and a tsconfig. Requirement coverage is 16 of 16 functional
requirements, and 7 of 9 success criteria by executable check.

### The design decision that shaped the epic

Constitution V requires a unit test per task, and this epic produces **documents, not application
code**. The plan's reading B resolved this: verification is an executable *conformance check* rather
than a unit test. Every artifact task is paired with a check that fails when the artifact drifts
from its governing standard — because a governance document no check reads is a document that
silently rots.

That reading is only honest if the checks can actually fail. See *Verified* below.

## Verified

Every gate CI runs, executed locally:

| Gate | Command | Result |
|---|---|---|
| Package typecheck | `pnpm -r typecheck` | pass — 4 packages |
| Governance typecheck | `pnpm typecheck:governance` | pass |
| Lint | `pnpm lint` | pass, 0 warnings |
| Unit tests | `pnpm test:unit` | **132 passed**, 16 files |
| Architecture tests | `pnpm test:arch` | **9 passed** |
| Contract tests | `pnpm test:contract` | no test files, exit 0 (expected — `--passWithNoTests`) |
| Governance checks | `pnpm test:governance` | **159 passed**, 9 files |

**Checks were written before the artifacts and confirmed red first**: 14 failing across 8 files
before any governance document existed.

**The two highest-value checks were mutation-tested**, because a check that cannot fail is
indistinguishable from no check:

- `G-04` (no duplication) — a real 16-word run from the constitution was pasted into
  `steering/security.md`. The check failed, naming the file and the duplicated shingle.
- `G-05d` (D-13 path guard) — `specs/012-workflow-tasks/` was removed from the protected-path list.
  The check failed, naming the unregistered directory.

Both mutations were reverted and the suite returned to green.

**`G-02b` currently skips all ten files.** It compares each steering file against its last committed
state, and these files are not yet committed, so there is no baseline. That is a skip, not a pass,
and it becomes live on the first commit.

## Not verified

- **`SC-RGP-001` and `SC-RGP-007`** — the `V18-5` and `V18-6` walkthroughs in
  [quickstart.md](./quickstart.md). Neither can be automated: one needs a reader new to the
  programme, the other is a judgement about whether a single index answers the question. The design
  acknowledged this rather than writing a check that pretends to test it.
- **The CI step itself has not run.** `pnpm test:governance` and `pnpm typecheck:governance` were
  verified locally; the `.github/workflows/ci.yml` step is wired but unexecuted until the next push.

## Deferred

| Item | Owner | Awaiting |
|---|---|---|
| `T445` — the two human walkthroughs | project-owner | a reader new to the programme |
| `T446` — ownership of `tsconfig.json` + `typecheck:governance` | tech-lead | a decision: keep here, or transfer to EPIC-014 with the rest of CI |
| `governance/steering/business-rules.md` content | product-owner | `PMI-DOC-004` — recorded as a gap with `status: awaiting-input`, not invented |
| UI standards specifics | product-owner | SRS Volume 8 |
| Decisions **D-1**, **D-2**, **D-4**, **D-9**, **D-13** | as registered | surfaced by this epic, deliberately not settled by it |

**On D-4 specifically**: [`template-conformance.md`](../../governance/template-conformance.md)
enumerates the gap between the four templates and `PMI-DOC-000` §4, with a reason and an owner for
every absence. That record is the evidence D-4 needs. A recommendation is stated there; the call is
the product owner's, not this epic's.

## Constitution and principle conformance

| Principle | Verdict |
|---|---|
| I Spec Kit Command Gate | pass — executed via `/speckit-implement`; `governance/**` recorded as **not exempt** in the index |
| II SRS as Source of Truth | pass — `PMI-DOC-000` §4 extracted from the source document, not invented |
| III Epic → Feature → Task | pass — 4 features, 31 tasks, 1 closure phase |
| IV Convergence Gate | pass — `/speckit-converge` run; 3 findings, 3 tasks appended, 1 closed |
| V Mandatory Unit Tests | pass under reading B — 159 executable conformance checks |
| VI Defect Traceability | pass — `specs/018-repository-governance/defects/` is empty; zero defects raised |
| VII Promotion Pipeline | not applicable — no deployable artifact |
| VIII Session Labelling | pass, with one exception below |
| IX Mandatory Closing Report | pass — this document |

**Principle deltas hold**, and every deferral above retains a valid owner (decision **D-6**).

### One deviation, corrected before commit

**Constitution VIII**: the work was *carried out* on `epic/001-platform-foundation`, not on
`epic/018-repository-governance`. I intended to branch at the start of the session and did not.
`G-08` still passed throughout, because the old branch matched the published regex — it just named
the wrong epic, which is a limitation of the check worth knowing: it verifies the *format* of a
branch name, not that the name matches the epic being worked on.

Corrected at commit time: `epic/018-repository-governance` was created before anything here was
committed, so the permanent record is right. The deviation is left recorded rather than deleted —
a report that quietly erases its own findings once they are fixed is the pattern
[`closing-report.md`](../../governance/closing-report.md) exists to prevent.

## Recommended Next Task

**Push this epic.** The branch is created and the work is committed; `G-02b` activates with that
commit, having been inert while these files had no baseline to compare against.

**Then: EPIC-004 `T013` and `T052`** — the Prisma migration and the cross-workspace integration
test. Both are open, both are small, and `T013` was previously marked complete in error and
reverted. They are the only unfinished work in an otherwise closed foundation epic, and leaving two
loose ends in the layer everything else builds on costs more later than it does now.

**Not** a new epic. Every remaining Wave 1 candidate is either held on `PMI-DOC-004` (141 tasks
across the EPIC-002 family and others) or is a parent design with no tasks by intent. EPIC-018 was
the last substantial epic buildable without the BRS — so the honest statement of the programme's
position is that **the critical path now runs through `PMI-DOC-004`, not through engineering**.
Chasing another epic would mean building on invented business rules, which is the failure
[`steering/product.md`](../../governance/steering/product.md) `PRD-002` exists to prevent.
