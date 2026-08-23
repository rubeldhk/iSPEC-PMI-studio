# ADR-0018 — Governed Engineering Loops as a shared workflow abstraction

**Status**: **Accepted 2026-08-23**
**Date**: 2026-08-17 · **Accepted**: 2026-08-23
**Deciders**: Tech lead (architecture) · project owner (open items)
**Awaited**: the three Room epics, none of which existed (`U-01`, `U-04`, `U-05`)
**Discharged**: PMI-DOC-004 — approved v2.0, 2026-08-22. `BR-0064` makes the loop a requirement.
`EPIC-030` `T987` — the loop is built, and the constraint below is now enforced by test rather than
asserted

> Created by **EPIC-027 `T627`/`T659`** under decision `D-35`: all seventeen ADR subjects
> named by Native §27 and Cosmos §9 are recorded now, each either decided or explicitly
> **open naming what it awaits**. Native §26 forbids answering by assumption, and an ADR that
> exists as an open question is what prevents one.

## Context

Cosmos §3.1 introduces Governed Engineering Loops as a reusable workflow abstraction beneath the
three Rooms: *Event, Context, Analyze, Decide, Execute, Verify, Evidence, Outcome, Next Event.*

It is **genuinely new** — absent from all four August-11 documents — and it sits underneath three
capabilities that themselves do not exist.

## Decision

**Accepted.** Owned by `EPIC-030`, built 2026-08-23.

> **What changed, and what did not.** The constraint below is the same sentence it was on
> 2026-08-17. What changed is that it stopped being a sentence: `EPIC-030` `T944a`/`T944b` test it,
> and `EPIC-034` `T994z` and `EPIC-035` `T998x` cite that test by name because each carries an
> `SC-*-01x` that depends on it holding. The ADR was Open because nothing owned the abstraction, not
> because the decision was in doubt.

What is decided is the constraint Cosmos §3.1 states: the Requirement, Change and Defect Rooms
**remain distinct user-facing governed rooms** with their own rules, states, permissions and
decisions, while reusing a common workflow engine. A shared engine must not collapse three governed
surfaces into one.

## Consequences

**Positive** — building the three Rooms on one loop engine avoids three divergent workflow
implementations.

**Negative** — it is a dependency of three unbuilt capabilities, so sequencing it wrongly would block
all three. Nothing is blocked today because all four are held.

> **Discharged 2026-08-23.** The sequencing risk was real and was resolved by building the loop
> first: `EPIC-030` is complete and `EPIC-031`–`EPIC-035` are all `Ready`. Two things the build
> settled that this ADR could not have:
>
> - **The engine names no Room.** `SC-GEL-001` is asserted by
>   `backend/tests/integration/loop-new-workflow-type.spec.ts`, which invents a workflow type, runs
>   it end to end from a configuration file, and then scans every engine source for the type's name,
>   its gate, its rule, and any branch on `workflowType`. *"A shared engine must not collapse three
>   governed surfaces into one"* is now a build failure rather than a principle.
> - **The distinction that makes it workable.** A tenant's configuration file may carry the string
>   `"requirement-room"` — `BR-0064` requires configurability per workflow type, and the type's name
>   is how a tenant configures it. What the contract may not carry is the **concept**: no
>   `RequirementStage`, no `baselineId`. `backend/tests/architecture/loop-independence.spec.ts`
>   enforces exactly that line, and it is the line this ADR would have been read as forbidding
>   outright.

## Traceability

Cosmos §3.1 · D-42 · unowned capability area
