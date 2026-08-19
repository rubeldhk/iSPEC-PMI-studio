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
| Convergence `T445`, `T446` | **done 2026-08-17** | see *Addendum* below |
| Convergence `T664`, `T665` | **done 2026-08-17** | `DEF-018-001`; `pnpm test:governance` 184 passed |
| Convergence `T666` | **not done** | `V18-6` needs a reader new to the programme; owner project-owner |

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
| ~~`T445` — the two human walkthroughs~~ | ~~project-owner~~ | ✅ **Discharged 2026-08-17** — `V18-5` performed; `V18-6` split to `T666`. See *Addendum* |
| ~~`T446` — ownership of `tsconfig.json` + `typecheck:governance`~~ | ~~tech-lead~~ | ✅ **Decided 2026-08-17 — keep in EPIC-018.** See *Addendum* |
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

---

# Addendum — 2026-08-17 · `T445`, `T446` and what `V18-5` found

**Session**: `EPIC-018 Repository Governance` · **Branch**: `epic/003-specification-engine` ·
**Date**: 2026-08-17

> **Constitution VIII deviation, again.** This addendum was written on
> `epic/003-specification-engine`. That is the **fifth** occurrence, and the third recorded in this
> file's lineage. `G-08` passed throughout because it checks the *format* of a branch name, not
> whether it names the epic being worked. **Decision `D-39` should now simply be taken.**

## V18-5 · Templates are checked against `PMI-DOC-000` — **PERFORMED, and it failed**

The scenario's own warning: *"This output is the evidence for decision D-4 … If the record does not
make D-4 answerable, the record is incomplete."*

**It did not.** Reading `governance/template-conformance.md` against the four templates it measures,
**ten cells claimed `Present` for a section the template does not contain in any form** — including
"Related Documents", claimed for all four templates and true of none of them as originally written.

| | `spec-template.md` conformance |
|---|---|
| As the record read | 9 of 13 present |
| Actually | **3** present under their own name, 1 inline equivalence, 9 absent |

**Why `G-06` was green throughout.** It asserts *"a reason for every **absence**"*. A cell reading
`Present` was never compared to the template. Its own header said so — *"Note what this does NOT
assert: that the templates have the thirteen sections"* — a note written to explain why the epic
does not perform the D-4 migration, which also left the positive half of every claim unverified.

**This is the same failure shape as `DEF-001-001`, found the same day in a different epic**: a check
that verifies one half of a claim and is read as verifying both. Two independent instances in one
day is a pattern worth naming rather than two coincidences.

**Fixed rather than merely reported** (`T664`, `T665`): `G-06` now resolves every bare `Present`
against the template's real headings, and the record is corrected to version 2 with a measured-gap
table. An explicitly qualified equivalence — `Present — as the Technical Context Constraints field`
— is still accepted, because `## Summary` really is an executive summary and forcing a rename would
be conformance theatre.

**Mutation-tested**: reverting one corrected cell to a bare `Present` fails the check and names the
exact cell.

**D-4 is still open and still the product owner's call.** This corrected the evidence; it did not
take the decision. The recommendation in the record stands, and is now supported by true numbers.

## V18-6 · A newcomer can find the standards — **NOT PERFORMED**

The scenario says what it needs: *"Give someone unfamiliar with the programme the repository root
and nothing else"*, and *"'Can someone new find this?' is answered by someone new, not by a script."*

**This session is not a newcomer** — it has read the constitution, the governance index, the steering
files and `srs-alignment.md`. Any walkthrough it performed would measure recall, not discoverability,
and its failure signal (*"if they navigate by searching the file tree rather than by following the
index, the index has failed"*) cannot be observed from the inside.

Split out as **`T666`**, owner **project-owner**. **`SC-RGP-001` and `SC-RGP-007` remain unverified**
— exactly as the original closing report recorded, and this addendum does not change that.

A structural proxy was run and is reported as a proxy, not as the scenario: `governance/README.md`
answers each of the three questions in one hop, and the ten steering subjects in
`governance.config.json` each resolve to a file. **That proves the index is complete. It does not
prove it is findable**, which is the whole of what `V18-6` asks.

## T446 · Ownership of `tests/governance/tsconfig.json` and `typecheck:governance`

**DECIDED: keep both in EPIC-018.** Revisit when EPIC-014 unblocks and consolidates CI configuration,
or when a second non-package tsconfig appears.

| | Argument |
|---|---|
| **For keeping** | The tsconfig exists *because* the checks live outside every workspace package, so `pnpm -r typecheck` cannot reach them. It is part of the check artifact, not part of the pipeline — and the checks are this epic's product |
| **For keeping** | **EPIC-014 is held on `PMI-DOC-004`.** Transferring a live, load-bearing asset to a held epic parks it: nobody could act on it until the BRS lands. That is the decisive argument |
| **For keeping** | The seam is already in the right place. The CI *step* lives in `.github/workflows/ci.yml` and is EPIC-014-shaped whenever EPIC-014 claims it. What stays here is only what makes the checks runnable at all |
| **Against** | EPIC-014 owns CI and release; two owners of CI-adjacent configuration is a seam that can drift |

**Evidence from this session**, which is why the decision is taken now rather than deferred again:
the governance suite ran **nine times today across two epics** and caught two real regressions — an
unmapped Vitest project (`T537`) and the ten overstated conformance cells. A suite that active
belongs with the epic that maintains it, not with one that cannot yet be worked.

## Verified — 2026-08-17

| Gate | Command | Result |
|---|---|---|
| Governance checks | `pnpm test:governance` | **184 passed**, 12 files (was 183; `T664` adds one) |
| Governance typecheck | `pnpm typecheck:governance` | pass |
| Unit tests | `pnpm test:unit` | **506 passed**, 46 files |
| Architecture tests | `pnpm test:arch` | **22 passed** |
| Lint · package typecheck | `pnpm lint` · `pnpm -r typecheck` | pass, 0 warnings · pass, 12 packages |

`T664` was **confirmed red before the record was corrected** — it reported all ten overstated cells
by name — and **mutation-tested afterwards**.

## Not verified — 2026-08-17

- **`V18-6` was not performed.** `SC-RGP-001` and `SC-RGP-007` remain unverified by the human test.
  The structural proxy above is not a substitute and is not counted as one.
- **The integration suite was not run** — no container runtime on this machine. Not this epic's gate.
- **CI has not run.** Every gate above was executed locally.

## Deferred — restated as of 2026-08-17

| Item | Owner | Awaiting |
|---|---|---|
| `T666` — the `V18-6` newcomer walkthrough | project-owner | a reader new to the programme |
| `governance/steering/business-rules.md` content | product-owner | `PMI-DOC-004` |
| UI standards specifics | product-owner | SRS Volume 8 |
| Decision **D-4** | product-owner | now answerable on corrected evidence |
| Decisions **D-1**, **D-2**, **D-9**, **D-13** | as registered | unchanged |
| Decision **D-39** | project-owner | nothing — five occurrences is enough |

`T445` and `T446` are **no longer deferred**. `T666` replaces `T445`'s unperformable half.

## Epic status

**34 of 35 tasks complete.** The one open task, `T666`, is explicitly deferred to a named owner —
which Constitution IV permits as an alternative to no remaining work. **EPIC-018 is
release-eligible**, with `SC-RGP-001` and `SC-RGP-007` stated as unverified rather than assumed.

---

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
