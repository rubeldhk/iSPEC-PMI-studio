# DEF-028-004 — the Docker provider cannot reach a daemon on Windows

**Status**: CLOSED · **Raised**: 2026-08-17 · **Epic**: EPIC-028 · **Task**: `T646b` (found), `T646a` (cause)
**Severity**: blocks `T646b`, and therefore blocks `SC-AGT-001`

## What it is

`unixSocketDockerApi()` in `execution-providers/docker/src/index.ts` resolves its socket path as:

```ts
socketPath = process.env['DOCKER_HOST']?.replace(/^unix:\/\//, '') ?? '/var/run/docker.sock'
```

Both branches are POSIX-only.

- The default `/var/run/docker.sock` **does not exist on Windows**; Docker Desktop exposes the Engine
  API on the named pipe `//./pipe/docker_engine`.
- The `DOCKER_HOST` branch strips only a `unix://` prefix. Windows sets `npipe://./pipe/docker_engine`,
  which survives the replace unchanged and is then handed to `http.request` as a filesystem path.

The result is `ENOENT` before a single API call. **The provider `T646a` delivered cannot start a
container on the machine `T646b` was waiting for.**

## Why no test caught it

`T570` tests the provider against a **mocked daemon** — deliberately, and correctly: it verifies
request construction and every `ADR-0002` flag without needing a runtime. But `unixSocketDockerApi`
is the *transport factory*, and the mock replaces exactly that. **The one function the mock exists to
stand in for is the one function no test exercises.**

This is the seventh occurrence of the pattern this programme keeps recording: *a check that names the
right condition and cannot observe it.* The others are `DEF-001-001`, `DEF-018-001`, `DEF-028-001`,
`DEF-028-003`, `DEF-027-001` and `DEF-027-002`.

It is also why `T646b` was never a formality. Eleven days of "we just need a machine with Docker"
concealed a provider that would have failed on this one.

## Options considered

| Option | Verdict |
|---|---|
| Hard-code the Windows pipe | rejected — trades one platform assumption for another |
| Require `DOCKER_HOST` to be set explicitly | rejected — moves a solvable defect onto every operator, and the failure mode stays `ENOENT` |
| **Resolve per platform, and parse `npipe://` as well as `unix://`** | **taken** |

## Resolution

`unixSocketDockerApi` now resolves in this order: an explicit argument; `DOCKER_HOST` with either a
`unix://` or `npipe://` scheme stripped; then the platform default — `//./pipe/docker_engine` on
`win32`, `/var/run/docker.sock` elsewhere. Node's `http.request` accepts a Windows named pipe as
`socketPath` directly, so the transport itself needed no change.

The exported helper `resolveDockerSocketPath(platform, env, explicit)` makes the resolution a pure
function, which is what lets `T668` test all six branches without a daemon — closing the gap that
allowed this defect through.

**Verified**: `T668`'s unit tests, and by `T646b` itself, which now reaches the daemon.
