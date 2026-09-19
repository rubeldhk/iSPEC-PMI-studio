# Research: Repository Governance Process

**Epic**: `EPIC-018` | **Date**: 2026-08-04 | **Plan**: [plan.md](./plan.md)

Five decisions. None is expensive to reverse — this epic produces documents, and documents can be
rewritten. The expensive mistakes here are *conceptual*, not structural.

---

## R-018-1 · How is the recommended layout adopted against 65 tracked files?

**Question**: the source document recommends
`docs/specs/architecture/planning/tasks/tests/apis/database/knowledge/adr/governance/prompts/agents/automation/`.
This repository already has `specs/<epic>/`, `specs/_shared/`, `adr/`, `.specify/`, and four code
trees, with 65 tracked files under `specs/` cross-referenced from the README, `_shared/`, and 18 epic
documents.

**Decision**: **map, then migrate incrementally.** Publish the layout as a mapping from artifact type
to location, keeping existing locations where they already satisfy the intent. Create new directories
only when the first artifact of that type arrives. Record every migration in advance.

**Rationale**: the recommendation's value is *one obvious home per artifact type*, and that is
achieved by writing the mapping down. Physically relocating files delivers no additional value and
breaks every cross-reference in the repository. The existing `specs/<epic>/` structure already
satisfies the intent for specifications, planning, and tasks — it just was not written down.

**Alternatives considered**:

- *Adopt the recommended tree wholesale* — rejected. It breaks 65 tracked file paths for a
  presentational gain, and would collide head-on with decision **D-13**'s deferred module re-cut,
  which touches the same paths.
- *Ignore the layout section* — rejected. The programme has already been bitten: the `_shared/`
  convention needed a README "Known limitation" section because tooling could not find it. That is
  precisely the cost of an unwritten layout.

**Consequence**: `FR-RGP-007` requires the mapping to record the relationship to existing paths, and
`FR-RGP-008` requires it to record the D-13 dependency rather than resolve it.

---

## R-018-2 ⚠️ · How is duplication with the constitution prevented?

**Question**: this epic's own greatest risk. Ten steering files describing standards, next to a
constitution describing governance and three templates describing structure, is an obvious route to
two sources of truth — violating **PP-002**, the principle this epic claims to strengthen.

**Decision**: **a strict division by question**, plus a mechanical overlap check.

| Artifact | Answers |
|---|---|
| Constitution | *What governs how we work?* — non-negotiable process rules |
| Templates | *What shape does an artifact take?* |
| Steering files | *What standards must the content meet?* |
| Governance index | *Where is all of this?* |

Where a steering file needs constitutional content, it **links**. `SC-RGP-003` makes this checkable:
a check flags substantial verbatim overlap between any steering file and the constitution or a
template.

**Rationale**: a rule without a check is a hope. The overlap check is cheap — it is text comparison —
and it is the single highest-value automated check in the epic, because the failure it prevents is
silent and slow.

**Alternatives considered**:

- *Author steering files carefully and rely on review* — rejected. Review discipline is exactly what
  erodes; the same argument the programme already accepted for engine independence (T047 fails the
  build rather than a reviewer noticing).
- *Fold standards into the constitution* — rejected. Standards change often, governance rarely.
  Merging them means amending the constitution to change a lint rule.

---

## R-018-3 · What format must steering files take?

**Question**: these files are read by people *and* loaded as context by future agent sessions. Prose
or structure?

**Decision**: **structured front matter plus prose body**, specified in
[contracts/steering-file-format.md](./contracts/steering-file-format.md). Front matter carries
subject, scope, version, status, and owner; the body carries the standards as individually
identifiable, checkable statements.

**Rationale**: an agent loading a steering file needs to know its subject and currency without parsing
prose, and a conformance check needs to address individual standards. Pure prose makes both
guesswork. Pure structure makes the standards unreadable, and a standard nobody reads is not a
standard.

**Alternatives considered**:

- *Free-form markdown* — rejected. `FR-RGP-002` requires checkable standards; you cannot address
  "the third paragraph".
- *YAML or JSON only* — rejected. Standards need rationale, and rationale is prose. The programme's
  own experience is relevant: its most useful documents state *why*, and stripping that would
  reproduce the box-ticking ADR-0005 warned about.

---

## R-018-4 · Where do conformance checks live and when do they run?

**Decision**: `tests/governance/`, run under Vitest in CI alongside `pnpm test:arch`.

**Rationale**: `test:arch` is the closest existing analogue — it enforces a rule about the repository
rather than about runtime behaviour, and it fails the build. Governance checks are the same kind of
thing and belong beside it, under the same runner the constitution already mandates.

**Alternatives considered**:

- *A separate governance CLI* — rejected. A second tool to install, learn, and run means it will not
  be run.
- *Pre-commit hooks only* — rejected. Hooks are bypassable with `--no-verify`; the constitution
  explicitly instructs against skipping hooks, which is an argument for CI enforcement too.
- *Manual review at the convergence gate* — rejected. It defers detection to the last possible moment,
  which is when a fix is most expensive.

---

## R-018-5 · Does this epic amend `spec-template.md` to PMI-DOC-000's thirteen sections?

**Decision**: **no. Check and record, do not move.** `FR-RGP-010` requires each template to be checked
against `PMI-DOC-000`, with every required section present or its absence recorded as a reasoned
deviation. Whether the templates then adopt the thirteen-section structure remains **decision D-4**.

**Rationale**: D-4 predates this epic and was never this epic's to settle. Ruling **D-16** removed the
enhancement document from the question — the 21-section structure governs product outputs only — but
D-16 explicitly left D-4 *scoped, not closed*. Amending the templates here would decide an open
governance question as a side effect of an implementation task, which is exactly the kind of quiet
decision the programme's decision register exists to prevent.

**What this epic does deliver**: the *evidence* for D-4. After F-18.5, the owner can see precisely
which sections are missing from which template and why — which is what makes D-4 answerable instead
of theoretical.

**Alternatives considered**:

- *Adopt the thirteen sections now* — rejected. It back-fills six sections into 18 epic specs and
  pre-empts an open owner decision.
- *Leave templates unexamined until D-4 is answered* — rejected. It is circular: D-4 is hard to answer
  precisely because nobody has enumerated the gap.
