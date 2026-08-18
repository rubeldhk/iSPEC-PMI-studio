# ADR-0021 — Governed Learning — agent observations are not knowledge

**Status**: Open
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)
**Awaits**: PMI-DOC-004 and a Governed Learning epic, which does not exist

> Created by **EPIC-027 `T627`/`T659`** under decision `D-35`: all seventeen ADR subjects
> named by Native §27 and Cosmos §9 are recorded now, each either decided or explicitly
> **open naming what it awaits**. Native §26 forbids answering by assumption, and an ADR that
> exists as an open question is what prevents one.

## Context

Cosmos §3.4 introduces controlled organizational learning and states the prohibition first:
*"Agent observations SHALL NOT silently become trusted project or organizational knowledge."*

**Genuinely new.** Nothing in the four August-11 documents covers learning at all, and nothing in the
corpus does either (`PRE-012`).

## Decision

**Open.** The flow is recorded: Agent Discovery, Learning Candidate, Supporting Evidence,
Confidence and Impact Evaluation, Policy Decision, then either automatic acceptance for explicitly
permitted low-risk cases **or** human review, then Approved Knowledge, then the Context Engine.

The system must preserve provenance, source, confidence, approval status and supersession history —
without which "the platform learned it" is indistinguishable from "an agent asserted it once".

## Consequences

**Positive** — the prohibition is the valuable half and can be honoured immediately: nothing
today feeds agent output back into project knowledge.

**Negative** — unowned, and dependent on the Context Engine, which is also unowned.

## Traceability

Cosmos §3.4 · D-42 · PRE-012 · unowned capability area
