# DEF-031-001 — an eleventh steering subject, and what one-winner-per-subject means for rules

**Epic**: `EPIC-031` | **Raised**: 2026-10-08 | **Status**: DEFERRED to `EPIC-019`
**Originating task**: `T728b` · **Severity**: MEDIUM

## Finding

`R-031-1` (clarified 2026-08-22, `FR-DPE-005`) puts classification rules in `EPIC-019`'s steering as a
new subject. `EPIC-019`'s `FR-ENH-002` says steering has *"exactly the ten named subjects"*. This Epic
added `risk-classification` as an eleventh (`steering.validation.ts`) and amended the pinning test so
the ten stay visibly the ten and the eleventh is named as `EPIC-031`'s.

And `resolveSteering()` keeps **one winning document per subject** — the narrowest scope. So a
project-scope ruleset replaces the workspace ruleset whole; it does not merge rule by rule. The
adapter applies that faithfully: merging per action would be a second precedence implementation,
which `R-031-1` rejected.

## Why deferred

Both are `EPIC-019`'s to settle: amend `FR-ENH-002` to admit the eleventh subject, and decide whether
steering should ever compose a subject's documents rather than choose one. Until then, a project that
wants the workspace's rules plus one more restates them.
