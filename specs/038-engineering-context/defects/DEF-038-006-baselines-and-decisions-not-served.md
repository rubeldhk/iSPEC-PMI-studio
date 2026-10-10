# DEF-038-006 — baselines and decisions cannot enter the corpus

**Epic**: `EPIC-038` | **Raised**: 2026-10-08 | **Status**: DEFERRED to `EPIC-033` and the decisions owner
**Originating task**: `T1828` (convergence finding against `FR-CTX-015`, `FR-CTX-011`) · **Severity**: MEDIUM

## Finding

`FR-CTX-015`'s approved source set is specifications, requirements, baselines and decisions, and
execution history. `sources.adapter.ts` now serves three of the five through their owners' public
services: requirements (`RequirementsService`), specifications (`SpecificationsReadService`) and,
since `T1828`, execution history (`EPIC-037`'s projections). **Baselines** and **decisions** are
served by nothing: `read` returns `null`, `reindex` refuses them as *does not resolve*, and their
current version answers *unknown*.

## Why deferred

- **Baselines** belong to `EPIC-033`. Its `BaselineService` records a baseline as member version ids
  and a set hash; there is no read of one baseline's text or current version for a caller. The same
  gap as `DEF-038-003`, from the other side.
- **Decisions** are split between `EPIC-016` (architecture decision records) and `EPIC-031`
  (decision & policy outcomes, on its own branch). Which of them is the governed *decision*
  `FR-CTX-015` means is not settled in either Epic, and indexing the wrong one would put material
  in packages under a classification nobody chose.

When either owner exposes a read of one version's text and its current version, adding it to
`sources.adapter.ts` is a branch per type, in the shape the other three already have.
