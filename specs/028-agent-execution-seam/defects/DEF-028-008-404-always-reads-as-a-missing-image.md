# DEF-028-008 — every 404 is reported as a missing image

**Status**: CLOSED · **Raised**: 2026-08-17 · **Epic**: EPIC-028 · **Task**: `T646b` (found), `T646a` (cause)
**Severity**: diagnostic — misdirects the operator

## What it is

```ts
const reason =
  status === 404
    ? 'image_unavailable'
    : code === 'ENOENT' || code === 'ECONNREFUSED'
      ? 'provider_unavailable'
      : 'provider_error';
```

The Docker Engine API answers `404` for **anything** it cannot find — an image, a network, a
container, a volume. The classifier assumes the only findable thing is an image.

On the first real run, a missing *network* was reported as `image_unavailable`. The image was present
and correct; the operator is sent to rebuild it.

The method's own comment states the cost:

> *"`image_unavailable` and `provider_unavailable` are deliberately distinct: one means build the
> image, the other means fix the infrastructure, and **sending an operator to the wrong one costs an
> outage's worth of time**."*

The reasoning was right and the implementation contradicted it.

## Why no test caught it

`T570`'s failure-mapping test asserts a 404 maps to `image_unavailable` — with a *mocked* 404 that
the test itself labels as an image lookup. The test and the code share the same assumption, so the
test can only confirm it. No fixture ever presented a 404 for something other than an image.

## Options considered

| Option | Verdict |
|---|---|
| Map 404 to `provider_error` | rejected — loses the genuinely useful image signal, which is the common case |
| Inspect the failing request path | rejected — the classifier does not receive it, and threading it through for this would spread daemon detail across the provider |
| **Read what the daemon says it could not find** | **taken** — the message names the resource, and it is the daemon's own words rather than a guess |

## Resolution

`classify` now examines the daemon's message on a 404: a message naming a network becomes
`policy_refused` (the network is the egress control), anything else stays `image_unavailable`. The
default is unchanged, so the common case still says *build the image*.

**Verified**: `T670`'s classification tests, driven by the daemon's real message from this run —
`"failed to set up container networking: network pmi-egress-generation not found"` — rather than a
fixture invented alongside the code.
