# DEF-038-003 — no reader answers "is this source version still authoritative?"

**Epic**: `EPIC-038` | **Raised**: 2026-10-08 | **Status**: DEFERRED to `EPIC-033`
**Originating task**: `T1250` (found during `T1299`) · **Severity**: MEDIUM

## Finding

`ProvenanceService` (`T1250`) was implemented and unit-tested, and then **never called**. Every
assembled item was stamped `undetermined` with the reason *"provenance resolution is not yet
bound (T1250)"*, which is honest about the item and was false about the task: `T1250` was ticked.

Assembly now resolves every kept item through `ProvenanceService` before anything is written
(`backend/src/modules/context/assembly.service.ts`, `#provenance`), and
`backend/tests/unit/context-provenance.spec.ts` requires superseded, current, execution-history and
malformed answers to reach the stored items. That half is closed.

The other half is not. `ProvenanceService` needs a `BaselineReaderPort` answering, for one source
version, *current / superseded by X / unknown*. `EPIC-033`'s `BaselineService` records baselines as
member version ids and a set hash, and exposes no such query. Deriving it here — walking baselines
to find which one contains a version and whether it was superseded — would be a second reader of
`EPIC-033`'s semantics, which `R-038-5` and `FR-CTX-054`'s reasoning both refuse.

So `context.module.ts` binds `provenance: null`, and every item in the running application is
`undetermined` with a reason naming `EPIC-033`. Never `current` by default (`FR-CTX-044`).

## Why deferred

The query belongs to the Epic that owns baselines. When `EPIC-033` exposes a version-status read,
an adapter to `BaselineReaderPort` is a few lines in `context.module.ts`, and `SC-CTX-002`'s
provenance half becomes observable in the deployment rather than only under test.
