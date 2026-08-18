# DEF-028-009 — the image's entrypoint swallows the provider's idle command

**Status**: CLOSED · **Raised**: 2026-08-17 · **Epic**: EPIC-028 · **Task**: `T646b` (found)
**Cause**: EPIC-003 `T088` and EPIC-028 `T646a`, together · **Severity**: no step can ever run

## What it is

The provider keeps the container alive so the engine can `exec` its five steps into it:

```ts
Cmd: ['sleep', String(Math.ceil(request.timeoutMs / 1000))],
```

The image declares:

```dockerfile
ENTRYPOINT ["/bin/sh", "-c"]
CMD ["echo 'pmi-studio speckit-engine: awaiting invocation'"]
```

`ENTRYPOINT ["/bin/sh","-c"]` makes the **first** `Cmd` element the shell script and every element
after it a positional argument. So `['sleep','300']` runs `sh -c "sleep" "300"` — `sleep` with no
operand, `300` bound to `$0`:

```console
$ docker run --rm pmi-studio/speckit-engine sleep 5
sleep: missing operand
```

The container starts and exits in milliseconds. The engine then execs into it:

```json
{"message":"container 10e7c2ce... is not running"}
```

**Neither half is wrong on its own, and together they cannot work.** The image's comment explains the
entrypoint: *"No ENTRYPOINT that starts work on its own… a container that starts does nothing until
told to — which keeps 'the container ran' and 'generation started' separate events."* Correct
intent. But *does nothing* was implemented as *exits immediately*, and the exec-based session model
`T646a` built needs a container that idles.

Two epics, each internally consistent, meeting at a seam neither could test.

## Why no test caught it

`T088a` reads the Dockerfile; `T570` inspects the create config against a mocked daemon. Both pass.
**Only a real daemon composes an image's `ENTRYPOINT` with a provider's `Cmd`** — and until today no
real daemon had ever seen either.

Tenth instance of the recurring pattern, and the clearest statement of its limit: this one was not
observable by *any* check on either side, because the fault lives in neither artifact. It exists only
in their combination.

## Options considered

| Option | Verdict |
|---|---|
| Change the image's `ENTRYPOINT` | rejected — the image is `T088`'s, EPIC-003 is closed, and the entrypoint's *intent* is right. A provider that only works against one image's entrypoint is not a provider |
| Pass a single shell string as `Cmd` | rejected — it makes the provider's containment depend on the image's shell, and re-introduces the string-interpolation surface `writeFile` was written to avoid |
| **Reset `Entrypoint` in the create request** | **taken** — the provider owns the session lifecycle, so it states the process it needs rather than inheriting one |

## Resolution

`buildCreateConfig` now sets `Entrypoint: []` alongside the existing `Cmd`, so the idle process runs
as an exec-form command regardless of what the image declares. Verified directly:

```console
$ docker run --rm --entrypoint "" pmi-studio/speckit-engine sleep 2
$ echo $?
0
```

`T671` asserts the reset is present and that `Cmd` stays exec-form. The Dockerfile is untouched —
EPIC-003's entrypoint intent is preserved for anyone running the image by hand.

**Verified**: `T671`'s unit tests (mutation-checked), and by `T646b`, which now execs into a live
container.
