# DEF-028-001 — the hung-step conformance case tested a flag, not a hang

**Epic**: `EPIC-028` | **Raised**: 2026-08-17 | **Status**: CLOSED
**Originating task**: `T556` (the conformance suite) / `T563` (`FixtureAgent`)
**Found by**: `T565`, extracting the suite so it could run against a second adapter
**Severity**: HIGH — the one case in the suite that exists to prevent a shipped defect did not
exercise the condition it names

## Expected

`T556`'s case **C2**: *"a hung step self-terminates at the wall clock"*. Its stated provenance is a
defect this repository has already shipped — *"the adapter waited for a hung step instead of
self-terminating"* — and the engine side carries the same guarantee, implemented as a `Promise.race`
in `speckit.adapter.ts`.

An agent whose session wedges must return `timeout` at `ctx.timeoutMs`, and `cancelled` if the caller
aborts first.

## Actual

The case was driven by `new FixtureAgent({ hang: true })` — a **constructor flag** that makes the
adapter take a deliberate branch containing a `setTimeout` race:

```ts
if (this.options.hang) {
  return new Promise((resolve) => { const timer = setTimeout(... 'timeout' ...); ... });
}
```

The **real** path does not race anything:

```ts
const result = await session.exec([invocation.command]);   // awaited directly
```

So the suite proved the adapter *can* produce a timeout when told to simulate one. It never proved
it *does* when a step actually wedges — which is the entire claim.

Replacing the flag with a session whose `exec` never resolves turns both C2 assertions red:

```
× produces timeout rather than waiting forever          → Test timed out in 5000ms
× a cancellation DURING a hung step is still cancelled  → Test timed out in 5000ms
```

**The adapter hangs forever.** A wedged agent would hold a generation job open past its own
wall-clock limit — exactly the outcome `E5` and `abandonOn()` were written to prevent on the engine
side, absent on the agent side.

## Why it survived review

The flag and the real path are both in `execute()`, a few lines apart, and both contain the word
`timeout`. Reading the file, the guarantee looks present. **The test named the right condition and
constructed the wrong one**, which is the hardest kind of gap to see: the case is not missing, and
its title is accurate about intent.

It also could not be caught by adding adapters, because every adapter would have been tested through
the same flag. It surfaced only when the suite had to run against an adapter that has no such flag.

## Impact

- **`FR-AGT-006` / the C2 guarantee was unenforced** for the real condition.
- **`SC-AGT-003`** — the conformance suite's value as evidence — was overstated for one of its four
  cases.
- `ClaudeAgent` would have been written against the same suite and inherited the same hole. It is the
  adapter that talks to a real provider over a real container, where a wedged step is not
  hypothetical.

## Options

| | Option | Consequence |
|---|---|---|
| **A** | Drive C2 with a genuinely hanging session; add a real wall-clock race to every adapter | The guarantee becomes true. Costs a race in each adapter. **Recommended** |
| **B** | Keep the flag and add a second case for the real hang | Two ways to express one guarantee; the flag path remains dead weight that looks like coverage |
| **C** | Move the race into the engine only | The engine already has one — and it did not save the agent, because `runAgent` awaits `agent.execute()` which awaits the session. A race at one layer does not bound a wedge at another |

## Resolution

**Option A.** The shared suite drives C2 with `hangingSession()`, whose `exec` returns a promise that
never settles. `FixtureAgent` and `ClaudeAgent` both race the session against the wall clock and the
abort signal, checking `signal.aborted` **before** subscribing — the C1 rule, which is why the two
cases belong in one suite.

`FixtureAgent`'s `hang` option is retained as a *simulation* knob for tests that want a wedge without
a session, but it is no longer what C2 asserts.

**Status**: CLOSED 2026-08-17.

## Traceability

- Requirement: **FR-AGT-006** · Criterion: **SC-AGT-003**
- Originating tasks: `T556`, `T563` · Found by: `T565` · Fixed by: `T564`, `T565`
- Precedent: the identical guarantee on the engine side, `speckit.adapter.ts` `abandonOn()`
- Related: `T587` mutation-tests this suite; this defect is the strongest argument for that task
