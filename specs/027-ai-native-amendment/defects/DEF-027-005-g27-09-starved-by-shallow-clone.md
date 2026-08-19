# DEF-027-005 — `G-27-09` cannot see any history in CI

**Epic**: `EPIC-027` | **Raised**: 2026-08-19 | **Status**: **CLOSED — FIXED 2026-08-19**
**Originating task**: `T632` (check) · `T010`/`T048` (CI workflow) · found by the first CI run
**Severity**: HIGH — blocks CI, and would otherwise have passed by examining nothing

## What it is

`G-27-09` proves EPIC-027 shipped no product source by walking git history:

```ts
git(['log', '--format=%H|%s', '--all'])
```

`actions/checkout@v4` defaults to **`fetch-depth: 1`** — a shallow clone containing a single commit.
So in CI the walk finds **zero** EPIC-027 commits, and the check fails:

```text
no EPIC-027 commits found; G-27-09 would pass by having nothing to examine
```

## The check is behaving correctly

That failure comes from an assertion `T632` added deliberately:

> *"Without this the checks below iterate nothing and pass, which is the shape of every defect this
> week."*

Without that guard, `G-27-09` would have reported **green in CI forever** while examining nothing —
a `SC-AMD-009` gate that verified precisely zero commits. The anti-vacuity assertion is the only
reason this is a visible failure rather than a silent one, and it worked on its first exposure to
the environment it was written for.

**So the defect is in the environment, not the check.** CI starves a history-walking check of
history.

## Options

| | Option | Consequence |
|---|---|---|
| **A** | `fetch-depth: 0` on the checkout step | The check gets what it needs. Costs a full clone — seconds on this repository |
| **B** | Skip the check when the clone is shallow | Rejected — it reintroduces exactly the vacuous pass the guard exists to prevent, and would do so *only in CI*, where it matters most |
| **C** | Narrow the walk to the pushed range | Rejected — `SC-AMD-009` is a claim about the epic's whole history, not one push |

## Resolution

**Option A.** `.github/workflows/ci.yml` sets `fetch-depth: 0` on `actions/checkout@v4`, with a
comment naming the two checks that require history (`G-27-09` and `G-10`) so the next person to
"optimise" the clone sees what it costs.

> **`G-10` is affected the same way** and was silently degraded rather than failing: it reads
> `git log -1` and `git status`, so on a shallow clone it reports *"no epic determinable"* and
> stays quiet. Fixing the depth restores both.
