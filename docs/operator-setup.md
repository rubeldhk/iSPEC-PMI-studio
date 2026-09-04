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

The network must permit **exactly** the profile's destinations (`api.anthropic.com` for
`generation`) and nothing else. `R-028-8` recorded why `docker network create` alone cannot express
that; **`D-28` delivered the shape that can** (EPIC-028 Phase 8). One command creates both halves —
the `--internal` network (no route out) and the proxy sidecar whose whitelist is *generated from
the profile*:

```console
$ docker build -t pmi-studio/egress-proxy execution-providers/docker/proxy
$ node scripts/egress-proxy-up.mjs generation
```

The sandbox reaches the sidecar via `HTTPS_PROXY` (injected by the provider) and the sidecar
tunnels CONNECT/443 to the allowlisted hosts only. Re-run the script after any profile change; it
converges rather than erroring.

> The provider's preflight now refuses a network that merely *exists* (`DEF-028-015`): one that is
> not internal routes past the proxy and is refused; an internal one without the sidecar is
> containment, not the profile, and is also refused. A bare
> `docker network create --internal pmi-egress-generation` therefore no longer passes — run the
> bring-up script instead.

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

## 6. The local workspace — a directory on the user's machine (EPIC-041)

A project with a root path is a directory PMI Studio **prepares** and the user's own agent works
in. The API writes it; a worker initialises it; the credential that lets the agent reach the API
is shown once and never written into the directory (`specs/041-local-project-workspace`).

**Six variables** (`.env.example` carries defaults): `PMI_PROJECTS_ROOT` (where the API writes),
`PMI_PROJECTS_ROOT_HOST` (the same directory as the host sees it — mounted at `/projects` by
`docker-compose.yml`, and the path written into every `.pmi/project.json`), `PMI_PUBLIC_URL` (what
the agent's MCP server calls), `PMI_ENGINE_TAG` (the engine toolkit tag the initialise step pins),
`PMI_MCP_SERVER_VERSION` (written into `.mcp.json`), `PMI_INITIALISE_WAIT_MS` (how long a prepared
project waits for a worker before reading *initialisation pending*), and the two defaults a project gets when its creator chooses neither — `PMI_DEFAULT_AGENT_INTEGRATION` (empty means the workspace bundle's default) and `PMI_DEFAULT_SCRIPT_TYPE` (`sh` or `ps`). For development, `PMI_MCP_SERVER_COMMAND` runs the `pmi-studio` MCP server from a checkout instead of the published `@pmi/mcp-server` package; leave it empty on any deployed stack. The server itself is `packages/mcp-server` (`@pmi/mcp-server`): a client of this API, started by the developer's agent from the project's `.mcp.json`; it needs `PMI_STUDIO_URL` (the public address the platform wrote) and `PMI_STUDIO_TOKEN` (the credential, from the developer's environment only).

**`uv` on the worker host.** The initialise step runs the engine toolkit at the pinned tag through
`uvx` (`specify init --here --force --integration <i> --script <s>`) in the project directory.
Without `uv` the step fails by name (`initialiser_unavailable`) and the project reads *failed* at
`run_engine_init`; with no worker at all it reads *initialisation pending* and the setup skill
`setup-PMIStudio` finishes the job from inside the directory. Neither outcome is silent. The
containerised stack has no worker that can reach the host directory, so *initialisation pending*
is its expected result — see the outcome table in `README.md` §Setup.

**What to check after `docker compose up`:** `docker compose config` shows the `/projects` mount;
`POST /v1/projects` with a `rootPath` answers `201` with `provisioningState: prepared` and — once —
`connectorCredential.value`; `GET /v1/projects/:id/provisioning` lists the record with every step
it completed. A `503 projects_root_unavailable` means the mount is missing or not writable.
