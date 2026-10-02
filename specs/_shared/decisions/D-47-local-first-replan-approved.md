# D-47 — PMI Studio is the visual manager of Spec Kit: the local-first replan is approved

**Status**: **DECIDED — approved 2026-09-03 by the Project Owner**
**Owner**: Project Owner (Product)
**Authorises**: [PMI-DOC-007 v1.0](../../../SRS/PMI-DOC-007_Local_First_Replan_v0.1.md) in full,
with every §12 default intact (`D-1`–`D-9` of that document); the `/speckit-specify` flow for
`EPIC-041` Local Project Workspace, `EPIC-043` PMI Integration Contract and `EPIC-042` PMI Spec Kit
Extension, in that order; the declaration of `EPIC-044`–`EPIC-046` after milestone `M1`
**Discharges**: the nine unmet objectives recorded in
[PMI-DOC-004B](../../../SRS/PMI-DOC-004B_Spec_Kit_Visual_Manager_Objective_Verification_and_Replan_v0.1.md) §2
**Precedent**: `D-44`, which approved a product document (PMI-DOC-006) as the authority an Epic is
then specified against

## The question

On 2026-09-03 the Project Owner restated the product's ten core objectives. Verification against
commit `62644ba` found nine unmet, with one root cause: the platform **executes** Spec Kit itself in
a disposable managed sandbox, while the objectives require the **user's own agent** to execute Spec
Kit in a durable local directory with PMI Studio as the record. `ADR-0024` admitted that mode as
optional; `ADR-0017` left it unowned; `ADR-0010` designed its MCP surface with no code.

Three options were put: **A** invert the execution model and keep the platform; **B** add local
mode beside the sandbox as an equal; **C** start a lightweight product afresh.

## The decision

**Option A.** Controlled-local becomes the default execution mode. The project directory is the
durable substrate for artifact content; PMI Studio is the durable substrate for status, decisions
and evidence. Agents reach PMI Studio only through the `EPIC-037` contract and the read/sync tools
PMI-DOC-007 §4 specifies, authenticated by a project-scoped connector token. The managed sandbox is
retained as an optional mode and is not required by any objective.

The nine defaults approved with it, in PMI-DOC-007 §12: MCP first with REST mounted alongside; PMI
is the source of the constitution and the file is generated; one specification per Epic with a
50-task ceiling and human-confirmed splits; Kanban manual moves are proposal-gated; the park list of
§9.4; declaration sequencing 041 → 043 → 042 now and 044–046 after `M1`; PMI-aware commands are a
**Spec Kit extension with hooks**, never edited stock skills; assurance is one field with two values.

## What this does NOT do

It does not declare an Epic, create a `specs/` directory, or change a posture — those are the
separate acts that follow it (`RULE-14`, `ADR-0029`). It does not assign `BR-` identifiers: the
eleven requirements PMI-DOC-007 §9.3 states as `LR-01`–`LR-11` receive numbers only in PMI-DOC-004
v2.1, so no citation in the corpus points at a requirement that does not yet exist (`G-BRS-03`).
Until then an Epic specified from PMI-DOC-007 cites `LR-nn` and the existing `BR-0132`, `BR-0133`,
`BR-0196`–`BR-0203` it conforms to, and records the back-fill under Assumptions — the standing
`D-46` pattern for authorised-but-not-yet-SRS-numbered requirements.

## Consequences

- `EPIC-041` is specified first, from PMI-DOC-007 §7, and its Foundational phase repairs the four
  severed wiring points of PMI-DOC-004B §2.1, because nothing local is demonstrable while the worker
  throws on persistence.
- `ADR-0030` is owed, and `ADR-0009`, `ADR-0024` are amended, at `EPIC-041`'s plan step; `ADR-0010`
  and `ADR-0017` close when `EPIC-043` and `EPIC-041` close respectively.
- PMI-DOC-004 v2.1 (MINOR) is owed before the platform release gate: `LR-01`–`LR-11` numbered,
  release slice `R3-local` inserted.
- `EPIC-038`'s current task block completes and the Epic is then held; `EPIC-039`, `EPIC-040`,
  `EPIC-031` and the managed-sandbox family are held per PMI-DOC-007 §9.4. The postures are
  recorded in `epic-declarations.json` when the first new Epic is declared, not by this record.
