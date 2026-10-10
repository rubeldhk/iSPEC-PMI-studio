# DEF-032-005 — the contract typed a subject digest as requiring all three algorithms

**Epic**: `EPIC-032` | **Raised**: 2026-10-07 | **Status**: CLOSED 2026-10-07
**Originating task**: `T856a`/`T856b` · **Severity**: MEDIUM

## Expected / Actual

`contracts/evidence-contract.md` §1 typed `digest` as
`Readonly<Record<'sha256' | 'gitCommit' | 'gitBlob', string>>` — all three required. The in-toto
Statement v1 spec (consulted through Context7, `/in-toto/attestation`) requires a digest **set**,
any algorithm; its own `test-result` example carries `gitCommit` alone. As written, every real
test-result attestation would have been refused as having no digest.

## Resolution

`SubjectDigest` is *at least one of* the three (`packages/evidence-contract/src/attestation.ts`);
`{}` still fails to compile, so `FR-EVS-042`'s fence is intact. Asserted in `attestation.spec.ts`.
