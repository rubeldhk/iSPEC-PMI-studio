# Register: Capability Areas

**Epic**: `EPIC-027` | **Schema**: [../contracts/reconciliation-register.md](../contracts/reconciliation-register.md)

The twenty capability areas the amendment introduces (`SC-AMD-011`).

**Exactly twenty rows**, asserted by `G-27-13` so this table and the figure quoted in `spec.md`
cannot drift apart. Seventeen came from the August-11 set; the Augment/Cosmos amendment added three
on 2026-08-14.

> **Generated projection**: `register.json` is built from this file by `pnpm register:build`.
> Never hand-edit the projection — `G-27-11` compares its digest to this file and fails on drift.

## The twenty areas

`FR-AMD-012` requires each capability area assigned: an existing epic, a new epic, architectural
preparation only, or deferred. This is that assignment, and `G-27-13` asserts the count agrees with
the figure `SC-AMD-011` quotes — an assertion added because those two numbers had already drifted
apart (`DEF-027-001`).

**Four proceeded, sixteen are held, and three of the twenty have no owner at all.**

The four proceeding areas were the amendment's immediately-buildable slice. Three are now BUILT by
EPIC-028; the fourth, persistent project state, is still unspecified. The sixteen held areas are held
behind `PMI-DOC-004` — not by this reconciliation, which changed no epic's posture (`FR-AMD-017`,
asserted by `G-27-14`).

**The three unowned areas are the finding this table exists to surface.** Governed Engineering Loops,
Governed Learning and the Specification Compliance Agent all arrived with the Cosmos amendment on
2026-08-14, all three are genuinely new — absent from the four August-11 documents — and none has an
owning epic. All three are product surface and therefore held, so nothing is blocked today. What is
recorded here is that when `PMI-DOC-004` lands, three capability areas will have nowhere to go until
someone creates epics for them.

## The twenty areas

`FR-AMD-012` requires each capability area assigned: an existing epic, a new epic, architectural
preparation only, or deferred. This is that assignment, and `G-27-13` asserts the count agrees with
the figure `SC-AMD-011` quotes — an assertion added because those two numbers had already drifted
apart (`DEF-027-001`).

**Four proceeded, sixteen are held, and three of the twenty have no owner at all.**

The four proceeding areas were the amendment's immediately-buildable slice. Three are now BUILT by
EPIC-028; the fourth, persistent project state, is still unspecified. The sixteen held areas are held
behind `PMI-DOC-004` — not by this reconciliation, which changed no epic's posture (`FR-AMD-017`,
asserted by `G-27-14`).

**The three unowned areas are the finding this table exists to surface.** Governed Engineering Loops,
Governed Learning and the Specification Compliance Agent all arrived with the Cosmos amendment on
2026-08-14, all three are genuinely new — absent from the four August-11 documents — and none has an
owning epic. All three are product surface and therefore held, so nothing is blocked today. What is
recorded here is that when `PMI-DOC-004` lands, three capability areas will have nowhere to go until
someone creates epics for them.

## Register

| area | verdict | home | posture |
|---|---|---|---|
| Agent Gateway + agent contract | missing | EPIC-028 | BUILT 2026-08-17 |
| ProjectExecutionEnvironment | needs-enhancement | EPIC-028 | BUILT 2026-08-17 |
| EgressPolicy profiles | conflicting | EPIC-028 | BUILT 2026-08-17 |
| Agent-independence architecture test | missing | EPIC-028 | BUILT 2026-08-17 |
| Persistent project state | missing | EPIC-029 (proposed) | proceeds — unspecified |
| Execution job to AgentRun state machine | needs-enhancement | EPIC-012 | held |
| Requirement Room / Requirement Intelligence | conflicting | new epic — NOT EPIC-007 | held |
| Change Room / Change Intelligence | conflicting | new epic | held |
| Defect Room / TDD remediation | conflicting | new epic | held |
| Decision Intelligence / Decision Center | conflicting | new epic — shared by three Rooms | held |
| Engineering Context Engine | missing | new epic | held |
| Knowledge Graph expansion | needs-enhancement | EPIC-011 + EPIC-022 | held |
| Evidence Package + completion gate | missing | new epic, or EPIC-015 extension | held |
| Integration Hub + Capability Resolver | missing | new epic — M-16 | held |
| PMI Studio MCP surface | conflicting | EPIC-013 core, M-09 marketplace | held |
| Spec Kit native lifecycle | needs-enhancement | EPIC-008 / EPIC-013 | held |
| Human/AI responsibility model | needs-enhancement | _shared/platform-spec.md | recordable now — D-37 open |
| Governed Engineering Loops | missing | UNOWNED | held — no epic exists |
| Governed Learning | missing | UNOWNED | held — no epic exists |
| Specification Compliance Agent | missing | UNOWNED | held — no epic exists |
