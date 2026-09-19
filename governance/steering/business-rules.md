---
subject: business-rules
scope: repository
version: 1
status: awaiting-input
owner: product-owner
last_reviewed: 2026-08-07
blocked_by: PMI-DOC-004 Business Requirement Specification
supersedes: null
---

# Business Rules

## Why this exists

This file exists **empty on purpose**, and that is its content.

`PMI-DOC-004`, the Business Requirement Specification, has not been issued. Every business rule this
programme would state — approval thresholds, lifecycle gates, retention obligations, entitlement
rules — derives from it. 141 tasks across the epic set are already held pending the same document.

Writing plausible rules here would not fill the gap; it would hide it. They would be cited, built
against, and contradicted by `PMI-DOC-004` when it arrives, and the contradiction would surface as
defects in whichever epic happened to depend on them.

## Status

**No standards are stated.** This is a recorded gap, not an oversight. Check `G-03` exempts a file
with `status: awaiting-input` from the "at least one standard" rule, and requires it to name what it
awaits and who owns the back-fill — so the exemption is itself checked rather than assumed.

**Back-fill owner**: product-owner.

**Blocked by**: `PMI-DOC-004` Business Requirement Specification, tracked as risk **D-K** in the
[RAID log](../../specs/_shared/raid-log.md) and as decision **D-10** in
[`specs/srs-alignment.md`](../../specs/srs-alignment.md).

## What happens when PMI-DOC-004 arrives

1. This file moves to `status: active`, `version: 2`, and states rules with identifiers `BR-001`
   onward — each with a check and a rationale, like every other steering file.
2. The held epics are released in dependency order per the wave sequence in
   [`specs/README.md`](../../specs/README.md).
3. The SRS back-fill owed by [EPIC-023](../../specs/023-unattended-runs-review/) and
   [EPIC-025](../../specs/025-external-storage-publishing/) is discharged. Both gate **approval**,
   not merely closure.

## Deliberately not covered here

- **Product principles** — `SRS/PMI-DOC-003` `PP-001` to `PP-020`, bound programme-wide by decision
  **D-6**. Principles are not business rules: a principle constrains how the product is built, a
  business rule states what the business requires it to do.
- **Specification lifecycle states** — [EPIC-009](../../specs/009-spec-lifecycle-versioning/), which
  models the mechanism. The thresholds that drive it are business rules and belong here, once they
  exist.
