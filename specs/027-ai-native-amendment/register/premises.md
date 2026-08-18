# Register: Premises

**Epic**: `EPIC-027` | **Schema**: [../contracts/reconciliation-register.md](../contracts/reconciliation-register.md)

Every "existing capability" claim, verified against the corpus (`FR-AMD-006`).

The register records **the evidence, not the conclusion**. A claim that resizes a programme should be
checkable in ten seconds by anyone who doubts it, so `search_performed` carries the query as run.

> **Generated projection**: `register.json` is built from this file by `pnpm register:build`.
> Never hand-edit the projection — `G-27-11` compares its digest to this file and fails on drift.

## Register

| id | claimed_capability | claim_source | search_performed | occurrence_count | locations | verdict |
|---|---|---|---|---|---|---|
