# ADR-0019 — Context Engine composition — four capabilities, not one store

**Status**: Open
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)
**Awaits**: D-24 (pgvector) and the Context Engine epic, which does not exist

> Created by **EPIC-027 `T627`/`T659`** under decision `D-35`: all seventeen ADR subjects
> named by Native §27 and Cosmos §9 are recorded now, each either decided or explicitly
> **open naming what it awaits**. Native §26 forbids answering by assumption, and an ADR that
> exists as an open question is what prevents one.

## Context

Cosmos §3.2 upgrades the Engineering Context Engine into four coordinated capabilities rather
than one document store or knowledge graph: **Semantic Retrieval**, **Knowledge Graph**, **Live
Engineering State** and **Context Curation**.

Plan Amendment §9 had already asked for a Context Engine; Cosmos decomposes it. Neither exists
(`PRE-009`).

## Decision

**Open.** The decomposition is adopted as the design shape, because it separates concerns that
would otherwise be conflated: retrieval is a search problem, the graph is a modelling problem, live
state is an integration problem, and curation is an **authorization** problem.

Curation is the one that matters for governance — it constructs task-specific packages by role,
permissions, token budget and security classification, which is `ADR-0011`'s subject.

`D-24` (adopt `pgvector`) stays open: adopt when the first similarity requirement is planned, not
before.

## Consequences

**Positive** — separating curation from retrieval keeps the access-control decision out of the
search layer.

**Negative** — four capabilities is a larger build than one store, and none of it is owned.

## Traceability

Cosmos §3.2 · Plan Amendment §9 · D-24 · PRE-009 · Context Engine epic (unowned)
