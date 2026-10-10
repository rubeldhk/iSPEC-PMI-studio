# DEF-032-003 — which artifact types EPIC-024 governs is known by convention, not declared

**Epic**: `EPIC-032` | **Raised**: 2026-10-07 | **Status**: DEFERRED to `EPIC-024`
**Originating task**: `T859j` · **Severity**: MEDIUM

## Finding

`FR-EVS-015` requires evidence reads to honour the attested artifact's access rules. `EPIC-024`'s
rule is strict — *no grants means nobody* — and is applied today to `specification` and `project`.
Evidence also attests things with no grant model (a file at a commit, a build), and applying the
strict rule to those would refuse every read. `backend/src/modules/evidence/access.adapter.ts`
therefore carries `ACCESS_GOVERNED_TYPES = {specification, project}`, found by reading the call
sites, and applies the workspace boundary to everything else.

## Why deferred

The list of grant-governed types is `EPIC-024`'s to declare. When `EPIC-024` exports it, the
adapter should import it rather than restate it — a duplicated list agrees only on the day it is
written. Until then a newly governed type is readable through evidence by anyone in the workspace.
