# Closure record: EPIC-020 Living Specifications & Impact

**Date**: 2026-08-20 · **Session**: `/speckit-implement EPIC-020`, executed in the isolated
worktree branch `epic/009-011-016-lifecycle-wave` (concurrent-session rule) · **Released by**:
PMI-DOC-004 v1.0. Built after EPIC-019 exactly as the family sequencing required.

## `T269` — every implementation task has a passing unit test (Constitution V)

**18 of 18 implementation tasks complete**, all red-first (all eight spec files failed before the
implementations existed — seven backend on unresolved modules, the frontend banner tests against
the pre-currency view).

| Implementation task | Paired test | Result |
|---|---|---|
| T252 `DependencyEdge` model — separate table (R-017-3), unique endpoint pair, both traversal indexes, self-edge CHECK | T251 `dependency-edge.spec.ts` (7, schema + migration + service integrity) | pass |
| T254 multi-hop cycle detection, pure | T253 `cycle-detection.spec.ts` (7 — direct/two-hop/five-hop, diamond ≠ cycle, type+id identity) | pass |
| T256 dependency service — create/list/delete, cycle refused BEFORE storage | T255 `dependencies.service.spec.ts` (cycle table: direct/two-hop/multi-hop, SC-ENH-009) | pass |
| T258 impact path construction, pure — path + distance per affected artifact | T257 `impact-path.spec.ts` (5, incl. diamond shortest-path and direction) | pass |
| T260 bounded impact query (R-017-5) — `bounded=true`, never silent shortening | T259 `impact-bounded.spec.ts` (4, incl. exactly-at-bound not reported bounded) | pass |
| T262 endpoints + `DependenciesModule` — impact in ONE request (SC-ENH-002) | T255's controller half (route table, 401, one-request assertion) + **T261 integration (6) on real PostgreSQL** | pass |
| T264 `currency_status`/`stale_reason`/`reconciled_at/by` on Specification | T263 `currency.spec.ts` (schema half) | pass |
| T265 currency detection via the dependency graph — ONE field, wider trigger | T263 (graph-driven marking names the change; FR-032's requirement trigger through the SAME field) | pass |
| T267 reconciliation — attribution; baselined FORKS, never alters | T266 `reconciliation.spec.ts` (4) | pass |
| T268 staleness on the specification itself (SC-ENH-006) | `StalenessBanner.spec.tsx` (3) extending EPIC-010 T084's view — ONE live region, flags can never disagree on screen | pass |

Suites at closure: 1277 fast across 142 files (see honesty note on the one flake) · integration
on real PostgreSQL including the T261 suite and both raw refusals (self-edge CHECK, duplicate
unique) · governance re-run after register refresh · typecheck clean ×3.

**Honesty note**: one run of the fast suites under CPU contention with the concurrent
Testcontainers suite showed `auth/password.spec.ts` exceeding its timeout (argon2 hashing at
12.9s under load). It passes alone and in every uncontended batch, and was re-run clean before
this record — a scheduling flake, not a regression; noted rather than hidden.

## Design notes that will matter later

- **DependencyEdge is deliberately NOT TraceabilityLink** (R-017-3): system-written derivation
  links stay immutable and acyclic; user-maintained dependency edges are mutable and
  cycle-checked. The self-edge is refused by the DATABASE; multi-hop cycles by the pure detector
  before storage — an illegal edge never exists, even transiently.
- **A bounded impact result announces itself.** `bounded` is true only when the cut removed
  something; a bound with nothing beyond it is not a truncation. The service default is 25 hops.
- **One staleness field.** `currency_status` generalises FR-032; the requirement-change trigger
  and the graph trigger both write it, and the UI renders ONE live region for both — two flags
  (or two banners) would eventually disagree.
- **Reconciling a baseline forks.** The baseline row keeps its staleness record as history; the
  fork is the reconciled line — FR-011a holds without exception.

## `T270` — convergence

Performed within this run per the `speckit-converge` method. **No unbuilt work found in scope.**
Deferrals with owners: Prisma-backed `DependencyStore`/currency writes + wiring
`CurrencyService.artifactChanged` into the requirement-edit and ADR-edit paths → the platform
composition root, **EPIC-014 F-11.2** (the in-memory OutOfDateService continues to serve FR-032's
existing path meanwhile); reconcile/currency endpoints → not named by this epic's tasks or
contracts, surfaced when EPIC-021's review gates consume them; SC-ENH-003 (impact at 500
specifications) → EPIC-015's scale suite by this epic's own Notes.

## `T271` — defect triage

`specs/020-living-specifications/defects/` contains no records. **0 open.**

## `T272` — closing report

**Work completed**: `backend/src/modules/dependencies/` (cycle-detector, dependencies.service,
impact-path, impact.service, dependencies.controller, dependencies.module),
`backend/src/modules/specifications/currency.service.ts` + `reconciliation.service.ts`, the
`DependencyEdge` model + `CurrencyStatus` columns + migration
`20260820200000_epic020_dependencies_currency`, AppModule registration, the frontend staleness
banner (Specification view + api type), and 8 test files (~50 new tests incl. the real-PostgreSQL
impact suite). **Deferred with owners**: as listed under T270.

### Epic Exit Criteria

- [x] Every implementation task has a passing unit test (T269)
- [x] Convergence reports no unbuilt work in scope (T270)
- [x] `defects/` contains no open records (T271)
- [x] Principle deltas hold; deferrals have valid owners (T272)
- [x] Closure recorded — **EPIC-020 is CLOSED and release-eligible**
- [ ] Platform promotion — EPIC-014 F-11.2's

### Recommended Next Task

`/speckit-implement EPIC-021` — Review Gates & Roles, next in the family; EPIC-022 should wait
for the fold-into-011 ruling (EPIC-011 is delivered, so the question is live).
