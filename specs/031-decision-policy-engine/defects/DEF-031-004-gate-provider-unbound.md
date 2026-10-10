# DEF-031-004 — no GateProvider is bound, so every required gate is a violation

**Epic**: `EPIC-031` | **Raised**: 2026-10-08 | **Status**: DEFERRED to `EPIC-021`
**Originating task**: `T737`, `T777` · **Severity**: HIGH

`EPIC-021`'s gates are evaluated per review session and expose no *"evaluate gate G for this action
on this object"* call. Binding one would be guessing at semantics nobody declared, so
`DECISION_GATE_PROVIDER` is `null` and every required gate resolves to `violation` — the declared,
fail-closed behaviour (`FR-DPE-013`). Consequence: a **medium**-band action is refused unless a gate
exception is recorded, until `EPIC-021` publishes the call. `EPIC-032`'s Evidence Contracts would
arrive through the same provider.

The same shape as `EPIC-032`'s `DEF-032-006`: the substrate's seams are declared on both sides and
connected on neither.
