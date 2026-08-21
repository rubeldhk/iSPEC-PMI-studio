# Cross-Artifact Analysis: EPIC-029 Design System

**Session**: 2026-08-20 (second run — see [below](#session-2026-08-20--second-run) for the current findings)

---

## Session 2026-08-20 — second run

**Why re-run**: the first run analysed artifacts written against constitution **v1.4.0** with `D-42`
open. Both changed — Principle **XI** was ratified, `D-42` was decided, and `tasks.md` went 42 → 47.
Nothing below was visible to the first run.

**A note on finding IDs.** This record uses `F1`…`F9`, **not** the category-initial IDs
(`D1`, `C1`, `U1`) the first run used and `/speckit-analyze` prescribes. `DOR-09` counts blocking
rows matching `/^\|\s*F\d+\s*\|/`, so **no finding the first run wrote was ever visible to the
gate** — including `D1`, which was CRITICAL. That is finding `F4`, and using the `F` prefix here is
what makes this record's own findings enforceable.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| F1 | Constitution | HIGH | spec.md:242–250 | **Epic Exit Criteria omit Constitution XI.** The header cites "Constitution IV, V, VI, IX" and no criterion covers the reachability gate. `tasks.md` complies via `T901a`, but the Exit Criteria list is what a closing report is checked against — so the Epic could be closed against its own checklist while violating a NON-NEGOTIABLE principle | Add exit criteria for XI Tier 1 (`T899a`) and Tier 2 (`T900a`, `T900b`), and add XI to the section header |
| F2 | Inconsistency | HIGH | spec.md:203; `PMI-DOC-005` `UI-0042`/`UI-0043` | **`FR-DS-042` still states as MUST what its own SRS downgraded to SHOULD.** The first run's `C1` remediation split `UI-0042`, moving "name things as users recognise them" to `UI-0043` as a SHOULD — but that pass explicitly did not touch `spec.md`. The Epic now asserts a stronger obligation than its source, and half of it can never have a check that fails | Split `FR-DS-042` to mirror `UI-0042`/`UI-0043`: the controls/confirmations half stays MUST (covered by `T888a`); the naming half becomes a stated SHOULD convention |
| F3 | Coverage gap | HIGH | spec.md:226; quickstart.md V5; tasks.md T900, T900b | **`SC-DS-006` has no task that tests it.** It reads *"a new page can be built without introducing a visual value that is not already a token"* — nothing builds a new page. Three artifacts cite it for unrelated work: V5 and `T900b` test delivered pages in both themes (that is `SC-DS-005`); `T900` tests viewport and zoom (`FR-DS-040`) | Repoint the three citations to `SC-DS-005`/`FR-DS-040`, then either give `SC-DS-006` a task that composes a throwaway page from tokens and asserts the lint rule stays clean, or reclassify it as an outcome rather than a measurable criterion |
| F4 | Constitution | HIGH | `tests/governance/epic-stage/dor.ts:337`; `/speckit-analyze` template | **`DOR-09` cannot see findings written per this command's own template.** The gate counts blocking rows matching `/^\|\s*F\d+\s*\|/`; the command instructs *"generate stable IDs prefixed by category initial"*. The first run's `D1` was **CRITICAL** and `DOR-09` reported *"analysis recorded, no blocking findings"*. Owner: EPIC-026 | Reconcile gate and template — widen the pattern, or fix the template and every existing record. Mutation-verify against a known CRITICAL row; a gate that cannot fail is decoration (Constitution V) |
| F5 | Constitution | HIGH | plan.md:77; `tests/governance/epic-stage/dor.ts:266` | **`DOR-06` cannot see a warning-marked FAIL.** The pattern matches `\| FAIL` and `\| ❌ FAIL` but not `\| ⚠️ FAIL`, because `\s*` does not match `⚠️`. `plan.md:77` records a genuine FAIL — another session active on this checkout — and `DOR-06` reports *"Constitution Check clean"*. Owner: EPIC-026 | Close the status vocabulary and reject any word outside it. An undefined status currently defaults to passing, which is the wrong default for a term nobody defined |
| F6 | Inconsistency | MEDIUM | spec.md:81, 95 | **`PP-008` and the deferral count are stale after `D-42`.** No third-party UI dependency is taken, so no security review is owed — yet `PP-008` reads "Partial" and "**Deferral count**: 1" | Set `PP-008` to Satisfied, citing `D-42` as evidence that `PP-008` is not triggered; deferral count 0 |
| F7 | Inconsistency | MEDIUM | spec.md:246 | Exit criterion *"Decision `D-42` is recorded"* is unticked, though it was recorded 2026-08-20 | Tick it and cite the decision record |
| F8 | Inconsistency | MEDIUM | spec.md:233 | Assumptions still state *"the component-library build-vs-adopt choice is **not** made here"* | Replace with the settled outcome and its consequence: components are built on native elements, `PP-008` untriggered |
| F9 | Style | LOW | spec.md:206–209 | `FR-DS-005`, `006`, `034`, `052` are appended after `FR-DS-051`, out of numeric order | Reorder, or state that clarification-sourced requirements are appended by convention |

**Overflow**: none. Nine findings; no aggregation needed.

## Coverage Summary — second run

| Requirement group | Has task? | Task IDs |
|---|---|---|
| `FR-DS-001`–`006` tokens, palette, browser floor | ✅ | T868, T869, T900 |
| `FR-DS-010`–`012` themes | ✅ | T870–T874 |
| `FR-DS-020`–`023` components | ✅ | T886, T886a, T887–T893 |
| `FR-DS-030`–`034` accessibility | ✅ | T880–T885 |
| `FR-DS-040`–`041` layout | ✅ | T889, T900 |
| `FR-DS-042` microcopy | ⚠️ half | `T888a` covers the testable half only — **F2** |
| `FR-DS-050`–`052` restyle + lint | ✅ | T876–T879, T895–T899 |
| `SC-DS-001`–`005`, `007`, `008` | ✅ | T883, T885, T878, T886, **T900a**, T872, T884 |
| **`SC-DS-006`** | ❌ | none — **F3** |

## Constitution Alignment — second run

| Principle | Status |
|---|---|
| I, II, III, IV, VI, VII, IX, X | PASS |
| V — Mandatory task-level tests | PASS for all 47 tasks. `FR-DS-042`'s naming half is a requirement no check can discharge — **F2** |
| VIII — Session labelling | ⚠️ Recorded deviation; separate clone required before implementation. Invisible to `DOR-06` — **F5** |
| **XI — Reachability gate** | Satisfied in `tasks.md` (`T899a`, `T900a`, `T900b`, `T901a`); **absent from `spec.md` Exit Criteria — F1** |

## Unmapped Tasks — second run

None. All **47** tasks map to a requirement, success criterion, or Constitution obligation.

## Metrics — second run

- **Total requirements**: 32 (24 `FR-DS`, 8 `SC-DS`)
- **Total tasks**: 47
- **Coverage**: **31 / 32 = 97%** (`SC-DS-006` uncovered — F3)
- **Ambiguity count**: 0
- **Duplication count**: 0
- **CRITICAL**: 0 · **HIGH**: 5 (F1–F5) · **MEDIUM**: 3 · **LOW**: 1

## Next Actions — second run

**Five HIGH findings block `/speckit-implement`** via `DOR-09` — and, for the first time, the gate
can actually see them.

1. **F1, F2, F6, F7, F8, F9** — all `spec.md` edits, none of them large. `/speckit-specify` owns
   that file; this command does not.
2. **F3** — decide whether `SC-DS-006` earns a task or is reclassified, then repoint the three
   mis-citations.
3. **F4, F5** — belong to **EPIC-026**, which owns the epic-stage gates. They do not block
   EPIC-029's *implementation*; they block *trusting* any readiness verdict, this one included.

Concrete command: `/speckit-specify` for EPIC-029 to amend `spec.md` for F1, F2, F6, F7, F8, F9.

**Note on `D-42` and `PMI-DOC-005`**: both gates the first run left open are now discharged —
`PMI-DOC-005` approved v1.0, `D-42` decided. The gate that replaced them sits at the other end of
the Epic: Constitution XI, at closure.

---

## First run

**Session**: 2026-08-20

**Scope**: `spec.md`, `plan.md`, `tasks.md`, `contracts/`, `research.md` — consistency, coverage,
ambiguity, and Constitution alignment before implementation.

**Note on authorship**: all five artifacts were produced in one session by the same author, which is
the condition under which self-review is weakest. Two of the six findings below came from reading
the **actual frontend source** rather than the documents, and neither was visible from the documents
alone.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| D1 | Constitution | **CRITICAL** | tasks.md T866 | `T866` imports `tokens.css`/`themes.css` into `frontend/src/main.tsx` — application code — and **no task asserts the import exists**. If it is dropped or never added, every page silently renders unstyled and every component test still passes, because components are tested in isolation. This is Constitution V (paired test MANDATORY) and it is the **sixth instance** of built-tested-called-by-nothing (`DEF-001-001`, `DEF-001-002`, `DEF-028-005`, `DEF-005-001`, `DEF-001-005`) | Add a paired check asserting `main.tsx` imports both stylesheets, mutation-verified by removing the import. `T662`'s `main.ts` source-assertion is the precedent |
| C1 | Coverage gap | HIGH | spec.md FR-DS-042; tasks.md | **`FR-DS-042` (microcopy) has zero tasks.** Nothing implements or checks "name things as users recognise them; controls state what happens, confirmations what happened" | Either add a task (a review checklist item is not enough — Constitution V), or move it to `PMI-DOC-005` as a standing convention with no Epic obligation, and say so |
| U1 | Underspecification | HIGH | tasks.md T879, Phase 6 | `T879` says to run the lint rule and "record every existing violation as the restyling backlog". **Verified against the source: the four pages and two components contain zero styles and zero literals** — no `className`, no `style=`, no hex or px anywhere. The rule will report **nothing**, so `T879` produces an empty backlog by construction, and Phase 6's real work is *adding* styling where none exists, not *replacing* literals | Rewrite `T879` to derive the restyling backlog from the component inventory each page needs, not from lint output. The premise "written with no tokens at all" is true but the conclusion drawn from it is wrong |
| O1 | Ordering | MEDIUM | tasks.md T886–T889 before T890 | The component **tests** are written before `T890` records decision `D-42` (build vs adopt). If a library is adopted, some test APIs may need rework — tests-first is right, but the decision that shapes them lands after | Move `T890` to the head of Phase 5, before the test tasks. It is a decision record, not implementation, so nothing is lost by taking it first |
| I1 | Inconsistency | MEDIUM | tasks.md T884, T882; quickstart V4 | The accessibility-record conformance check and the focus-contrast assertion are both placed in `tests/governance/design-tokens.spec.ts` — a file named for tokens holding a check about a **markdown transcript** | Put the record check in `tests/governance/accessibility-record.spec.ts`. A file whose name does not describe its contents is where checks go to be forgotten |
| C2 | Traceability | MEDIUM | tasks.md | Seven requirements are **implemented but never cited by ID**: `FR-DS-001`, `FR-DS-002`, `FR-DS-020`, `FR-DS-023`, `FR-DS-030`, `FR-DS-051`; and three success criteria: `SC-DS-003`, `SC-DS-005`, `SC-DS-006`. Each *is* covered — by T868, T876–T878, T886, T887–T893, T880 — but a reader cannot follow the trace, and `PP-004` requires upstream and downstream IDs | Add the IDs to the existing task descriptions. No new work, and it makes the coverage auditable rather than inferable |

**Overflow**: none. Six findings total; no aggregation needed.

## Coverage Summary

| Requirement group | Has task? | Task IDs | Notes |
|---|---|---|---|
| `FR-DS-001`–`004` tokens | ✅ | T868, T869 | 001/002 covered, not cited (C2) |
| `FR-DS-005` palette | ✅ | T869 | cited |
| `FR-DS-006` browser floor | ✅ | T900 | cited |
| `FR-DS-010`–`012` themes | ✅ | T870, T871, T873, T874 | cited |
| `FR-DS-020`–`023` components | ✅ | T886–T893 | 020/023 covered, not cited (C2) |
| `FR-DS-030`–`034` accessibility | ✅ | T880–T885 | 030 covered, not cited (C2) |
| `FR-DS-040`–`041` layout | ✅ | T889, T900 | cited |
| **`FR-DS-042` microcopy** | ❌ | — | **C1 — zero coverage** |
| `FR-DS-050`–`052` restyle + lint | ✅ | T876–T879, T895–T899 | 051 covered, not cited (C2); T879 premise wrong (U1) |
| `SC-DS-001`–`008` | ✅ (8 of 8) | T883, T885, T878, T886, T871, T900, T872, T884 | 003/005/006 covered, not cited (C2) |

## Constitution Alignment

| Principle | Status |
|---|---|
| I — Spec Kit command gate | PASS |
| II — SRS source of truth | PASS — four clarification-sourced requirements flagged for back-fill by `T902` |
| III — Epic → Feature → Task | PASS |
| IV — Convergence gate | PASS — `T903` |
| **V — Mandatory task-level tests** | ❌ **FAIL — D1**. `T866` changes `main.tsx` with no paired check |
| VI — Defect traceability | PASS — `defects/` exists, `T904` triages |
| VII — Promotion pipeline | PASS |
| VIII — Session labelling | ⚠️ Recorded deviation — `plan.md` Complexity Tracking; separate clone required before implementation |
| IX — Closing report | PASS |
| X — Interaction discipline | PASS — clarify batched four questions in one round |

## Unmapped Tasks

None. All 40 tasks map to at least one requirement, success criterion, or Constitution obligation.

## Metrics

- **Total requirements**: 32 (24 `FR-DS`, 8 `SC-DS`)
- **Total tasks**: 40
- **Coverage**: **31 / 32 = 97%** (`FR-DS-042` uncovered)
- **Cited-by-ID coverage**: 22 / 32 = 69% (ten covered-but-uncited — C2)
- **Ambiguity count**: 0 — no vague adjective survives without a metric; no TODO or placeholder
- **Duplication count**: 0 — `FR-DS-001` (values must be tokens) and `FR-DS-051` (a rule enforces it) are requirement and enforcement, deliberately distinct
- **Critical issues**: **1** (D1)

## Next Actions

**One CRITICAL finding blocks `/speckit-implement`**: `D1` is a Constitution V violation, and
Constitution V is NON-NEGOTIABLE. It is also the cheapest of the six to fix — one paired check.

Recommended order:

1. **D1** — add the import assertion for `main.tsx`, mutation-verified (CRITICAL, blocking)
2. **U1** — rewrite `T879`; its stated output is empty by construction
3. **C1** — decide whether `FR-DS-042` gets a task or moves to `PMI-DOC-005` as a convention
4. **O1** — move `T890` (`D-42`) to the head of Phase 5
5. **I1**, **C2** — file naming and ID citations; neither blocks implementation

Concrete command: `/speckit-tasks` for EPIC-029 to amend `tasks.md` with the remediation above —
tasks.md is this command's to write, not this one's (analysis is read-only apart from this record).

Nothing here changes the Epic's two standing gates: `PMI-DOC-005` remains v0.1 Draft, and `D-42`
remains unrecorded.

---

## Remediation applied — 2026-08-20

All six findings were remediated the same session, by the project owner's approval, through
`tasks.md` (which is `/speckit-tasks`' file to write) plus the two documents each finding pointed
at. **`spec.md` and `plan.md` were not touched.**

| ID | Applied |
|---|---|
| **D1** | `T866a` added — asserts `main.tsx` imports both stylesheets, mutation-verified by removing one. Placed adjacent to `T866` using the repository's `a`-suffix convention (`T549a`/`T576a`) so the pairing is visible |
| **U1** | `T879` rewritten: the backlog now derives from the component inventory each page needs, not from lint output that would return nothing |
| **C1** | Split rather than forced. `T888a` asserts the **testable** half (a `Save` control pairs with a `Saved` confirmation). The naming half became **`UI-0043` in `PMI-DOC-005` as a SHOULD convention** — no check can fail on "name things as users recognise them", and Constitution V holds that review does not satisfy a requirement. A MUST no Epic could ever discharge is worse than an honest SHOULD |
| **O1** | `T890` moved to the head of Phase 5, under its own *Decision first* heading |
| **I1** | The accessibility-record check moved to `tests/governance/accessibility-record.spec.ts`; quickstart `V4`'s command repointed to match |
| **C2** | IDs cited across seven tasks — `FR-DS-001`, `002`, `020`, `023`, `030`, `051`, `SC-DS-003`, `005`, `006` |

**Coverage after remediation**: 32 / 32 requirements (100%), since `FR-DS-042`'s testable half now
has `T888a` and its untestable half is no longer claimed as a requirement. Tasks: **42**
(`T865`–`T904`, `T866a`, `T888a`).

**Constitution V**: the `D1` violation is closed. No task now changes application code without a
paired check.

**Superseded within the hour**: `PMI-DOC-005` was **approved v1.0 on 2026-08-20**, with the four
clarification-sourced requirements back-filled at approval. One gate remains: `D-42`, which is
`T890` at the head of Phase 5.
