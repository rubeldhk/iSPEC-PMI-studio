# Cross-Artifact Analysis: `EPIC-036` Application Shell & Dashboard

**Session**: 2026-08-24

**Artifacts analysed**: [spec.md](./spec.md) · [plan.md](./plan.md) · [tasks.md](./tasks.md) ·
[research.md](./research.md) · [data-model.md](./data-model.md) ·
[contracts/shell-contract.md](./contracts/shell-contract.md) · [quickstart.md](./quickstart.md) ·
[checklists/requirements.md](./checklists/requirements.md)

**Also read**, because the central finding cannot be reached from the Epic's own documents:
`SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` §4.1 and §9, `governance/epic-stage-register.md`,
`frontend/src/pages/`, and every `specs/*/tasks.md`.

Read-only apart from this record (`FR-ESK-019`). No specification, plan or task file was modified.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 | Coverage Gap | CRITICAL | data-model.md §1 "The eighteen, and the nine"; spec.md Assumptions; tasks.md `T436f`, `T436g` | **Three of the nine "declared" areas have nothing to render and no task anywhere that builds one.** `QA & Releases`, `Architecture & Decisions` and `Governance` have no component in `frontend/src/pages/`; their owning Epics (`EPIC-014`/`015`, `EPIC-016`, `EPIC-019`/`021`/`024`) are all at stage **Ready**, unimplemented; and no `specs/*/tasks.md` in the corpus builds any of the three. `T436f` asserts `declared: true` implies an `element`, and `FR-SHL-003` forbids the shell supplying one or rendering a placeholder — so `T436g` has no correct completion | Decide the meaning of `declared` **once** and apply it uniformly. data-model.md §1 already applies *delivered, not merely owned* to the Rooms — excluding `EPIC-033` at 68 of 102 — then applies *Epic exists* to these three at 0. Under the Rooms' rule the count is **six**, not nine. Amend data-model.md §1, spec.md Assumptions, quickstart.md and `T436g` together, or add the three areas' screens to an Epic that owns them |
| I1 | Inconsistency | HIGH | contracts/shell-contract.md §2 route table vs data-model.md §1, spec.md Assumptions, quickstart.md Scenario 1 | **The route table declares eight areas; every other artifact says nine.** `QA & Releases` has no row in §2. An implementer building the route tree from the contract produces eight routes, and `T437h` — which asserts every `declared: true` area is reachable — then fails against a registry built from the data model | Add the missing row to §2, or remove the area everywhere at once. This is the first symptom of `C1` an implementer meets, and it is worth fixing separately because the route table is what `T436k` and `T437m` are written against |
| C2 | Coverage Gap | HIGH | contracts/shell-contract.md §6 vs tasks.md `T436m` | **`FR-SHL-003`'s first clause is asserted by nothing.** contracts §6 lists six prohibitions "asserted by the Epic's own architecture check". `T436m` enumerates five and omits exactly one: **no area content — the shell hosts screens and implements none**. That clause is the one keeping `FR-SHL-003` from being prose, and it is the clause `C1` puts under pressure | Add the sixth clause to `T436m`'s enumeration. It is a one-line change to a task that already exists, and `T436n`'s anti-vacuity companion already covers the new assertion |
| C3 | Coverage Gap | MEDIUM | spec.md `FR-SHL-061`; tasks.md `T438g`, `T439g`, `T441h` | **`FR-SHL-061` ("an empty state MUST say what is absent and what to do next") is checked for one case only.** `T438g` asserts it for the no-project state. `T439g` and `T441h` assert that the four states are *distinguishable*, which is `FR-SHL-060` — distinguishable is not the same claim as informative, and an empty state can be unmistakably empty while saying nothing | Extend `T441h` to assert the **content** of every shell-owned empty state, not only that it differs from loading and error |
| A1 | Ambiguity | MEDIUM | spec.md `SC-SHL-006`; plan.md Performance Goals; tasks.md `T441f` | **"The reference local stack" is named in three artifacts and defined in none.** checklists/requirements.md records the phrasing as deliberate — it scopes the measurement so `SC-SHL-006` does not inherit `DEF-030-002`'s suite-load ambiguity — but a scope with no value still lets two runs measure different things and both report a pass | Define the stack once where `SC-SHL-006` is stated: which services, on what, at what data volume. `T441f`'s "recorded with the stack named" defers this to execution, which is a report, not a criterion |
| I2 | Inconsistency | MEDIUM | data-model.md §5 vs tasks.md `T436i`, `T438d`, `T436k` | **The three derived views are named twice and never the same way.** data-model.md §5 defines `NavigationModel`, `Breadcrumb` and `RouteTree`; tasks.md builds all three as `navigationModel()`, a breadcrumb inside `ContextBar.tsx`, and an unnamed route tree in `routes.tsx`. The work is covered; the vocabulary is not shared, so no check can compare the model against what was built | Use the data model's names in `T436i`, `T438d` and `T436k`, or drop §5's type names and describe the derivations as functions. Either is fine; two vocabularies for three objects is not |
| C4 | Coverage Gap | LOW | spec.md `FR-SHL-001`, `002`, `011`, `030`, `032`, `050`; tasks.md throughout | **Six requirements are covered in substance by tasks that never cite them.** `FR-SHL-011` is asserted verbatim by `T436f` ("no area in two groups") without naming the requirement; `FR-SHL-002` is measured by `T437q` through `SC-SHL-004`. The work exists; the trace does not, and every future coverage audit re-derives it by hand | Add the identifiers to the six task lines. Cheap, and it is the difference between 80% and 98% traced coverage |
| P1 | Constitution Alignment | HIGH | plan.md Constitution Check, final row | **`DOR-06` fails: the plan records a FAIL, so this Epic cannot reach `Ready`.** The concurrent-session row leads with `**FAIL at planning — discharged by the first task.**`, and `DOR-06` reads the leading word of a Constitution Check row's last cell. `EPIC-033`, `EPIC-034` and `EPIC-035` recorded the **same** condition — plan written outside the worktree, discharged by the first task — and led with `**PASS** — **discharged 2026-08-23**`, so none of them tripped it. One fact, two spellings, and only this Epic is held | Either re-word the cell to lead with the status that will hold at implementation, as the three sibling Epics did, or accept that `EPIC-036` stays *Not ready* until `T436a` creates the worktree and the plan is amended. The first is consistent with the corpus; the second is more literally true at planning time. **Do not soften what the row says** — only where the status word sits |
| D1 | Duplication | LOW | spec.md `FR-SHL-001` vs `FR-SHL-010`+`FR-SHL-013`; `FR-SHL-050` vs `FR-SHL-054`+`SC-SHL-007` | **Two umbrella requirements restate the conjunction of their own children.** Harmless to build, but they are why a mechanical coverage pass reports gaps where none exists | Leave as is, or mark them explicitly as umbrella requirements so a coverage tool can skip them. Not worth a specification edit on its own |

**Blocking**: `C1` (CRITICAL), `I1` (HIGH), `C2` (HIGH), `P1` (HIGH).

**Definition of Ready, evaluated 2026-08-24**: ten of twelve conditions pass. The two that fail are
**`DOR-06`** — *"plan.md Constitution Check records a FAIL (1)"*, which is `P1` — and **`DOR-09`** —
*"3 blocking finding(s)"*, which is this table reading itself. Resolving `C1`, `I1`, `C2` and `P1`
clears both.

## Coverage

34 functional requirements and 11 success criteria, mapped against 76 tasks.

| Measure | Value |
|---|---|
| Requirements defined | 45 (34 `FR-SHL-*`, 11 `SC-SHL-*`) |
| Covered by a task citing the identifier | 36 of 45 — **80.0%** |
| Covered in substance | 44 of 45 — **97.8%** |
| Not covered, correctly | `FR-SHL-014` — a declared deferral, owner `EPIC-024`, `PP-008` |
| Covered only in part | `FR-SHL-003` (`C2`), `FR-SHL-061` (`C3`) |
| Success criteria covered | **11 of 11**, each by a named task |

Every success criterion has a task. `SC-SHL-001` `T437j`, `SC-SHL-002` `T437k`, `SC-SHL-003`
`T437p`, `SC-SHL-004` `T437q`, `SC-SHL-005` `T439g`/`T441h`, `SC-SHL-006` `T441f`, `SC-SHL-007`
`T440i`, `SC-SHL-008` `T440g`, `SC-SHL-009` `T441g`, `SC-SHL-010` `T437l`, `SC-SHL-011` `T437n`.

**Unmapped tasks**: none. Every task traces to a requirement, to a Constitution obligation
(`T441j`–`T441o`), or to `TS-001` (`T436b`–`T436e`). The 36 tasks that cite no requirement
identifier are implementation halves whose paired test task carries the citation — the pattern
`DOR-08` accepts.

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

## What this analysis could not check

- **Whether the six remaining declared areas render acceptably inside the shell.** Their pages exist
  (`Projects.tsx`, `SpecificationList.tsx`, `Tasks.tsx`, `Runs.tsx`, `StorageConnections.tsx`, plus
  Home built here) but none has been composed into a shell, so this is an implementation question.
- **`SC-SHL-009`, and the keyboard and screen-reader pass.** Both are human measures.
  checklists/requirements.md already records why, and `T441k` is a person's task.
- **Whether `react-router@7` behaves as `R-036-1` describes.** The dependency is not yet installed;
  `T436d` installs it and `T436e` asserts the version and the React pin.
