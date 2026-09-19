# ADR-0004 — One-way publishing to external storage

**Status**: Accepted
**Date**: 2026-08-02 (recorded as an ADR 2026-08-03)
**Deciders**: Project owner
**Applies to**: EPIC-002

## Context

EPIC-002 requires project artifacts to be published to external file storage — Google Drive,
Dropbox, S3 — so people outside the platform can read them in tools they already use.

The question was whether edits made to those files at the provider should flow back into the
platform. Two-way synchronisation was a genuine option and was considered.

## Decision

**Publishing is one-way and permanent.** Files are copied out for reading and sharing. External
edits never return. The platform remains the authoritative source. This explicitly excludes
per-file import-back, not merely bulk sync.

Storage providers sit behind a single integration boundary and are interchangeable — the same
adapter pattern ADR-0001 applies to specification engines.

## Consequences

**Positive**

- No conflict resolution, no merge semantics, no class of data-loss bug.
- The platform holds lifecycle state, approvals, and version history that a Drive or S3 file cannot
  carry. One-way publishing means those never compete with an external copy.
- Nothing at the provider can damage a platform artifact (FR-037).
- Provider switching is loss-free (FR-038), satisfying PP-015 (no vendor lock-in).

**Negative**

- Someone who edits a published file at the provider has done work the platform will never see.
  Mitigated by making the copy nature explicit in the interface rather than implied.

**Rejected alternatives**

- *Two-way sync* — would require external change detection, conflict resolution, and a rule for
  which side wins when both changed. Realistically doubles the storage work and introduces a
  genuine way to lose someone's writing.
- *One-way plus explicit per-file import* — a smaller version of the same problem; an imported file
  still has no approval state to reconcile.

## Traceability

- Requirements: EPIC-002 FR-029 to FR-040, SC-010, SC-012
- Principles: PP-002 (single source of truth), PP-015 (open standards)
- Clarification: EPIC-002 session 2026-08-02, question 2
- **Unresolved dependency**: third-party storage integration still has **no SRS source**. Re-verified
  against the MPS drop of 2026-08-03 — absent from all 18 module specifications and all 6 volumes.
  Back-fill remains owed (Constitution II).
