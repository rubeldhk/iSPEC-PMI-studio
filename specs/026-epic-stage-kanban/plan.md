# Implementation Plan: Epic Stage Register & Definition of Ready

**Epic**: `EPIC-026` | **Module**: governance (no product module) | **Date**: 2026-08-09 |
**Spec**: [spec.md](./spec.md)

**Tasks**: see [tasks.md](./tasks.md) — counted there, never restated here (`T686`, PP-002) (`T466`–`T536`) · [tasks.md](./tasks.md) · **Posture**: ▶ **PROCEEDING** (decision D-10) — process, not product

**Sibling**: [EPIC-018 Repository Governance Process](../018-repository-governance/plan.md) — whose
`governance/`, config pattern, and check harness this epic extends rather than duplicates

**Rulings that shaped this plan**: the clarification session of **2026-08-09** (five answers, in
[spec.md](./spec.md) §Clarifications) and **D-17** (the product/process split that makes a governance
epic buildable while the product surface is held).

## Summary

Make each Epic's position in the Spec Kit journey **derived, published, and gated**. Today that
position is inferred from a directory listing; four Epics are ambiguous as a result. This epic
derives a stage for every Epic from its artifacts, publishes a committed register, lets a deliberate
stop be declared as one of three postures, and gates entry to implementation behind a
mechanically-checkable Definition of Ready with an owned, expiring waiver path.

**This epic produces no application code.** Its outputs are governance documents, two Spec Kit skill
edits, and executable conformance checks — which is why it proceeds while the product surface is
held.

## Two things this plan must confront

### 1. `specs/README.md` already publishes epic status — the PP-002 collision

This is the epic's most likely failure mode, and it is not hypothetical. `specs/README.md` groups
every Epic under **▶ Proceeding — 89 tasks** and **⏸ Held — 199 tasks**, with per-epic task counts.
The register would restate all of it, in a second file, that can disagree.

It is **already disagreeing**. EPIC-018's task count is recorded in three places: its own `plan.md`
says **31** (twice), `specs/README.md` says **32**, and `tasks.md` holds **34** task lines. No check
reads any of them. This is the drift the epic exists to make impossible, found in the artifact the
epic would have duplicated.

EPIC-018 faced the identical risk with steering files and solved it with `FR-RGP-004` (reference,
never copy) plus a blocking duplication check. **The same resolution applies here**, with the
division stated once:

| Question | Answered by |
|---|---|
| *How far along is each Epic, and is it Ready?* | `governance/epic-stage-register.md` — **generated** |
| *What is each Epic about, how do they relate, what order do they build in?* | `specs/README.md` — **authored** |

`specs/README.md` therefore **loses its status groupings and task counts** and links to the register
instead. This is a migration of existing content, so `FR-RGP-007` applies: it is recorded here before
it executes. It is the one substantive edit this epic makes outside its own artifacts.

### 2. This epic already broke a check by existing — `G-05d` is red now

Creating `specs/026-epic-stage-kanban/` failed EPIC-018's `G-05d`, which requires every Epic
directory on disk to be registered in `governance/repository-layout.md`:

```text
Tests  1 failed | 158 passed (159)
→ these epic directories exist but are not registered as protected paths: [ '026-epic-stage-kanban' ]
```

**This is not incidental.** It is the thesis of this epic demonstrated on itself within one command:
a repository fact changed, a derived document did not follow, and only a machine noticed. Constitution I
directs that a needed change with no covering task be produced by a Spec Kit command rather than
edited first, so the registration is task F-26.7's, not an ad-hoc fix — and the check stays red until
`/speckit-implement` runs. Recorded openly rather than quietly patched.

## Scope

Task figures are **estimates** — `/speckit-tasks` has not run.

| Function | Est. tasks | What it delivers |
|---|---|---|
| F-26.1 Stage model and configuration | ~4 | The seven stages, their artifact evidence, posture kinds, DOR condition set, waiver roles — as `governance/epic-stage.config.json` |
| F-26.2 Stage derivation and register generation | ~6 | Derivation from the file tree; the generated, committed `governance/epic-stage-register.md`; `pnpm register:update` |
| F-26.3 Posture and kind declarations | ~5 | `governance/epic-declarations.json`; the three posture kinds; parent-design declarations for EPIC-002 and EPIC-017 (`FR-ESK-024`); the held postures for EPIC-009 and EPIC-012 |
| F-26.4 Definition of Ready evaluation | ~6 | Twelve conditions `DOR-01`–`DOR-12`, each mechanically checkable; all-failures reporting |
| F-26.5 Waivers | ~4 | Single-condition, owned, expiring waivers; `Ready (waived)` never reads as Ready |
| F-26.6 Journey-step evidence | ~5 | `/speckit-clarify` records every session; `/speckit-analyze` writes `analysis.md` |
| F-26.7 Governance integration | ~5 | Register the epic directory (fixes `G-05d`); layout map row; governance index row; `specs/README.md` de-duplication |
| F-26.8 Conformance checks and CI wiring | ~8 | Checks `G-26-01` to `G-26-10` under `tests/governance/epic-stage/` |

**Estimated total: ~42 tasks**, before the mandatory paired conformance checks and Phase Z closure.

**Explicitly out of scope**: EPIC-009's product specification lifecycle (`draft → review → approved
→ baselined → implemented → archived`), which governs specifications authored *inside* PMI Studio
and shares only the word "lifecycle"; a Kanban view in the product, which is EPIC-012's; and
convergence, defect, closure and promotion tracking, which Constitution IV, VI and VII already own.

## Technical Context

**Language/Version**: TypeScript 5.7 on Node 22 — the repository's existing toolchain. No new
language, no new runtime.

**Primary Dependencies**: **none new.** Derivation, generation and checks use `node:fs` and Vitest
2.1, both already present. See [research.md](./research.md) **R-026-5** for why the regeneration CLI
adds no dependency either.

**Storage**: the git repository. The register is a committed file; declarations are a committed JSON
file; history is the audit trail.

**Testing**: conformance checks under `tests/governance/epic-stage/`, collected by the existing
`governance` Vitest project (`tests/governance/**/*.spec.ts`) and run by `pnpm test:governance`.
No new Vitest project needed.

**Target Platform**: the repository itself. No runtime, no deployment, no database.

**Project Type**: governance / documentation with executable checks — the EPIC-018 shape.

**Performance Goals**: not a dimension. The full derivation reads ~26 Epic directories; it is
milliseconds, and the existing governance suite completes in 2.8s.

**Constraints**: must not weaken **PP-002**. `specs/README.md` already publishes epic status; this
epic must remove that duplication rather than add to it. Must not pre-empt **D-13**, which would
rewrite every row of the register.

**Scale/Scope**: 26 Epic directories · 7 stages · 3 posture kinds · 12 DOR conditions · 2 Spec Kit
skill files · 1 existing document to de-duplicate.

**NEEDS CLARIFICATION**: none. Five questions were answered on 2026-08-09; zero markers remain in
the spec.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes produced only via Spec Kit commands — no direct edits | PASS — outputs land in `governance/**` and `.claude/skills/speckit-*/**`, both exempt; `tests/governance/**` and `specs/README.md` are **not** exempt and are changed through this epic's tasks. `G-05d`'s current failure is left for F-26.7 rather than patched ad hoc |
| II | Every requirement traces to a cited `SRS/` document; untraced items in Assumptions | PASS — **all 23 requirements are owner-originated and constitution-derived**, declared as such with **project owner** as back-fill owner. Same posture as `FR-RGP-014`/`015` |
| III | Work decomposed Epic → Feature → Task; Epic ID assigned and directory exists | PASS — `EPIC-026`, 8 functions, `specs/026-epic-stage-kanban/` exists |
| IV | `/speckit-converge` scheduled as the Epic exit gate before promotion | PASS — Phase Z will be generated by `/speckit-tasks` |
| V | Every implementation task carries a mandatory test task, written to fail first — or an executable conformance check for document outputs | PASS — constitution **v1.2.0**. Every document output pairs with a check; the derivation and DOR logic are *code* and take conventional unit tests, so this epic satisfies V on both readings |
| VI | `specs/026-epic-stage-kanban/defects/` exists and is the sole defect intake | PASS — created 2026-08-09 |
| VII | Changes land in local first; promotion follows local → dev → stage → prod | PASS — trivially; this epic ships no runtime artifact |
| VIII | Session/clone labelled with the working Epic | ⚠️ **QUALIFIED** — the checkout is on branch `epic/003-specification-engine` with uncommitted EPIC-003 changes while this session works EPIC-026. Principle VIII makes the convention mandatory and its mechanical application best-effort, so this is recorded, not waved. See Complexity Tracking |
| IX | This run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work started | PASS — **0 commits behind `origin/main`** (19 ahead), verified 2026-08-09 |
| — | No other Claude session active on this checkout | PASS — single session; asserted by the operator, not independently verifiable |
| — | **PMI-DOC-003 register** — deltas recorded per D-6 | PASS — 6 deltas in [spec.md](./spec.md) |
| — | **D-13 not pre-empted** — the register does not force the module re-cut | PASS — the register derives from whatever directories exist; **R-026-6** records the dependency |
| — | **PP-002 not weakened** — no second source of epic status | PASS **by design, not by default** — `specs/README.md` de-duplication is F-26.7, and check `G-26-09` enforces it |

**Any FAIL blocks Phase 0.** No FAIL. One qualified gate (VIII), carried into Complexity Tracking.

**Post-design re-check (after Phase 1)**: **PASS.** No gate weakened. Gate V is *strengthened* by the
design — twelve DOR conditions and seven stage rules became executable predicates rather than prose,
and the derivation logic is ordinary code with ordinary unit tests. Gate II is unchanged: the
requirements remain constitution-derived with a recorded back-fill owner. Gate VIII is unchanged and
remains the honest weak point of this session rather than of the design.

## Build order

```text
F-26.1 stage model + config ──► F-26.2 derivation + register ──► F-26.4 DOR ──► F-26.5 waivers
              │                          │                          │
              └──► F-26.3 postures ──────┘                          │
                                                                    │
F-26.6 journey-step evidence (clarify + analyze skills) ────────────┤
                                                                    ▼
F-26.7 governance integration (layout, index, README de-dup) ──► F-26.8 checks + CI
```

**Configuration precedes derivation.** The stage list, evidence rules and DOR conditions are data;
writing the code first means writing it twice.

**Postures before the DOR**, because `DOR-12` reads a posture and a condition cannot be evaluated
against a concept that does not yet exist.

**Waivers last among the DOR work.** A waiver is an exception to a rule; building the exception
before the rule produces a rule shaped around its exception.

**F-26.6 runs in parallel** — the two skill edits touch no code this epic writes, and the Epics they
affect will not have evidence until they are re-run regardless.

**F-26.7 before F-26.8 is deliberate but partial.** The `G-05d` registration must land before the
suite can go green at all; the `specs/README.md` de-duplication must land before `G-26-09` can pass.
Every other check is authored alongside its function, not after — the EPIC-018 lesson that a
duplication check written after the files are authored arrives too late to prevent the duplication.

## Design notes specific to this epic

**Derive, then overlay — never merge.** Stage comes from the file tree and is never written down by
a person. Posture and waivers are declared, because no artifact can express intent or authorisation.
The register is the *join* of the two and is generated. Any design where a human writes a stage is
the design that drifts.

**Evidence records that a step ran, not that it found something.** Two of the five clarifications
produced this rule (`FR-ESK-017`). It is why `/speckit-clarify` must record a session even when it
asks nothing, and why `/speckit-analyze` must write findings even when there are none. A clean run
that leaves no trace is indistinguishable from a run that never happened.

**A skill file is an instruction, not an enforcement.** `.claude/skills/speckit-*/SKILL.md` tells an
agent what to do; nothing makes it comply. The checks therefore verify the **artifact** (does
`analysis.md` exist and conform) and, separately, that the **instruction** is present in the skill.
Neither check alone is honest — see **R-026-4**.

**`Ready (waived)` is a distinct reading, not an annotation.** No combination of waivers produces an
unqualified Ready. This is what stops waivers becoming a second, weaker DOR.

**The register will churn.** Every artifact an Epic gains changes a row. That is the point — the diff
is the signal — but it means the generated file must be diff-stable: fixed row order, no timestamps,
no counts that shift for unrelated reasons. **R-026-3** covers the format.

## Risks carried by this epic

| Risk | Score | How this epic handles it |
|---|---|---|
| **PP-002 weakened — two sources of epic status** | **high** | The most likely failure. `specs/README.md` de-duplication is a task (F-26.7), not an intention, and `G-26-09` fails when the README restates posture or stage |
| **Skill instructions not followed by the agent** | medium | Checks verify artifacts, not intentions; the instruction check is separate and explicitly weaker. Recorded in **R-026-4** rather than assumed away |
| **Register churn drowns real signal in diffs** | medium | Deterministic ordering, no timestamps, no derived counts. **R-026-3** |
| **Retroactive demotion reads as regression** | medium | Recorded in spec Assumptions and surfaced in the register itself: Epics analysed before this epic show at the last stage they can prove |
| **Parent designs read as permanently stalled** | medium — **found in Phase 0** | `FR-ESK-024` makes parent design a declared Epic kind completing at Planned. Without it the register would have been wrong about EPIC-002 and EPIC-017 on every regeneration. **R-026-7** |
| **Waivers become a routine bypass** | medium | Single-condition, owned, expiring, and visible in the register; renewal is a fresh dated record. Not prevented — made costly and observable |
| **D-13 rewrites every row** | low | The register derives from directories on disk, so a re-cut regenerates rather than breaks. **R-026-6** |
| **DOR too strict to satisfy on day one** | low | Expected: several Epics will fail `DOR-09` until re-analysed. Honest, and the waiver path exists for the genuinely stuck |

## Phase 0 outputs

- [research.md](./research.md) — 7 decisions, `R-026-1` to `R-026-7`

**Phase 0 changed the spec.** Two findings fed back rather than being noted and ignored:

1. The Purpose section claimed EPIC-002 and EPIC-017 had an *unrecorded* reason for having no task
   list. That was wrong — `specs/README.md` records it clearly. The motivating evidence was replaced
   with the verified EPIC-018 count drift, which is both true and stronger.
2. **EPIC-002 and EPIC-017 are parent designs** and would have read as permanently stalled under the
   stage model as specified. `FR-ESK-024` was added: a parent design is a declared *kind of Epic*
   whose journey completes at Planned, distinct from the three posture kinds. See **R-026-7**.

## Phase 1 outputs

- [data-model.md](./data-model.md) — the artifact model: stages, evidence, postures, conditions,
  waivers, and the derivation rules that join them
- [contracts/register-format.md](./contracts/register-format.md) — the generated register's format,
  so it is diff-stable and machine-comparable
- [contracts/declarations-format.md](./contracts/declarations-format.md) — the declared posture and
  waiver file, the only hand-authored input to the register
- [quickstart.md](./quickstart.md) — 8 validation scenarios, `V26-1` to `V26-8`

## Definition of done

- [ ] All tasks complete, each paired with a passing unit test or conformance check (Constitution V)
- [ ] Quickstart **V26-1** to **V26-8** pass
- [ ] `pnpm test:governance` green — including `G-05d`, red since 2026-08-09 (`SC-ESK-002`)
- [ ] Every Epic directory appears in the register; every exclusion by a stated rule (`SC-ESK-002`)
- [ ] Zero hand-maintained stage values; regeneration is idempotent (`SC-ESK-004`)
- [ ] The committed register agrees with the repository (`SC-ESK-013`)
- [ ] Every DOR condition mechanically checkable; zero manual review (`SC-ESK-006`)
- [ ] Zero `specs/README.md` content restates stage or posture (`SC-ESK-008`, PP-002)
- [ ] Every journey step leaves evidence that it ran (`SC-ESK-012`)
- [ ] Zero unowned, unexpiring, or multi-condition waivers (`SC-ESK-014`)
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records

## Complexity Tracking

> Two items recorded rather than waved through.

| Item | Why | Simpler alternative rejected because |
|---|---|---|
| **Gate VIII qualified** — session works EPIC-026 on branch `epic/003-specification-engine`, with uncommitted EPIC-003 changes in the tree | Recorded honestly rather than reported as PASS. The specification chain for EPIC-026 is complete and self-contained; nothing produced here depends on the branch name | Claiming PASS is simpler and false. The fix — branch as `epic/026-epic-stage-kanban` before implementing — is named in the closing report, because interleaving two Epics in one checkout is precisely the condition Principle VIII exists to prevent |
| **A second governance config file** (`epic-stage.config.json`) rather than extending `governance.config.json` | Different epics own them, and different checks read them. EPIC-018's checks must not break when this epic's stage list changes | One shared config is simpler until two epics edit it in the same week, at which point EPIC-018's suite fails for a reason that has nothing to do with EPIC-018 |
| **Waivers admitted at all** (`FR-ESK-022`) | A gate with no legitimate exception path invites someone to weaken the check instead — the exact failure this register exists to detect | "No waivers ever" is simpler and stricter on paper. It is also the version that gets routed around silently, leaving no record that a gate was skipped |
