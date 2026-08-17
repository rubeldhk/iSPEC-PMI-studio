# Implementation Plan: Artifact Access Control

**Epic**: `EPIC-024` | **Module**: M-13 Security & Governance | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)

**Tasks**: 21 · [tasks.md](./tasks.md) | **Posture**: ⏸ **HELD** (decision D-10)

**Parent design** — not duplicated here: [`../002-team-review-access-storage/`](../002-team-review-access-storage/)
([plan](../002-team-review-access-storage/plan.md) ·
[research](../002-team-review-access-storage/research.md) ·
[data-model](../002-team-review-access-storage/data-model.md) ·
[contracts](../002-team-review-access-storage/contracts/) ·
[quickstart](../002-team-review-access-storage/quickstart.md))

**Shared design**: [`../_shared/`](../_shared/)

**Created by ruling D-19** (2026-08-07), which split EPIC-002 into three delivery epics along the
seam its own build order already described: the run/review chain, access control, and storage were
independent of each other, and of everything else.

## Summary

Direct read and edit grants to named users on individual artifacts — a deliberate, bounded advance on
the SRS roadmap's Phase 3 governance, with roles, groups, inheritance and SSO explicitly left there.

The smallest child and the one with the sharpest failure mode: if access control is implemented as a
filter rather than a boundary, it passes every unit test and leaks in production.

## Scope

| Function | Tasks | What it delivers |
|---|---|---|
| F-02.5 Artifact access control | 15 | Grants, enforcement, hiding, inheritance, last-editor guarantee, snapshots, access API, integration tests |
| F-024.UI Interface | 2 | Access grant control |
| F-024.Z Epic closure | 4 | Per-epic gate |

## Technical Context

Inherited from [`../_shared/plan.md`](../_shared/plan.md) and the
[parent plan](../002-team-review-access-storage/plan.md). The research decisions that bear on this
epic:

**Access control is a second authorisation layer, not a replacement** (**R-002-2**). EPIC-004's
workspace scoping runs **first** and is unchanged; grants narrow *within* an already-scoped result
set. Two layers, fixed order. Folding grants into the scoping helper would turn every existing query
into a permission query and put `SC-004` — the platform's strongest security guarantee — at risk to
deliver a weaker one.

**Both layers refuse identically**: the artifact is **absent**, never forbidden. That is `FR-024`
and it matches EPIC-004's 404-not-403 rule. A locked placeholder discloses existence.

**The last-editor guarantee is a transaction-level invariant** (`FR-027`), not a validation. It must
hold under *concurrent* revocations, which means enforcing it inside the revoke transaction — a
check-then-revoke sequence races past it.

**NEEDS CLARIFICATION**: none.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | PASS — `FR-021`–`FR-028` cite SRS 11 Security (RBAC, Authorization, Audit_Log) and the Security & Governance module |
| III | Epic → Feature → Task decomposition | PASS — 2 functions, 21 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `F-024.Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first — or, for document/configuration outputs, an executable conformance check | PASS — 0 gaps after the 2026-08-05 remediation |
| VI | `specs/024-artifact-access-control/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution` (its first command); stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 behind upstream, 2026-08-08 |
| — | No other Claude session on this checkout | ⚠️ **Cannot assert** — this epic was itself authored outside this session on 2026-08-07 |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md); parent register in [EPIC-002](../002-team-review-access-storage/spec.md) |
| — | **C-01 identifier collision** | ⚠️ **Unresolved and now wider** — see G-02F.1 |

**Any FAIL blocks Phase 0.** No FAIL. This is the only child of the three with no Constitution II debt.

**Post-design re-check**: PASS. No new design was produced — this epic implements the parent's.

## Review of the existing task list

### G-024.1 · Sequencing — ✅ corrected 2026-08-08

**An earlier version of this section had the dependency backwards.** It claimed this epic gates both
siblings and that neither recorded it. Checking the task placement showed otherwise:

- `T381` (run-start access snapshotting, **FR-028**, owned here) lives in **this epic**, not EPIC-023.
  It writes the `access_snapshot` column on `Run`, and **`Run` is defined by EPIC-023 `T343`** — so
  **this epic depends on EPIC-023**, not the reverse. Now recorded in [spec.md](./spec.md).
- **EPIC-023 does not depend on this epic.** Nothing across its 43 tasks references access or grants.
- **EPIC-025 already recorded its dependency** on this epic — `T392` excludes artifacts the publisher
  cannot access (`FR-033`) — and always had; that half of the original claim was simply wrong.

**Corrected order**: EPIC-023 → EPIC-024 → EPIC-025. The numbering was right all along.

**Otherwise the cleanest of the three.** The access API (`T418`–`T420`) and both integration tests
(`T427`, `T428`) were added on 2026-08-05 and migrated intact. It is the only child where every
requirement has a test, a controller, *and* database-level coverage.

### G-02F.1 · The identifier collision extends to success criteria ⚠️ new finding, family-wide

**C-01** was recorded as a *requirement* collision: EPIC-002's `FR-001`–`FR-040` clash with the
platform's `FR-001`–`FR-034`. Checking the split surfaced that **the success criteria collide too**,
and that was never recorded:

```text
EPIC-002 family:  SC-001 … SC-013
platform:         SC-001 … SC-012
```

Every identifier overlaps. `SC-001` here means one thing; `SC-001` in `_shared/platform-spec.md`
means another, and EPIC-010 owns that one. Before the split this was contained in a single spec.
**Now three separate epic specs each cite bare `SC-00n`**, so a reader cannot tell which population
is meant without checking the parent.

Decision **D-1** owns the fix for requirement identifiers; it should be widened to cover success
criteria. Recorded here rather than silently renumbered — renumbering is D-1's pass to make.

## Build order

```text
F-02.5  grant/enforcement tests ──► models ──► grant + revoke ──► enforcement (refuse, hide, record)
                 ├─► inheritance (derived ≥ source restriction)
                 ├─► last-editor invariant (in the revoke transaction)
                 ├─► access snapshotting  (consumed by EPIC-023 T381)
                 └─► access API (T418–T420) + integration tests (T427, T428)
        └─► F-024.UI ──► F-024.Z closure
```

## Design notes specific to this epic

**Hiding is not refusing.** `FR-024` requires an inaccessible artifact to be *absent* from listings.
`T427` asserts this against a **real** PostgreSQL via Testcontainers, because `SC-007` is a claim
about what the database returns — a mocked repository passes while the real query leaks. That is the
same argument EPIC-004 made for `T052`.

**A derived artifact is at least as restricted as its source** (`FR-025`), evaluated on read rather
than copied on write, so a later restriction on the source propagates rather than going stale.

**Every refusal is recorded in the same transaction as the refusal** (`FR-023`), matching EPIC-004's
audit interceptor. An action cannot be refused without its record.

**Revocation is a timestamp, not a delete** — the audit trail survives the grant.

## Phase 0 / Phase 1 outputs

**None new.** This epic implements the parent's design:
- [`research.md`](../002-team-review-access-storage/research.md) — R-002-2 (two-layer authorisation),
  R-002-4 (access snapshot)
- [`data-model.md`](../002-team-review-access-storage/data-model.md) — `AccessGrant`,
  `AccessAttemptRecord`, and the two-layer authorisation rule
- [`contracts/platform-api-epic-002.md`](../002-team-review-access-storage/contracts/platform-api-epic-002.md)
  — the Access Grants endpoint group
- [`quickstart.md`](../002-team-review-access-storage/quickstart.md) — V02-7

Generating a per-epic `research.md` restating decisions already made in
[EPIC-002](../002-team-review-access-storage/research.md) would duplicate the one thing the parent
exists to hold once.

## Definition of done

- [ ] 21 tasks complete, every unit test passing (Constitution V)
- [ ] `T427` green against a **real** PostgreSQL — an ungranted artifact is absent, not forbidden
- [ ] `T428` green — the last-editor invariant holds under concurrent revocation
- [ ] Quickstart **V02-7** passes
- [ ] Every grant, revocation, and refusal appears in the audit record (`SC-013`)
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
