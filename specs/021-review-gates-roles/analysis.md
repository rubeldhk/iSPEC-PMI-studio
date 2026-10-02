# Analysis: Review Gates & Roles

**Epic**: `EPIC-021` · **Session**: 2026-08-19

Produced by `/speckit-analyze` against `spec.md`, `plan.md` and `tasks.md`.

## Findings

| ID | Category | Severity | Summary | Recommendation |
|---|---|---|---|---|
| F1 | Coverage Gap | MEDIUM | 7 of 7 owned requirements are cited by no task or feature note: `FR-ENH-012`, `FR-ENH-013`, `FR-ENH-014`, `FR-ENH-015`, `FR-ENH-016`, `FR-ENH-023`, `FR-ENH-024` | `traceability-convention.md` makes **Feature → requirements it satisfies** mandatory, carried in the `F-<epic>.<n>` framing note. The work is described; the link is not. MEDIUM rather than HIGH because this is a missing trace, not missing coverage |
| F2 | Coverage Gap | MEDIUM | 4 feature sections and none names the requirements it satisfies | Add the requirement reference to each `F-<epic>.<n>` framing note (`traceability-convention.md`, mandatory link) |
| F3 | Underspecification | MEDIUM | No dated clarification session is recorded in `spec.md` | Run `/speckit-clarify`. Until then the register holds this Epic at `Specified` however far its plan and tasks have gone — `FR-ESK-018` derives the stage from a recorded session, never from the absence of markers |

**Blocking findings (CRITICAL or HIGH): 0.** `DOR-09` is satisfied.

## Coverage

| Measure | Value |
|---|---|
| Requirements owned | 7 — `FR-ENH-012`, `FR-ENH-013`, `FR-ENH-014`, `FR-ENH-015`, `FR-ENH-016`, `FR-ENH-023`, `FR-ENH-024` |
| Owned requirements cited by a task or feature note | 0 of 7 |
| Tasks listed | 23 |
| Feature sections | 4 |
| Vague terms (config list) | 0 |
| Unresolved placeholders | 0 |
| `[NEEDS CLARIFICATION` markers | 0 |
| Constitution-mandated sections present | 3 of 3 |
| Clarification session recorded | no |

## Method

Run by `/speckit-analyze` as one pass across every Epic carrying a `tasks.md`, on 2026-08-19.
The detection passes this record reports are **measured**, not judged: requirement ownership and
citation, task counts against those the documents state, the vague-term list in
[`governance.config.json`](../../governance/governance.config.json), unresolved placeholders and
`[NEEDS CLARIFICATION` markers outside inline code, the constitution-mandated sections, and the
plan's Constitution Check gate.

**What that does and does not buy.** Every finding below is reproducible and cites what was counted.
A systematic pass will not catch what only a careful human read of this Epic's subject matter would —
EPIC-027's own closure records exactly that limit, where eight of ten sampled clause verdicts held
and two were wrong in ways no completeness check could see. This record claims the passes ran and
what they returned; it does not claim a domain expert read the specification.

## Remediation — 2026-08-19

Findings from this session were acted on the same day by EPIC-026 `T686` and `T687`:

- **Task-count drift** — the count in `tasks.md` was corrected against a recount, and `plan.md`'s
  duplicate was **removed** rather than synchronised. A number restated in two documents is the
  PP-002 fault itself; only `tasks.md` now carries it, marked *counted, not quoted*.
- **Feature → requirement links** — the mandatory citation now sits in the `F-<epic>.<n>` framing
  notes (`traceability-convention.md`).
- **No clarification session** — unremediated. It needs `/speckit-clarify` to actually run, and
  writing the session without running it would fabricate the evidence `FR-ESK-017` exists to
  guarantee.

The findings above are left as recorded. They state what the pass returned on the day it ran; a
later fix does not change what was found.

---

# Analysis: EPIC-021 — C2C reopening

**Session**: 2026-08-26 · **Scope**: the production gate capability delivered under the C2C
ownership decision (`T1107`–`T1110`). See [closure.md](./closure.md) — Reopening record.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| G1 ✅ | Coverage Gap | HIGH | `backend/src/modules/reviews/` | **Closed.** The Epic had services and no producer — no module, imported by nothing, in-memory store only, nothing writing `ReviewGate` or `GateOutcome`. It now has `ReviewsModule`, Prisma-backed configuration, an append-only authoritative decision table, and a public typed-disposition query | Verified end to end through the real `AppModule` |
| G2 | Constitution Alignment | MEDIUM | `gate_final_outcomes`; `GateProductionService` | **Target-version binding and staleness have no SRS source.** `FR-ENH-012`–`016` cover configurability, findings, the human decision, outcome recording and role failure. They say nothing about binding an outcome to the version it examined, or about an outcome ceasing to authorise when its inputs change. The rule was implemented because `X11` showed an unbound outcome could authorise the wrong transition — but Constitution II requires a requirement to originate in the SRS | Back-fill `SRS/enhancement_module/` (or `PMI-DOC-004`) and add the requirement with a citation, **or** rule that this is an implementation constraint rather than a requirement. Recorded now so it is not discovered later as unsourced |
| G3 | Underspecification | LOW | `gate_outcomes` | The mutable two-phase working record remains, and is now **not** what authorises a transition. Nothing reads it on the governed path | Retire it, or document it as the review-workflow projection it has become. Not urgent; it misleads only a reader who assumes it is authoritative |

## Notes

`G2` is the one that matters. The behaviour is right — an outcome that survives a change to the
thing it examined is dangerous — but "right" is not the same as "sourced", and this repository's
Constitution II exists precisely because those two get conflated. The rule ships; its provenance is
open.
