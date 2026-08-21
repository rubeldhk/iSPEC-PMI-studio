# Quickstart: Design System (EPIC-029)

**Phase 1** · 2026-08-20 · the runnable scenarios that prove this Epic worked

Each scenario is independently runnable and maps to a success criterion. `V4` is the one that
cannot be automated, and it is deliberately the one with a committed artifact.

## Prerequisites

```bash
pnpm install                 # adds axe-core (dev dependency)
docker compose up -d         # only for V5, which drives the real app
```

## V1 — the token layer is complete and contrasts correctly

**Proves**: `SC-DS-005`, `SC-DS-007` · **Requirements**: `FR-DS-002`, `FR-DS-010`, `FR-DS-012`

```bash
pnpm vitest run --project governance tests/governance/design-tokens.spec.ts
```

**Expected**: every token declared exactly once; every themed token present in **both** themes;
every text-on-surface pair meets WCAG 2.2 AA contrast in both themes, computed from the values.

**Fails when**: a token is declared twice, defined in one theme only, or a pair falls below the
ratio — each failure naming the token or the pair and its computed ratio, not just "contrast
failed".

## V2 — no component may hold a literal visual value

**Proves**: `SC-DS-003` · **Requirements**: `FR-DS-001`, `FR-DS-051`

```bash
pnpm lint
```

**Expected**: clean.

**Then prove the rule can fail** — the check is itself a check:

```bash
# add `color: #ff0000` to any component, re-run, expect a failure naming file and value
```

A rule that passes on a literal is decoration (Constitution V), so its own test asserts the
failure rather than assuming it.

## V3 — every component implements every state it declares

**Proves**: `SC-DS-004` · **Requirements**: `FR-DS-020`, `FR-DS-021`, `FR-DS-033`

```bash
pnpm vitest run --project frontend tests/unit/design
```

**Expected**: for each of the fifteen components, one assertion per state its row in
[contracts/components.md](./contracts/components.md) declares — including loading, empty and error,
the three most often omitted and most often met.

**Also expected**: the axe check runs with `['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']`
**and `target-size` explicitly enabled**, plus the meta-test proving the harness detects a known
violation. Without that meta-test the suite can report conformance to a standard it never tested —
see research `R-029-2`.

## V4 — a person can use the product without a mouse

**Proves**: `SC-DS-002`, `SC-DS-008` · **Requirements**: `FR-DS-032`, `FR-DS-034` · **MANUAL**

Not automatable, and the reason is the point: automated checks cannot see focus *order* or whether
an announcement is *meaningful*. Walk sign-in → create project → capture requirement using only a
keyboard and a screen reader, then commit the transcript to
`docs/accessibility/EPIC-029-manual-pass.md` naming the tool, its version, and each journey.

```bash
pnpm vitest run --project governance tests/governance/accessibility-record.spec.ts
```

**Expected**: the check finds the record and confirms it names a screen reader and at least one
journey. A file saying only "passed" **fails** — that is the difference between a transcript and a
tick, and it is why `FR-DS-034` exists.

## V5 — the delivered pages render from the system, in both themes

**Proves**: `SC-DS-006` · **Requirements**: `FR-DS-050`, `FR-DS-052`

```bash
pnpm --filter frontend dev      # then: http://localhost:5173
```

**Expected**: SignIn, Projects, Requirements and Traceability render from tokens alone; switching
the OS between light and dark re-themes every one without an undefined token or text on a
same-coloured surface; at 200% text zoom nothing clips; at 360px width nothing overflows.

**Note**: this is the scenario the first UAT session failed by default — the frontend had **zero
CSS files**, and the product rendered in browser-default Times New Roman. That is the baseline this
Epic is measured against.

## What these scenarios do NOT prove

- That components are **built rather than adopted** — decision `D-42` is open, and both answers
  satisfy every scenario here.
- That future Epics' UI is styled — each Epic styles its own (`FR-DS-052`); the lint rule of `V2`
  is what makes that automatic rather than a promise.
- Real-browser contrast or layout — jsdom has no layout (research `R-029-3`), so `V1` computes
  contrast from values and `V5` is a human looking at a screen. A browser-driven suite belongs to
  EPIC-015.
