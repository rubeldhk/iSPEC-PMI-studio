# DEF-028-002 — `executionId` embeds the prompt, so the execution record carries content

**Epic**: `EPIC-028` | **Raised**: 2026-08-17 | **Status**: CLOSED
**Originating task**: `T567` (record `AgentExecutionRecord`) · found by `T559`
**Severity**: HIGH — a structure documented as carrying no customer content carries customer content

## Expected

`FR-AGT-012` and Native §7: an `AgentExecutionRecord` is **provenance** — who reasoned, when, at
what cost. The adapter says so itself, in a comment directly above the success path:

```ts
// Note what is absent: stdout. An execution record is provenance, never
// model output (PC-3, FR-AGT-012).
```

Provenance is safe to ship to a log aggregator precisely because it holds nothing a customer wrote
and nothing a model said.

## Actual

`engine-adapters/speckit/src/speckit.adapter.ts`, in the shared `base` object used by **both** the
success and failure paths:

```ts
executionId: `${ctx.correlationId}:${command}`,
```

`command` is the **prompt**. For a specification run it is:

```text
/speckit-specify Apollo: see pmi-input.md
```

where `Apollo` is `input.projectName` — customer data, verbatim, in a field designed to be logged.

The comment about `stdout` is accurate and was watched carefully. The identifier two lines above it
was not.

## Reproduction

`T559` asserts the serialised record contains no prompt:

```
× carries no prompt
  → expected '[{"provider":"fixture","model":"fixtu…' not to contain '/speckit-specify'
```

## Impact

- **PC-3 is violated** by the one structure the design points at when explaining PC-3.
- The leak scales with the prompt: a project named after a customer, a client, or a case number puts
  that string into every operational record for the run — including the failure path, which is the
  path most likely to be forwarded to an aggregator or attached to a ticket.
- It is **invisible to review**, because the field is called `executionId` and reads as an opaque
  identifier at every call site.

## Why the existing tests did not catch it

`T567`'s tests assert the record's *fields are present and correct*. Nothing asserted the record is
*free of content* — the negative claim. That claim is what `T559` exists for, and it found this on
its first run, before the feature it was written to guard had ever been exercised with real prompt
text.

## Options

| | Option | Consequence |
|---|---|---|
| **A** | Build the id from the correlation id, the capability and a per-run sequence | Stable, unique, greppable, and structurally incapable of holding content. **Recommended** |
| **B** | Hash the command into the id | Unique and opaque, but a hash of a prompt is still derived from a prompt, and it is not human-traceable |
| **C** | Drop `executionId` | Loses the ability to distinguish the several agent runs inside one generation |

## Resolution

**Option A.** `executionId` is now `` `${correlationId}:${capability}:${sequence}` `` — capability is
a closed enum, sequence is a counter scoped to the engine instance. It still distinguishes the
`generate` run from the `analyze` run inside one correlation, which is all it was ever needed for.

`T559` additionally asserts the record declares **no field outside Native §7's list**, as a
whitelist rather than a blacklist: the next person adding a field has to change that test, which is
the moment to ask whether what they are adding is provenance.

**Status**: CLOSED 2026-08-17.

## Traceability

- Requirement: **FR-AGT-012** · Design constraint: **PC-3** · Source: Native §7
- Originating task: `T567` · Found by: `T559` · Fixed by: `T559`'s implementation change
- Related: [`DEF-028-001`](./DEF-028-001-hung-step-case-tested-a-flag-not-a-hang.md) — also found by
  writing the test that was supposed to already be covered
