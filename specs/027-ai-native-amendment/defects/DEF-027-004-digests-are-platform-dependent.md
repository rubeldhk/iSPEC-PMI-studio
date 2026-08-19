# DEF-027-004 — the register digests are platform-dependent, so `G-27-11` fails in CI

**Epic**: `EPIC-027` | **Raised**: 2026-08-19 | **Status**: **CLOSED — FIXED 2026-08-19**
**Originating task**: `T603`/`T605` · found by the **first CI run** since EPIC-027 closed
**Severity**: HIGH — blocks CI on every platform whose checkout differs from the author's

## What it is

`register-digest.spec.ts` hashes each source file's **raw bytes**:

```ts
const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
…
if (sha256(readFileSync(path, 'utf8')) !== digest) { … }
```

This repository has no `.gitattributes` and `core.autocrlf=true` on the authoring machine, so the
working copy holds **CRLF**. The digests in `register.json` were computed against CRLF bytes. GitHub
Actions checks out on Linux with **LF**, so every digest differs and `G-27-11` reports all nine
sources as *"changed since the last build"*.

Measured, not inferred:

```text
files: 9 | match RAW bytes (CRLF here): 9 | match LF-normalised: 0
```

The check is correct about what it observes — the bytes genuinely differ. It is wrong about what
that means: nobody edited anything.

## Why it was never seen

EPIC-027's closing report says it plainly under *Not verified*: **"CI has not run. Every gate above
was executed locally, and nothing is pushed."** This is the first CI run since, and it found the
gap on the first attempt. The honesty of that line is what made this diagnosable in minutes.

EPIC-026 hit the identical hazard and solved it: `RF-7` normalises **line endings only** before its
exact-text comparison, *"because they are decided by git's `core.autocrlf` and the checkout
platform, not by anything a person wrote."* The reasoning was available; this check predates it.

## Options

| | Option | Consequence |
|---|---|---|
| **A** | Normalise line endings before hashing, in generator and checker, then regenerate | Platform-independent. Digests change once, deliberately |
| **B** | Add `.gitattributes` forcing LF for the register files | Fixes these nine and leaves the next file to rediscover it |
| **C** | Hash after stripping all whitespace | Rejected — a digest that ignores whitespace cannot detect a whitespace edit, which is a real edit |

## Resolution

**Option A.** `scripts/build-register.mjs` and `tests/governance/register-digest.spec.ts` both
normalise `\r\n` → `\n` before hashing, and the projection is regenerated so the committed digests
are LF-based. A digest then means *"this content"*, not *"this content on this operating system"*.
