# Loop instance configurations

**EPIC-030 `T930`.** The programme-defined half of every governed workflow type — `FR-GEL-004`,
`FR-GEL-005`, `FR-GEL-009`.

One file per workflow type, named `<workflowType>.json`. `stages` is programme-defined and **not
writable by a tenant**; the tenant-configured half — authorities, required gates, trigger rules —
is the `loop_instance_configurations` row keyed to it.

## What checks these

[`schema.json`](./schema.json) documents the shape.
**`backend/tests/architecture/loop-config-conformance.spec.ts` (`T931`) enforces it**, and is the
authority where the two could disagree: it is the executable conformance check Constitution V
requires for a non-code output, it reads **every** file in this directory, and it demonstrably fails
on each of the four faults rather than only describing them.

A later Epic adding a file here is covered without editing that check. `EPIC-034` `T406v` and
`EPIC-035` `T997w` both cite `T931` by number for exactly this reason.

## `example-workflow.json` is an example, not a product workflow

It exists so the schema has a worked instance and the conformance check has something real to run
against — an empty directory would make `T932` pass forever, which is the *"two Vitest projects
passed with no test files"* failure recorded in `epic-stage/harness.spec.ts`.

It deliberately includes an **automated** transition that names its rule, because the easy case —
every transition human, every `trigger` null — would demonstrate the half of `FR-GEL-031` that
cannot go wrong.

The three Rooms bring their own: `requirement-room.json` (`EPIC-033`), `change-room.json`
(`EPIC-034` `T406v`), `defect-room.json` (`EPIC-035` `T997w`). This Epic authors none of them —
`FR-GEL-061` lets the loop carry the *string* `"requirement-room"` as data in a tenant's file, and
not the concept.

## Omitted stages are legal and visible

`example-workflow.json` omits `Context`, `Execute`, `Verify` and `Evidence`. `FR-GEL-008` requires
those to appear in the progress projection as **omitted**, not as absent — *configured not to apply*
and *not reached* are different facts, and a missing row conflates them.
