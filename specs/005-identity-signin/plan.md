# Implementation Plan: Identity & Sign-in

**Epic**: `EPIC-005` | **Module**: M-01 | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Tasks**: 15 · [tasks.md](./tasks.md) | **Posture**: ⏸ **HELD** (decision D-10)

**Shared design** — not duplicated here: [`../_shared/`](../_shared/)
([platform-spec](../_shared/platform-spec.md) · [system-design](../_shared/system-design.md) · [data-model](../_shared/data-model.md) · [schema](../_shared/schema.sql) · [platform-api](../_shared/contracts/platform-api.md)))

> ## ⚠️ Retroactive plan
>
> `tasks.md` predates this plan — these tasks were generated in the 2026-08-03 decomposition and
> never passed a Constitution Check. This plan records the technical context they assumed and
> **reviews the existing task list**. It is one of eleven written on 2026-08-07 to close finding
> **C3**, and it adds no design: everything this epic needs already exists in `_shared/`.

## Summary

Session-based sign-in behind an identity-provider boundary, plus the web client that consumes it.
Deliberately minimal — the boundary exists so Phase 3 SSO replaces an adapter rather than the request
pipeline.

## Scope

| Function | Tasks | What it delivers |
|---|---|---|
| F-01.3 Authentication and session | 7 | Argon2id hashing, identity-provider boundary, sign-in/out/me endpoints |
| F-01.4 Sign-in experience and API client | 4 | Sign-in page, session handling, API client |
| Phase Z Epic closure | 4 | Per-epic gate (Constitution IV, V, VI, IX) |

## Technical Context

Inherited wholesale from [`../_shared/plan.md`](../_shared/plan.md) — TypeScript on Node 22, NestJS,
Prisma, PostgreSQL 16, BullMQ + Valkey, React + Vite, Vitest, Testcontainers. Specific to this epic:

**The identity-provider boundary is the whole point.** `T024` defines an interface with a local
implementation behind it. Phase 3 SSO must be a second implementation, not a change to the request
pipeline — which is the same adapter argument ADR-0001 makes for engines.

**Argon2id, not bcrypt** (`T021`/`T022`), per `_shared/tech-stack.md`. `password_hash` is never
selected — asserted by EPIC-004 `T011a`.

**NEEDS CLARIFICATION**: none blocking. See **G-05.1** — this epic's requirement coverage is the open question, and it is a Constitution II matter rather than a technical unknown.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | ⚠️ **PASS WITH DEBT** — see G-05.1: this epic owns **no** functional requirement |
| III | Epic → Feature → Task decomposition | PASS — 2 functions, 15 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `Phase Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first — or, for document/configuration outputs, an executable conformance check | PASS — 0 gaps; 5 implementation tasks, 5 paired tests |
| VI | `specs/005-identity-signin/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution` (its first command); stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 behind `origin/epic/001-platform-foundation`, 2026-08-07 |
| — | No other Claude session on this checkout | ⚠️ **Cannot assert** — files authored outside this session appeared in the tree on 2026-08-05 |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md); platform baseline in [`_shared/platform-spec.md`](../_shared/platform-spec.md) |

**Any FAIL blocks Phase 0.** No FAIL. Gate II is qualified and carried below.

**Post-design re-check**: PASS. No new design was produced, so no gate could be weakened by it.

## Review of the existing task list

### G-05.1 · This epic builds 15 tasks against **zero** requirements ⚠️ open

`spec.md` states plainly: *"Requirements owned: None directly"*, and its Notes add *"⚠️ No functional
requirement covers sign-in. It derives from the clarification 'basic sign-in', not from an SRS
requirement."*

The platform spec records "basic sign-in" under **Assumptions**, which satisfies the letter of
Constitution II — but unlike `FR-024`/`FR-025`, **no back-fill owner is named and no closure task
gates it**. `T155a` in EPIC-014 confirms back-fill for FR-024/FR-025 only.

This is the same class of debt EPIC-002 carries, and it is smaller and easier to fix: one requirement
in the platform spec would close it.

**Nothing else.** All five implementation tasks pair with tests, and `T026` provides contract
coverage for `/auth/*`.

## Build order

```text
F-01.3  T021/T023/T024a tests ──► T022 hashing ──► T024 provider boundary ──► T025 endpoints
                                                                    └─► T026 contract tests
F-01.4  T056a/T057a tests ──► T057 sign-in page ──► T058 API client
```

## Design notes specific to this epic

**Sign-in establishes identity, not authorisation.** Workspace scoping (EPIC-004) and per-artifact
grants (EPIC-002) are separate layers. This epic answers *who are you*, nothing more.

**The API client is part of this epic deliberately** (`T058`). Every later frontend epic consumes it,
so its error-shape parsing and session-expiry handling are foundational rather than incidental.

## Phase 0 / Phase 1 outputs

**None.** Every technical question this epic raises was answered when `_shared/research.md`,
`data-model.md`, `schema.sql`, and `contracts/` were written. Generating a per-epic `research.md`
recording "no decisions" would be an artifact pretending to be work — the same judgement EPIC-016's
plan made.

## Definition of done

- [ ] 15 tasks complete, every unit test passing (Constitution V)
- [ ] Sign-in, sign-out, and `me` behave per `contracts/platform-api.md`
- [ ] `password_hash` is never returned by any endpoint
- [ ] **G-05.1 resolved** — a requirement covering sign-in exists, or a back-fill owner is named and gated
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
