# DEF-028-015 — the egress network is checked for existence, never for what it permits

**Epic**: `EPIC-028` · blocks **`SC-AGT-001`** · relates to decision **`D-28`** (proxy enforcement)
**Raised**: 2026-08-19 | **Status**: **OPEN** — the fix needs `D-28`, which is unowned
**Found by**: `T699`, after pre-baking the scaffold disproved the hypothesis it was built to test
**Severity**: **HIGH** — the profile reports as enforced while permitting something else entirely

## The hypothesis this disproved

`DEF-028-013` guessed that `specify init` needed GitHub, which the generation egress profile forbids.
`T699` pre-baked the scaffold into the image so it needs no network at all. **The run still fails,
identically**, against the new image digest — so the scaffold was never the cause.

Recorded because the guess was wrong and the record should say so. The pre-baked scaffold is kept:
it removed a real run-time network dependency and is correct on its own merits, per the 2026-08-19
ruling. It simply did not fix this.

## What is actually happening

`GENERATION_EGRESS_PROFILE` declares exactly one permitted destination:

```
allowedDestinations: ['api.anthropic.com']
```

The Docker network that carries it on this machine:

```
$ docker network inspect pmi-egress-generation --format '{{.Name}} internal={{.Internal}}'
pmi-egress-generation internal=true
```

**`internal=true` permits no egress at all** — including the one destination the profile exists to
allow. So the agent cannot reach Anthropic, `claude` exits 1, and the run fails with the profile
reporting as enforced.

## The gap, which is wider than this machine

The provider checks the network **exists** and stops there. Its own comment states the danger it was
guarding against:

> a network created by default is a bridge network with unrestricted egress: the run would succeed,
> the profile would report as enforced, and the sandbox would have the whole internet

That reasoning is right and the check is half of it. **Existence is not conformance.** A network can
fail the profile in two opposite directions, and only one of them is loud:

| Network | Permits | Profile says | Detected |
|---|---|---|---|
| `--internal` | nothing | `api.anthropic.com` | no — the run fails confusingly |
| plain bridge | everything | `api.anthropic.com` | **no — the run succeeds** |

The second is the dangerous one, and it is silent. A sandbox with the whole internet, reporting a
frozen one-destination profile, is precisely the state `SC-AGT-005` froze the boundary to prevent —
and the freeze protects the *declaration*, which nothing compares against the *network*.

## Why this cannot simply be fixed here

Restricting egress to one hostname is not something a Docker network can express. `--internal` is
all-or-nothing, and a bridge network is unrestricted; there is no middle setting. Host-level
filtering by DNS name requires a forward proxy that terminates and allow-lists — which is decision
**`D-28`**, `enforcement: 'proxy'`, recorded in this epic's closure as **unowned and not built**:

> The egress **proxy** (`D-28`, `enforcement: 'proxy'`) | unowned | Not built by this epic; the
> Docker provider implements the network-policy half only

So the profile is, today, undeliverable as written. The provider implements the half a network can
express and names the other half as `D-28`'s. **`SC-AGT-001` is blocked on that decision**, not on
anything remaining in this epic's code.

## Remaining work

- `T700` — assert the egress network CONFORMS to the profile, not merely that it exists: at minimum
  refuse an `internal` network for a profile with permitted destinations, and refuse a network that
  permits more than the profile names. The second half needs `D-28` to say how enforcement is
  expressed before it can be checked.
- `D-28` — own and build the egress proxy, or amend `ADR-0002` to state what the Docker provider can
  actually enforce alone. Owner: unowned. **This is what `SC-AGT-001` now waits on.**
