# Operator setup — what a machine needs before a real run

**Written 2026-08-17**, after `T646b` — the first real container run in this programme — failed five
times in a row on prerequisites nothing had written down.

Every failure below was real, in this order. They are recorded rather than smoothed over, because
the next operator hits them in the same order.

## 1. A Docker daemon

```console
$ docker info --format '{{.ServerVersion}} · {{.OSType}}/{{.Architecture}}'
28.3.3 · linux/x86_64
```

The provider talks to the **Docker Engine HTTP API** over a local socket — no `dockerode`, no
`docker` CLI. It finds the socket in this order:

1. an explicit argument to `unixSocketDockerApi()`;
2. `DOCKER_HOST`, with a `unix://` or `npipe://` scheme stripped;
3. the platform default — `//./pipe/docker_engine` on Windows, `/var/run/docker.sock` elsewhere.

> `DEF-028-004`: the default used to be `/var/run/docker.sock` on every platform, so the provider
> could not reach a daemon on Windows at all.

## 2. The engine image, built

```console
$ docker build -t pmi-studio/speckit-engine engine-adapters/speckit/docker/
```

> `DEF-028-006`: this had **never** succeeded. `SPECIFY_VERSION` was pinned to `0.0.17`, which does
> not exist on PyPI. Pins now live in
> [`engine-adapters/speckit/docker/pinned-versions.json`](../engine-adapters/speckit/docker/pinned-versions.json)
> with the sha256 of the artifact actually resolved, and `T669` fails on a pin without one.

## 3. The egress network — and this one is a policy decision

The provider maps an egress profile to a Docker network named `pmi-egress-<profile>`. **It refuses
to create that network**, and the refusal is deliberate: the network *is* the egress control. One
created by default would be a bridge network with unrestricted egress, and the run would report the
profile as enforced while the sandbox had the whole internet.

For a **fully contained** run — no egress at all:

```console
$ docker network create --internal pmi-egress-generation
```

For a run that can actually reach the AI provider, the network must permit **exactly** the profile's
destinations (`api.anthropic.com` for `generation`) and nothing else.

> ⚠️ **`R-028-8` — that network cannot be created with `docker network create` alone.** Restricting
> egress to one hostname needs a proxy or a CNI policy. `D-28` records the proxy as undelivered, and
> `IMPLEMENTATION_EGRESS_PROFILE` already carries `enforcement: 'proxy'` for the same reason. So
> today an operator can have **containment** (`--internal`, no egress) or **reachability** (a normal
> bridge, full egress) — **not the profile as specified**. Any transcript produced on a bridge
> network must say so; the profile is not being enforced.

## 4. The AI provider credential

```console
$ export AI_PROVIDER_TOKEN=...   # never committed, never logged (PC-3, ADR-0002)
```

This is the **only** credential a sandbox receives. Without it the engine refuses before starting a
container, which is correct — a doomed run is never billed:

```text
[FAIL] generate_specification — Refusing to start a sandbox without an AI provider credential.
```

## 5. Run it

```console
$ pnpm v6:real-run --dry-run   # prints the plan, starts nothing
$ pnpm v6:real-run             # writes specs/028-agent-execution-seam/v6-transcript.md
```

Exit status and transcript never disagree: a failed run exits non-zero.

## What a green CI run does not tell you

CI cannot run any of this — RAID `R-04` blocks container-in-container. Of the six defects `T646b`
found, **all six were invisible to 658 passing unit tests**, because each lives at a seam a mock
replaces:

| Defect | The seam |
|---|---|
| `DEF-028-004` | the transport a mocked daemon stands in for |
| `DEF-028-005` | the caller a test supplies itself |
| `DEF-028-006` | a pin read from a file, never resolved |
| `DEF-028-007` | a network name constructed correctly, never looked up |
| `DEF-028-008` | a 404 fixture labelled by the same assumption as the code |
| `DEF-028-009` | an image's `ENTRYPOINT` composed with a provider's `Cmd` — in neither artifact |
| `DEF-028-010` | a digest the stub invented and the system had no field for |
