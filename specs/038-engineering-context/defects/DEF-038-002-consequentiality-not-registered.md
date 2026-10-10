# DEF-038-002 — EPIC-037's registration records no consequentiality

**Epic**: `EPIC-038` | **Raised**: 2026-10-08 | **Status**: DEFERRED to `EPIC-037`
**Originating task**: `T1266` · **Severity**: MEDIUM

## Finding

`FR-CTX-061` requires *consequential* to be derived from the session's registration (Constitution
XII, `EPIC-037`) and forbids this Epic from deciding it. `EPIC-037`'s `ExecutionSnapshot` carries
`command`, `surface`, `assurance`, `lifecycleState` and `governanceState`, and nothing that says
whether a session was consequential.

`backend/src/modules/context/context.module.ts` therefore reports a registered execution as
`registered: true, consequential: 'undetermined'` with a reason naming this record. Inspection is
available for every package regardless, so `FR-CTX-060` (a reviewer can inspect a consequential
session's context) holds; what is missing is the label.

## Why deferred

Deriving consequentiality from `command` or `assurance` here would be the second registry of what
matters that `FR-CTX-061` exists to prevent. `EPIC-037` owns the registration; when it records the
determination, the adapter in `context.module.ts` reads it and this record closes.
