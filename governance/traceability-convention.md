# Traceability Convention

**Epic**: [`EPIC-018`](../specs/018-repository-governance/) · **Requirement**: `FR-RGP-013` ·
**Version**: 1 · **Check**: `G-06c`

Which artifact types link to which, and which of those links are mandatory. A link rule is only
worth stating if it can be checked, so each rule below names how.

## Status — the full chain awaits decision D-2

`PMI-DOC-000` §5 states a nine-level chain:

> Business Goal → Requirement → Epic → Feature → User Story → Task → Code → Test → Release

Whether this repository adopts all nine levels is decision **D-2**, recorded in
[`../specs/srs-alignment.md`](../specs/srs-alignment.md) and still **open**. Three levels — Business
Goal, User Story as a distinct artifact, and Release — have no representation here yet, and two of
them depend on `PMI-DOC-004`.

The rules below cover the links that exist **today**. They are deliberately a subset. Stating the
full chain as though it were in force would make five of nine levels aspirational, and a
traceability model that is mostly aspiration is one nobody trusts enough to check.

## Link rules

| Link | Required | Checked by |
|---|---|---|
| Requirement → SRS source document | mandatory | SRS traceability table per epic spec, reviewed at approval |
| Epic → requirements it owns | mandatory | "Requirements owned" section per epic spec |
| Feature → requirements it satisfies | mandatory | Framing note per `F-<epic>.<n>` section |
| Task → file path it changes | mandatory | `DS-1`, reviewed at code review |
| Implementation task → unit-test task | mandatory | Constitution V, confirmed at epic closure |
| Task → defect record | mandatory when a defect exists | `specs/<epic>/defects/`, triaged at closure |
| Defect → the task that fixes it | mandatory | Constitution VI |
| Epic → epics it depends on | mandatory | "Depends on" section per epic spec |
| Steering standard → its check | mandatory | `G-03` |
| Steering file → governed text it references | mandatory where it overlaps | `G-04` |
| Governance artifact → governance index | mandatory | `G-05b` |
| Epic → closure report | mandatory | Constitution IX, `G-09` format |
| Decision → the epic that consumes it | optional | decision register |
| ADR → the epics it constrains | optional | `adr/README.md` |

## Cross-epic links

A link may point outside its own epic. When it does, it is **declared** rather than inferred.

The 2026-08-03 analysis found `T081 → T073` and `T101 → T095` crossing epic boundaries correctly but
invisibly: each was a real dependency, and neither was visible to per-epic convergence, which checks
one epic at a time. A cross-epic link that nobody declared is a dependency that closure cannot see.

**Rule**: where a task cites an identifier belonging to another epic, the citing epic's task list
says so in its Dependencies section. The D-15 split method preserves this — task identifiers stay
invariant across a split, so a citation that pointed into the same epic before a split may point
into a sibling epic afterwards, and that is expected rather than a defect.

## What is not traced

- **Code → requirement**, directly. Code traces to a task, and the task traces to a requirement.
  A comment naming a requirement in source is not maintained and goes stale silently.
- **Release** — no release artifact exists yet; [EPIC-014](../specs/014-devops-release/) owns it.
- **Business Goal** — awaits `PMI-DOC-004`.

## Related documents

- [`document-structure.md`](./document-structure.md) — the documents these links run between.
- [`../specs/srs-alignment.md`](../specs/srs-alignment.md) — decision **D-2**.
- [`../specs/011-traceability/`](../specs/011-traceability/) — the product's traceability capability,
  which is a different thing: it traces the customer's artifacts, not this repository's.
