# DEF-038-001 — requirements, baselines, decisions and execution history carry no grant model

**Epic**: `EPIC-038` | **Raised**: 2026-10-08 | **Status**: DEFERRED to `EPIC-024`
**Originating task**: `T1258` · **Severity**: MEDIUM

## Finding

`FR-CTX-054` puts adjudication with `EPIC-024`, and `R-038-7` says the workspace partition is not
the permission. `EPIC-024` keys grants by `specification` and `project` only. The approved source
set (`FR-CTX-015`) also includes requirements, baselines, decisions and execution history, which no
grant can be held on today. Applying the strict rule (*no grants means nobody*) to them would
exclude every one from every package, permanently.

`backend/src/modules/context/access.adapter.ts` therefore carries
`ACCESS_GOVERNED_TYPES = {specification, project}` and, for the other types, permits an actor that
`WorkspaceBoundaryService` confirms is inside the requesting workspace. For those types the
permission is, in practice, workspace membership — the conflation `R-038-7` warns about, accepted
here because the alternative is a feature that can never include its own material.

The same position `EPIC-032` took for evidence (`DEF-032-003`).

## Why deferred

Which artifact types carry grants is `EPIC-024`'s to declare, and extending its grant model to
requirements and decisions is its scope, not this Epic's (`FR-CTX-054` forbids a second model).
When `EPIC-024` exports the list, the adapter should import it rather than restate it. Until then a
member of the workspace may receive any ungoverned approved source in a package.
