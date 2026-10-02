# Quickstart — Governed Execution Registry (`EPIC-037`)

Runnable validation scenarios. Each proves a requirement against a running stack or the composed
module graph — not against a mock.

**Prerequisites**: the EPIC-014 container stack (`docker compose up -d`), a seeded workspace and
project, and the fixture connector from `packages/execution-contract`.

---

## V37-1 · A governed command is registered and completes

**Proves**: `FR-EXR-001`, `FR-EXR-004`, `FR-EXR-005`, `FR-EXR-014` · `SC-EXR-001`

```bash
pnpm vitest run --project backend-integration backend/tests/integration/executions/round-trip.spec.ts
```

**Expect**: one execution, events `registered → started → completed`, an input binding at
registration, an output binding at completion, a mandatory completion comment, and a projection that
reports `completed`.

---

## V37-2 · Registration refuses missing input identity, and never demands output identity

**Proves**: `FR-EXR-004`, `FR-EXR-005` · `AC-EXR-17a`–`17d`

```bash
pnpm vitest run --project backend-contract backend/tests/contract/executions/version-binding.spec.ts
```

**Expect**: registration without a target version **refused**, naming the missing field; registration
**accepted** without `commitAfter`; a successful completion without output binding **refused**; a
failed completion without output binding **accepted**.

> **A test asserting that `commitAfter` is required at registration is itself a defect** (`AC-EXR-17b`).
> That is the Rev 2 error this scenario exists to prevent recurring.

---

## V37-3 · Idempotency

**Proves**: `FR-EXR-009` · `SC-EXR-007` · `AC-EXR-05`

```bash
pnpm vitest run --project backend-integration backend/tests/integration/executions/idempotency.spec.ts
```

**Expect**: replaying a registration with a known key returns the original execution; the event count
is unchanged; concurrent replays still yield exactly one execution.

---

## V37-4 · Terminality binds lifecycle only

**Proves**: `FR-EXR-018` · `AC-EXR-18`, `AC-EXR-19`

```bash
pnpm vitest run --project backend-contract backend/tests/contract/executions/terminality.spec.ts
```

**Expect**: after `completed`, a `comment-added`, `approval-granted` or
`execution-reconciliation-accepted` is **accepted**; any lifecycle event is **refused**.

---

## V37-5 · The platform decides status, not the connector

**Proves**: `FR-EXR-006`, `FR-EXR-007` · `SC-EXR-005`, `SC-EXR-006` · `AC-EXR-08`, `16`, `20`

```bash
pnpm vitest run --project backend-integration backend/tests/integration/executions/status-authority.spec.ts
```

**Expect**: a proposal is recorded and no transition applied by the connector; a connector attempting
to apply one is **refused**; a passed validation routed to approval is **not applied**; an AI agent
approving its own gated transition is **refused with a recorded reason**.

---

## V37-6 · Strict offline blocks; permitted offline goes provisional

**Proves**: `FR-EXR-010`, `FR-EXR-011` · `SC-EXR-003` · `AC-EXR-06`, `07`

```bash
pnpm vitest run --project backend-integration backend/tests/integration/executions/offline.spec.ts
```

**Expect**: with the control plane unreachable, strict mode **blocks** the command and nothing is
presented as governed; permitted mode creates a provisional record **before execution**, appends
`execution-sync-queued`, and reports the execution as **not yet governed**.

---

## V37-7 · Reconciliation preserves causal order and surfaces conflicts

**Proves**: `FR-EXR-012` · `SC-EXR-009` · `AC-EXR-21`

```bash
pnpm vitest run --project backend-integration backend/tests/integration/executions/reconcile.spec.ts
```

**Expect**: replay preserves connector-local order and original `occurredAt`; an authoritative server
sequence is assigned; `originalLocalSequence` is retained; a conflict is **returned for a human** and
**never** auto-resolved or reordered.

---

## V37-8 · Projection replay fidelity and sequence-gap detection

**Proves**: `FR-EXR-003`, `FR-EXR-017` · `SC-EXR-004` · `AC-EXR-12`, `13`

```bash
pnpm vitest run --project backend-integration backend/tests/integration/executions/projection.spec.ts
```

**Expect**: rebuilding the projection from events reproduces the stored state exactly; a sequence gap
is reported as a **reconciliation fault**, never silently accepted; a stale `expectedSequence` is
refused with the current sequence.

---

## V37-9 · Secrets never land, and redaction preserves the chain

**Proves**: `FR-EXR-015`, `FR-EXR-022` · `SC-EXR-008` · `AC-EXR-10`, `15`

```bash
pnpm vitest run --project backend-contract backend/tests/contract/executions/redaction.spec.ts
```

**Expect**: an argument containing a connection string never appears in any stored event or API
response; a redaction conceals the body and preserves row, sequence, thread linkage and integrity
hash; the chain verifies before and after; **no hard-delete path exists**.

---

## V37-10 · Four surfaces, one governed outcome

**Proves**: `SC-EXR-002` · `AC-EXR-01`–`04` · **the scenario that matters most**

```bash
pnpm vitest run --project backend-integration backend/tests/integration/executions/surface-parity.spec.ts
```

**Expect**: the same governed command against the same project under the same policy, driven through
the **managed sandbox**, an **MCP client**, the **local CLI connector** and **CI**, agrees on
normalized command, target-version bindings, required lifecycle milestones, governance outcome and
evidence obligations.

> **Semantic equivalence, not byte identity.** Identifiers, timestamps, sequence numbers, transport
> metadata, environment, surface, adapter and adapter-specific supplementary events legitimately
> differ. Requiring identical streams was the Rev 2 error corrected in Rev 3 §07.

---

## Mutation checks, required at the convergence gate

1. **Make the projection authoritative** — delete an event and rebuild. `V37-8` must fail. If it
   passes, the projection has become the source of truth and `R-037-1` has been inverted.
2. **Give `status_transition_proposals` an `adjudication` column and write to it.** `V37-5` must
   fail. This is the exact shape the project owner rejected in Rev 2.
3. **Let a connector import a store.** The architecture test must fail. If it passes, `FR-EXR-019`
   is enforced by review rather than by the module graph.
4. **Allow a lifecycle event after a terminal one.** `V37-4` must fail.
5. **Order offline replay by `occurredAt`.** `V37-7` must fail — client clocks are evidence, never
   the sequencing key.
