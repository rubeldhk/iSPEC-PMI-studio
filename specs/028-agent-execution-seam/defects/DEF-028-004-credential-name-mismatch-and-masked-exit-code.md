# DEF-028-004 — the sandbox passes a credential the agent does not read, and the failure was masked

**Epic**: `EPIC-028` · blocks **`SC-AGT-001`** · answers research item **`R-028-5`**
**Raised**: 2026-08-19 | **Status**: **OPEN** — the fix is an architectural choice, recorded below
**Found by**: `T646b`, the first run with a real credential present
**Severity**: **HIGH** — two defects, and the second hid the first

## What the run did

`pnpm v6:real-run`, 2026-08-19T20:06:37Z, with a real `AI_PROVIDER_TOKEN`:

```
[PASS] resolve_environment — docker
[PASS] resolve_agent — anthropic/claude-opus-5
[PASS] start_container
[PASS] record_image_digest — sha256:c9e1f7e4…
[FAIL] generate_specification — empty_output: The engine produced no output.
[PASS] stop_container
```

**Real progress.** The credential gate that stopped the 2026-08-18 run is passed, the container
starts, and the image digest is recorded. `SC-AGT-001` is still **not** satisfied.

## Defect 1 — the credential name

The sandbox environment is exhaustive by design (`buildSandboxEnvironment`) and sets exactly two
variables: `PMI_CORRELATION_ID` and `AI_PROVIDER_TOKEN`. `sandbox.json` `allowedKeys` permits only
those two. **Claude Code reads `ANTHROPIC_API_KEY`**, and nothing maps between them — not the
Dockerfile, not the adapter, not the manifest.

Verified directly, by replicating the sandbox's exact environment against the same image digest:

```
$ docker run --env-file <AI_PROVIDER_TOKEN + PMI_CORRELATION_ID> pmi-studio/speckit-engine
  claude -p "say hi"
exit=1
stdout=37 bytes → "Invalid API key · Please run /login"
```

The agent CLI is genuine and correctly installed — `/usr/bin/claude`, 7.2 MB, the real Anthropic
bundle, `1.0.0 (Claude Code)`. It is not broken. **It is never given a credential it recognises.**

**This answers `R-028-5`** — *"is `claude -p <command>` a supported server-side model?"* The
invocation shape is fine. The credential wiring is not.

## Defect 2 — the failure was reported as the wrong thing

With that environment the agent exits **1**. The adapter is explicit that a non-zero exit is
`agent_error`, on the sound reasoning that *"reporting it as `agent_unavailable` sends an operator to
check an outage for a fault that is in the command."* The run should therefore have stopped at
`generate_specification` with **"The agent exited 1"**, naming the invalid key.

It did not. It emitted `agent_finished`, then `generated`, then failed at read-back with
`empty_output`. **The adapter believed the agent had succeeded.**

The only route found for that is `execution-providers/docker/src/index.ts:481`:

```ts
const exitCode = (JSON.parse(inspect.text) as { ExitCode: number }).ExitCode ?? 0;
```

Docker reports `ExitCode: null` while an exec is unfinished, and `?? 0` turns **unknown** into
**success**. `ExitCode` appears exactly once in this repository — on that line — and in **no test**.
Exit-code propagation from a real exec has never been asserted, which is why a defaulted failure
could not be noticed.

Stated as the likely mechanism rather than a proven one: what is *proven* is that claude exits 1 in
that environment and the adapter nonetheless continued. Confirming the null requires instrumenting a
live exec, which is `T692` below.

**The masking is the worse of the two.** A missing API key is a five-minute fix once named. Reported
as "the engine produced no output", it sends an operator to the parser, the image, the Spec Kit
scaffold and the read-back path — every place except the one that is wrong.

## The fix is a decision, not an edit

Mapping the token to `ANTHROPIC_API_KEY` **inside the sandbox** would couple a provider-neutral
sandbox to one vendor, which Native §30 and `FR-AGT-004` exist to prevent — no AI provider may
become the architectural authority. The mapping belongs in the **agent adapter**, which is already
the vendor-specific component and already owns `invocationFor()`.

Recorded rather than chosen, because it moves a security boundary and `ADR-0002` names
`AI_PROVIDER_TOKEN` as the only credential permitted into a sandbox. Whether the adapter may rename
it on the way in is the question, and it is the owner's.

## Remaining work

- `T692` — assert exit-code propagation from a real exec, including the `ExitCode: null` case, and
  decide whether the default should be a failure rather than `0`
- `T693` — wire the credential the agent actually reads, at the seam the decision above settles
