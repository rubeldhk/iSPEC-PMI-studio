# Research: Unattended Runs, Team Review, Access Control & External Storage

**Epic**: `EPIC-002` | **Date**: 2026-08-05 | **Plan**: [plan.md](./plan.md)

Seven decisions. Three are flagged ⚠️ **expensive to reverse** — they change stored data or a
published contract and cost far more after implementation than before.

---

## R-002-1 ⚠️ · Is a `Run` the same thing as a `GenerationJob`?

**Question**: EPIC-001 already has `GenerationJob` — identifier, engine, inputs, state, failure
reason, timestamps. This epic needs a `Run` that proceeds through a user-selected range. Same entity?

**Decision**: **separate entities.** A `Run` *has many* `GenerationJob`s.

**Rationale**: they answer different questions. A `GenerationJob` is one engine invocation with one
terminal state — that is why its failure taxonomy is closed and its state machine is small. A `Run`
spans several invocations, survives questions that would have stopped a job, carries a mode, a
stop-point range, and an access snapshot, and can end at a selected stop point without having failed
(FR-RUN-008a).

Merging them would mean adding a nullable parent, a mode flag, a range, and a snapshot column to a
table whose name and semantics say *one invocation* — three concessions to avoid one table. It would
also corrupt `job_state`: "reached the selected stop point" is a legitimate run outcome and a
meaningless job outcome.

**Cost of reversing**: high once either table has rows.

**Alternatives considered**:

- *One table with a `kind` discriminator* — rejected as above.
- *`Run` as a pure view over jobs* — rejected. Recorded questions, the access snapshot, and the stop
  range have nowhere to live in a view.

---

## R-002-2 ⚠️ · How does per-artifact access relate to workspace scoping?

**Question**: EPIC-004 enforces `workspace_id` on every read through a scoping helper, returning 404
never 403 (SC-004). This epic adds per-user, per-artifact grants. Replace, or layer?

**Decision**: **layer, in a fixed order** — workspace scoping first, then grants. The scoping helper
is unchanged. Grants narrow *within* an already-scoped result set.

**Rationale**: the two answer different questions — *does this row belong to your tenant?* and *may
you see this particular artifact?* Workspace scoping is a tenancy boundary backed by SC-004 and an
integration test against a real database; grants are a collaboration control. Folding grants into the
scoping helper would turn every existing query into a permission query and put the platform's
strongest security guarantee at risk to deliver a weaker one.

Both refuse the same way — the artifact is **absent**, not forbidden (FR-ACC-024, matching the
404-not-403 rule). One disclosure rule, two layers.

**Cost of reversing**: high. Reordering authorisation layers after implementation means re-auditing
every read path.

**Alternatives considered**:

- *Grants replace workspace scoping* — rejected. Every artifact would need an explicit grant,
  including all existing ones, and SC-004 would depend on grant coverage rather than a column.
- *Grants as a filter in the controller* — rejected. Filtering after the fact is how leaks happen;
  the boundary belongs at the repository, which is also what makes **G-02.5** integration tests
  meaningful.

---

## R-002-3 ⚠️ · How are storage providers abstracted?

**Decision**: a **`packages/storage-contract` package** mirroring `packages/engine-contract`, plus a
fixture provider and a build-failing architecture test asserting `backend/src/**` names no provider
SDK or provider string.

**Rationale**: the SRS applies this pattern to engines and the spec's own assumptions extend it to
storage. More practically, `SC-011` ("an additional provider with zero changes outside the storage
layer") is **untestable** without a second provider, exactly as SC-008 was untestable without the
fixture engine. The fixture also keeps the test suite free of network calls to Google Drive.

**Cost of reversing**: high — it is a published contract plus a package boundary.

**Alternatives considered**:

- *Call provider SDKs directly from services* — rejected. Repeats the mistake ADR-0001 exists to
  prevent, and makes SC-011 a claim rather than a test.
- *One generic SDK abstraction library* — rejected. It fixes the vocabulary but not the boundary;
  `backend/` would still know which provider it is talking to.
- *Defer the fixture until a second real provider exists* — rejected. That is the point at which the
  contract has already hardened around the first provider.

---

## R-002-4 · What exactly is an access snapshot?

**Question**: FR-ACC-028 requires a run to evaluate access "using the grants in force when it started".

**Decision**: capture the **resolved grant set** for the initiating user over the artifacts in the
run's scope, stored on the `Run`. The run reads that set; it never re-queries live grants. Anything
the snapshot excluded is reported at the end (FR-ACC-028).

**Rationale**: an unattended run can span a long period with no human present. Re-querying live means
a revocation mid-run produces a half-applied permission state — some artifacts processed, some not,
with no record of which. Snapshotting makes the run's behaviour explainable after the fact, which is
the same reasoning behind stamping steering provenance at application time in EPIC-017.

**Cost of reversing**: low — it is a column and a read path.

**Alternatives considered**:

- *Evaluate live at each step* — rejected as above.
- *Fail the run when grants change* — rejected. It punishes an unattended run for a routine
  administrative action, and the point of the mode is that it finishes.
- *Snapshot the whole grant table* — rejected. Unbounded, and most of it is irrelevant to the run.

---

## R-002-5 · Is a provisional marking a flag or a link?

**Decision**: a **link table** joining artifact → the specific `RecordedQuestion` that governs it,
with a `cleared_at` timestamp.

**Rationale**: FR-RUN-017 clears markings "whose governing question has been answered" — selectively. A
boolean on the artifact cannot say *which* question made it provisional, so answering one question
out of five would either clear everything (wrong) or nothing (useless). The link also makes
`SC-004`'s "the marking clears once that question is answered" directly checkable.

One artifact may carry several markings; all must clear before it is no longer provisional.

**Cost of reversing**: medium — a boolean cannot be back-filled into links, because the association
was never recorded.

**Alternatives considered**:

- *Boolean `is_provisional`* — rejected as above.
- *Recompute from the run's question set on read* — rejected. It cannot distinguish artifacts
  produced *before* a question from those produced *because of* it.

---

## R-002-6 · How are the two concurrency guards implemented?

**Question**: FR-RUN-013 blocks submission on conflicting answers; FR-PUB-040 prevents two concurrent
publishes of one project. Same mechanism?

**Decision**: **different mechanisms.** Answer conflicts are **detected and surfaced** — two rows
coexist, flagged, and submission is refused until resolved. Concurrent publishes are **prevented** —
an advisory lock on `(project_id)` held for the publish duration; the second caller is told a publish
is already running.

**Rationale**: the failure modes are opposite. Two different answers is *information* — a
disagreement between colleagues that a human must settle, so both must survive. Two simultaneous
publishes is a *race* with no informational value; the second should not start.

**Cost of reversing**: low.

**Alternatives considered**:

- *Lock questions during answering* — rejected. It turns a review meeting into a queue and hides the
  disagreement the session exists to surface.
- *Last-write-wins on answers* — rejected. It silently discards a colleague's judgement.
- *Queue the second publish* — rejected. FR-PUB-040 says prevent, and the user is better served by
  "already running" than by a delayed surprise.

---

## R-002-7 · Where do publish failure reasons come from?

**Decision**: a **closed enum** with the five reasons FR-PUB-035 names — `provider_unavailable`,
`authorisation_expired`, `quota_exceeded`, `size_limit_exceeded`, `destination_missing` — modelled on
`job_failure_reason` and, like it, **with no `unknown` member**.

**Rationale**: `schema.sql` already states the principle for jobs: *"There is deliberately no
'unknown' member — a generic failure is a defect."* `SC-009` makes the same demand of publishes.
Adding an escape hatch guarantees it becomes the most common value.

Provider-specific errors are **mapped into** this taxonomy by the adapter, which is precisely the
adapter's job — `backend/` must never see a Dropbox error code.

**Cost of reversing**: low while held; adding an enum member later is a migration.

**Alternatives considered**:

- *Free-text failure messages* — rejected. Unqueryable, and SC-009 becomes unverifiable.
- *Pass through provider error codes* — rejected. It leaks provider identity into the platform,
  breaking the boundary R-002-3 exists to hold.
