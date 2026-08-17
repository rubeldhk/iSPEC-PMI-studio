# Research: Epic Stage Register & Definition of Ready

**Epic**: `EPIC-026` | **Date**: 2026-08-09 | **Plan**: [plan.md](./plan.md)

Six decisions. Like EPIC-018, this epic produces documents and checks, so structural mistakes are
cheap to reverse. The expensive mistakes are the ones that create a **second source of truth** or a
gate that **cannot fail** — both leave the repository confidently wrong rather than visibly broken.

---

## R-026-1 · Where does the register live, given `specs/README.md` already publishes epic status?

**Question**: `specs/README.md` groups every Epic under **▶ Proceeding — 89 tasks** and **⏸ Held —
199 tasks**, with per-epic task counts and module mappings. A stage register restates all of it.
Where does the register go, and what happens to the README?

**Decision**: **`governance/epic-stage-register.md`, generated; `specs/README.md` keeps narrative and
loses status.** The division is by *question answered*, the same test EPIC-018 used to keep four
governing documents from restating each other:

| Question | Document | Authored or generated |
|---|---|---|
| How far along is each Epic, and is it Ready? | `governance/epic-stage-register.md` | **generated** |
| What is each Epic about, how do they relate, what order do they build in? | `specs/README.md` | authored |

The README drops its Proceeding/Held groupings and task counts and links to the register. Check
`G-26-09` fails when it restates stage or posture.

**Rationale**: the README's status content is *derivable* and therefore, under `FR-ESK-003`, must not
be hand-maintained. It is also **already drifting, verifiably**: EPIC-018's task count is recorded in
three places and disagrees with itself —

| Source | Claims | Verified |
|---|---|---|
| `specs/018-repository-governance/plan.md` (twice) | 31 tasks, `T312–T336` + `T433–T434` + `T407–T410` | — |
| `specs/README.md` | 32 tasks, `T312–T339` + closure | — |
| `specs/018-repository-governance/tasks.md` | — | **34 task lines** |

No check reads any of them, so all three can be wrong at once, and are. `governance/` is the
documented home for cross-epic process artifacts, and the register is exactly that.

**Note on scope**: the register derives *stage*, not task counts. Reconciling the count is a
consequence of generating from the tree, not a separate feature — but it is the clearest available
evidence that hand-maintained programme state does not stay true.

**Alternatives considered**:

- *Register at `specs/register.md`* — rejected. `specs/` holds per-Epic artifacts plus two
  cross-cutting exceptions (`README.md`, `srs-alignment.md`); adding a third generated file there
  puts a machine-written document in a directory people hand-edit constantly.
- *Extend `specs/README.md` in place, generating the whole file* — rejected. It carries genuine
  narrative — the 2026-08-03 restructure rationale, the `_shared/` single-source argument, the
  module cut — that no generator can produce and no one should lose.
- *Leave the README alone and accept the overlap* — rejected outright. This is the PP-002 violation
  the epic is most likely to commit, committed deliberately.

---

## R-026-2 · What evidence places an Epic in each stage?

**Question**: `FR-ESK-003` requires derivation from artifacts. Which artifact, precisely, proves each
of the seven stages — and what happens when they appear out of order?

**Decision**: **one named evidence rule per stage, evaluated as the highest contiguous stage
reached.**

| Stage | Evidence | Next command |
|---|---|---|
| Specified | `spec.md` exists | `/speckit-clarify` |
| Clarified | `spec.md` contains `## Clarifications` and ≥1 `### Session <date>` | `/speckit-checklist` |
| Checklisted | `checklists/*.md` present and zero unchecked items across them | `/speckit-plan` |
| Planned | `plan.md` exists | `/speckit-tasks` |
| Tasked | `tasks.md` exists | `/speckit-analyze` |
| Analyzed | `analysis.md` exists | DOR evaluation |
| Ready / Ready (waived) | every DOR condition passes, or is waived | `/speckit-implement` |

**Contiguity is the rule that makes this honest.** An Epic holding `tasks.md` but no `plan.md` reads
**Clarified** — the highest stage it can prove without a gap — and the gap is reported separately as
an out-of-order finding. Taking the highest *present* artifact instead would let an Epic skip the
Development Workflow and have the register congratulate it.

**Rationale**: each rule reads one thing and is trivially falsifiable, which is what `SC-ESK-006`
demands. `epicDirectories()` in `tests/governance/helpers.ts` already implements the exclusion rule
(`/^\d{3}-/`), which excludes `specs/_shared/` by construction rather than by a maintained list —
reuse it.

**Alternatives considered**:

- *Highest artifact present, ignoring gaps* — rejected. It rewards skipping steps.
- *Checklisted = a checklist file exists, regardless of unchecked items* — rejected. A checklist with
  open items has not been satisfied, and the stage would claim work that has not happened.
- *Clarified = zero `[NEEDS CLARIFICATION]` markers* — rejected in the clarification session: a spec
  written without markers would arrive already Clarified before the step ever ran.

---

## R-026-3 · What format keeps a generated, committed register from drowning its own signal?

**Question**: every artifact an Epic gains changes a row. The register will appear in a large share
of future diffs. How is it formatted so those diffs stay readable?

**Decision**: **a deterministic markdown table — fixed row order by Epic identifier, no timestamps,
no derived aggregates, one row per Epic, one line per row.**

Excluded on purpose: generation timestamps (every regeneration would diff), roll-up counts (one
Epic's change rewrites an unrelated summary line), and progress bars or percentages (cosmetic churn
with no added information).

**Rationale**: a generated file that is committed is read as a diff far more often than as a
document. Ordering by identifier makes a row's position stable for the life of the Epic, so a diff
shows exactly which Epics moved. Timestamps are the classic mistake — they guarantee every
regeneration produces a change, which trains readers to ignore the file.

**Alternatives considered**:

- *JSON* — rejected as the committed form. Unreadable in a pull request, which is the whole point of
  committing it (`FR-ESK-021`). JSON remains the format for the *declarations* input, where a person
  writes and a machine reads.
- *Include a generation timestamp for freshness* — rejected. Freshness is proven by the drift check,
  not by a self-reported date, and the date would make every regeneration a diff.
- *Group rows by stage, like a Kanban board* — rejected. Groups reorder rows as Epics move, so a
  single advancing Epic rewrites two blocks of the file.

---

## R-026-4 · How can a check enforce behaviour that lives in a Spec Kit skill file?

**Question**: `FR-ESK-018` and `FR-ESK-019` require `/speckit-clarify` and `/speckit-analyze` to
record their runs. Those are `SKILL.md` instructions to an agent. Nothing compels an agent to obey
an instruction, so what exactly can a check assert?

**Decision**: **check the artifact and the instruction separately, and state plainly that only the
first has teeth.**

| Check | Asserts | Strength |
|---|---|---|
| `G-26-07` | `analysis.md`, where present, conforms to the expected shape and severity vocabulary | Strong — reads a real artifact |
| `G-26-08` | The two `SKILL.md` files contain the recording instruction | **Weak — proves the instruction exists, not that it was followed** |

Nothing asserts "the agent complied", because nothing can. What the design does instead is make
non-compliance *self-punishing*: an agent that skips the recording leaves the Epic at a lower stage
and failing `DOR-09`, which is visible in the register.

**Rationale**: the alternative is a check that appears to enforce compliance and does not — which
Constitution V explicitly rules out ("a check that cannot fail is decoration"), and which is worse
than no check because it is trusted. Recording the weakness is the honest option.

**Alternatives considered**:

- *Assert every Epic past Tasked has an `analysis.md`* — rejected as a **blocking** check. It would
  fail the build for eleven Epics analysed before this epic existed, punishing history for a rule
  written after it. It survives as a **reporting** finding.
- *A git hook enforcing the write* — rejected. Hooks are local, bypassable, and unversioned in
  effect; it would move an honest weakness somewhere less visible.

---

## R-026-5 · How is the committed register regenerated and drift-checked without a new dependency?

**Question**: `FR-ESK-021` requires the committed register to be regenerable, with disagreement
failing the build. The repository has no script runner for TypeScript — no `tsx`, no `ts-node`.

**Decision**: **one derivation module, two entry points, zero new dependencies.**

- `tests/governance/epic-stage/derive.ts` — pure functions: read the tree, return the model. No I/O
  beyond reads, no formatting decisions.
- `tests/governance/epic-stage/register.spec.ts` — regenerates and compares against the committed
  file; fails on disagreement. When `UPDATE_REGISTER=1` is set, it writes instead of asserting.
- `pnpm register:update` → `UPDATE_REGISTER=1 vitest run --project governance`.

**Rationale**: this is the snapshot-update pattern, already familiar from every test runner, and it
reuses Vitest — the mandated runner, already a dependency, already wired into
`tests/governance/**/*.spec.ts` by the existing workspace project. Adding `tsx` to regenerate one
markdown file is a dependency for a build step that does not need to exist.

The separation matters more than the mechanism: **derivation is pure and unit-testable**, so the
stage rules and DOR conditions get conventional unit tests that construct a fixture tree and assert
an outcome. That is what lets this epic satisfy Constitution V on the code reading as well as the
conformance-check reading.

**Alternatives considered**:

- *Add `tsx` and a standalone generator script* — rejected. A new dependency and a second execution
  path for the same logic, where the check and the generator could then disagree.
- *Generate in a CI workflow and commit from CI* — rejected. Bot commits on a governance artifact,
  and a local run could no longer reproduce what CI produces.
- *No committed file; compute on demand* — rejected in the clarification session. A board nobody can
  see without running a command is not a board.

---

## R-026-6 · How does the register avoid pre-empting D-13's module re-cut?

**Question**: decision **D-13** — the deferred re-cut of the Epic set into 18 modules — would change
every Epic directory name, and therefore every row of the register. EPIC-018 was required to record
that dependency without resolving it (`FR-RGP-008`). The same obligation applies here.

**Decision**: **derive from whatever directories exist; record the dependency; hard-code nothing.**

The register enumerates `specs/<nnn>-<slug>/` at generation time. A re-cut changes the directory
names, the next regeneration produces new rows, and the drift check reports the difference. Nothing
in this epic's configuration names an Epic, a module, or a path.

The one thing that *would* pre-empt D-13 is the exclusion rule. It stays as
`epicDirectories()` already defines it — a positional `NNN-` prefix — and is configuration under
`FR-ESK-015`, so a re-cut that nests Epics under module directories changes a config value rather
than the epic's design.

**Rationale**: the register is a projection of the tree, and a projection cannot pre-empt a decision
about the tree. The temptation `FR-RGP-008` warns about — tidying module paths while writing a
document about them — has no purchase here, because this epic never writes a path down.

**Alternatives considered**:

- *A maintained list of Epic identifiers in configuration* — rejected. It makes the register a second
  place Epics must be registered, which is `FR-ESK-008`'s explicit prohibition, and it would need
  editing by any re-cut.
- *Wait for D-13 before building the register* — rejected. D-13 has been open since 2026-08-03 with
  no owning epic, and the register's value is highest precisely while the Epic set is in flux.

---

## R-026-7 · What about Epics that are never meant to reach Ready?

**Question**: discovered while checking R-026-1. **EPIC-002** and **EPIC-017** hold requirements,
clarifications, traceability and design for child Epics and **deliberately carry no tasks** —
`specs/README.md` calls them *parent designs*, created by rulings **D-19** and **D-18**. On disk they
are indistinguishable from a stalled Epic: `spec.md` and `plan.md` present, no `tasks.md`. The stage
model as specified would show both as stalled at Planned, forever, for doing exactly what they were
designed to do.

**Decision**: **a parent design is a declared *kind of Epic*, not a posture.** Its journey completes
at **Planned**; the DOR is not evaluated against it; it must name its child Epics. Recorded as
`FR-ESK-024`.

Keeping this out of the posture vocabulary is the whole point. Posture answers *"why has this
stopped?"*; a parent design has not stopped — it has finished, at a different finish line. Folding it
in as a fourth posture kind would have meant "Held / Blocked / Superseded / …and one that means the
opposite of stopped", and would have contradicted the 2026-08-09 ruling fixing posture at exactly
three kinds.

**Rationale**: the alternative is worse than untidy. A register that permanently shows the two Epics
holding the requirements for seven child Epics as *stalled* would be wrong on its most consulted
rows, and the natural response — adding tasks to make the warning go away — would undo rulings D-18
and D-19.

**Why declared rather than derived**: nothing on disk distinguishes a parent design from an
abandoned Epic. Both have a spec and a plan and no tasks. Intent is not an artifact, which is the
same reason posture is declared, and the boundary `FR-ESK-003` draws holds: *derive what the tree
knows, declare only what it cannot.*

**Alternatives considered**:

- *Infer it from `plan.md` saying "carries no tasks"* — rejected. Prose-sniffing for intent is
  exactly the fragility that makes hand-maintained status untrustworthy in the first place.
- *A fourth posture kind* — rejected as above; it would overload a vocabulary just fixed at three.
- *Let them read as stalled and explain it in the register's preamble* — rejected. A permanent
  footnote explaining why two rows are wrong is how a register loses its readers.
