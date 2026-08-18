# DEF-028-010 — nothing can report which image actually ran

**Status**: CLOSED · **Raised**: 2026-08-17 · **Epic**: EPIC-028 · **Task**: `T646b` (found)
**Severity**: makes `T577` unsatisfiable, and `T577` gates `SC-AGT-001`

## What it is

`T577` requires the transcript to name an image digest, for a good reason it states itself:

> *"A tag is a moving target. Six months on, `pmi-studio/speckit-engine` cannot tell you which image
> produced the specification; a digest can."*

`runV6` looks in the only two places that existed:

```js
digest =
  extractImageDigest(environment.descriptor.imageDigest) ??
  extractImageDigest((await session.exec(['sh','-c','echo "$PMI_IMAGE_DIGEST"'])).stdout);
```

- `ExecutionEnvironmentDescriptor` has **no `imageDigest` field**. The provider describes its
  *capabilities*, not any particular run, so this was always `undefined`.
- `PMI_IMAGE_DIGEST` is set by **nothing**. Not the Dockerfile, not `buildSandboxEnvironment`, not
  the provider. The probe returns an empty string.

So the first real run produced:

```text
[FAIL] record_image_digest — no sha256 digest reported — the transcript cannot identify the image
```

**A required piece of evidence had no source.** `T577` was written to gate `T646b`, and until a real
run happened, nothing revealed that the gate could never open.

## Why no test caught it

`T576a` supplies `descriptor.imageDigest` in its stub, so `runV6` reads it and the test passes. The
stub answers a question the real descriptor does not have a field for. **The fixture invented the
capability the system lacked** — the same shape as `DEF-028-005`, where the stub supplied a caller
that did not exist.

Eleventh instance of the pattern, and the third found by this one task.

## Options considered

| Option | Verdict |
|---|---|
| Bake a digest into the image at build time | rejected — an image's own digest is not knowable while it is being built |
| Have the runner ask Docker directly | rejected — `T581`'s architecture rule: nothing outside the worker composition root reaches a container runtime directly, and `scripts/` is not that root |
| Add `imageDigest` to the environment descriptor | rejected — the descriptor describes the provider, not one run. A per-run value there is wrong for every concurrent session |
| **Have the provider report it on the session it just started** | **taken** — the provider is the only component that knows which image the daemon actually resolved |

## Resolution

- `ExecutionSession` gains an optional readonly `imageDigest`.
- `DockerEngineApi` gains an optional `inspectContainer(id)`, and the Docker provider populates
  `imageDigest` from the started container's `Image` field — the daemon's own content address for
  the image it resolved, which is exactly "which image produced this".
- `runV6` consults the **session** first, then the descriptor, then the in-container probe. The two
  older sources are kept: a future provider may legitimately know its digest up front.
- `T576a` is extended so a stub that supplies neither source produces `FAILED`, rather than a stub
  inventing the field.

**Verified**: `T672`'s unit tests, and by `T646b`, whose transcript now names a real sha256.
