# DEF-018-002 — content comparisons are platform-dependent, and were green by accident

**Epic**: `EPIC-018` (owns `G-02b`) · also affects **EPIC-028** `T549a`
**Raised**: 2026-08-19 | **Status**: **CLOSED — FIXED 2026-08-19**
**Found by**: merging `epic/026-epic-stage-kanban` into `main` — the checkout re-materialised files and 14 tests turned red
**Severity**: HIGH — the checks pass or fail according to how bytes happened to land on disk

## What it is

Two check families compare file **content**, and both compare git-stored bytes against
working-copy bytes:

| Check | Comparison |
|---|---|
| `G-02b` (steering currency) | `git show HEAD:<file>` vs `readFileSync(<file>)` |
| `T549a` (frozen egress control) | a recorded sha256 vs `sha256(readFileSync(<file>))` |

Git stores blobs with **LF**. This repository has no `.gitattributes` and `core.autocrlf=true` on the
authoring machine, so a **checkout writes CRLF**. The two sides therefore differ for reasons no
person introduced.

Measured, not inferred:

```text
engine-adapters/speckit/docker/sandbox.json
  has CRLF: true
  sha(raw) : 70f93ff83c82ca8a      <- what the check computed
  sha(LF)  : 389daa738f82bd34      <- the recorded frozen hash
```

The frozen hashes are LF-based. Every one of the ten steering files reported *"a content change
carries no version increment"* for the same reason.

## Why it appeared only now

**Because the files had never been re-checked-out.** They were written by an editor as LF and stayed
LF on disk, so both sides agreed. `git checkout main` deleted them and the merge re-materialised
them through git, which applied `core.autocrlf` and wrote CRLF. Nothing about the content changed;
only the line endings did, and only because a branch switch happened.

**These checks were green by accident.** They pass in CI, where a Linux checkout is LF, and fail on
any Windows working copy whose files have been through a checkout — which is to say, on the machine
they were written on, the next time anyone switched branches.

This is the third appearance of one root cause in two days. `DEF-027-004` was the register digests;
before that EPIC-026's `RF-7` anticipated it and normalised line endings *only*, recording why:
*"they are decided by git's `core.autocrlf` and the checkout platform, not by anything a person
wrote."* Two checks predate that reasoning and never received it.

## Resolution

Both checks normalise `\r\n` → `\n` on **both sides** before comparing. Nothing else is normalised —
a comparison that ignored whitespace could not detect a whitespace edit, which is a real edit.

The frozen hashes are **unchanged**: they were always LF-based, and `SC-AGT-005` freezes
`sandbox.json` and `sandbox-config.spec.ts`, neither of which is touched. Only the checkers change.

## The wider gap this leaves

A `.gitattributes` declaring `* text=auto eol=lf` would remove the whole class rather than treating
it three times. Not done here: it rewrites line endings across every tracked file in the repository,
which is a change that deserves its own task and its own review rather than riding along with a
merge. **Recorded as the recommended follow-up.**
