# DEF-032-006 — the loop declares an Evidence seam and nothing reads it

**Epic**: `EPIC-032` | **Raised**: 2026-10-08 | **Status**: DEFERRED to `EPIC-030`
**Found by**: `T1796` (convergence) · **Severity**: HIGH — no governed transition can reach `satisfied` on an evidence gate

## Finding

`packages/loop-contract` declares `EvidenceProvider` — *"Filled by EPIC-032. Absent ⇒ the Evidence
stage cannot be configured in"* — and `backend/src/modules/loop/loop.tokens.ts` declares
`LOOP_EVIDENCE_PROVIDER`, `LOOP_POLICY_PROVIDER` and `LOOP_GATE_PROVIDER`. **`LoopService`
injects none of them.** Its constructor takes a store, a config registry, authorities, an audit
sink and two resolvers, and `transition()` calls the writer with **`gates: []`**.

`TransitionWriter` evaluates the **declared** gates against what was reported (`FR-GEL-021`), so
every transition whose configuration requires `requirement-room.evidence-complete`,
`change-room.evidence-complete` or `defect-room.evidence-complete` resolves that gate to
`violation` and refuses. That is the safe direction — the loop fails closed — but it means the
Evidence stage is reachable only by an authorised exception, whatever evidence exists.

## Why not fixed here

Binding an `EvidenceProvider` adapter to `LOOP_EVIDENCE_PROVIDER` would be a binding nothing reads —
the *built, tested, called by nothing* defect this repository has recorded six times. The seam has
to be **consumed** first: `LoopService` (or a `GateProvider` the loop calls) must ask for gate
outcomes, and an `evidence-complete` gate should then be answered from `CompletionGate.evaluate`.
Both halves of that change are in `EPIC-030`'s module; `EPIC-032`'s half is a small adapter once the
call exists.
