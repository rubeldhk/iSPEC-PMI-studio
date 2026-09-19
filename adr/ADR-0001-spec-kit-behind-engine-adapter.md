# ADR-0001 — Spec Kit behind a specification engine adapter

**Status**: Accepted
**Date**: 2026-08-02 (recorded as an ADR 2026-08-03)
**Deciders**: Project owner, tech lead

## Context

The SRS states the requirement twice and unambiguously: *"Treat Spec Kit as Engine V1, not the
product"* and *"Spec Kit becomes the first implementation, not the core dependency."* PMI-DOC-003
raises it to a binding principle — **PP-006 Engine Independence**.

Phase 0 research (R-001) then established a fact that shapes everything: **Spec Kit is not a
callable generation API.** The `specify` CLI only scaffolds a project; the `/speckit-*` commands are
prompt templates executed by an AI coding agent. Generation therefore means orchestrating an
external, non-deterministic, long-running process — not calling a function.

A claim of engine independence decays silently unless something fails when it stops being true.

## Decision

All engine capabilities are invoked through a single contract, `SpecificationEngine`, declared in
`packages/engine-contract`. Phase 1 covers three capabilities: generate specification, generate
tasks, validate specification.

Independence is enforced by three mechanisms, not by discipline:

1. **Package boundary** — `backend/` depends on `packages/engine-contract`, never on
   `engine-adapters/*`. Adapters are supplied at the worker's composition root.
2. **Architecture test** — the build fails if any file under `backend/src` references a Spec Kit
   symbol, package, or string identifier.
3. **Fixture adapter** — a deliberately trivial second engine implementing the same contract, used
   by the User Story 8 acceptance test and by the fast test suite.

Engines return typed failures rather than throwing, so the failure taxonomy is enforceable.

## Consequences

**Positive**

- Engine independence is a build-time guarantee, not an assertion.
- The fixture adapter makes engine-dependent logic unit-testable without invoking a live AI agent —
  fast, deterministic, and free.
- The contract takes plain data (`RequirementInput[]`, not database entities), which later made the
  D-10 split possible: the engine can be built and tested with no product surface at all.

**Negative**

- A four-package split (contract, two adapters, backend) is more structure than a single package.
- The fixture adapter is code that ships no user value.

**Accepted trade-off**: without the fixture there is no way to prove the contract is engine-neutral
rather than Spec-Kit-shaped, and SC-008 becomes untestable.

## Traceability

- Requirements: FR-016 to FR-019, FR-021, SC-008
- Research: R-001, R-009
- Principle: PP-006
- Contract: `specs/_shared/contracts/specification-engine.md`
- Tasks: T031–T039, T047, T142, T137
