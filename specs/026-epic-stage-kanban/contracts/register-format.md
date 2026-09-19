# Contract: Epic Stage Register Format

**Epic**: `EPIC-026` | **Requirements**: `FR-ESK-007`, `FR-ESK-021` | **Checks**: `G-26-03`, `G-26-04`

The format of `governance/epic-stage-register.md`. It is **generated and committed**, so it has two
audiences that pull in opposite directions: a person reading a pull request, and a comparison
routine deciding whether the committed copy still agrees with the repository.

This contract exists because a generated file that is committed is read as a **diff** far more often
than as a document. Every rule below serves that.

## RF-1 · The file is generated

The register carries a header stating so, naming the command that rebuilds it:

```markdown
# Epic Stage Register

**Generated — do not edit.** Rebuild with `pnpm register:update`.

**Epic**: [`EPIC-026`](../specs/026-epic-stage-kanban/) · **Requirements**: `FR-ESK-007`,
`FR-ESK-021` · **Checks**: `G-26-01` to `G-26-10`
```

A hand edit is not merged, negotiated, or preserved. `G-26-04` regenerates and compares; a
difference fails the build.

## RF-2 · Determinism

Identical repository state MUST produce a byte-identical file.

**Forbidden**, each because it makes every regeneration a diff:

- Generation timestamps or dates of any kind
- Roll-up counts, totals, or percentages — one Epic's change would rewrite an unrelated line
- Anything derived from the clock, the filesystem order, the machine, or the user

Rows are ordered by Epic identifier ascending. A row's position is stable for the life of the Epic,
so a diff shows exactly which Epics moved and nothing else.

## RF-3 · One row per Epic, one line per row

The main table is the whole register:

```markdown
| Epic | Title | Kind | Stage | Posture | Readiness | Next |
|---|---|---|---|---|---|---|
| [EPIC-001](../specs/001-platform-foundation/) | Platform Foundation | delivery | Tasked | — | Not ready | `/speckit-analyze` |
| [EPIC-002](../specs/002-team-review-access-storage/) | Team Review, Access Control & External Storage | parent-design | Planned | — | n/a | — |
| [EPIC-009](../specs/009-spec-lifecycle-versioning/) | Specification Lifecycle & Versioning | delivery | Tasked | Held — awaiting `PMI-DOC-004` | Not ready | — |
```

**One line per row, no wrapping.** A wrapped row turns a one-Epic change into a multi-line diff.

| Column | Rule |
|---|---|
| `Epic` | Link to the Epic directory, relative from `governance/` |
| `Title` | First heading of `spec.md`, prefix stripped |
| `Kind` | `delivery` or `parent-design` |
| `Stage` | One of the seven; never blank |
| `Posture` | `Kind — object`, or `—` when none. `stalled` when stopped with nothing declared |
| `Readiness` | `Ready`, `Ready (waived)`, `Not ready`, or `n/a` for a parent design |
| `Next` | The next command in backticks, or `—` at a terminal stage |

Em dash `—` is the single empty marker. Never blank cells, never `N/A`, never `null`.

## RF-4 · Findings are a separate section

Out-of-order artifacts, incomplete declarations and invalid waivers are **reported, not folded into
the stage**. A finding never changes a row's Stage or Readiness — reaching a stage and passing a gate
are different claims.

```markdown
## Findings

| Epic | Finding | Severity |
|---|---|---|
| EPIC-014 | `tasks.md` present without `plan.md` — stage held at Clarified | report |
| EPIC-020 | posture `Held` names no awaiting input | report |
```

Omitted entirely when empty — an empty findings table is noise in every diff until something breaks.

**Severity** is `report` or `fail`, matching the split in `FR-ESK-016`.

## RF-5 · Active waivers are listed

Every active waiver appears with its condition, owner, reason and expiry (`FR-ESK-023`). Omitted
when there are none.

```markdown
## Active waivers

| Epic | Condition | Owner | Expires | Reason |
|---|---|---|---|---|
| EPIC-014 | DOR-09 | tech-lead | 2026-09-30 | analysis blocked on the CI rebuild |
```

A waiver is visible in the register or it does not exist. Burying an exception in a config file
nobody reads is how a gate gets quietly skipped.

## RF-6 · No content that is not derived

The register states stage, posture, readiness and findings. It MUST NOT carry narrative, build
order, module mappings, rationale, or task counts.

That content belongs to `specs/README.md`, which is authored. This rule is the whole PP-002 defence:
the register cannot restate the README if it can only contain what the generator produces.

`G-26-09` enforces the converse — the README must not restate stage or posture.

## RF-7 · Comparison is exact

`G-26-04` compares the committed file to a freshly generated one as **exact text**, after normalising
line endings only.

No fuzzy matching, no "close enough", no ignoring whitespace. A generated file that tolerates
near-misses is a generated file that drifts, and the drift check is the only thing standing between
a committed register and the hand-maintained status this epic exists to replace.
