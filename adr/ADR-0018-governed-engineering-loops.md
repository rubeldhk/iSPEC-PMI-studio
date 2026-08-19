# ADR-0018 — Governed Engineering Loops as a shared workflow abstraction

**Status**: Open
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)
**Awaits**: PMI-DOC-004 and the three Room epics, none of which exists

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

**Open.** Recorded as one capability area with **no owning epic**.

What is decided is the constraint Cosmos §3.1 states: the Requirement, Change and Defect Rooms
**remain distinct user-facing governed rooms** with their own rules, states, permissions and
decisions, while reusing a common workflow engine. A shared engine must not collapse three governed
surfaces into one.

## Consequences

**Positive** — building the three Rooms on one loop engine avoids three divergent workflow
implementations.

**Negative** — it is a dependency of three unbuilt capabilities, so sequencing it wrongly would block
all three. Nothing is blocked today because all four are held.

## Traceability

Cosmos §3.1 · D-42 · unowned capability area
