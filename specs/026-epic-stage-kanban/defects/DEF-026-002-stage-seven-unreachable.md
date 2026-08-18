# DEF-026-002 — stage 7 is unreachable, so a Ready Epic reads as stalled

**Epic**: `EPIC-026` | **Raised**: 2026-08-18 | **Status**: **CLOSED — FIXED 2026-08-18**
**Originating task**: `T476`/`T483` (composition) · found by `T532` convergence, on the first Epic ever to reach readiness
**Severity**: HIGH — the register contradicts itself in the row that matters most

## What it is

The moment EPIC-026 became the first Epic to satisfy its DOR, its row read:

```text
| EPIC-026 | … | delivery | Analyzed | stalled | Ready (waived) | `DOR evaluation` |
```

Four cells, and three of them disagree with the fourth:

- **Stage `Analyzed`** — but `data-model.md` §1 defines stage **7** as `Ready` / `Ready (waived)`,
  with evidence *"every DOR condition passes, or is waived"*. That is exactly what happened.
- **Posture `stalled`** — `derivePosture` reads `stalled` for any Epic short of its terminal stage.
  The Epic is not short of anything; it is finished.
- **Next `DOR evaluation`** — the DOR has been evaluated. The answer was yes.

The cause is one line: `deriveStage` skips the `Ready` stage entirely —

```ts
if (stage.name === 'Ready') continue;  // "stage 7 is the DOR verdict, not an artifact"
```

— and **nothing ever puts it back**. The comment is correct that stage 7 is not an artifact; the
mistake is that the composition never layers the verdict on top, so the ladder stops at 6 for every
Epic forever.

## Why no test caught it

Every stage test asserts a rung of the artifact ladder, and the ladder genuinely ends at `Analyzed`.
`readiness.spec.ts` asserts `Ready (waived)` — correctly — but it tests `resolveReadiness` in
isolation and never asks what **stage** the Epic is showing. Neither suite could see the
disagreement, because the disagreement lives *between* them.

Twelfth instance of the pattern this repository keeps recording. The novelty here is that it needed
the first Epic in the programme to actually reach readiness before it could appear at all — the
register has been shipping a stage-7 that nothing could enter, and nothing said so.

## Options

| | Option | Consequence |
|---|---|---|
| **A** | Promote the stage to `Ready` in the composition when the DOR verdict is `Ready`/`Ready (waived)` | Matches `data-model.md` §1 exactly. Keeps derivation pure and layers the verdict where the two already meet |
| **B** | Make `deriveStage` evaluate the DOR | Rejected — it would make stage derivation depend on declarations, crossing the derived/declared line the whole design rests on |
| **C** | Drop stage 7 and let readiness carry it alone | Rejected — `FR-ESK-001` fixes seven stages and `G-26-01` asserts seven; the register would show a journey that never completes |

## Recommended resolution

**Option A.** `buildRegisterModel` already holds both the derived stage and the readiness verdict;
promoting there is a three-line change at the exact seam where derived meets declared, and it leaves
`deriveStage` pure. `next` becomes `/speckit-implement` and the posture clears, because the Epic has
reached its terminal stage.

---

## Resolution — 2026-08-18

**Option A applied** in `buildRegisterModel`: when a delivery Epic's DOR verdict is `Ready` or
`Ready (waived)`, the stage becomes `Ready`, `next` becomes `/speckit-implement`, and the posture
clears because the terminal stage has been reached. `deriveStage` is untouched and stays pure.

Guarded by five assertions in `build.spec.ts`, including one that fails when **no** Epic is at
readiness — without it the other four would pass vacuously against an empty list and keep passing
through a regression. That guard fired immediately on first run, which is how it earned its place.

A parent design is explicitly excluded: `evaluatesDor(kind)` is false for it, so `FR-ESK-024`'s
terminal stage of `Planned` is preserved rather than overwritten by the same fix.

### A note on what recording this defect did

Raising `DEF-026-002` as OPEN made `DOR-11` fail, which withdrew EPIC-026's readiness in the same
run. That is `data-model.md` §4's *"evaluation is fresh, never stamped"* behaving exactly as written:
the register does not remember that an Epic was ready, it asks again. Closing the record restored it.
