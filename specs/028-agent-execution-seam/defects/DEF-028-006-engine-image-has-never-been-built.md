# DEF-028-006 — the engine image has never been built, and could not have been

**Status**: CLOSED · **Raised**: 2026-08-17 · **Epic**: EPIC-028 · **Task**: `T646b` (found)
**Cause**: EPIC-003 `T088`, marked complete 2026-08-08 · **Severity**: blocks `T646b`; qualifies EPIC-003's closure

## What it is

`engine-adapters/speckit/docker/Dockerfile` pins `ARG SPECIFY_VERSION=0.0.17` and installs
`specify-cli==${SPECIFY_VERSION}`. **There is no such release.** PyPI's `specify-cli` starts at
`0.9.4`:

```text
ERROR: Could not find a version that satisfies the requirement specify-cli==0.0.17
       (from versions: 0.9.4, 0.10.0, ... 0.16.3, 0.16.4)
ERROR: No matching distribution found for specify-cli==0.0.17
```

`docker build` fails at layer 6 of 9. It has always failed. `T088` — *"Build the engine container
image"* — was marked `[X]` on an image that **cannot be built**, and EPIC-003 closed with it.

The same fictional version propagated outward as fact: `worker/src/engine-composition.ts` defaults
`specifyVersion` to `'0.0.17'`, so the engine descriptor — the thing a generated specification is
attributed to — would have reported a version that never existed.

`ARG AGENT_CLI_VERSION=1.0.0` was checked at the same time and **is** real
(`npm view @anthropic-ai/claude-code@1.0.0` → `1.0.0`). Only the `specify` pin is fiction.

## Why no test caught it

`T088a` (`engine-adapters/speckit/tests/unit/engine-image.spec.ts`) asserts:

```ts
expect(dockerfile).toMatch(/ARG SPECIFY_VERSION=\d+\.\d+\.\d+/);
```

`0.0.17` matches that regex perfectly. **The check verifies that a pin has the shape of a version,
not that it names one.** It reads the Dockerfile and never builds it, so a build that has never
succeeded produced a green test for nine days.

This is the eighth recorded instance of *a check that names the right condition and cannot observe
it*, and the most consequential: the previous seven guarded process artifacts, this one guarded the
container the entire product runs inside.

The Dockerfile's own comment is the sharpest evidence: *"Versions are PINNED. RAID R-01 is the
top-scoring risk in this programme… a floating tag would mean the image silently changes."* The
concern was right. **A pin nobody ever resolved is not a pin — it is a floating tag that floats to
nothing.**

## Options considered

| Option | Verdict |
|---|---|
| Leave the pin, record the finding, stop | rejected — `T646b` would stay unrunnable and `SC-AGT-001` unverified for a fourth week |
| Un-pin (`specify-cli` latest) | rejected — R-01 is the top risk; floating is what the pin exists to prevent |
| Pin to a release that exists **and record the artifact digests that prove it was resolved** | **taken** |

## Resolution

- `SPECIFY_VERSION` → `0.16.4`, the current release, published 2026-08-14.
- `engine-adapters/speckit/docker/pinned-versions.json` records each pin with the **sha256 of the
  artifact actually resolved** — for `specify-cli` 0.16.4 the wheel
  `000d9732faf9eefa78782edb0805395a52c5f070914ce31c47193ead3116763c` and sdist
  `1b7118132869dce8d91163226cc809006253bf1cc3b81acd9be6bfcb411785e4`.
- `T088a` is strengthened by `T669`: a pin must appear in that record with a digest. A version
  invented at a keyboard has no digest and now fails the check. **That is the assertion `T088a` was
  missing.**
- `worker/src/engine-composition.ts` default corrected to `0.16.4`.

### Provenance note, recorded rather than glossed

PyPI's `specify-cli` self-describes as *"Specify CLI, part of GitHub Spec Kit"*, which matches
`R-001`. Its PyPI metadata carries **no `project_urls` and no author**, so the link to
`github/spec-kit` rests on the package description alone. The digests above pin *which artifact* is
installed; they do not attest *who published it*. Confirming that the PyPI name is the project's own
distribution channel is left open as **`R-028-7`** and named in EPIC-003's closure addendum.

## Effect on EPIC-003

EPIC-003 is closed and stays closed — `T088`'s Dockerfile is otherwise correct, and its closure
already carried *"No real container has ever started."* But that sentence understated it: no image
had ever been **built**. An addendum records this against the epic that shipped it.

**Verified**: `docker build` now succeeds, and the resulting image is the one named in
`v6-transcript.md` by digest.
