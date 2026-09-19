# Analysis — EPIC-044 Epic Model and Spec Journey Board

**Session**: 2026-09-05 · **Artifacts**: [spec.md](./spec.md) (clarified 2026-09-05) ·
[plan.md](./plan.md) · [tasks.md](./tasks.md) (`T1549`–`T1611`) · constitution v1.6.1

Read-only cross-artifact analysis (`FR-ESK-019`). Eight findings; one HIGH, three MEDIUM, four
LOW; none CRITICAL. No constitution MUST is violated.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| I1 | Inconsistency | HIGH | spec.md `FR-EPB-012`, `FR-EPB-013`, `SC-EPB-002`; tasks.md `T1561`, `T1584` | `FR-EPB-012` requires the **register** to record which package version produced it, while `FR-EPB-013` and `SC-EPB-002` require the register to be **byte-identical** before and after the extraction. Both cannot hold at the same commit: any version line changes the bytes. `T1584` covers the board's half; no task covers the register's half at all | Sequence the two: byte identity is proved at `T1561` **before** any register change; append a task that adds the version footer to the register as a second, documented regeneration; amend `FR-EPB-013` to *byte-identical at the extraction step, before `FR-EPB-012`'s version line is added* |
| C1 | Coverage | MEDIUM | spec.md `FR-EPB-014`; contracts/stage-derivation.md §4; tasks.md | The package MUST import nothing from the platform, the tests or a toolkit adapter, and `backend/src` MUST name no toolkit. The contract names an architecture check; no task writes it | Append a task: `backend/tests/architecture/epic-stage-boundary.spec.ts` — `packages/epic-stage/src` imports only `node:` modules; no command name appears as a literal in `backend/src/modules/epics/` (they come from the configuration) |
| C2 | Coverage | MEDIUM | spec.md `FR-EPB-009`; tasks.md `T1562` | *The same executions in any arrival order yield the same stages* has no assertion: `T1562` lists every rule of data-model §4 and the timing, not determinism under reordering | Extend `T1562` with a shuffled-order case asserting identical `evidence`, `last` and `running` |
| S1 | SRS alignment | MEDIUM | spec.md `FR-EPB-063`; SRS/PMI-DOC-007 §4.2; contracts/epics-api.md §1 | PMI-DOC-007 §4.2 lists `GET /v1/epics/{id}/stage` in the **REST binding of the integration contract** (connector-authenticated); the spec and contract make it a **session** route only. Constitution II: where they disagree the SRS wins, or the departure is listed | Record the departure under spec Assumptions with its reason (no agent consumer exists — §4.1 lists no tool for it; the board is a human surface) and name the follow-up (a connector binding under `project.read` when a tool needs it), so the traceability table does not imply parity it does not deliver |
| I2 | Inconsistency | LOW | plan.md §Source Code; tasks.md `T1549`, `T1552`, `T1554` | The plan's source tree omits three test files the tasks add: `tests/governance/epic-stage-package.spec.ts`, `tests/governance/epic-stage-config-mirror.spec.ts`, `backend/tests/integration/epics-schema.spec.ts` | Add the three lines to the plan's tree at the implement step; no task change |
| D1 | Duplication | LOW | spec.md `FR-EPB-029`, `FR-EPB-063` | Both state that a cross-project read returns nothing; `FR-EPB-063` restates it for the connector reads specifically | Keep both; `FR-EPB-063`'s clause is the connector-specific instance. No change |
| A1 | Ambiguity | LOW | spec.md `FR-EPB-020`; research.md `R-044-13` | *A slug derived from the title* is not specified in the spec; `R-044-13` fixes the rule (`kebab-case`, ASCII, ≤ 40 chars) | Carry the rule into `FR-EPB-020` in one parenthesis so the acceptance test reads it from the spec, not the research |
| U1 | Underspecification | LOW | spec.md `FR-EPB-048`; tasks.md `T1582`, `T1584` | *Reflected on its next load* is asserted only implicitly (the integration flow reads after completing) | Add one explicit assertion to `T1584`: after a completed execution the board re-renders the moved card on reload, with no manual refresh control |

**Overflow**: none.

**Remediation applied 2026-09-05** (approved by the requester in one round, Constitution X):
`I1` → `FR-EPB-013` amended and `T1612` appended; `C1` → `T1613` appended; `C2` → `T1562`
extended; `S1` → the departure recorded under spec Assumptions; `A1` → the slug rule carried into
`FR-EPB-020`; `U1` → `T1584` extended. `I2` is left for the implement step's plan tree update;
`D1` needs no change. Findings status: `I1` ✅ · `C1` ✅ · `C2` ✅ · `S1` ✅ · `I2` ⏳ (implement) ·
`D1` ✅ (no change) · `A1` ✅ · `U1` ✅.

## Coverage Summary

Tasks cite files, research decisions (`R-044-n`) and contract sections rather than requirement
ids; coverage below is by concept, the way `EPIC-042`'s and `EPIC-043`'s analyses mapped it.

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-EPB-001–008 (the derived stage, evidence rules, unbound) | Yes | T1558, T1560, T1562, T1563, T1566, T1567, T1582, T1583 | |
| FR-EPB-009 (determinism) | Partial | T1562 | `C2` |
| FR-EPB-010, FR-EPB-011, FR-EPB-013 (one derivation, configuration, byte identity) | Yes | T1549–T1553, T1558–T1561 | `I1` on the sequencing with FR-EPB-012 |
| FR-EPB-012 (package version recorded) | Partial | T1551, T1584 | the register's half has no task — `I1` |
| FR-EPB-014 (no platform import; no toolkit name) | No | — | `C1` |
| FR-EPB-020–029 (the entity, assignment, decisions, grant, audit, scoping) | Yes | T1554, T1555, T1557, T1564, T1565, T1568, T1569, T1572, T1573 | `A1` on the slug rule |
| FR-EPB-040–049 (the board, the Epic screens, readiness note, filters, states, footer) | Yes | T1576–T1579, T1584–T1589 | `U1` on FR-EPB-048 |
| FR-EPB-050 (specification list columns) | Yes | T1597–T1600 | |
| FR-EPB-060–064 (the reads, decision processing exposed) | Yes | T1574, T1575, T1578, T1591–T1596 | `S1` on FR-EPB-063's binding |
| FR-EPB-070 (governance records) | Yes | T1550, T1611 | ADR amended at the plan step |
| SC-EPB-001 (mutation) | Yes | T1562, T1608 | |
| SC-EPB-002 (byte identity, unchanged specs, inversion) | Yes | T1561, T1590, T1608 | `I1` |
| SC-EPB-003 (M3 first half, transcript) | Yes | T1602, T1607 | needs the reference-local stack |
| SC-EPB-004 (100 % assigned or unassigned) | Yes | T1572, T1574 | |
| SC-EPB-005 (timings) | Yes | T1562, T1582, T1603 | |
| SC-EPB-006 (idempotent split, mutation) | Yes | T1568, T1593, T1608 | |
| SC-EPB-007 (provisional moves nothing) | Yes | T1582 | |
| SC-EPB-008 (four states, filters) | Yes | T1576, T1584 | |

## Constitution Alignment Issues

None. I (no code at analysis), II (`S1` is a listed departure, not a violation once recorded),
IV (`T1610`), V (every implementation task names its failing-first test or conformance check;
unpaired tasks are test-writing or closure records), VI (`defects/` exists), IX and X (this run
ends with a quick-select), XI (Tier 1 `T1606`, Tier 2 `T1607`), XII (`T1609` records the
unregistered build commands).

## Unmapped Tasks

None. `T1586`/`T1587` (sub-routes) serve `FR-EPB-040`/`FR-EPB-041`; `T1601`/`T1603`/`T1604` are
documentation and conformance for `SC-EPB-002` and `FR-EPB-060`–`062`.

## Metrics

- Total requirements: 41 `FR-EPB` + 8 `SC-EPB` (all eight require buildable work or evidence)
- Total tasks: 63 (`T1549`–`T1611`)
- Coverage: 39 of 41 requirements with at least one task (**95 %**); the two without full coverage
  are `FR-EPB-012` (register half) and `FR-EPB-014`
- Ambiguity count: 1 (`A1`)
- Duplication count: 1 (`D1`, kept)
- Critical issues: 0
