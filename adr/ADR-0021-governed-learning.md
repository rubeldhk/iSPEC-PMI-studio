# ADR-0021 — Governed Learning — agent observations are not knowledge

**Status**: Decided (2026-10-11) — **delivered by `EPIC-048` Governed Learning**; one remainder, `DEFER-048-01`, open
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)
**Awaited**: a Governed Learning epic (`U-15`) — `EPIC-048`, closed 2026-10-11
**Discharged**: PMI-DOC-004 — approved v2.0, 2026-08-22. §6.12 (`BR-0114`–`BR-0118`) makes
governed learning a requirement

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

**Decided 2026-10-11, as built by `EPIC-048`** (`specs/048-governed-learning/`, closing report
`closure.md`). An agent's observation enters only as an untrusted **learning candidate**
(`FR-LRN-001`): it is never a context source, and the only code path that writes approved knowledge
is the materialiser acting on a decision `EPIC-031` recorded — fenced again in PostgreSQL, where a
knowledge version cannot exist without an approving `policy_decisions` row for its candidate
(`knowledge_versions_require_decision`), and a human version never rests on an automated approval.
Automatic approval applies only to categories the workspace's `learning_policy` explicitly declares
low-risk **and** `EPIC-031` classifies low (`FR-LRN-022`); everything else waits for a human who is
none of the candidate's AI source identities (`FR-LRN-027`). Approved knowledge is versioned with
supersession and deprecation history (`FR-LRN-031`–`-035`) and is supplied to `EPIC-038`'s context
assembly within its approved scope and classification (`FR-LRN-041`–`-045`). Reuse across
workspaces is **not** decided here: it is deferred as `DEFER-048-01`, and until an epic owns it no
entry crosses a workspace (`no_cross_workspace_knowledge`).

The flow as first recorded (2026-08-17): Agent Discovery, Learning Candidate, Supporting Evidence,
Confidence and Impact Evaluation, Policy Decision, then either automatic acceptance for explicitly
permitted low-risk cases **or** human review, then Approved Knowledge, then the Context Engine.

The system must preserve provenance, source, confidence, approval status and supersession history —
without which "the platform learned it" is indistinguishable from "an agent asserted it once".

## Consequences

**Positive** — the prohibition is the valuable half and can be honoured immediately: nothing
today feeds agent output back into project knowledge.

**Negative** — unowned, and dependent on the Context Engine, which is also unowned. *(As of
2026-10-11: owned and delivered by `EPIC-048`, over `EPIC-038`'s Context Engine. Knowledge is
recorded *not yet retrievable* by semantic search until an embedding provider exists, `R-048-13`.)*

## Traceability

Cosmos §3.4 · D-42 · PRE-012 · PMI-DOC-004 §6.12 `BR-0114`–`BR-0118` · `EPIC-048`
