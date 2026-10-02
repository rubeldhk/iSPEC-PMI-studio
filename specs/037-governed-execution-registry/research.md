# Research — Governed Execution Registry (`EPIC-037`)

**Date**: 2026-08-25 · Phase 0 of [plan.md](./plan.md)

Ten decisions. Each records what was chosen, why, what was rejected, and — where an external API is
involved — the documentation consulted.

---

## `R-037-1` — Event sourcing, with the projection explicitly derived

**Decision**: an append-only `execution_events` stream is the sole authority. Current state is a
projection, rebuildable by replay, carrying the sequence it was projected through.

**Rationale**: `BR-0197` requires immutable authoritative history, and Principle XII clause 2 forbids
mutable updates as the audit mechanism. Governance also continues after the execution terminates —
an approval three days later is normal — so the record cannot be a row whose final state is written
once and then edited.

**Alternatives considered**:
- *Mutable execution row plus an audit side-table.* **Rejected in Rev 2 review.** It makes the
  mutable row authoritative and the audit advisory, which is exactly the hole this Epic closes. The
  project owner's correction was explicit: *"`StatusTransitionProposal.adjudication` must not be
  mutable authoritative state."*
- *Event log with no projection.* Rejected: `FR-EXR-016` requires bounded, ordered, paginated
  history, and replaying every stream per query does not scale.

**Docs consulted**: none needed — the pattern is in-repo (`R-037-2`).

---

## `R-037-2` — Immutability enforced by the database, not by discipline

**Decision**: apply the existing `reject_mutation()` trigger to `execution_events` and
`execution_comments`.

**Rationale, stated precisely because the distinction matters**: what already exists is the trigger
**FUNCTION** `reject_mutation()`, defined in
`backend/prisma/migrations/20260814000000_init/migration.sql`, which raises `'% is append-only'` on
UPDATE or DELETE. It is currently bound by **17 separate `CREATE TRIGGER` statements** across the
corpus — `audit_entries_immutable`, `requirement_versions_immutable`,
`specification_versions_immutable`, `lifecycle_transitions_immutable` and thirteen others.

> **A function protects nothing on its own.** **No EPIC-037 table is protected until this Epic's
> migration attaches a trigger to it.** Reusing the function avoids a second mechanism for one
> meaning; it does **not** mean the new tables inherit protection. `T1026` must create one
> `CREATE TRIGGER … BEFORE UPDATE OR DELETE … FOR EACH ROW EXECUTE FUNCTION reject_mutation()`
> per immutable table, and `T1025` must observe each one failing before it exists.

**Reusing the function means immutability becomes a property of the database rather than of every
future code path** — and EPIC-004's clarification already established the
posture: *retention indefinite, erasure by redaction, never deletion*, defended by a database that
physically refuses `DELETE`.

**Alternatives considered**:
- *Application-level guards.* Rejected: a guard protects the paths someone remembered to guard. The
  session that produced this Epic found four separate cases of exactly that failure.
- *A new bespoke trigger.* Rejected: a second mechanism for one meaning is the fault `FR-GEL-002`
  and `FR-ESK-025` both exist to prevent.

---

## `R-037-3` — Server-allocated gapless sequence, `expectedSequence` for concurrency

**Decision**: the server assigns `sequence` per execution, gapless. Append accepts an optional
`expectedSequence`; a mismatch is refused with the current value. Offline appends carry a
connector-assigned `localSequence`, retained after reconciliation.

**Rationale**: the project owner's Rev 3 correction — *"Do not rely on source timestamps alone
because client clocks may be incorrect."* Ordering therefore derives from `localSequence` within an
execution and from server `sequence` across it; `occurredAt` is retained as **evidence of when the
connector believed it happened**, never as the sequencing key.

**Alternatives considered**:
- *Client-assigned global sequence.* Rejected: two connectors cannot agree without coordination.
- *Timestamp ordering.* Rejected explicitly by the owner, and correctly — a skewed clock silently
  reorders causally dependent events.
- *Last-write-wins on conflict.* Rejected: `FR-EXR-012` forbids silent resolution.

---

## `R-037-4` — Phase-aware binding as one table with a discriminator

**Decision**: `execution_target_bindings` carries a `phase` of `input` or `output`. Input identity is
required at registration; output identity at successful completion.

**Rationale**: Rev 3 correction 5. Rev 2 required `commitAfter` at registration, which cannot exist
before the command runs — `AC-EXR-17b` now asserts that demanding it is *itself* a defect. One table
with a discriminator keeps the before/after pair queryable as a unit.

**Alternatives considered**:
- *Two tables.* Rejected: every query wants both halves, and a join per read buys nothing.
- *Nullable output columns on the execution row.* Rejected: an execution may bind several targets.

---

## `R-037-5` — Proposals immutable; adjudication is events only

**Decision**: `status_transition_proposals` holds identity and the request. It has **no
adjudication column**. The eleven governance events carry every verdict; `StatusTransitionState` is
projected.

**Rationale**: the owner's Rev 3 correction 3, verbatim: a mutable column recording a governance
decision is the audit hole event sourcing exists to close. Rev 3 correction 4 adds that `validating`
is intermediate — a passed validation routes to `approval_required` or `applied` **by policy**, and
never implies application.

**Alternatives considered**: an `adjudication` enum on the proposal row — proposed in Rev 2 and
**rejected by the project owner**, correctly.

---

## `R-037-6` — Additive migration only

**Decision**: new tables only. `runs` and `audit_entries` each gain one optional nullable reference.

**Rationale**: no existing table carries execution semantics. `Run` (EPIC-023) is scoped to
unattended-run mode and stop-range; overloading it would conflate two concepts and break that Epic's
contract. `AuditEntry` gains `executionId` so audit and execution history **join rather than
diverge**.

**Alternatives considered**: extending `Run`. Rejected on the boundary Step C1 set — unattended-run
semantics remain EPIC-023's.

---

## `R-037-7` — MCP refusals are `isError`, not JSON-RPC errors

**Decision**: on the MCP binding, a refused registration (missing input version identity,
unsupported contract version, unauthorised) returns a **tool result with `isError: true`** and
`structuredContent` carrying the reason. JSON-RPC errors are reserved for protocol faults such as an
unknown tool.

**Rationale**: this is what the current MCP specification says, and it matters here because a
refusal is a *governed outcome the caller must record*, not a transport failure. Tools declare an
`outputSchema` (JSON Schema 2020-12, object at root) and return `structuredContent` alongside a text
fallback, so the refusal reason is machine-readable rather than prose.

**Docs consulted**: `/websites/modelcontextprotocol_io_specification_2025-11-25` — *server tools:
input and output schema, structured content, error results*.

**Alternatives considered**: JSON-RPC error for refusals. Rejected — it conflates "the platform
refused this" with "the call did not arrive", and the two demand different connector behaviour.

---

## `R-037-8` — Idempotency key unique per workspace

**Decision**: `(workspaceId, idempotencyKey)` unique, not a global unique key.

**Rationale**: keys are client-generated. A global constraint lets one tenant's key collide with
another's and leak the existence of a foreign execution through a constraint violation.

**Alternatives considered**: global uniqueness (rejected, cross-tenant leak); per-project (rejected —
a correlated workflow may span projects within a workspace).

---

## `R-037-9` — Redaction retains the original; crypto-erasure is the legal exception

**Decision**: default is an immutable `comment-redacted` event with the original retained under
access control, readable only by a named compliance or legal reviewer role, with every such access
audited. Cryptographic erasure of the content key is used **only where law compels deletion**; the
ciphertext, its hash and its sequence position survive so the chain still verifies.

**Rationale**: Rev 3 §08, approved. Consistent with EPIC-004's erasure-by-redaction posture.

**Alternatives considered**: hard delete. **Rejected absolutely** — a deletion leaving no trace is
indistinguishable from tampering, and no unaudited hard-delete path exists anywhere in this model.

---

## `R-037-10` — The fixture connector is the conformance oracle

**Decision**: a fixture connector ships inside `packages/execution-contract` and every other
connector passes the same conformance suite against it.

**Rationale**: it is the pattern `EPIC-028` already established (`FR-AGT-005`), and it makes
provider neutrality **provable without any real provider** — which is what `FR-EXR-013` and
`SC-EXR-002` actually require. The thin foundation (step C) is complete when the fixture connector
round-trips one execution end to end.

**Alternatives considered**: proving neutrality with two real connectors. Rejected: it makes the
first delivery depend on two integrations, and neither is available at step C.
