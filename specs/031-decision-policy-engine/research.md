# Research: Decision & Policy Engine

**Epic**: `EPIC-031` · **Phase**: 0 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

Eight decisions. Two were settled at the 2026-08-22 clarification session and are recorded here with
their implementation consequence; six resolve `NEEDS CLARIFICATION` items or choices the
clarification created.

**Current-docs discipline**: Context7 MCP was available and was used for the one build-versus-adopt
decision (`R-031-2`). It changed the answer's reasoning materially — see below. Library IDs are
recorded for `/speckit-implement` and `/speckit-converge`.

---

## `R-031-1` — Classification rules live in the existing steering system

**Decision**: Classification rules become a new **`SteeringSubject`** in `EPIC-019`'s existing
steering system. Storage, versioning, scope composition and precedence are `EPIC-019`'s;
this Epic supplies only the rules' *meaning*.

**Rationale**: this is the clarification answer (`FR-DPE-005`), and the code inspection turned it
from a reasonable choice into an easy one. `backend/src/modules/steering/` already provides
everything the alternative would have rebuilt:

| Need | Already exists |
|---|---|
| Versioned, reviewable rule documents | `SteeringDocumentRecord` — `lineageId`, `version`, `status: active \| retired` |
| Scope composition | `scope-resolver.ts` — `SCOPE_ORDER`, `resolveScopePath`, `isNarrowerThan` |
| **Conflict precedence (`BR-0071`)** | `steering-resolver.ts` — `resolveSteering()` returns a `SteeringResolution` carrying `SteeringOverride` |
| Provenance of what applied | `SteeringApplicationService.recordForGeneration` |

`FR-DPE-042` requires the precedence rule that resolved a conflict to appear in the explanation.
`resolveSteering()` already returns it as data, so the explanation quotes a value rather than
reconstructing an argument.

**One divergence, recorded not fixed**: `SCOPE_ORDER` is
`['organization', 'workspace', 'project', 'product']`. `BR-0070` names *"organization, workspace,
project, repository and path scope"* — so `repository` and `path` are absent from the
implementation. **This Epic does not need them**: a risk class is a property of the action and its
target (`FR-DPE-002`), not of a file path. The gap is `EPIC-019`'s to close if `BR-0070` requires it,
and is recorded here so this Epic is not read as having accepted a narrower `BR-0070`.

**Alternatives considered**: a separate policy artifact with its own scoping — rejected at
clarification, and the inspection confirms it would have meant a second precedence implementation
beside a working one.

---

## `R-031-2` — Build the decision evaluator; adopt two of Cedar's properties, reject the third

**Decision**: **Build** a small evaluator over steering-resolved rules. Take no policy-language
dependency. Adopt two properties from Cedar's authorization model and **explicitly reject a third**.

| Cedar property | Adopted? | Why |
|---|---|---|
| **Default deny** — no request is authorized unless a policy grants it | **Adopt** | It is `FR-DPE-050` fail-closed and `FR-DPE-004` most-restrictive-band, arrived at independently |
| **Forbid overrides permit** — a satisfied `forbid` always wins | **Adopt** | It is exactly `FR-DPE-012`: the high band is not configurable away, so a tenant `permit` can never outrank it |
| **Skip on error** — a policy that errors is skipped and does not affect the response | **REJECT** | This is the mismatch. `FR-DPE-040` makes an unexplainable allow a **defect**, and `ADR-0025` constraint 3 forbids exactly this. A rule that fails to evaluate must **refuse and say so**, never be silently omitted from the result |

**Rationale**: the first two are good governance semantics and cost nothing to reimplement — the
band table has three values and the scope composition is already `EPIC-019`'s. The third is
disqualifying, and it is the reason a general-purpose engine is the wrong shape here rather than
merely unnecessary: skip-on-error is a *safety* feature in an authorization system where a broken
rule should not lock everyone out, and a *governance hole* in a system whose whole claim is that no
consequential action happens unexplained.

Also weighed: `RULE-08` forbids a core workflow depending on one vendor; `TS-001`/`TS-002` require a
register entry and licence check per dependency; and this repository has repeatedly declined a
dependency for a small job — *"the Docker provider talks to the Engine API rather than pull in
`dockerode` for four endpoints"*.

**Alternatives considered**:
- *Cedar* — rejected on skip-on-error, above. Its `forbid`-overrides-`permit` model is adopted as a
  principle.
- *OPA / Rego* — rejected. A second policy language beside steering, an out-of-process dependency on
  the critical path of every governed action, and `BR-0071` precedence would have to be
  reimplemented inside Rego.
- *`casl`* — rejected. It models subject/action/resource ability, not risk banding with evidence
  gates, and it has no concept of an explanation.

**Docs consulted**: `/cedar-policy/cedar-docs` — *policy storage, scoping and combination; whether
forbid always overrides permit*. The `skip on error` property is documented under *Authorization*
and is what changed this from a build-by-default into a build-with-a-reason.

---

## `R-031-3` — Publishing the `BR-0005` decision-authority contract

**Decision**: A new workspace package **`packages/decision-contract/`** holding the
decision-authority record shape, the three bands, the decision result and the explanation type.
`U-02` adopts it unchanged when declared.

**Rationale**: the clarification answer (`FR-DPE-014`) requires the shape be **published**, not
private. This repository already separates a contract from its implementations four times —
`engine-contract`, `agent-contract`, `execution-contract`, and `loop-contract` from `EPIC-030` — each
with an architecture test asserting the boundary. A fifth is the established shape, and it gives
`U-02` something to adopt rather than a service to import.

**Alternatives considered**: exporting the types from `backend/src/modules/decisions/` — rejected;
that module is `EPIC-016`'s **ADR** store (`AdrRecord`), a different thing that happens to share a
word, and importing from a backend module is what `U-02` could not do.

---

## `R-031-4` — The Decision Inbox is derived, never stored

**Decision**: Inbox membership is **computed at read time** from open decisions, the reader's role
and current policy. No queue table, no materialised rows.

**Rationale**: `FR-DPE-022` requires exactly this — *"an entry MUST NOT persist because it was once
visible"*. A stored queue has to be invalidated when a role changes, a policy changes, or an item is
decided elsewhere, and every missed invalidation is an entry that lies. Deriving it makes
`FR-DPE-024` (a decided item leaves the queue) true by construction rather than by a cleanup path.

**Alternatives considered**: a materialised queue with invalidation — rejected on the above.
Revisit only if `PP-018` measurement shows the derived read cannot meet its target; that would be a
performance decision with a stated trade-off, not a default.

---

## `R-031-5` — What "the engine cannot be consulted" means in-process

**Decision**: The engine is an in-process NestJS provider, so `FR-DPE-050` fail-closed applies to
its **inputs**: if steering cannot be read, or the resolved ruleset fails validation, the decision
is **refused** and the refusal is recorded with the reason.

**Rationale**: `FR-DPE-050` is easy to misread as being about a network call. The engine has no
network hop; what can fail is the steering store and the ruleset. Naming that precisely is what
makes the requirement testable — otherwise it becomes an untested branch guarding a call that
cannot fail.

**Alternatives considered**: treating fail-closed as not applicable in-process — rejected. The
failure mode is real, only relocated.

---

## `R-031-6` — Performance and scale targets (`PP-018`, deferred here by the spec)

**Decision**:

| Target | Value |
|---|---|
| Decision evaluation, excluding gate providers | **p95 < 40 ms** |
| End-to-end decide including steering resolution and audit write | **p95 < 120 ms** |
| Decision Inbox read (derived, `R-031-4`) | **p95 < 250 ms** at 500 open items per reader |
| Decision throughput per workspace | **≥ 50/second sustained** |

**Rationale**: `ADR-0025` names availability and latency as product concerns *"because the engine
sits on the critical path of every governed action"*. The decide budget is tighter than
`EPIC-030`'s transition budget (50 ms) because the loop's Decide stage calls into this engine and the
two budgets must compose. The Inbox target is stated **with a load figure** because a derived read
is fast at ten items and the number that matters is the one where it stops being.

---

## `R-031-7` — Satisfying Constitution XI Tier 2

**Decision**: The Decision Inbox is a new page at `frontend/src/pages/DecisionInbox.tsx`, and closure
requires a **run-generated** transcript of the inbox journey against a running application,
following the `SC-AGT-001` precedent and `EPIC-029`'s `T900a`/`T900b`.

**Rationale**: **this Epic delivers a user-facing journey and `EPIC-030` did not** — that is the
substantive difference between the two plans. Tier 1 alone would leave the situation Principle XI
was ratified over: `DEF-005-001`, *"sign-in impossible in the running application"*, found by a human
opening a browser after the Epic was declared closed.

Tier 1 uses `EPIC-030`'s pattern verbatim: `Test.createTestingModule({ imports: [AppModule] })` plus
the real HTTP route, with only the database overridden. That pattern is established by `EPIC-030`
`T934` and copied, not reinvented.

**Alternatives considered**: extending an existing page — rejected. `UX-0021` requires the Inbox be
reachable in one action from every screen, which is a shell-level surface of its own.

---

## `R-031-8` — Explanations are stored, not recomputed

**Decision**: An explanation is **persisted with its decision**, carrying the policy version, the
matched rule, the risk class, the precedence resolution and the authority applied.

**Rationale**: `FR-DPE-044` requires a later policy change not to rewrite a past explanation.
Recomputing on read would do exactly that — the explanation would drift to whatever the rules say
today, and a decision taken under a superseded ruleset would explain itself with rules that were not
in force. Storing it also makes `SC-DPE-002` (100% of consequential decisions carry an explanation)
checkable by query rather than by replay.

**Alternatives considered**: recompute from the retained policy version — rejected. It is
reconstructible in principle and wrong in practice: it depends on the evaluator behaving identically
forever, which is a stronger assumption than storing a row.

---

## Resolved `NEEDS CLARIFICATION` items

| Item | Resolved by |
|---|---|
| Performance Goals and latency constraints | `R-031-6` |
| Where classification rules are stored | `R-031-1` (clarified 2026-08-22) |
| Policy evaluation: build or adopt | `R-031-2` |
| Where the `BR-0005` contract lives | `R-031-3` (clarified 2026-08-22) |
| Inbox storage model | `R-031-4` |

**None remain.**

## Library IDs for downstream commands

| Dependency | Context7 library ID | Consulted for |
|---|---|---|
| Cedar (**evaluated, not adopted**) | `/cedar-policy/cedar-docs` | policy combination semantics; the `skip on error` property that disqualified it (`R-031-2`) |
| NestJS (`@nestjs/core` `^10.4.15`) | `/nestjs/docs.nestjs.com` | composed-graph e2e testing — pattern established by `EPIC-030` `R-030-8`, reused unchanged |
| Prisma (`@prisma/client` `^5`) | `/prisma/web` | as `EPIC-030` `R-030-1`; no new Prisma concept is introduced here |

**No new runtime dependency.** `supertest` is added by `EPIC-030` `T993d`/`T993e` with its `TS-001`
register entry; this Epic depends on that landing rather than duplicating it. If `EPIC-030` has not
merged when this Epic implements, the register entry is this Epic's to make — a task, not an
assumption.
