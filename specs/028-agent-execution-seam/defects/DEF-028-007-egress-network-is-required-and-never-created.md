# DEF-028-007 — the egress network is required, and nothing creates or documents it

**Status**: CLOSED · **Raised**: 2026-08-17 · **Epic**: EPIC-028 · **Task**: `T646b` (found), `T646a` (cause)
**Severity**: blocks every real run

## What it is

The provider translates an egress profile into a Docker network name:

```ts
NetworkMode: `${this.networkPrefix}${request.egressProfile.name}`,   // pmi-egress-generation
```

The daemon's answer, on the first real run in this programme's history:

```json
{"message":"failed to set up container networking: network pmi-egress-generation not found"}
```

**Nothing creates that network. Nothing documents that it must exist.** Not the quickstart, not
`T646b`, not `governance/`, not the provider's own error. An operator who follows every written
instruction gets a container that will not start and a message about an image.

## Why no test caught it

`T570` drives the provider against a **mocked daemon**, which accepts any `NetworkMode` string
because a mock has no networks. The assertion verifies the *name is constructed correctly* — and it
is. Nothing verified the named thing exists.

Ninth instance of *a check that names the right condition and cannot observe it*, and the second
found by `T646b` alone. That is the value of running the thing: three of this session's five defects
were invisible to a suite of 617 passing unit tests.

## Options considered

| Option | Verdict |
|---|---|
| Have the provider create the network when absent | **rejected — this would be a security regression.** A network created by default is a bridge network with unrestricted egress. The profile exists to restrict egress to `api.anthropic.com`; auto-creating would silently grant the whole internet and still report the profile as enforced. `SC-AGT-005` froze this boundary precisely so an epic could not widen it by accident |
| Fail with the current generic message | rejected — it is what produced *"the execution environment could not be started"* for a missing network |
| **Preflight the network, refuse with `policy_refused`, and name what the operator must create** | **taken** |

## Resolution

`DockerExecutionEnvironment.start` now checks the network exists **before** creating a container, and
refuses with `policy_refused` — not `image_unavailable` — naming the network, the profile, the
destinations it must permit, and the command that creates a containment-correct one.

The provider still **never creates it**. That the network encodes policy is exactly why an operator
owns it, and the message now says so:

```text
Egress profile "generation" requires the Docker network "pmi-egress-generation", which does not
exist. This provider does not create it: the network IS the egress control, and one created by
default would permit the whole internet while reporting the profile as enforced.
Create it with the destinations the profile allows (api.anthropic.com), or, for a fully contained
run with no egress at all:  docker network create --internal pmi-egress-generation
```

`docs/operator-setup.md` records the same, and `quickstart.md` `V6` gains the prerequisite it never
had.

**Verified**: `T670`'s unit tests (mutation-checked), and by `T646b`, which now starts a container.

## What remains open

Creating a network that permits **exactly** `api.anthropic.com` and nothing else is not a `docker
network create` flag — it needs a proxy or a CNI policy. `D-28` already records the proxy as
undelivered, and `IMPLEMENTATION_EGRESS_PROFILE` carries `enforcement: 'proxy'` for the same reason.
So today an operator can have containment (`--internal`, no egress) or reachability (a normal bridge,
full egress) but **not the profile as specified**. Recorded as **`R-028-8`** and named in the
`v6-transcript.md`, because a transcript that did not say so would imply the profile was enforced.
