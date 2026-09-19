# Contract — Governed Execution (`EPIC-037`)

**One semantic contract, three transport bindings.** The semantics below are authoritative; REST,
MCP and the connector SDK are projections of them. Where a binding cannot express a semantic, the
binding is wrong — not the semantic.

**No `PATCH` appears anywhere in this surface.** A mutable update as the audit mechanism is
forbidden by Principle XII clause 2, so every state change is an append.

---

## 1. Semantic operations

| Operation | Meaning | Refuses when |
|---|---|---|
| **Register** | Create an execution and append `registered` | input version identity missing · unsupported contract version · unauthorised · idempotency key replayed *(returns the original, not an error)* |
| **AppendEvent** | Append one immutable event | terminal lifecycle already reached and the event is `lifecycle` · `expectedSequence` mismatch · unknown event type |
| **Complete** | Append a terminal lifecycle event with outcome, artifacts, evidence and a mandatory comment | success without output binding · empty completion comment |
| **Comment** | Append to the thread | — *(permitted after terminal)* |
| **ProposeStatus** | Record a transition request | connector attempting to **apply** rather than propose |
| **History** | Authorisation-filtered, bounded, ordered, paginated events for an execution or artifact | caller may not read the artifact *(returns nothing that discloses its existence)* |
| **Sync** | Offer a queued offline batch for intake | — *(conflicts are returned, never auto-resolved)* |

**Every mutating operation requires an idempotency key.** Every operation negotiates a contract
version; an unsupported version is refused with the supported range, never best-guessed.

---

## 2. REST binding

```text
POST /v1/executions                          register            201 {executionId, governanceState}
POST /v1/executions/{id}/events              append event        201 {eventId, sequence}
POST /v1/executions/{id}/complete            terminal event      201
POST /v1/executions/{id}/comments            append comment      201 {commentId}
POST /v1/executions/{id}/status-proposals    propose transition  202 {proposalId, state}
GET  /v1/executions/{id}                     root + projection   200
GET  /v1/executions/{id}/events              full stream         200  ordered, paginated
GET  /v1/executions?target=…&targetVersion=… history for artifact 200  authz-filtered, bounded
POST /v1/executions/sync                     offline batch       200 {accepted[], conflicts[]}

Headers: Idempotency-Key (required on POST) · X-Contract-Version
Concurrency: optional expectedSequence in the append body; mismatch → 409 with current sequence
```

`202` on status-proposals is deliberate: the platform has **accepted the proposal**, not applied the
transition. A `200` would suggest the change took effect.

---

## 3. MCP binding

Tools declare an `inputSchema` and an `outputSchema` (JSON Schema 2020-12, object at root) and
return `structuredContent` alongside a text fallback.

```text
pmi.execution.register        pmi.execution.appendEvent    pmi.execution.complete
pmi.execution.comment         pmi.execution.proposeStatus
pmi.execution.history         pmi.execution.sync
```

**Refusals return a tool result with `isError: true`** and a `structuredContent` reason —
*not* a JSON-RPC error (`R-037-7`). JSON-RPC errors are reserved for protocol faults such as an
unknown tool. The distinction matters: a refused registration is a **governed outcome the caller
must record**, while a protocol fault means the call never arrived.

---

## 4. Connector SDK binding

```ts
register() · appendEvent() · complete() · comment() · proposeStatus() · history() · sync()
```

Six implementations, one interface: **managed sandbox · MCP client · IDE extension · local CLI
(BR-0132) · CI/CD · fixture**.

- **No connector may import a data-access module** (`FR-EXR-019`). Enforced by an architecture test
  asserting no file under a connector path imports a store or Prisma client — the same mechanism
  that keeps `FR-AGT-004` honest today.
- **The fixture connector is the conformance oracle** (`R-037-10`). Every other connector passes the
  same suite against it, so neutrality is provable with no real provider present.

---

## 5. Semantic parity

Parity means the same inputs produce the same **governed outcome** on every binding. It does not
mean identical wire shapes.

| Semantic | REST | MCP | SDK |
|---|---|---|---|
| Register | `POST /v1/executions` | `pmi.execution.register` | `register()` |
| Append event | `POST …/events` | `pmi.execution.appendEvent` | `appendEvent()` |
| Complete | `POST …/complete` | `pmi.execution.complete` | `complete()` |
| Comment | `POST …/comments` | `pmi.execution.comment` | `comment()` |
| Propose status | `POST …/status-proposals` | `pmi.execution.proposeStatus` | `proposeStatus()` |
| History | `GET /v1/executions…` | `pmi.execution.history` | `history()` |
| Sync | `POST …/sync` | `pmi.execution.sync` | `sync()` |
| Refusal | 4xx + problem body | `isError: true` + `structuredContent` | typed rejection |
| Concurrency conflict | `409` + current sequence | `isError` + current sequence | typed rejection |
| Idempotent replay | `201` with the original id | original `structuredContent` | original result |

**Parity is asserted, not assumed**: `AC-EXR-01`–`04` drive the same governed command through four
surfaces and require agreement on normalized command, target-version bindings, required lifecycle
milestones, governance outcome and evidence obligations — permitting differences only in identity,
transport, environment, timing and surface metadata.

---

## 6. What this contract does not carry

- **Adjudication.** Proposals go in; verdicts come back as events decided by EPIC-030.
- **Agent selection or capability negotiation.** EPIC-028.
- **Evidence storage.** EPIC-032 — this contract carries references.
- **Any user interface.** EPIC-031, EPIC-033, EPIC-036.
