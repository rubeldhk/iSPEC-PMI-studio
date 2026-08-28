# Analysis: EPIC-033 Requirement Room

**Session**: 2026-08-22 · **Artifacts**: [spec.md](./spec.md), [plan.md](./plan.md),
[tasks.md](./tasks.md) · **Also read**: [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/room-contract.md](./contracts/room-contract.md),
[quickstart.md](./quickstart.md)

Cross-artifact consistency pass before implementation. Read-only apart from this record
(`FR-ESK-019`).

**Result: four findings, one blocking.** No CRITICAL.

**Remediation applied 2026-08-22 — all four closed.** `tasks.md` gained `T405y` (the shared-pattern
handoff, named), a stated citation convention and thirteen scenarios written in full; `plan.md`'s
table count is corrected to six. `EPIC-034` and `EPIC-035` were additionally told the artifact's
name on their own branches — the half of `C1` that could not be fixed from here. `DOR-09` now reads
**zero blocking findings**; `DOR-06` still fails on the concurrent-session gate.

**This Epic's analysis carries more weight than the three before it**, because `EPIC-033` decides
the Room pattern `EPIC-034` and `EPIC-035` inherit. A defect in the shared half propagates to two
Epics rather than staying local — and the blocking finding is exactly that: the shared artifact
exists, and the two Epics that must import it do not know its name.

Three patterns from earlier Epics were applied forward before this run — requirement citations
(`U1`), a named adapter-binding task (`C2`), and the inverse *does-this-test-have-an-implementation*
check. **All three held**; the inverse check caught `T403u` during authoring and `T403w` closed it.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 ✅ | Coverage Gap | HIGH | `plan.md` Complexity Tracking; `tasks.md` Phase 2, T405q; `EPIC-034`/`EPIC-035` `spec.md` | **The shared artifact has no handle in the two Epics that inherit it.** `packages/room-contract` and `frontend/src/rooms/RoomShell.tsx` are produced by this Epic's Phase 2 and **must** be imported by `EPIC-034` and `EPIC-035` — that is `R-033-3`'s entire purpose and the reason Phase 2 is scheduled first. **Neither of those specs mentions `room-contract` or `RoomShell`.** Both name `EPIC-033` as a dependency in general terms, which is all they could do: this plan did not exist when they were clarified. The consequence is concrete — a planner opening `EPIC-034` finds `UX-0035` and no artifact, and re-derives the pattern, which is precisely what `UX-0035` forbids and what Phase 2 exists to prevent. `T405q` asserts the artifacts *are* shareable; **nothing tells the other two Rooms to share them** | Add a task in Phase Z that records the shared-artifact handoff explicitly — naming `packages/room-contract` and `RoomShell` as required imports for `EPIC-034` and `EPIC-035` — and raise it at those Epics' `/speckit-plan` runs. `T405q` proves shareability; this makes the sharing an instruction rather than an availability |
| I1 ✅ | Inconsistency | MEDIUM | `plan.md` Technical Context (Storage) and Scale/Scope | **Plan states 5 new tables in two places; there are 6.** [data-model.md](./data-model.md) defines `RequirementCandidate`, `Clarification`, `RequirementDecision`, `Baseline`, `BaselineException` and `Handoff` — `AiAnalysis` (§3) is embedded, not a table — and `T337u` lists all six. **This is the third occurrence of this defect class**: `EPIC-030` `I1` (16 versus 30 requirements, 4 versus 3 tables) and `EPIC-031`'s first draft (30 versus 32). Sharper here, because this plan carries an explicit *"counted from the artifacts, not asserted"* note — which was true of five figures and false of this one | Correct both occurrences to **6 new tables**. The counting note should either be true of every figure it covers or not be made |
| U1 ✅ | Underspecification | LOW | `tasks.md`, 27 requirements | **27 requirements are cited on the failing-test task and never on the implementation.** `FR-RQR-050` cites `T338e` (the test); `T338f` implements it and cites only `unit test: T338e`. The trace is valid but **two-hop**, and the convention is written down nowhere — so every analyze run rediscovers it and has to decide whether it is a gap. It is not; it is a house style used consistently across all four tasked Epics | State the convention once, near the top of `tasks.md`: *a requirement is cited on the task that tests it; the implementing task cites the test.* One sentence retires a recurring false positive |
| A1 ✅ | Ambiguity | LOW | `quickstart.md` (13 scenarios); `tasks.md` T405j | **The scenario-enumeration fix has now failed three ways.** `EPIC-031` closed this finding by rewording to *"enumerated by number"* — an instruction, not an enumeration. `EPIC-032` closed it by listing all twelve in full. `EPIC-033` listed them but **abbreviated after the first** — `**Scenario 1** … **2** … **3**` — so extraction finds 4 of 13 and the enumeration is only legible to a human reader | Write `Scenario N` in full for each of the thirteen. Recorded as a three-variant failure so the fourth attempt is not another abbreviation |

**Blocking**: `C1` (HIGH) — **resolved 2026-08-22**, see Remediation status. `DOR-09` ignores rows
marked ✅, so this record no longer holds the Epic out of `Ready`. `DOR-06` still does.

## Coverage summary

Computed by identifier extraction across all 100 task lines and all five design documents, after
the 2026-08-22 remediation.

| Requirement group | Defined | Cited | Has an implementation task |
|---|---|---|---|
| Room identity and boundary (`FR-RQR-001`–`004`) | 4 | 4 | 4 |
| Guided clarification (`FR-RQR-010`–`015`) | 6 | 6 | 6 |
| Options and risks (`FR-RQR-020`–`023`) | 4 | 4 | 4 |
| Acceptance criteria (`FR-RQR-030`–`033`) | 4 | 4 | 4 |
| Stakeholder decision (`FR-RQR-040`–`044`) | 5 | 5 | 5 |
| Baseline (`FR-RQR-050`–`055`) | 6 | 6 | 6 |
| Handoff (`FR-RQR-060`–`062`) | 3 | 3 | 3 |
| Room pattern (`FR-RQR-070`–`075`) | 6 | 6 | 6 |
| **Functional total** | **38** | **38** | **38** |
| Success criteria (`SC-RQR-001`–`009`) | 9 | 9 | 9 |

**Citation coverage 100%. Implementation coverage 100%.** Both axes clean — the first time in the
Wave, and a direct result of the three earlier findings being applied forward.

**Unmapped tasks: none.** All 100 map to a requirement, success criterion, constitution obligation,
`TS-00x` standard, or named handover (`T405q`–`T405t`, `T405w`).

**Failing-test tasks with no implementation partner: 2**, both legitimate — `T337w` (constraints
created by the `T337v` migration) and `T403e` (an architecture check *is* its implementation).
`T403u` was the third and was closed by `T403w` during authoring.

**All nine `R-033-*` research decisions are cited downstream**, and every file named in `plan.md`'s
Project Structure has a task.

## Constitution alignment

| Principle | State |
|---|---|
| I — Spec Kit command gate | Satisfied. The only directly edited files are on the exempt list |
| II — SRS as source of truth | **Satisfied with a named risk**, correctly recorded rather than silently: `FR-RQR-070`–`075` rest on PMI-DOC-006, status `PROPOSED`, and `BR-0191` is only a *SHOULD*. Argued in `R-033-9` and Complexity Tracking |
| V — Mandatory task-level tests | **Satisfied both directions** — `DOR-08` reports 0 unpaired, and the inverse check reports only two legitimate orphans |
| IX — Closing report / Delivery Board | Board **stale**, declared in `plan.md` and `tasks.md` |
| X — Interaction discipline | Satisfied |
| XI — Reachability gate | Tier 1 planned (`T337x`, inverted by `T405e`). **Tier 2 applies** (`T405o`) and must be a **keyboard** transcript, because `SC-RQR-008` requires the journey be completable by keyboard alone |
| Concurrent-session isolation | **FAIL, already recorded** in `plan.md` with `T337a` as its discharge. Not re-raised — `RF-4` |

**No constitution MUST is violated.**

## Metrics

| Metric | Value |
|---|---|
| Total requirements (FR + SC) | 47 |
| Total tasks | 100 |
| Citation coverage | 100% (38/38 FR, 9/9 SC) |
| Implementation coverage | 100% (38/38 FR, 9/9 SC) |
| Ambiguity findings | 1 |
| Duplication findings | 0 |
| **Critical issues** | **0** |
| **Blocking issues (CRITICAL + HIGH)** | **0** after remediation (was 1) |

## Remediation status

Recorded separately from the findings table so `DOR-09` reads open findings, not history.

| ID | State | Action taken |
|----|-------|--------------|
| C1 ✅ | Closed | **Both halves.** `T405y` added here — the handoff as an instruction, naming `packages/room-contract` and `RoomShell` as required imports. And `EPIC-034`/`EPIC-035` each gained an Assumption naming those artifacts **on their own branches**, which is the half that could not be fixed from this Epic |
| I1 ✅ | Closed | `plan.md` corrected to **6 new tables** in both places, with the third-recurrence recorded rather than the number quietly changed |
| U1 ✅ | Closed | The two-hop citation convention is now stated once near the top of `tasks.md` |
| A1 ✅ | Closed | `T405j` writes `Scenario N` in full, thirteen times. Verified by extraction: 13 of 13 |

**Applied 2026-08-22 on explicit approval.** `/speckit-analyze` itself wrote only this record.

## Notes

- **`C1` is a cross-Epic finding, and only a cross-Epic read could produce it.** Every document in
  `EPIC-033` is internally consistent; every document in `EPIC-034` and `EPIC-035` is internally
  consistent. The gap exists only in the relationship, and it exists because those two Epics were
  clarified **before** this plan decided the pattern would be shared. That ordering was correct — the
  pattern could not have been decided earlier — which makes this a handoff that has to be created
  rather than a mistake that has to be corrected.
- **Three recurring defect classes, three different outcomes.** `U1` (uncited requirements) and `C2`
  (missing adapter binding) were applied forward and **held** — coverage is 100% on both axes for the
  first time in the Wave. `I1` (a stated count disagreeing with the list) **recurred for the third
  time**, in the one plan that explicitly claimed its figures were extracted. And `A1` has now failed
  in three different ways. The two that held were mechanical fixes; the two that recurred are habits.
  That distinction is the useful part.
- **`U1` here is a false positive worth retiring rather than fixing twice.** The two-hop trace —
  requirement on the test, implementation on the test's id — is deliberate and consistent across four
  Epics. Writing the convention down once costs a sentence and stops four future analyses
  rediscovering it.

---

# Reconsideration: EPIC-033 slices S1 and S4, after EPIC-037 Band A

**Session**: 2026-08-27
**Authorised by**: the Project Owner, *"AUTHORIZE REQUIREMENT ROOM S1/S4 RECONSIDERATION"*
**Scope**: reconsider whether S1 and S4 remain the right next delivery slice, and in what form,
given what Band A built and what its closure revealed. Analysis and recommendation only — no
production change, and no decision record, since the delivery decision is the owner's.

## Why this reconsideration was scheduled where it was

The A–G delivery order places Requirement Room S1 and S4 **between** EPIC-037's thin foundation and
its connectors, and `tasks.md` records the reason in one sentence: *"building every connector first
would repeat the mistake this whole remediation corrected — internal completeness ahead of
user-reachable product."*

The question this reconsideration must answer is therefore narrow and concrete: **after Band A, what
is the shortest path to a user-reachable Requirement Room?**

## What was found

The premise the ordering assumed — that S1 and S4 are unbuilt work to be scheduled — is **wrong**.

### S1 and S4 are already implemented

| Slice | Phase | Tasks | Status |
|---|---|---|---|
| **S1** — raw intent to immutable baseline | Phase 3 | `T338a`–`T338l`, `T338u`, `T338v` (14) | **all complete** |
| **S4** — options, trade-offs, recorded decisions | Phase 6 | `T339m`–`T339s` (7) | **all complete** |

Intake, normalization, the register binding, baseline creation, in-place edit refusal with Change
Request handoff, supersession, conflict detection, option generation, decision recording and Decision
Inbox surfacing are all built, wired into a mounted controller, and covered by tests.

EPIC-033's 34 open tasks are **not** in S1 or S4. They are Phase 8 (US6, visual parity, 11),
Phase N (polish, 10) and Phase Z (closure, 13).

### But their central guarantees are unenforced

Probing the mounted routes the way `DEF-037-001` was found:

```
POST /v1/rooms/requirement/intake     (no session)   ->  201 Created, row written
```

The workspace came from the request body. Following that thread through the services produced
[`DEF-033-001`](./defects/DEF-033-001-the-approver-and-the-actor-kind-are-caller-supplied.md):

- **S1 acceptance scenario 2** — *"the baseline … carries its approver"*. `approvedBy` is a required
  **string**, never resolved against `users`, never checked for workspace membership or approval
  authority.
- **S4's premise** — *"after an authorized human decides"*. The AI-decision refusal is
  `input.actor?.kind !== 'human'`, backed by a `CHECK` constraint over the stored value. Both read
  the same caller-supplied field. An agent sending `{"actor":{"kind":"human"}}` satisfies both.

The immutability, the supersession chain and the constraint are all real and all correct. That is
what makes this the serious version of the problem rather than the trivial one: the platform
durably and unalterably records an attribution nothing verified.

## The reconsideration

**S1 and S4 do not need building. They need binding.**

The gap is not features; it is that the Room's identity claims were built before there was anything
to bind them to. When S1 and S4 were written there was no way to resolve a non-human principal —
that was finding `Y2`, which stopped EPIC-037 Band A at C3A. A body-supplied `actor.kind` was, at
the time, the only thing available.

C3B changed that, and C3C proved it works:

- `TrustedPrincipalFactory` (EPIC-028) mints an unforgeable principal context and refuses unknown,
  foreign, suspended and revoked principals;
- `CompositePrincipalDirectory` (EPIC-024) resolves humans against `users` and non-humans against
  the principal registry — so `kind` becomes **resolved** rather than **declared**;
- `PrincipalDelegationService` carries `NEVER_DELEGABLE`, which is where *approve a baseline* and
  *take a requirement decision* belong;
- `principal-reactivation.spec.ts` proves suspension invalidates delegations and reactivation
  requires new ones.

Every part the Room needs now exists, is tested, and is reachable from `AccessModule` and
`AgentsModule`. The Room imports neither.

## What this changes about the delivery order

The order itself is **still right**, and for the reason it was written: user-reachable product
before internal completeness. What changes is the content of the slice.

- The slice is **not** "implement S1 and S4".
- The slice is **"make S1 and S4's existing guarantees true"** — bind the Room to the identity that
  now exists, and only then judge whether anything is missing for a user.
- This is *smaller* than the slice the order anticipated, and it is a precondition for the rest.
  Handing a user a Room whose baselines record unverified approvers is worse than not shipping it,
  because baselines are immutable: the wrong attribution cannot later be corrected in place, only
  superseded.

The five-controller survey in `DEF-033-001` shows the Room is an outlier — fourteen of nineteen
controllers already resolve the caller through `requireAuth`, and `projects` additionally strips
caller-supplied scope from the body. The pattern to copy is in the repository and is normal here.

## Recommended next slice

**"Bind the Requirement Room to authenticated identity."** Concretely:

1. Take `workspaceId`, the approver, the decider and `actor.kind` from the session context, not the
   body; strip caller-supplied scope as `projects` does.
2. Resolve the actor through `CompositePrincipalDirectory` so `kind` is a resolved property, and
   refuse the request when no context is present.
3. Keep the service check and the `CHECK` constraint exactly as they are — they become the second
   line they were always meant to be.
4. Add the test that was missing: not *"does the service refuse an agent?"* but *"can a caller
   claiming to be human be recorded as one?"*, driven over HTTP against the composed application.
5. Only then re-evaluate S1/S4 for user-reachability, and size Phase 8 (US6) accordingly.

`EPIC-024`'s and `EPIC-028`'s public services are consumed, not re-implemented, consistent with the
standing constraint.

## Deliberately not recommended

- **Do not create a new epic.** This is EPIC-033 work consuming EPIC-024/028.
- **Do not extend the fix to `loop` in the same slice.** `POST /v1/loop/objects/:id/transitions` is
  in the same five and needs its own assessment (recorded in `DEF-033-001`); its probe returned
  `500` and no unauthenticated write was demonstrated, so its severity is unestablished. Bundling an
  unassessed endpoint into a scoped remediation is how the C2B stop became necessary.
- **Do not begin `T1060`–`T1079`.** Unchanged and untouched.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| R1 ✅ | Security / correctness | **HIGH** | `requirement-room.controller.ts`, `baseline.service.ts`, `decision.service.ts` | Baseline approver, decision maker and `actor.kind` are caller-supplied strings on mounted, unauthenticated routes; an unauthenticated intake write returned `201` | `DEF-033-001` raised. Bind to session context and `CompositePrincipalDirectory` — the recommended next slice |
| R2 ✅ | Planning | MEDIUM | A–G delivery order, `specs/037-…/tasks.md` | The order schedules S1 and S4 as work to be built; both are already implemented (21 tasks complete). The remaining EPIC-033 work is US6, polish and closure | Restate the slice as *bind*, not *build*; it is smaller than anticipated and is a precondition for the rest |
| R3 ✅ | Test design | MEDIUM | `requirement-room-no-ai-decision.spec.ts` | A careful suite that proves the constraint refuses an `agent` row, but every test supplies the kind directly. It cannot detect an agent that declares itself human | Add an HTTP-level test that attacks the provenance of `actor.kind`, not its handling |
| R4 ✅ | Scope | LOW | `loop.controller.ts` | Same unguarded shape on EPIC-030's transition endpoint; probe reached the handler unauthenticated but produced no write | **Assessed 2026-08-28** and routed to its owning Epic as [`DEF-030-003`](../030-governed-engineering-loop/defects/DEF-030-003-the-caller-supplies-its-own-authorities.md) — latent, not live. Closed here; tracked there |

## Metrics

- S1 tasks: **14 of 14 complete** · S4 tasks: **7 of 7 complete**
- EPIC-033 open: **34** — Phase 8 (11), Phase N (10), Phase Z (13). None in S1 or S4
- Controllers resolving the caller authoritatively: **14 of 19**
- Findings: **1 HIGH, 2 MEDIUM, 1 LOW**
- Production code changed by this reconsideration: **none**

## Resolution — the binding slice, 2026-08-28

`R1`, `R2` and `R3` are marked resolved above (`✅`, the convention `DOR-09` reads). The Project
Owner authorised the binding slice; it is recorded as **Phase R**, `T1148`–`T1155`, and closed
[`DEF-033-001`](./defects/DEF-033-001-the-approver-and-the-actor-kind-are-caller-supplied.md).

- `R1` — identity is resolved in `RequirementRoomService` against `EPIC-024`'s
  `WorkspaceBoundaryService`, before any body validation. Proven over real HTTP by
  `backend/tests/integration/requirement-room-identity-binding.spec.ts` (19 tests).
- `R2` — the slice was *bind*, not *build*, as recommended. No new Room capability was added.
- `R3` — the missing test exists: it attacks the provenance of `actor.kind` rather than its
  handling, and its own first draft was refused by the options rule instead of the actor rule, which
  is why it now sends a fully valid decision.

**`R4` is closed here and tracked in its owning Epic.** The assessment ran on 2026-08-28 under
separate authorisation and produced
[`DEF-030-003`](../030-governed-engineering-loop/defects/DEF-030-003-the-caller-supplies-its-own-authorities.md).

The answer differs from this Epic's in the way that matters. `loop.controller.ts` accepts
`actorAuthorities` **from the request body** — a caller asserting an authorisation rather than an
identity, which is a category beyond `DEF-033-001` — but the loop module is inert as wired: no
workflow type can be declared, the store is in-memory by documented design, and the `AuthorityMap`
defaults to `{}`, which refuses every transition before the caller's list is read. So it is **latent
at MEDIUM**, not live at HIGH, and no containment was proposed.

Declining to fold it into the binding slice was right for the reason given at the time — its severity
was unestablished — and the assessment confirms the severities genuinely differ.
