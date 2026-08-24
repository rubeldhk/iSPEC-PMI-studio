# Cross-Artifact Analysis: `EPIC-036` Application Shell & Dashboard

**Session**: 2026-08-24

**Artifacts analysed**: [spec.md](./spec.md) · [plan.md](./plan.md) · [tasks.md](./tasks.md) ·
[research.md](./research.md) · [data-model.md](./data-model.md) ·
[contracts/shell-contract.md](./contracts/shell-contract.md) · [quickstart.md](./quickstart.md) ·
[checklists/requirements.md](./checklists/requirements.md)

**Also read**, because the central finding cannot be reached from the Epic's own documents:
`SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` §4.1 and §9, `governance/epic-stage-register.md`,
`frontend/src/pages/`, and every `specs/*/tasks.md`.

**The analysis pass itself was read-only** apart from this record (`FR-ESK-019`). The remediation
that followed was **separately authorised** and is recorded under [Remediation](#remediation) below:
four findings are marked ✅ and the artifacts they name were changed.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 ✅ | Coverage Gap | CRITICAL | data-model.md §1 "The eighteen, and the nine"; spec.md Assumptions; tasks.md `T436f`, `T436g` | **Three of the nine "declared" areas have nothing to render and no task anywhere that builds one.** `QA & Releases`, `Architecture & Decisions` and `Governance` have no component in `frontend/src/pages/`; their owning Epics (`EPIC-014`/`015`, `EPIC-016`, `EPIC-019`/`021`/`024`) are all at stage **Ready**, unimplemented; and no `specs/*/tasks.md` in the corpus builds any of the three. `T436f` asserts `declared: true` implies an `element`, and `FR-SHL-003` forbids the shell supplying one or rendering a placeholder — so `T436g` has no correct completion | Decide the meaning of `declared` **once** and apply it uniformly. data-model.md §1 already applies *delivered, not merely owned* to the Rooms — excluding `EPIC-033` at 68 of 102 — then applies *Epic exists* to these three at 0. Under the Rooms' rule the count is **six**, not nine. Amend data-model.md §1, spec.md Assumptions, quickstart.md and `T436g` together, or add the three areas' screens to an Epic that owns them. **Resolved 2026-08-24.** `Area.declared: boolean` became `Area.status: 'delivered' | 'declared-not-delivered' | 'undeclared'`. Six areas are `delivered`; the three named here are `declared-not-delivered`, carry their owning Epic, appear in no navigation and answer not-found; nine are `undeclared`. Applied across data-model.md §1, contracts §1–§2, spec.md (`FR-SHL-001`/`002`/`003`/`013`/`015`/`017`, `SC-SHL-001`–`004`/`010`/`011`, Assumptions, Edge Cases, Exit Criteria), plan.md Scale/Scope and Complexity Tracking, quickstart.md, checklists, and tasks.md `T436f`/`T436g`. `T441p` was added to hand the remainder of `UX-0003` to the three owing Epics |
| I1 ✅ | Inconsistency | HIGH | contracts/shell-contract.md §2 route table vs data-model.md §1, spec.md Assumptions, quickstart.md Scenario 1 | **The route table declares eight areas; every other artifact says nine.** `QA & Releases` has no row in §2. An implementer building the route tree from the contract produces eight routes, and `T437h` — which asserts every `declared: true` area is reachable — then fails against a registry built from the data model | Add the missing row to §2, or remove the area everywhere at once. This is the first symptom of `C1` an implementer meets, and it is worth fixing separately because the route table is what `T436k` and `T437m` are written against. **Resolved 2026-08-24.** The route table is now six routed areas plus four sub-views and `*`. `/architecture` and `/governance` are removed; `QA & Releases` never had a path and gains none. All three answer not-found until their owners ship |
| C2 ✅ | Coverage Gap | HIGH | contracts/shell-contract.md §6 vs tasks.md `T436m` | **`FR-SHL-003`'s first clause is asserted by nothing.** contracts §6 lists six prohibitions "asserted by the Epic's own architecture check". `T436m` enumerates five and omits exactly one: **no area content — the shell hosts screens and implements none**. That clause is the one keeping `FR-SHL-003` from being prose, and it is the clause `C1` puts under pressure | Add the sixth clause to `T436m`'s enumeration. It is a one-line change to a task that already exists, and `T436n`'s anti-vacuity companion already covers the new assertion. **Resolved 2026-08-24.** `T436m` now enumerates **all six** prohibitions, the first being *no area content: the shell hosts screens and implements none*. `FR-SHL-003` went from 0 tasks citing it to 1 |
| C3 ✅ | Coverage Gap | MEDIUM | spec.md `FR-SHL-061`; tasks.md `T438g`, `T439g`, `T441h` | **`FR-SHL-061` ("an empty state MUST say what is absent and what to do next") is checked for one case only.** `T438g` asserts it for the no-project state. `T439g` and `T441h` assert that the four states are *distinguishable*, which is `FR-SHL-060` — distinguishable is not the same claim as informative, and an empty state can be unmistakably empty while saying nothing | Extend `T441h` to assert the **content** of every shell-owned empty state, not only that it differs from loading and error. **Resolved 2026-08-24 by `T441w`.** Home's working-but-empty section offers *"See all runs"*, the no-workspace state offers *"Go to Home"*, and `RequireProject` offers *"Choose a project"*. The two `unavailable` sections deliberately get none — a next step into an Epic that does not exist would send the user somewhere that cannot help them. |
| A1 ✅ | Ambiguity | MEDIUM | spec.md `SC-SHL-006`; plan.md Performance Goals; tasks.md `T441f` | **"The reference local stack" is named in three artifacts and defined in none.** checklists/requirements.md records the phrasing as deliberate — it scopes the measurement so `SC-SHL-006` does not inherit `DEF-030-002`'s suite-load ambiguity — but a scope with no value still lets two runs measure different things and both report a pass | Define the stack once where `SC-SHL-006` is stated: which services, on what, at what data volume. `T441f`'s "recorded with the stack named" defers this to execution, which is a report, not a criterion. **Resolved 2026-08-24 by `T442l`.** *"The reference local stack"* is defined in `quickstart.md` — services, versions, data volume, browser, what is timed and how many samples — so the criterion is scoped for the next measurement and not only for the one that was taken. The transcript's §7 now points at that definition rather than standing in for it. |
| I2 | Inconsistency | MEDIUM | data-model.md §5 vs tasks.md `T436i`, `T438d`, `T436k` | **The three derived views are named twice and never the same way.** data-model.md §5 defines `NavigationModel`, `Breadcrumb` and `RouteTree`; tasks.md builds all three as `navigationModel()`, a breadcrumb inside `ContextBar.tsx`, and an unnamed route tree in `routes.tsx`. The work is covered; the vocabulary is not shared, so no check can compare the model against what was built | Use the data model's names in `T436i`, `T438d` and `T436k`, or drop §5's type names and describe the derivations as functions. Either is fine; two vocabularies for three objects is not |
| C4 ✅ | Coverage Gap | LOW | spec.md `FR-SHL-001`, `002`, `011`, `030`, `032`, `050`; tasks.md throughout | **Six requirements are covered in substance by tasks that never cite them.** `FR-SHL-011` is asserted verbatim by `T436f` ("no area in two groups") without naming the requirement; `FR-SHL-002` is measured by `T437q` through `SC-SHL-004`. The work exists; the trace does not, and every future coverage audit re-derives it by hand | Add the identifiers to the six task lines. Cheap, and it is the difference between 80% and 98% traced coverage. **Resolved 2026-08-24 by `T442j`.** `FR-SHL-001` cited on `T437b`, `FR-SHL-002` on `T436g`, `FR-SHL-011` on `T436f`, `FR-SHL-030` on `T439h`, `FR-SHL-032` on `T439b`, `FR-SHL-050` on `T440i`. **44 of 45** requirements are now cited by a task that implements or asserts them; `FR-SHL-014` has none on purpose, being a declared deferral. A naive scan reads 45 of 45 only because `T442j`'s own line names it while explaining why it should not. |
| N1 ✅ | Underspecification | MEDIUM | contracts §2 route table; data-model.md §1; tasks.md `T437b` | **`Plan & Tasks` is a `delivered` area whose path needs a parameter it has no way to supply.** Its `Area.path` is `/specifications/:id/tasks`, and navigation renders a link to `area.path`. `:id` is not an address, so primary navigation would emit a broken link for one of the six — and `FR-SHL-013` requires every delivered area to be reachable **from navigation**. Found while remediating `C1`; not blocking, because `T437h` fails loudly the moment it happens, which is what that check is for | Give `Plan & Tasks` a parameterless landing address, or make it a sub-view of Specifications and drop it from the six. Decide before `T436g` writes the registry, since both choices change the count. **Resolved 2026-08-24 during the Phase 2 implementation.** `Plan & Tasks` is recorded `declared-not-delivered` against `EPIC-012`: the screen exists and is specification-scoped, so its only address is `/specifications/:id/tasks` and navigation cannot link to it. The tasks view stays reachable as a sub-view; the area is a debt with a debtor, and `handovers.md` carries it. **Five delivered areas, not six.** |
| P1 ✅ | Constitution Alignment | HIGH | plan.md Constitution Check, final row | **`DOR-06` fails: the plan records a FAIL, so this Epic cannot reach `Ready`.** The concurrent-session row leads with `**FAIL at planning — discharged by the first task.**`, and `DOR-06` reads the leading word of a Constitution Check row's last cell. `EPIC-033`, `EPIC-034` and `EPIC-035` recorded the **same** condition — plan written outside the worktree, discharged by the first task — and led with `**PASS** — **discharged 2026-08-23**`, so none of them tripped it. One fact, two spellings, and only this Epic is held | Either re-word the cell to lead with the status that will hold at implementation, as the three sibling Epics did, or accept that `EPIC-036` stays *Not ready* until `T436a` creates the worktree and the plan is amended. The first is consistent with the corpus; the second is more literally true at planning time. **Do not soften what the row says** — only where the status word sits. **Resolved 2026-08-24.** The cell now leads `**PASS** — **discharged by `T436a`**`, matching `EPIC-033`/`034`/`035`. **What it discloses is unchanged** — that the plan was written on `main` and only the worktree restores exclusivity — and a note in plan.md records why the wording moved |
| D1 | Duplication | LOW | spec.md `FR-SHL-001` vs `FR-SHL-010`+`FR-SHL-013`; `FR-SHL-050` vs `FR-SHL-054`+`SC-SHL-007` | **Two umbrella requirements restate the conjunction of their own children.** Harmless to build, but they are why a mechanical coverage pass reports gaps where none exists | Leave as is, or mark them explicitly as umbrella requirements so a coverage tool can skip them. Not worth a specification edit on its own |

**Blocking when written**: `C1` (CRITICAL), `I1` (HIGH), `C2` (HIGH), `P1` (HIGH).
**Blocking now**: none — all four are ✅ and `DOR-09` reads a resolved finding as history, not a
blocker.

**Two remain open and neither blocks**: `I2` at MEDIUM and `D1` at LOW — and `D1`'s own
recommendation was to leave it. Four have since been resolved and are marked ✅ in the table above —
`C1`, `I1`, `C2` and `P1` by the remediation of 2026-08-24, then `C3`, `C4`, `N1` and `A1` by the
implementation and its four convergence passes.

**Corrected 2026-08-24 (`T442m`).** This section read *"four remain open"* while three of the four
had been closed for several phases. A record that reports finished work as outstanding is the same
fault as one that reports outstanding work as finished, in the direction nobody checks — and
`DOR-09` would not have caught it, because it reads only CRITICAL and HIGH.

**Definition of Ready**: ten of twelve conditions passed when this was written, failing `DOR-06`
(`P1`) and `DOR-09` (this table reading itself). Both are addressed by the remediation.

## Coverage

34 functional requirements and 11 success criteria, mapped against **99 tasks**.

**Re-measured 2026-08-24 (`T442n`).** This table read *"37 of 45 — 82.2% (was 80.0% before `C2`'s
fix)"* while `C4` sat marked ✅ six lines above with a note giving the figure as 44 of 45. **The
document contradicted itself**, and the stale half was the one a reader would quote: `T442j` closed
`C4` in Phase 9's successor and `T442m` marked it resolved without touching the metrics. Every value
below was measured on the date above, not carried forward.

| Measure | Value |
|---|---|
| Requirements defined | 45 (34 `FR-SHL-*`, 11 `SC-SHL-*`) |
| Covered by a task citing the identifier | **44 of 45 — 97.8%** (80.0% at analysis, 82.2% after `C2`, 97.8% after `C4`) |
| Not covered, correctly | `FR-SHL-014` — a declared deferral, owner `EPIC-024`, `PP-008`. **The only one**, and it should stay that way |
| Covered only in part | **none.** `FR-SHL-003` was joined by `T436m` ✅ and `FR-SHL-061` by `T441w` ✅ |
| Success criteria covered | **11 of 11**, each by a named task |

> **Why a naive scan reads 45 of 45.** **Three** task lines — `T442j`, `T442m` and `T442n` — name
> `FR-SHL-014` while explaining that it should *not* be cited, and each new one that explains it
> adds another. A counter cannot tell a citation from a note about one; **44** is the figure, and
> the test is whether a task *implements or asserts* the requirement, not whether a line mentions
> it.

Every success criterion has a task. `SC-SHL-001` `T437j`, `SC-SHL-002` `T437k`, `SC-SHL-003`
`T437p`, `SC-SHL-004` `T437q`, `SC-SHL-005` `T439g`/`T441h`, `SC-SHL-006` `T441f`, `SC-SHL-007`
`T440i`, `SC-SHL-008` `T440g`, `SC-SHL-009` `T441g`, `SC-SHL-010` `T437l`, `SC-SHL-011` `T437n`.

**Unmapped tasks**: none. Every task traces to a requirement, to a Constitution obligation
(`T441j`–`T441p`), or to `TS-001` (`T436b`–`T436e`). The tasks that cite no requirement identifier
are implementation halves whose paired test task carries the citation — the pattern `DOR-08` accepts.

**Task count**: 76 when analysed, **77** after remediation added `T441p`.

## Constitution alignment

| Gate | Position |
|---|---|
| I, III, IV, VIII, X | Satisfied. Every artifact so far came from a Spec Kit command |
| **V** | **Satisfied, and verified mechanically.** All 76 task lines pass `T148` and `DOR-08`: every task naming application source pairs with a named test, and both non-code outputs — the area registry and the `D-30` register row — carry an executable conformance check (`T436f`, `T436c`) |
| VI | Satisfied — `specs/036-application-shell/defects/` exists |
| **VII** | **Cannot be satisfied, and says so.** `dev`, `stage` and `prod` do not exist and no Epic owns building a deployable artifact. Recorded in plan.md Complexity Tracking with an owner-shaped hole rather than claimed. Not raised as a finding: it is a disclosed programme gap, not a defect in this Epic |
| IX | Satisfied — `T441o` |
| **XI** | Satisfied at both tiers. Tier 1 is `T437h`/`T437i` driving the real `App`, mutation-verified by `T437j`. Tier 2 is `T441j`'s driven transcript |
| Concurrent session | Recorded **FAIL** at planning, discharged by `T436a` — `EPIC-033` `T337a`'s pattern in substance, but **not in wording**, and `DOR-06` reads the wording. See `P1` |

**No constitution principle is violated by this Epic.** Both failing conditions are about how the
work is *recorded*, not what it does: `DOR-06` on where a status word sits in a table cell, and
`DOR-09` on this table's own contents. That distinction matters — `P1` must be fixed by moving the
status word, never by softening what the row discloses.

## Remediation

Applied 2026-08-24, on explicit authorisation, after the read-only pass above.

| Artifact | What changed |
|---|---|
| `data-model.md` | `declared: boolean` → `status: 'delivered' \| 'declared-not-delivered' \| 'undeclared'`; a new section on why the middle state exists; the eighteen/nine table became eighteen/six/twelve; §5 derivations filter on `delivered`; §6 names the three owing Epics |
| `contracts/shell-contract.md` | `AreaStatus` added to §1; §2 rebuilt as six routed areas, four sub-views and `*`; §7 scoped to `delivered` |
| `spec.md` | `FR-SHL-001`, `002`, `003`, `013`, `015`, `017`; `SC-SHL-001`–`004`, `010`, `011`; User Story 1 gained a sixth acceptance scenario for the declared-but-unbuilt case; Edge Cases; Key Entities; two Assumptions bullets replaced by three; one Exit Criterion added |
| `plan.md` | the concurrent-session cell re-worded to lead with its status (`P1`); Scale/Scope and Constraints re-counted; a fourth Complexity Tracking row for the three unbuilt areas |
| `tasks.md` | `T436f`, `T436g`, `T436m` (`C2`), `T437h`, `T437k`, `T437n`, `T437q`, `T440i`, `T441j`; **`T441p` added** to hand the remainder of `UX-0003` to `EPIC-014`/`015`, `EPIC-016` and `EPIC-019`/`021`/`024` |
| `quickstart.md` | Scenarios 1, 2, 3 and 7 re-scoped; a fourth entry added to *what this Epic does not prove* |
| `checklists/requirements.md` | the scope note, with why *"nine are declared"* conflated two questions |

**What was deliberately not changed.** The `UX-0003` obligation is **not** waived — it is satisfied
for six areas and carried, with named owners, for three. `EPIC-014`, `EPIC-016` and `EPIC-019` each
discharge it with a one-line registry edit, which is the claim `T437q` exists to prove. And `P1`'s
fix moved a status word without softening a single thing the row discloses.

## What this analysis could not check

- **Whether the six remaining declared areas render acceptably inside the shell.** Their pages exist
  (`Projects.tsx`, `SpecificationList.tsx`, `Tasks.tsx`, `Runs.tsx`, `StorageConnections.tsx`, plus
  Home built here) but none has been composed into a shell, so this is an implementation question.
- **`SC-SHL-009`, and the keyboard and screen-reader pass.** Both are human measures.
  checklists/requirements.md already records why, and `T441k` is a person's task.
- **Whether `react-router@7` behaves as `R-036-1` describes.** The dependency is not yet installed;
  `T436d` installs it and `T436e` asserts the version and the React pin.
