# DEF-028-003 — the frozen-egress check compares against a baseline that does not exist

**Epic**: `EPIC-028` | **Raised**: 2026-08-17 | **Status**: CLOSED
**Originating task**: `T549a` · found by `T591` (running quickstart `V8`)
**Severity**: HIGH — the check added *because* `SC-AGT-005` had no enforcement that could fail still
has none

## Expected

`T549a` was added by the analyse pass of 2026-08-14 with an explicit rationale:

> **`SC-AGT-005` had no enforcement that could fail in CI** … only a `git diff` inside `T591`'s
> quickstart run. The epic's own checklist calls it *"the most important criterion and the easiest
> to skip"*, and it is the one that proves which half of a security boundary this epic did **not**
> touch. A modified test would pass just as green and mean nothing; a hash comparison is the only
> form of that assertion that works.

## Actual

The check compares `sandbox.json` and `sandbox-config.spec.ts` against **`main`** — and neither file
exists on `main`:

```bash
git diff --stat main -- engine-adapters/speckit/docker/sandbox.json \
                        engine-adapters/speckit/tests/unit/sandbox-config.spec.ts
#  sandbox.json          | 101 ++++++++++++++++
#  sandbox-config.spec.ts | 128 +++++++++++++++++++++
#  2 files changed, 229 insertions(+)
```

229 insertions and zero deletions: from `main`'s point of view these files are **new**. `main` is at
`7980f9f`, which predates EPIC-003 — the branch carrying this work has never been merged.

So `atMain()` throws, the check takes its skip branch, and prints:

```
[T549a] SKIPPED — 'main:engine-adapters/speckit/docker/sandbox.json' is unavailable in this checkout.
```

**Every run. On every machine. Including CI.** The skip was written for a shallow clone — a
transient, environmental condition — and the actual condition is permanent and structural.

## Why this is worse than the gap it replaced

The skip is honest in its wording and reports rather than passing silently, which is right. But the
*suite* is green, `SC-AGT-005` is listed as enforced, and the assertion has never once executed.
That is a stronger claim than the `git diff` it replaced, resting on nothing.

**This is the third instance of one shape in two days**: `DEF-001-001` (an installation check that
read one of two processes), `DEF-018-001` (a conformance check that validated absences and not
presences), and now a freeze check whose baseline does not exist. In each, the check names the right
condition and cannot observe it.

## Options

| | Option | Consequence |
|---|---|---|
| **A** | Pin the expected content hashes as committed constants | Works on any branch, any clone depth, in CI, and after a merge. The hash **is** the freeze. **Recommended** |
| **B** | Compare against the merge-base rather than `main` | Still branch-topology-dependent, and a rebase silently changes the answer |
| **C** | Compare against the commit that introduced each file | Requires history walking, and is defeated by a squash merge |
| **D** | Leave it skipping until the branch merges | Leaves `SC-AGT-005` unenforced for exactly as long as the work is unmerged, which is when it matters |

## Resolution

**Option A.** The two SHA-256 hashes are committed in the check itself. A hash in the repository is
what "frozen" means: changing the manifest requires changing the recorded hash in the same commit,
which is a visible, reviewable act rather than a silent drift.

The `main` comparison is **retained as a second, additive assertion** — when the ref does exist it
is genuine evidence, and it costs nothing to keep. But it is no longer the only one, so a skip no
longer means nothing ran.

**Status**: CLOSED 2026-08-17.

## Traceability

- Criterion: **SC-AGT-005** · Originating task: `T549a` · Found by: `T591`
- Fixed in: `tests/governance/generation-egress-frozen.spec.ts`
- Related: [`DEF-001-001`](../../001-platform-foundation/defects/DEF-001-001-worker-observability-not-installed.md),
  [`DEF-018-001`](../../018-repository-governance/defects/DEF-018-001-conformance-record-overstates-presence.md)
  — same shape, same week
