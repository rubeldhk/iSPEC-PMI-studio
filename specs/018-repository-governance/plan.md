# Implementation Plan: Repository Governance Process

**Epic**: `EPIC-018` | **Module**: governance (no product module) | **Date**: 2026-08-04 |
**Spec**: [spec.md](./spec.md)

**Tasks**: 38 · [tasks.md](./tasks.md) · **Posture**: ▶ **PROCEEDING** (decision D-10) — process, not product

**Sibling**: [EPIC-017 Enhancement Model](../017-enhancement-model/plan.md) — the product half, held

**Rulings that shaped this plan**: **D-17** (product/process split created this epic) and **D-16**
(authority layered — `PMI-DOC-000` governs this repository's documents). Both in
[srs-alignment.md](../srs-alignment.md) Part 7.

## Summary

Make the standards that already govern this repository **explicit, versioned, and checkable**. Today
they live in a constitution, a set of templates, and whoever is at the keyboard. This epic writes them
down as steering files, gives every artifact type one documented home, checks the internal templates
against `PMI-DOC-000`, states the traceability convention, and publishes one governance index.

**This epic produces no application code.** That is precisely why it proceeds while the product
surface is held — and it is also the source of its one genuinely open question, below.

## The question this plan could not answer alone — ✅ answered 2026-08-05

**Constitution V is NON-NEGOTIABLE and requires a unit test for every task producing application
code.** Nearly every task here produces a *markdown document*. Three readings are available:

| Reading | Consequence |
|---|---|
| **A** — documents are not application code; V does not apply | Clean, but the exemption must be *recorded*, or every future documentation epic re-litigates it |
| **B** — V applies; "test" means an automated conformance check | Steering files and layout get real checks (`SC-RGP-002` to `SC-RGP-006` are already machine-checkable). Costs a checking harness this repo does not have |
| **C** — case by case | Reproduces the ambiguity that produced findings **C2** and **C6** on 2026-08-03 |

**Reading B was chosen** by the clarification session of 2026-08-05, and ratified as a
**programme-wide** position rather than a per-epic exemption — it also settles the same open
question in EPIC-003 (`T088`/`T089`), EPIC-014 (`T149`) and EPIC-016. Every task below pairs with a
conformance check rather than a conventional unit test.

✅ **Ratified in constitution v1.2.0** (2026-08-05). Principle V now covers non-code outputs
explicitly, so this epic rests on governance rather than on a reading.

Two further rulings from the same session bear on this plan: **`governance/**` is exempt** from the
Spec Kit command gate (Constitution I), and **only the duplication check blocks CI** — coverage and
conformance checks report. Both are recorded in [spec.md](./spec.md) and both landed in
**v1.2.0**.

## Scope

Task figures are **estimates** — `/speckit-tasks` has not run.

| Function | Est. tasks | What it delivers |
|---|---|---|
| F-18.1 Steering file set | 11 | Ten steering subjects authored, each stating checkable standards, each recording `last_reviewed` |
| F-18.2 Steering conformance checks | — | Subject coverage, no-duplication, and currency checks (G-01 to G-07); authored alongside F-18.1 |
| F-18.3 Repository layout definition | ~6 | One documented home per artifact type; relationship to `specs/<epic>/` and `_shared/` |
| F-18.4 Layout migration record | ~4 | Every path that must move, recorded before it moves |
| F-18.5 Template conformance against PMI-DOC-000 | ~6 | Each template checked; deviations recorded with reasons |
| F-18.6 Planning and task-document structure | ~4 | Plans and task lists conformant by construction |
| F-18.7 Internal traceability convention | ~5 | Which artifact types link to which; which links are required |
| F-18.8 Governance index | ~3 | One document naming every governance artifact and its version |
| F-18.9 Constitutional process artifacts | ~4 | Session-labelling (VIII) and closing-report (IX) formats |

**Actual total: 38 tasks.** 38 = the 31 originally planned (`T312`–`T336`, `T433`–`T434`, Phase Z `T407`–`T410`) + 3 from Phase 6 convergence + 3 from Phase 7 convergence (`DEF-018-001`) + `T667` (`D-39`, check `G-10`). Corrected by EPIC-026 `T529` on 2026-08-18 — **count it, do not quote it**.

The 31 planned here were T312–T336, T433–T434, plus Phase Z T407–T410. The ~48 estimate was
high: several functions collapsed into single documents rather than one task per artifact type.

**Explicitly out of scope**: PMI Studio's product Steering Engine (EPIC-017 `FR-ENH-001`–`005`), which
shares a name and nothing else.

## Technical Context

**Language/Version**: none. Outputs are markdown and, for conformance checks, small scripts in the
repository's existing TypeScript + Vitest toolchain.

**Primary Dependencies**: none new. Checks run under Vitest, already the mandated unit-test runner.

**Storage**: the git repository. Steering files are versioned by being committed.

**Testing**: conformance checks under `tests/governance/`, runnable in CI alongside `pnpm test:arch`
— the closest existing analogue, since it also enforces a rule about the repository rather than about
behaviour.

**Target Platform**: the repository itself.

**Project Type**: governance / documentation. No runtime, no deployment.

**Constraints**: must not weaken **PP-002 Single Source of Truth**. Written standards that restate
other written standards create two sources of truth — the failure mode this epic is most likely to
cause. See [research.md](./research.md) **R-018-2**.

**Scale/Scope**: 10 steering subjects · ~14 artifact types · 3 templates · 65 tracked files under
`specs/` whose paths must not break.

**NEEDS CLARIFICATION**: none. Five questions were answered on 2026-08-05; zero markers remain in
the spec.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes in this plan will be produced only via Spec Kit commands — no direct edits | PASS — **`governance/**` is exempt** (clarified 2026-08-05), joining `.specify/**` and `specs/**`. `FR-RGP-009` requires the governance index to record it. The constitution itself stays non-exempt |
| II | Every requirement traces to a cited `SRS/` document; untraced items listed in Assumptions | PASS — `FR-RGP-014`/`FR-RGP-015` are constitution-derived; **`FR-RGP-016` derives from neither** and came from the 2026-08-05 clarification. All three declared with a named back-fill owner |
| III | Work is decomposed Epic → Feature → Task; Epic ID assigned and `specs/<epic-id>/` exists | PASS — 9 functions |
| IV | `/speckit-converge` is scheduled as the Epic exit gate before any promotion | PASS — `Phase Z · Epic closure` will be generated by `/speckit-tasks` |
| V | Every implementation task will carry a mandatory unit-test task, written to fail first | ✅ **PASS** — reading B chosen 2026-08-05: an executable conformance check satisfies Constitution V, programme-wide. Ratified in **v1.2.0**, 2026-08-05 |
| VI | `specs/018-repository-governance/defects/` exists and is the sole intake for defects | PASS |
| VII | Changes land in the local Claude repo first; promotion follows local → dev → stage → prod | PASS — trivially, since this epic ships no runtime artifact |
| VIII | Session/clone is labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution` (its first command); stated in the closing report because the terminal title is not settable from inside the session |
| IX | This run will close with a Work Completed + Recommended Next Task report | PASS |
| — | Repository was synced from GitHub before this work started | PASS — **0 commits behind `origin/main`**, verified 2026-08-04 |
| — | No other Claude session is active on this checkout | PASS — single session; asserted by the operator, not independently verifiable |
| — | **PMI-DOC-003 register** — deltas recorded per the epic convention (D-6) | PASS — 4 deltas in [spec.md](./spec.md) |
| — | **D-16 honoured** — templates follow `PMI-DOC-000`, not the 21-section product structure | PASS — `FR-RGP-011` states it explicitly |
| — | **D-13 not pre-empted** — the layout does not force the deferred module re-cut | PASS — `FR-RGP-008` requires recording the dependency, not resolving it |

**Any FAIL blocks Phase 0.** No FAIL. One qualified PASS on gate V, carried into Complexity Tracking.

**Post-design re-check (after Phase 1)**: **PASS.** No gate weakened. Gate V is *strengthened* by the
design: `SC-RGP-002` through `SC-RGP-006` became executable checks rather than review items, which is
what makes reading B viable instead of aspirational. Gate II is unchanged — the two
constitution-derived requirements still need `PMI-DOC-000` back-fill, and that is recorded rather than
resolved.

## Build order

```text
F-18.3 layout definition ──► F-18.4 migration record
        │
        └──► F-18.1 steering files ──► F-18.2 conformance checks
                                              │
F-18.5 template conformance ──► F-18.6 plan/task structure
                                              │
F-18.7 traceability convention ───────────────┤
F-18.9 constitutional artifacts ──────────────┤
                                              ▼
                                    F-18.8 governance index (last — it indexes the rest)
```

**Layout precedes steering** because steering files need a home, and choosing it twice is worse than
choosing it once.

**The governance index is last.** It names every governance artifact and its version; building it
first guarantees it is wrong by the end.

**F-18.2 immediately follows F-18.1.** Authoring ten steering files without a duplication check is
how PP-002 gets violated by the epic meant to strengthen it — the check should exist while the files
are being written, not after.

## Design notes specific to this epic

**Reference beats copy, always.** A steering file that restates the constitution creates a second
source that will drift. `FR-RGP-004` makes this a rule and `SC-RGP-003` makes it checkable — a
mechanical check for substantial overlap between steering files and the constitution or templates.

**Standards must be checkable, not aspirational.** "Write clean code" fails `FR-RGP-002`. "Every
exported function has an explicit return type" passes: an artifact can be held against it.

**The layout is adopted incrementally.** Directories are created and populated as artifacts arrive.
A big-bang move of 65 tracked files would break every path in every existing spec — and those paths
are cross-referenced from `_shared/`, the README, and 18 epic documents.

**`PMI-DOC-000` governs here, and D-4 is surfaced not settled.** `FR-RGP-010` requires the *check* and
the *record*; it does not require moving the templates to thirteen sections. That remains the owner's
decision.

**This epic's outputs are read by agents as much as by people.** Steering files are context that a
future session loads. That argues for a predictable format over prose — hence
[contracts/steering-file-format.md](./contracts/steering-file-format.md).

## Risks carried by this epic

| Risk | Score | How this epic handles it |
|---|---|---|
| **New — PP-002 weakened by duplication** | **high** | The epic's most likely failure. `FR-RGP-004` + `SC-RGP-003` + the F-18.2 check, sequenced to exist *while* files are authored |
| **New — layout adoption breaks existing paths** | medium | `FR-RGP-007` requires every migration recorded before execution; `SC-RGP-005` asserts zero broken paths |
| **New — layout collides with D-13's deferred re-cut** | medium | `FR-RGP-008` requires recording the dependency. A layout change and a taxonomy re-cut touching the same paths should be one pass, not two |
| **New — steering files rot** | medium | Versioned with the repository and named in the governance index, so staleness is visible. Not eliminated — nothing here forces a review cadence |
| **New — Constitution V reading is wrong** | low | Recorded openly above rather than assumed silently; cheap to change before tasks are generated |

## Phase 0 outputs

- [research.md](./research.md) — 5 decisions

## Phase 1 outputs

- [data-model.md](./data-model.md) — the artifact model (documents, not tables)
- [contracts/steering-file-format.md](./contracts/steering-file-format.md) — the format steering files
  must follow so both people and agents can consume them
- [quickstart.md](./quickstart.md) — 6 validation scenarios, V18-1 to V18-6

## Definition of done

- [ ] All tasks complete, each paired with a passing conformance check (Constitution V, reading B)
- [ ] Quickstart **V18-1** to **V18-6** pass
- [ ] All ten steering subjects present, or absence recorded with a reason (`SC-RGP-002`)
- [ ] Every steering file records `last_reviewed`; none past the 90-day interval unreported (`SC-RGP-009`)
- [ ] **Zero duplication** between steering files and the constitution or templates (`SC-RGP-003`)
- [ ] Zero existing paths broken (`SC-RGP-005`)
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records

## Complexity Tracking

> One qualified gate, recorded rather than waved through.

| Item | Why | Simpler alternative rejected because |
|---|---|---|
| Constitution V satisfied by conformance checks rather than unit tests | Every task produces documentation; a "unit test for a markdown file" is only meaningful as a conformance check | Declaring a blanket exemption is simpler, but it leaves Constitution V meaning different things in different epics — the ambiguity that produced findings C2 and C6 |
| A governance index in addition to the constitution | The constitution states *rules*; the index states *where the artifacts are*. Different questions | Extending the constitution to list artifacts makes it a directory, and amending governance to add a file is friction that guarantees the list goes stale |
| Steering files separate from the constitution | Standards change often; governance rarely. Different change rates want different documents | One document would mean amending the constitution to change a lint rule |
