# Research: Enhancement Model for Spec-Driven Engineering

**Epic**: `EPIC-017` | **Date**: 2026-08-04 | **Plan**: [plan.md](./plan.md)

Seven decisions. Three are flagged ⚠️ **expensive to reverse** — they change stored data or a
published contract, and cost far more after implementation than before.

---

## R-017-1 ⚠️ · Where does the organization tier live?

**Question**: FR-ENH-001 requires an *organization* scope above workspace. The platform's data model
tops out at workspace and carries `workspace_id` on every row from the first migration (EPIC-004
T013).

**Decision**: add an `organizations` table and an **`organization_id` column on `workspaces` only** —
not on every row. Scope resolution walks `artifact → workspace → organization`.

**Rationale**: every row already carries `workspace_id`, and every workspace belongs to exactly one
organization, so organization is reachable by one join from anything. Denormalising `organization_id`
onto all sixteen tables buys one join and costs a second column to keep consistent on every write —
the classic trade that looks cheap until two columns disagree.

**Cost of reversing**: high after data exists, near zero before. This is why F-17.1 is sequenced
first in the build order.

**Alternatives considered**:

- *`organization_id` on every row alongside `workspace_id`* — rejected. Faster reads, but two
  denormalised tenancy columns can disagree, and workspace isolation (FR-002, SC-004) is enforced
  against `workspace_id`. A second tenancy column is a second thing to get wrong in a security
  boundary.
- *Reuse workspace as the top scope* — rejected. It makes organization-wide steering impossible,
  which is the requirement.
- *Defer organization to Phase 3 with RBAC/SSO* — rejected. It is a column now and a migration later;
  and FR-ENH-001 names four scopes, not three.

---

## R-017-2 ⚠️ · How does steering reach the engine without naming one?

**Question**: steering must constrain generation. The obvious route — appending steering text to the
agent prompt — puts engine-specific knowledge in `backend/` and regresses PP-006.

**Decision**: extend the engine contract input with a **structured `steering` field** carrying
resolved steering documents as data (subject, scope, content, version). Each adapter decides how to
present them to its engine. `backend/` composes and passes the structure; it never formats a prompt.

**Rationale**: this is the same shape that made the D-10 split possible — the contract already takes
`RequirementInput[]` as plain data rather than database entities. Steering is more of the same, and
the existing architecture test (T047, T142) keeps it honest.

**Cost of reversing**: high. It is a published contract change affecting every adapter and the
conformance suite.

**Alternatives considered**:

- *Steering rendered to text in `backend/` and passed as a prompt fragment* — rejected. "Prompt
  fragment" is an engine-specific concept; a non-LLM engine has no prompt. It would put the first
  engine assumption inside the platform.
- *Steering fetched by the adapter directly from the database* — rejected. Adapters run inside the
  sandbox with no platform credentials (ADR-0002). Handing them database access to read steering
  would undo the sandbox's central property.
- *Steering as a separate contract capability* — rejected. It is an input to generation, not an
  operation; a capability implies it can be invoked alone, which is meaningless.

---

## R-017-3 ⚠️ · One link table or two?

**Question**: `TraceabilityLink` (EPIC-011 T078) records derivation. Impact analysis needs
dependency. Same table with a type discriminator, or two tables?

**Decision**: **two tables** — `traceability_links` unchanged, plus a new `dependency_edges`.

**Rationale**: they differ in more than semantics. Derivation links are written once at generation
time by the system and never edited; dependency edges are user-maintained, mutable, and subject to
cycle detection. Derivation is a tree; dependencies form a general graph. Merging them means every
impact query filters by type, every provenance query risks returning dependencies, and cycle
detection has to exclude rows it must not touch.

**Cost of reversing**: high. Merging or splitting link tables after either has data is a migration
over the graph.

**Alternatives considered**:

- *One table, `link_kind` discriminator* — rejected for the reasons above. It looks simpler until the
  first query that must not see the other kind.
- *Derive dependencies from derivation links* — rejected. A specification can depend on something it
  was not generated from. That is the common case, not the exception.

---

## R-017-4 · How do reviewing roles execute with M-07 deferred?

**Question**: twelve roles, no AI platform, no model selection, no prompt registry, no cost
optimisation — all deferred to M-07 by the 2026-08-04 phase-authority ruling.

**Decision**: roles execute as **engine contract invocations against the single configured model**,
one invocation per role, running **concurrently within one gate** and bounded by the platform's
existing per-job caps (FR-025). Role definitions live in configuration, not in a registry service.

**Rationale**: it is the only design consistent with the ruling. It also keeps the seam clean: when
M-07 lands, a registry replaces the configuration source and model selection replaces "the configured
model", without changing the gate.

**Cost of reversing**: low — configuration to registry is a substitution behind a boundary.

⚠️ **This is where the cost sits.** A gate with all twelve roles is twelve model invocations. Nothing
in this epic optimises that; the containment is per-job caps and nothing else. Gates should therefore
be **configured with the roles a transition actually needs**, not all twelve by default, and RAID
**R-02** must be re-scored before implementation.

**Alternatives considered**:

- *Sequential role execution* — rejected. Twelve sequential model calls make a gate unusably slow
  without reducing cost.
- *One combined invocation asking for all perspectives* — rejected. It destroys per-role attribution,
  which FR-ENH-013 and SC-ENH-005 require, and produces exactly the shallow multi-topic answer that
  splitting the roles was meant to avoid.
- *Wait for M-07* — rejected. It would make this epic undeliverable, and the ruling explicitly did
  not move M-07.

---

## R-017-5 · How does impact analysis scale to 500 specifications?

**Decision**: **recursive query in the database** (`WITH RECURSIVE`), with a configured depth bound
and a `bounded` flag on the result. No materialised closure table in this epic.

**Rationale**: the write path for dependency edges is user-driven and low-volume; the read path is
interactive but not hot. A recursive query keeps the write path trivial and the graph always
consistent. A closure table trades that for write amplification on every edge change — worth it at a
scale this epic does not target.

**Cost of reversing**: low. A closure table can be added later as a cache without changing the API.

**Alternatives considered**:

- *Materialised transitive closure* — deferred, not rejected. Revisit if measurement shows the
  recursive query missing SC-ENH-003.
- *Application-side traversal* — rejected. It pulls the whole edge set into memory to answer a
  question the database can answer in one round trip.
- *A graph database* — rejected. One graph query does not justify a second data store, its
  operational burden, or the consistency problem between the two.

---

## R-017-6 · Is the twenty-one-section structure stored or validated?

**Question**: FR-ENH-020 requires PMI Studio to support a twenty-one-section structure for the
specifications it produces. Is that a stored template or a validation rule?

**Decision**: **a validation rule over a named structure definition**, not a stored document skeleton.
The structure is a versioned list of section definitions; conformance is checked and reported as
findings, reusing the existing validation-finding shape (FR-023).

**Rationale**: a stored skeleton makes every generated specification carry twenty-one headings whether
or not they apply, which is how box-ticking documents get made. A validation rule reports what is
missing and lets the engine produce what the content warrants — and it reuses machinery EPIC-009
already builds.

**Cost of reversing**: low.

**Alternatives considered**:

- *Stored skeleton pre-populated on creation* — rejected as above.
- *Hard-coded twenty-one sections* — rejected. The structure is versioned in the source document and
  will change; hard-coding makes that an application release.

**Scope note (D-16)**: this governs specifications **PMI Studio produces**. This repository's own
documents follow `PMI-DOC-000`; whether *those* templates change is decision **D-4**, owned by
EPIC-018.

---

## R-017-7 · How does the twelve-link chain relate to `TraceabilityLink`?

**Decision**: **widen `TraceabilityLink`'s link-type enumeration** from the two Phase 1 edge types to
the twelve chain link types. One table, one traversal, more types.

**Rationale**: the twelve-link chain *is* derivation, extended — vision derives goals, goals derive
capabilities, and so on down to release and operations. It is the same relationship EPIC-011 already
models and indexes in both directions. A second table would mean two traversals to answer one
question.

Note this is the opposite conclusion to R-017-3, and deliberately so: the chain is derivation
(system-written, acyclic, append-only), while dependency edges are not. The distinguishing test is
not "is it a link?" but "does it behave like derivation?".

**Cost of reversing**: medium — an enum widening is cheap; splitting the table afterwards is not.

**Alternatives considered**:

- *A separate `chain_links` table* — rejected. It duplicates EPIC-011's bidirectional indexes and
  splits one traversal in two.
- *Keep two Phase 1 types and model the rest elsewhere* — rejected. It leaves PP-004 permanently
  partial and makes SC-ENH-007 unimplementable.

**Dependency**: EPIC-011 `T077a` asserts `TraceabilityLink` permits **only the two Phase 1 edge
types**. That test must be updated as part of this epic — it will otherwise fail the build the moment
the enumeration widens. Recorded so `/speckit-tasks` emits it rather than discovering it at runtime.
