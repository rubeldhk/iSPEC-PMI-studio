# DEF-028-005 — the `V6` runner cannot be run

**Status**: CLOSED · **Raised**: 2026-08-17 · **Epic**: EPIC-028 · **Task**: `T646b` (found), `T576` (cause)
**Severity**: blocks `T646b`

## What it is

`T646b` reads: *"run `scripts/v6-real-run.mjs` on a machine with a Docker daemon."* The file cannot
be run. It exports `runV6({environment, agent, engine, now, log})` and **nothing calls it**. There is
no `main`, no `import.meta.url === process.argv[1]` guard, and nothing anywhere that composes the
real `DockerExecutionEnvironment`, `ClaudeAgent` and `SpecKitEngine` and passes them in.

`node scripts/v6-real-run.mjs` exits 0 having done nothing at all.

## Why no test caught it

`T576a` tests step sequencing, digest extraction and transcript formatting **against a stubbed
environment** — which is the right call, and it passes. But a test that supplies the dependencies
itself can never notice that no production caller supplies them. The unit test *is* the only caller.

Same shape as `DEF-028-004`, raised the same hour: the seam the test stubs is the seam nobody built.

## Options considered

| Option | Verdict |
|---|---|
| Run it from a throwaway inline script | rejected — `T646b` requires a committed, repeatable artifact; a transcript produced by a script that no longer exists is not evidence |
| Add composition inside `runV6` | rejected — it would make the function untestable, undoing `T576a` |
| **Add a CLI entry point that composes the real objects and calls the tested `runV6` unchanged** | **taken** |

## Resolution

`scripts/v6-real-run.mjs` gains a `main()` behind an `import.meta.url`/`process.argv[1]` guard. It
composes `DockerExecutionEnvironment(unixSocketDockerApi())`, `ClaudeAgent`, `SpecKitEngine` from
their built packages, calls the **unchanged** `runV6`, writes
`specs/028-agent-execution-seam/v6-transcript.md`, and exits non-zero when the run fails so the
transcript can never disagree with the exit status.

`runV6`'s signature and body are untouched, so every `T576a` assertion still applies to the code path
the real run takes.

**Verified**: `T668`'s entry-point tests, and by `T646b`, which produced a transcript.
