# Epic Closure: EPIC-024 — Artifact Access Control

**Closed**: 2026-08-21 | **Session label**: `EPIC-024 Artifact Access Control` (Constitution VIII)

## T435 — every implementation task has a passing unit test (Constitution V)

**CONFIRMED.** All suites green on 2026-08-21 (`backend-unit` + `backend-contract` +
`frontend`: 1241 tests / 168 files; the three Testcontainers integration files: 7 tests, real
PostgreSQL):

| Implementation task | Unit test task | Test file |
|---|---|---|
| T376 models | T372, T373 | `tests/unit/access/{grants,refusal}.spec.ts` |
| T377 grant/revoke + audit | T372, T826 | `tests/unit/access/{grants,grant-audit}.spec.ts` |
| T378 refuse–hide–record | T373 | `tests/unit/access/refusal.spec.ts` |
| T379 restriction inheritance | T374 | `tests/unit/access/inheritance.spec.ts` |
| T380 last-editor guarantee | T375 | `tests/unit/access/last-editor.spec.ts` |
| T381/T813 run snapshot, narrowed | T811 | `tests/unit/access/snapshot-scope.spec.ts` |
| T814 open-time evaluation | T812 | `tests/unit/access/session-visibility.spec.ts` |
| T816 restricted-not-omitted | T812 | `tests/unit/access/session-visibility.spec.ts` |
| T420 access controller | T418 / T419 | `tests/unit/access/access.controller.spec.ts` · `tests/contract/access.spec.ts` |
| T427 real-DB enforcement | — (integration) | `tests/integration/access-enforcement.spec.ts` (SC-007) |
| T428 concurrent last-editor | — (integration) | `tests/integration/last-editor.spec.ts` (SC-008, FOR UPDATE serialisation, 5 rounds) |
| T815 real-DB session visibility | — (integration) | `tests/integration/session-visibility.spec.ts` (SC-018) |
| T400 grant control | T399 | `frontend/tests/unit/components/AccessGrants.spec.tsx` |

## T436 — convergence

Assessed 2026-08-21 against spec.md, plan.md, and tasks.md in this session (the
`/speckit-converge` command was executed as an in-session convergence assessment):

- FR-ACC-021–028 + FR-ACC-028a each have an implementation site and citing tests.
- The two-layer rule holds: layer 1 (EPIC-004 workspace scoping) untouched; layer 2 refuses
  identically — absent, never forbidden. Gap **G-02.4** (endpoints existed in no
  implementation task) is closed by T420.
- The run snapshot is produced here (T381) onto the `Run` EPIC-023 defined — the corrected
  build order (EPIC-023 → 024) held.
- **No unbuilt work found.** No tasks appended.

## T437 — defect triage

`specs/024-artifact-access-control/defects/` contains no records (only `.gitkeep`).
**Nothing to triage; nothing deferred.**

## T438 — principle deltas and the closing report

Deltas hold: the refusal path records every attempt in the same operation as the refusal
(PP-016 explainability of refusals; SC-007/SC-013), and absence-over-forbidden (FR-ACC-024)
is asserted at unit, contract, and real-database levels. No deferrals were taken.

### Work completed

- 2 new tables (migration `20260821010000_epic024_access_control`) — grants with
  no-delete trigger, append-only attempt records.
- `backend/src/modules/access/` — grant service (audited, last-editor-guarded), enforcement
  (refuse–hide–record + restricted-not-omitted questions), inheritance
  (most-restrictive-wins, transitive), snapshot (run-scoped, with the T813 narrowing),
  open-time evaluation, Prisma store (transactional audit + `FOR UPDATE` serialisation),
  controller + module.
- `frontend/src/components/AccessGrants.tsx` + API client methods.
- 8 unit test files, 1 contract file, 3 Testcontainers integration files, 1 frontend
  test file — all passing.

### Work deferred

None. The `DERIVATION_GRAPH` token defaults to the in-memory graph; the traceability module
can supply a live implementation on the same token when product composition needs it — a
wiring choice, not unbuilt scope.

### Recommended next task

`/speckit-implement EPIC-025` — External Storage Publishing, the last of the three D-19
children.

---

# Reopening record — C2D grant durability (2026-08-27)

**The closure above stands.** No task recorded there is reopened.

This Epic was reopened for one gap: `PrismaAccessStore` — which this Epic **wrote** — was never
composed, so `ACCESS_GRANT_STORE` and `ACCESS_ATTEMPT_STORE` resolved to in-memory implementations.

The harm was not "grants are lost". It is that this Epic's rule is **"unrestricted until granted"**:
an artifact with no grants is editable by anyone in the workspace. Combined with a volatile store,
**a restart turned a governed artifact back into an ungoverned one** — access widened silently, and
the refusal record that would have shown it was volatile too.

`T1119` binds the store. Grants, revocations and refusal records are now durable, an unreadable
store fails closed rather than reading as "no grants", and a restart cannot broaden access.

**One sub-item was reported rather than built.** Step C2D asked that the no-grant fallback be
preserved *"only through EPIC-024's authoritative workspace-role check"*. This Epic has no role or
membership model — `User.workspaceId` is the only workspace binding — so there is no such check to
route through, and building one is a **new authorization model**, which C2D names as a stop
condition. Recorded as `X19`.

## Readiness

Returns to **reopened-remediation** state until `T1119` is confirmed with the rest of C2D.

---

# Reopening record — C2E ownership bootstrap (2026-08-27)

**Both closure records above stand.** No task recorded in either is reopened, and nothing previously
delivered is re-described as undelivered.

This Epic was reopened a second time for `X19`, the finding the C2D record above reported rather
than built. The Project Owner's Step C2E instruction settled the ownership question and forbade the
option that would have been easiest:

> *"Do not build a workspace-role model during this dependency remediation."*

## What changed

**The zero-grant rule is inverted.** `directlyReadable` and `directlyEditable` returned `true` when
an artifact had no active grants. The header comment said so plainly — *"an artifact with NO active
grant rows is OPEN — restriction begins the moment the first grant is created"* — so this was a
documented, deliberate model rather than an oversight. It was also wrong: a governed artifact
nobody had restricted was readable and editable by anyone able to name the workspace, and a newly
created specification had no grants at all.

**A workspace boundary now runs ahead of grants.** `workspaceId` arrived from the caller and nothing
checked it, so a grant lookup was scoped by whatever the request said. `WorkspaceBoundaryService`
resolves the actor against `User.workspaceId` — authoritative identity, not a role — and refuses
before any grant is consulted.

**Existing artifacts are backfilled where an owner resolves, and only there.** `T1131` grants the
creator when they are a real user in the same workspace, records the ones it cannot resolve, and
invents nothing. Artifacts with no resolvable human owner stay inaccessible by design.

## What this record does not claim

The C2D record's statement stands unaltered: `X19` was **reported and not built** at that time,
correctly, because building it then would have meant inventing an authorisation model the owner had
not chosen. C2E built it after that decision was made, not before.

`FR-ACC-027` was not weakened. A revocation that would leave an artifact with no human editor is
still refused, and one C2E test had to grant a second holder before it could revoke — which is the
requirement working, not an obstacle to route around.

---

# Reopening record — C3B principal authorization (2026-08-27)

**All three closure records above stand.**

Reopened a third time, narrowly: to authorise a **second kind of principal**. Actor resolution now
runs through a directory that answers for humans and non-humans alike, and scoped delegation lets a
sponsoring human grant an agent exactly what it needs on exactly which artifact.

**No parallel authorization system was created.** The directory answers one question — *does this
identity exist here, and may it act?* — and everything after it is the same grant evaluation that
already existed. The workspace boundary, deny-by-default, durable grants, fail-closed behaviour and
audited attempts are unchanged.

**Delegation is deliberately not the grant model.** `AccessGrant.level` is `read` or `edit`, which
cannot express `transition.propose` without overloading it into ambiguity. The C3B instruction
permits a narrow extension where the existing model cannot represent this unambiguously, and that is
what `principal_delegations` is.

`Y1` is also resolved here: `ownership_backfill_records` was reviewed and found to be **authoritative
security evidence**, not a rebuildable projection, and is now append-only. It was raised LOW; it was
promoted on the review rather than left alone because of where it started.
