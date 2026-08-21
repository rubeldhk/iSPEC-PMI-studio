# Closure record: EPIC-021 Review Gates & Roles

**Date**: 2026-08-20 · **Session**: `/speckit-implement EPIC-021`, executed in the isolated
worktree branch `epic/009-011-016-lifecycle-wave` (concurrent-session rule) · **Released by**:
PMI-DOC-004 v1.0. Checklist 25/25 PASS at entry.

## `T292` — every implementation task has a passing unit test (Constitution V)

**19 of 19 implementation tasks complete**, all red-first (all nine spec files failed on
unresolved modules before the implementations existed).

| Implementation task | Paired test | Result |
|---|---|---|
| T274 the twelve roles — code catalogue + `ReviewRole` model + migration seed, names extracted VERBATIM from the source docx ("Recommended AI Agents") | T273 `role.spec.ts` (9 — roster exact, responsibilities, out-of-type refusal BY NAME, schema, seed) | pass |
| T276 `reviewSpecification` capability — `ReviewInput`/`RoleInput`/`ReviewOutput`, OPTIONAL on the engine interface, `EngineCapability` widened while `PHASE_1_CAPABILITIES` keeps its three | T275 `review-input.spec.ts` (7 — incl. attribution-not-forgeable: no role field on output) | pass |
| T278/T280 `ReviewGate` model + gate configuration | T277 `gate-config.spec.ts` (13 — the eight transitions DERIVED from EPIC-009's machine so the sets can never drift; unknown transition/role refused by name; **empty roles refused — the gate fails closed**) | pass |
| T280 capability checking (E-R5, C-20) | T279 `gate-capability.spec.ts` (3 — registration succeeds without review; the GATE refuses with engine + capability named) | pass |
| T282/T285 findings attributed or refused (E-R2, C-18, SC-ENH-005) | T281 `review-finding.spec.ts` (6 — platform stamps the role it ASKED; one bad finding voids the whole result; schema requires both columns, CHECKs raw) | pass |
| T285 gate execution — roles run CONCURRENTLY | T283 `empty-findings.spec.ts` (E-R4/C-17: **empty findings is a PASS**, distinguishable from a failed call) + T284 `role-unavailable.spec.ts` (E-R3/C-19: unavailable/malformed/timeout fails the GATE, no skip path; healthy roles' findings kept) | pass |
| T287/T288 `GateOutcome` (append-only) + pure arbitration | T286 `gate-arbitration.spec.ts` (8 — null decision blocks even with ZERO findings; a FAILED gate never advances, approved or not; trigger asserted) | pass |
| T290 the human decision path | T289 `override.spec.ts` (6 — approver + time + OVERRIDDEN findings recorded; write-once; failed gate not approvable; opaque cross-workspace) | pass |
| T291 RAID R-02 re-scored | recorded in `specs/_shared/raid-log.md` (see below) | done |

Suites at closure (all executed this run): 1333 fast across 151 files · 76 integration on real
PostgreSQL + 2 skipped by name — **the epic021 migration (four tables, twelve-row seed, the
write-once trigger) applies cleanly** · governance re-run after register refresh · typecheck
clean ×3.

**Maintenance note**: `auth/password.spec.ts` twice exceeded its 5s default under CPU contention
with concurrent Testcontainers runs (argon2 is deliberately expensive). Its describe now carries
a 30s timeout with the reason documented — accommodation of a designed cost, not a papered-over
defect.

## `T291` — the R-02 re-score (F-17.12)

Recorded in `specs/_shared/raid-log.md`: the twelve-role profile makes one gated transition up
to **twelve concurrent model invocations** with M-07 deferred. Score stays **9** (already the
ceiling) but the exposure behind it is materially larger and is ACCEPTED, with the three
controls this epic built named as containment: gates fail closed (an unconfigured transition
runs ZERO roles), `required_roles` is explicit per-gate configuration ("twelve is the maximum,
not the default" — the source's own words), and concurrent execution keeps a gate inside one
job's caps. Configuration guidance: start at 2–3 roles; re-score when M-07 or budget alerting
lands.

## Design notes that will matter later

- **The permitted-transition set is derived, not copied**: `PERMITTED_GATE_TRANSITIONS` maps
  over EPIC-009's `PERMITTED_TRANSITIONS` — a lifecycle change propagates to gates by
  construction, and T277 asserts the derivation.
- **The append-only exception is precise**: `gate_outcomes` refuses UPDATE/DELETE raw, with ONE
  carve-out — the one-time decision fill on a still-undecided row, touching only the decision
  columns. Both the in-memory store and the trigger enforce the same rule.
- **E-R4 is the trap the contract warned about**: empty findings is a PASS here, while empty
  output is a FAILURE in generation. The two rules live in different services and each has a
  test naming the other.
- **A failed gate is not approvable.** Arbitration blocks a failed gate regardless of the human
  decision; the decision service refuses to record one. Re-running the gate is the only path.

## `T293` — convergence

Performed within this run per the `speckit-converge` method. **No unbuilt work found in scope.**
Deferrals with owners: conformance cases C-17..C-20 are asserted at UNIT level here, per this
epic's own tasks note — promotion into the shared conformance suite happens "when the fixture
adapter gains injectable review failures", which rides the fixture's next extension (owner:
EPIC-003's contract package, first consumer wins); gate endpoints + wiring gates into the
lifecycle transition path → the composition root (**EPIC-014 F-11.2**), where the transition
endpoints EPIC-009 built meet the arbitration verdict; quickstart V17-7/V17-8 browser passes →
EPIC-015's journey infrastructure.

## `T294` — defect triage

`specs/021-review-gates-roles/defects/` contains no records. **0 open.**

## `T295` — closing report

**Work completed**: `backend/src/modules/reviews/` (roles, gate-config.service,
gate-execution.service, gate-arbitration, gate-decision.service), four Prisma models + migration
`20260820220000_epic021_review_gates` (twelve-role seed, fail-closed CHECK, attribution CHECKs,
the write-once trigger), the engine-contract review capability (`ReviewInput`/`ReviewOutput`,
optional `reviewSpecification`, widened `EngineCapability`), the R-02 re-score, and 9 test files
(~55 new tests). **Deferred with owners**: as listed under T293.

### Epic Exit Criteria

- [x] Every implementation task has a passing unit test (T292)
- [x] Convergence reports no unbuilt work in scope (T293)
- [x] `defects/` contains no open records (T294)
- [x] RAID R-02 re-scored against the twelve-role profile (T291)
- [x] Principle deltas hold (PP-003/PP-016 strengthened as claimed; PP-017 deferral retains its owner and now carries the re-scored record); deferrals have valid owners (T295)
- [x] Closure recorded — **EPIC-021 is CLOSED and release-eligible**
- [ ] Platform promotion — EPIC-014 F-11.2's

### Recommended Next Task

`/speckit-implement EPIC-022` — the family's last epic — **after the fold-into-011 ruling**:
EPIC-011 is delivered, so decide whether product traceability folds into it or stands alone
before building. If the ruling should wait, `/speckit-implement EPIC-023` starts the
team-review family instead.
