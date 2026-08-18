# ADR-0022 — Specification compliance and evidence as the differentiator

**Status**: Open
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)
**Awaits**: PMI-DOC-004 and an owning epic for the Specification Compliance Agent

> Created by **EPIC-027 `T627`/`T659`** under decision `D-35`: all seventeen ADR subjects
> named by Native §27 and Cosmos §9 are recorded now, each either decided or explicitly
> **open naming what it awaits**. Native §26 forbids answering by assumption, and an ADR that
> exists as an open question is what prevents one.

## Context

Cosmos §3.5 makes a positioning decision with architectural consequences: PMI Studio prioritises
**specification compliance and engineering evidence** over building a generic deep-code-review
product, and external review, static-analysis, security and testing tools **may supply evidence**.

It also states the completion rule: *"An agent reporting 'done' is not sufficient."*

Neither the Evidence Package (`PRE-010`) nor a Specification Compliance Agent (`PRE-013`) exists.

## Decision

**Open** on the agent; **decided** on the boundary.

**Decided**: generic deep code review is an **integration**, consuming external evidence
(`CAP-036`). PMI Studio does not build a review engine.

**Open**: the Specification Compliance Agent that evaluates approved specification, acceptance
criteria, constraints, architecture, implementation and test evidence against delivered work. It has
no owning epic.

Completion gates evaluate required evidence according to project policy — which requires policy, which
requires the Rooms.

## Consequences

**Positive** — the boundary decision alone prevents a large and unnecessary build.

**Negative** — the differentiator Cosmos names as the strongest is the one with no owner, which the
impact report records rather than resolves.

## Traceability

Cosmos §3.5 · Cosmos §8 · D-42 · PRE-010 · PRE-013 · CAP-036 · unowned
