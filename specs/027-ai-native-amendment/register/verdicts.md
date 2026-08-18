# Register: Verdicts

**Epic**: `EPIC-027` | **Schema**: [../contracts/reconciliation-register.md](../contracts/reconciliation-register.md)

Exactly one verdict per clause (`FR-AMD-002`).

`verdict` is one of **already-covered · needs-enhancement · missing · conflicting ·
should-integrate**. `owner` names the existing requirement or epic, or carries the literal
`NO-EXISTING-COVERAGE` sentinel — never blank, because blank is indistinguishable from unexamined.

> **Generated projection**: `register.json` is built from this file by `pnpm register:build`.
> Never hand-edit the projection — `G-27-11` compares its digest to this file and fails on drift.

## Register

| clause | verdict | owner | reasoning | action | new_identifier | necessity |
|---|---|---|---|---|---|---|
