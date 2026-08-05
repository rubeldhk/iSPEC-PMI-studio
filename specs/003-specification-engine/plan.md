# Implementation Plan: Specification Engine & Sandbox

**Epic**: `EPIC-003` | **Module**: M-08 | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Tasks**: 35 · [tasks.md](./tasks.md) | **Posture**: ▶ **PROCEEDING** (decision D-10)

**Shared design** — not duplicated here: [`../_shared/`](../_shared/)
([engine contract](../_shared/contracts/specification-engine.md) ·
[system-design](../_shared/system-design.md) · [research](../_shared/research.md) ·
[RAID](../_shared/raid-log.md)) · **ADRs**: [ADR-0001](../../adr/ADR-0001-spec-kit-behind-engine-adapter.md),
[ADR-0002](../../adr/ADR-0002-container-sandbox-for-engine-execution.md)

## Summary

The architectural centre of the programme. One contract, two adapters, and a sandboxed runtime for
executing an AI coding agent.

This is where *"Treat Spec Kit as Engine V1, not the product"* becomes true or false — and where the
hardest unknown lives. **This is the epic worth building first for what it teaches**, not for what
it ships.

## Scope

| Function | Tasks | What it delivers |
|---|---|---|
| F-08.1 Engine contract | 2 | `SpecificationEngine`, `EngineResult`, failure reasons |
| F-08.2 Registry and capability validation | 4 | Registration refused if a Phase 1 capability is missing |
| F-08.3 Engine resolution and selection | 5 | Per-project resolution; Spec Kit registered as default |
| F-08.4 Fixture adapter | 2 | Deterministic engine with injectable failures |
| F-08.5 Conformance suite | 3 | 13 cases, run against **every** adapter |
| F-08.6 Spec Kit sandbox | 6 | Engine image, sandbox constraints, ephemeral workspace |
| F-08.7 Spec Kit invocation and parsing | 5 | The five-step sequence; descriptor versioning |
| F-08.8 Architecture enforcement | 4 | Build fails on a Spec Kit reference in `backend/`, or an HTTP type in a service |

**Excluded**: F-08.9 engine API and selection UI — split into **EPIC-013** because it touches
`projects.controller.ts` and therefore the held product surface.

## Technical Context

Inherited from [`../_shared/plan.md`](../_shared/plan.md). Specific to this epic:

**The engine is not a service call.** Per research R-001, verified against the official
documentation: `specify` only *scaffolds*; the `/speckit-*` commands are prompt templates executed
by an AI coding agent. Generation means orchestrating an external, non-deterministic, long-running
process inside a container.

**The contract takes plain data.** `GenerateSpecificationInput` carries `RequirementInput[]`, not
database entities. This is why the epic is buildable with **zero product surface** — and it is the
property that made the D-10 split possible at all.

**Sandbox posture** (ADR-0002): one container per job, destroyed after; non-root; read-only root
filesystem except the scratch workspace; CPU, memory, and wall-clock caps; egress restricted to the
AI provider endpoint; no platform credentials mounted.

## Constitution Check

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | PASS — via [platform-spec](../_shared/platform-spec.md) |
| III | Epic → Feature → Task decomposition | PASS — 8 functions, 35 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS |
| V | Every implementation task carries a unit test, written to fail first | PASS — 0 gaps |
| VI | `specs/003-specification-engine/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS |
| — | Repository synced from GitHub before work | PASS |
| — | No other Claude session on this checkout | PASS — asserted by the operator |
| — | Principle register present, deferrals argued (D-6) | PASS — **PP-006 satisfied here for the whole platform** |
| — | Design constraints honoured (PC-1, PC-2) | PASS — PC-2 cost containment ships here as job caps; PC-1 enforced by T142a *(in EPIC-001's arch suite)* |

**Post-design re-check**: PASS. Constitution V is *strengthened* by this epic — the fixture adapter
makes engine-dependent logic across the whole platform unit-testable without invoking a live AI
agent.

## Build order — fixture first, deliberately

```text
F-08.1 contract
   └─► F-08.4 fixture adapter ──► F-08.5 conformance suite (13 cases, green against fixture)
          └─► F-08.2 registry ──► F-08.3 resolution + default
                 └─► F-08.6 sandbox ──► F-08.7 invocation ──► conformance green against Spec Kit
                        └─► F-08.8 architecture enforcement
```

**The fixture adapter is built before the real one on purpose.** It makes the contract, the registry,
the conformance suite, and every downstream consumer provably correct **before** the container
sandbox — the slowest, most expensive, least certain component — exists. If the sandbox work
overruns, everything above it is already done and tested.

It also means the conformance suite is written against an engine whose behaviour is fully
controllable, so a red test means the *contract* is wrong, not the AI agent.

## Risks carried by this epic

Both top-scoring risks in the RAID log live here.

| Risk | Score | How this epic handles it |
|---|---|---|
| **R-01** Spec Kit or model output drifts, breaking the parser | 9 | Pin Spec Kit and agent versions in the image; store raw output verbatim so a parser fix needs no re-run; `descriptor.version` records **both** tool and model (T091a) |
| **R-02** AI agent cost unbounded per job | 9 | Hard wall-clock, CPU, and memory caps in the container (T089). This is PC-2 cost *containment* — optimisation is deferred to M-07 |
| **R-04** Container-in-container makes CI unreliable | 4 | Conformance runs against the fixture in CI; the real engine runs **nightly only** (EPIC-015 T146) |
| **R-05** Engine independence erodes under delivery pressure | 6 | T047/T142 fail the build, not a review |
| **R-06** Sandbox escape or credential leakage | 3 | ADR-0002 controls; T086 asserts teardown on **every** terminal outcome |

## Design notes specific to this epic

**Adapters return failures; they do not throw.** `EngineResult` is a discriminated union. This is
what makes the failure taxonomy enforceable rather than dependent on exception hygiene — and it is
rule E2 in the contract.

**Two failures are detected *before* work starts**: `empty_selection` and `input_too_large`. The
spec requires oversized input to be rejected up front rather than after a failed, billed run.

**`descriptor.version` must change when either the Spec Kit release or the AI model changes.** Same
Spec Kit with a different model produces different output, so treating them as one version would
make FR-022 provenance misleading. Asserted by T091a.

**Teardown is asserted on every terminal outcome**, not just success — success, failure, timeout,
and cancellation all leave no container, process, or temporary directory (contract rule E8, T086).

## Phase 1 Outputs

Implements existing shared artifacts; adds none:

- [`../_shared/contracts/specification-engine.md`](../_shared/contracts/specification-engine.md) —
  the contract, failure taxonomy, adapter rules E1–E10, and the 13-case conformance suite
- [`../_shared/system-design.md`](../_shared/system-design.md) — sandbox security design, dependency rule
- [`../_shared/research.md`](../_shared/research.md) — R-001 invocation, R-006 sandbox, R-007 parsing, R-009 enforcement

## Definition of done

- [ ] 35 tasks complete, every unit test passing (Constitution V)
- [ ] **Conformance suite green against both adapters** — 13 cases each
- [ ] `pnpm test:arch` green — no Spec Kit reference anywhere in `backend/src`
- [ ] Quickstart **V11** (engine independence) passes: switch a project to the fixture engine,
      generation succeeds, an adapter missing a capability is refused by name
- [ ] Quickstart **V13** (real-engine smoke) passes at least once — sandbox scaffolds, runs the
      agent headlessly, parses output, and **leaves nothing behind**
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
