# Document Structure

**Epic**: [`EPIC-018`](../specs/018-repository-governance/) · **Requirement**: `FR-RGP-012` ·
**Version**: 1 · **Check**: `G-06b`

The structure a plan or task document follows, so that a document is conformant **by construction**
rather than by later correction. Governed by `PMI-DOC-000`; the measured gap against it is recorded
in [`template-conformance.md`](./template-conformance.md), not restated here.

## Required sections

| Document | Section | Required | Purpose |
|---|---|---|---|
| Plan | Technical Context | mandatory | Language, versions, constraints, scale — the facts implementation depends on |
| Plan | Constitution Check | mandatory | Each principle, with a pass verdict and its evidence |
| Plan | Project Structure | mandatory | Which directories this epic writes to |
| Plan | Complexity Tracking | when a gate is not met | The violation, why it is necessary, what was rejected |
| Plan | Related Documents | mandatory | Links to spec, research, data model, contracts |
| Task list | Epic and module header | mandatory | Epic id, module, task count |
| Task list | Delivery posture | mandatory | Proceeding, or held with what it awaits |
| Task list | Session label | mandatory | Constitution VIII; see [`session-labelling.md`](./session-labelling.md) |
| Task list | Test statement | mandatory | Constitution V; states what verification means for this epic |
| Task list | Feature sections `F-<epic>.<n>` | mandatory | Tasks grouped by feature, each with a framing note |
| Task list | Dependencies | mandatory | What this epic waits on, and what waits on it |
| Task list | Build order | mandatory | Which features may run in parallel |
| Task list | Phase Z closure | mandatory | Constitution IV, V, VI, IX gates |

## Rules

### DS-1 · One task, one checkbox, one file path

A task line reads `- [ ] T### [P?] Description with an explicit path`. A task with no path is a
task whose completion is a matter of opinion.

### DS-2 · Task identifiers are globally unique and invariant

An identifier is never reused, and never renumbered once published — other epics cite it. A split
that renumbers tasks breaks every citation silently.

This is why the D-15 split method asserts a loss check: task identifiers stay invariant across a
split, and a `(unit test: T0nn)` reference may legitimately point into a sibling epic.

### DS-3 · A feature section states why it exists before listing tasks

Each `F-<epic>.<n>` opens with a framing note naming the constraint that most easily breaks. Task
lists are read under time pressure; the constraint is the part worth putting where it will be seen.

### DS-4 · Held work states what it awaits

A held epic names the input, not just the state. "Held" without a named input is indistinguishable
from abandoned.

### DS-5 · A section that does not apply is removed, not filled with N/A

An `N/A` row is noise that survives review because it looks answered.

### DS-6 · Absences are reasoned where a standard requires the section

Where `PMI-DOC-000` §4 requires a section this repository omits, the omission is recorded in
[`template-conformance.md`](./template-conformance.md) with a reason and an owner.

## Related documents

- [`template-conformance.md`](./template-conformance.md) — measured conformance and decision **D-4**.
- [`traceability-convention.md`](./traceability-convention.md) — which links between these documents
  are mandatory.
- [`repository-layout.md`](./repository-layout.md) — where each document type lives.
