# DEF-032-001 — data-model.md named tables the scoped slice had already shipped with another shape

**Epic**: `EPIC-032` | **Raised**: 2026-10-07 | **Status**: CLOSED 2026-10-07
**Originating task**: `T856n`/`T856o` · found before writing the migration
**Severity**: HIGH — following the plan literally would have broken two shipped Rooms

## Expected

[`data-model.md`](../data-model.md) §1–§5 defines `EvidenceItem`, `EvidenceContract`,
`WorkEvidenceBinding` and `CompletionAttempt`, and `T856n` adds them to `schema.prisma`.

## Actual

The scoped slice (`T1201`–`T1204`, 2026-08-30) — authorised after `data-model.md` was written —
had already created `evidence_contracts`, `evidence_contract_items` and `evidence_items` with a
narrower shape, and `EPIC-033`'s `BaselineService` and `EPIC-034`'s `ClosureService` read them
through `PrismaEvidenceContractSource.isSatisfied`. `tasks.md` was never reconciled with the slice.

## Resolution

**Evolved, not replaced** — `backend/prisma/migrations/20261007090000_epic032_evidence_store/`:

- `evidence_items` gains the attestation columns beside the slice's; every existing column keeps
  its meaning, `satisfiesItemId` becomes nullable (attestations satisfy items by type and
  attachment, not by pointer), and the three fences are `NOT VALID` so they bind every row written
  from now on without re-judging the slice's rows.
- `evidence_contracts` / `evidence_contract_items` are **not altered**. Work-class Contracts are
  repository-resident JSON (`R-032-4`); a row per version would be a second copy of a reviewed file.
- `work_evidence_bindings` and `evidence_completion_attempts` are new.

Both Rooms' consumers are untouched and their suites pass. Two stores remain — the slice's
Room-scoped Contracts and the work-class Contracts — and converging the Rooms onto work-class
Contracts is a follow-up for `EPIC-033`/`EPIC-034`, not a defect of either.
