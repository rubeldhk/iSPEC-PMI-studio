# EPIC-034 — Change Room: Epic closing report

**Task**: `T995z` · **Session**: 2026-08-31 · **Constitution IX**

**Status**: `Implemented`, with five seams unbound by design, one dependency task blocked, and
promotion not performed.

---

## What the Epic delivered

`BR-0042`–`BR-0048` — capability area `U-04`, change control. The governing rule is `RULE-02`:
*baselines do not mutate silently.*

**102 of 104 tasks complete** (99 planned, plus five appended by convergence). The two open are
`T995u` and `T1219` — the same blocker, named under *Work not done* below.

| Phase | Tasks | What it established |
|---|---|---|
| 1–2 Foundational | `T406l`–`T406w` | Types carrying the guarantees, two architecture boundaries, persistence, the six ports |
| 3 US1 | `T996a`–`T996i` | `RULE-02` has a destination — the Requirement Room's refusal now leads somewhere |
| 4 US2 | `T996j`–`T996q` | Eight impact areas, unknown never rendering as clean, the architecture panel that says the check has not run |
| 5 US3 | `T996r`–`T996x` | Two or more options with six dimensions, and never a manufactured one |
| 6 US4 | `T994a`–`T994i` | The baseline moves, the old one byte-identical, the silent retarget closed |
| 7 US5 | `T994j`–`T994q` | Re-plan recorded and nothing executed; closure answering four questions |
| 8 US6 | `T994r`–`T994z` | The Room reads like the other two, through the imported shell |
| N Polish | `T995a`–`T995l` | Five mutation proofs, four confirmations made mechanical, `R-034-8` measured |
| Z Closure | `T995m`–`T995z` | Tier 1 and Tier 2, convergence, the identifier hand-off |
| C Convergence | `T1215`–`T1219` | Four capabilities found reachable from nowhere, now reachable |

Artifacts: [mutation-proofs.md](./mutation-proofs.md), [quickstart-results.md](./quickstart-results.md),
[tier2-transcript.md](./tier2-transcript.md), [identifier-handoff.md](./identifier-handoff.md),
[defects/DEF-034-001](./defects/DEF-034-001-the-eighth-impact-area-is-the-wrong-one.md).

---

## The five mutation observations (`T995a`–`T995d`, `T995l`)

Each applied to production source, observed failing by name, reverted. Full detail in
[mutation-proofs.md](./mutation-proofs.md).

| Requirement | Mutation | Failed |
|---|---|---|
| `FR-CHR-011`, `SC-CHR-001` | retarget at intake; hide `openAgainst` | 2 × `T996e` |
| `FR-CHR-032`, `SC-CHR-002` | undeterminable area renders absent | 6 × `T996l` |
| `FR-CHR-062`, `R-034-2` | `TaskRegenerationService` imported | `T406l`, `T994j` |
| Constitution XI Tier 1 | `ChangeRoomModule` out of `AppModule` | 4 × `T406u` |
| `FR-CHR-054`, `SC-CHR-009` | the silent retarget | 2 × `T994h` |

**One did not go as its task described, and the deviation is the finding.** `T995c` expected the
import mutation to fail both `T406l` and `T994l`. It failed `T406l` and `T994j`; `T994l` did not
move, because `RePlanRecorder` has no task store and importing `regenerate` cannot destroy what it
cannot reach. Making `T994l` fail would have required adding a dependency nobody supplies. The
boundary is held by an absent capability, not only an absent import — which is stronger than what
was asked for. `T994l` was separately proven live by a mutation producing `regenerate`'s effect.

---

## Measured performance (`T995e`, `T995f`, `R-034-8`)

| Target | Budget | Measured |
|---|---|---|
| Impact view assembly, depth 25, 500 artifacts | p95 < 3 s | **0.203 ms** |
| Baseline delta, 200 members | p95 < 500 ms | **0.689 ms** |
| Change closure, excluding the `EPIC-032` call | p95 < 200 ms | **0.082 ms** |
| Room load, six regions | p95 < 1.2 s | *`EPIC-033`'s 0.13 ms — measured once, inherited* |

Against in-memory stores and stubbed ports, stated as such: `EPIC-020`, `EPIC-028` and `EPIC-032`
are unbound here, so these measure this Room's own work and not production latency. The delta figure
was wrong on its first run and its own anti-vacuity control caught it — the fixture kept the old
version ids, so every "version change" was a plain addition.

---

## Work not done, and why

### `T995u` / `T1219` — the `EPIC-035` transfer, jointly · **BLOCKED**

`FR-CHR-012` requires the Defect Room transfer exercised end to end **from both sides**.
`EPIC-035` has **0 of 81 tasks complete and no backend module**, so the other side does not exist.

This Epic's half is exercised: `T994x`, 14 tests, including the return path carrying
`returnTo: EPIC-035` and the one refusal that has nowhere to return and does not claim otherwise.
The joint exercise is owed when `EPIC-035` implements `FR-DFR-074`.

### `T995r` — `BR-0154` re-plan remains `U-12`'s

**Restated as the task requires.** This Room **records** a `RePlanObligation` naming what must
change and why. It **executes nothing**. `FR-CHR-062` is **half-dischargeable by design** until
`U-12` is declared, and saying so is the difference between a known gap and a silent one.

`TaskRegenerationService.regenerate()` would satisfy `FR-CHR-062`'s wording in one call and violate
the requirement that wording cites: it **replaces** a task list, and `BR-0154` requires revision
without destroying completed-work history. The import is banned by architecture test, the ban is
mutation-proved, and `REPLAN_STATES` has two members of which neither is `executed`.

### `T995s` — `BR-0073` architecture-violation flagging remains `U-17`'s

**Restated.** The impact view surfaces the governed decisions a change reaches (`FR-CHR-033`) and
**states that the violation check has not run** (`FR-CHR-034`). `violationCheck.status` is the
literal type `'not-run'` with no `'passed'` to assign, in TypeScript and in the database CHECK.
Whoever implements `BR-0073` widens both, together. **This Room's delivery does not close it.**

### `T995t` — `BR-0083` rationale queries remain `U-17`'s

**Restated.** This Room retains the *why* of every change — the reason at intake, the rationale on
the decision, the declined options with their trade-offs, and the closure's four answers. That is
the raw material for rationale queries. **It does not answer queries over it**, and nothing here
should be read as having closed `BR-0083`.

### `T995z` — promotion beyond `local` · **not performed**

Constitution VII requires `local → dev → stage → prod` with no environment skipped. This work
reaches **local only**. `EPIC-014`'s `T156` is the only task in the programme that promotes
anything and it remains open (`- [ ] T156`). Promotion is a deployment act, not a code change, and
it is not this Epic's to perform — the same position `EPIC-033` recorded at its closure.

**One local change was made and is worth stating**: the `pmi-app` container was rebuilt from this
Epic's code to run the Tier 2 walk, so the running local stack now carries this build rather than
the one from 17 hours earlier.

---

## The five unbound seams

Five of this Room's six ports **refuse** when unbound; one degrades. That is `FR-GEL-062`'s posture:
a default that permits is invisible at every call site.

| Seam | Owner | Unbound behaviour |
|---|---|---|
| `LoopEngine` | `EPIC-030` | refuse |
| `PolicyProvider`, Decision Inbox | `EPIC-031` | refuse |
| `EvidenceContractSource` | `EPIC-032` | refuse |
| `BaselineReader` / writer | `EPIC-033` | refuse |
| `TransferIntake` | `EPIC-035` | refuse |
| `ImpactSource` | `EPIC-020` | **degrade** to `unknown`, with a reason |

The Tier 2 walk stops at three of these, each refusing with the Epic that owes it. **A walk that
completed today would mean one of those defaults had been made permissive.**

---

## What convergence found

`/speckit-converge` (`T995v`) found **four capabilities built, tested, and reachable from nowhere** —
`RePlanRecorder` registered in no module, and `answer`, `withdraw` and `retainForDecision` with no
caller in `src/`. All four are now wired and covered by route tests (`T1215`–`T1218`).

This is the seventh time this repository has recorded the pattern, and **the first time a check
caught one before a human did**. The question that found them was *which capabilities have a
caller*, not *which have a test* — every one of the four had a passing test throughout.

### `T1218` turned out to be a behaviour change, not a wiring fix

Calling `retainForDecision` from `DecisionService.record` failed twenty tests, because the fixtures
named an `impactViewId` nothing had written and the store throws on an absent view.

The tests were right to break. `BR-0044` says *a change decided without its impact view is decided
on the part somebody thought of*, and every one of those fixtures was recording a decision against a
view nobody could read — with the suite agreeing. So `record` now **refuses** an unreadable
`impactViewId` explicitly, rather than surfacing a store error from two layers down, and a shared
fixture saves the view.

One test genuinely needed the old state: `T994h`'s *"when the retained view cannot be read at all"*.
A view readable at decision time can stop being readable later, and `assessRebase` meets that on a
rebase months afterwards. It now builds that state through the store directly, with the reason
written beside it.

---

## Defects

| Defect | Status |
|---|---|
| [`DEF-034-001`](./defects/DEF-034-001-the-eighth-impact-area-is-the-wrong-one.md) — the eighth impact area was `security`, which `BR-0044` never names | **CLOSED — FIXED** |

Its lesson is worth carrying: **a completeness guarantee over a vocabulary does not validate the
vocabulary**, and **a second recollection is not a second source**. `T406f` restated the eight as
literals — the textbook remedy — and restated them wrong, because the test and the constant were
written minutes apart from one misreading. The guard that works reads `FR-CHR-030`'s sentence out of
`spec.md`.

---

## Gate results

| Gate | Result |
|---|---|
| `pnpm typecheck` | **pass** |
| `pnpm lint` | **15 errors, none in this Epic's files** — see below |
| `pnpm test` | **5409 passed, 3 failed, 2 skipped** |
| `pnpm test:governance` | **993 passed**, 3 failed — the `T884` pair and one this Epic fixed |

**Lint.** Fourteen of the fifteen errors are pre-existing and in files this Epic never touched: ten
in `.claude/worktrees/` copies, plus `shell.css` (three literal visual values), `surface-states.spec.tsx`,
`loop-reachability.spec.ts` and `adjudication-end-to-end.spec.ts`. The fifteenth was mine — a
disable directive for `react-hooks/exhaustive-deps`, a rule this repository does not configure — and
is fixed. **`pnpm lint` does not pass**, and that is reported rather than worked around.

**The three test failures are pre-existing and reported separately**, per the standing rule:

- `T884` ×2 — `docs/accessibility/EPIC-029-manual-pass.md` is a **pending human accessibility
  record**. Not fabricated, not waived, not touched.
- `T147` — `scale.spec.ts`'s p95, load-sensitive: fails in a combined run, passes alone. Filed as
  `EPIC-030` `DEF-030-002`.

**A wider observation, offered rather than filed.** During Phase 8 two separate full runs failed
different frontend tests on 5-second timeouts — `T437h`/`T437l` once, `SpecificationList` and
`ReviewSessionPage` another — none of them files this Epic touched, all passing in isolation. A
single full-suite run on this machine is therefore not a reliable regression signal for the
`frontend` project. That is worth someone's attention and is not this Epic's to fix.

**Governance.** `T864a` failed during this phase on an ISO 8601 timestamp regex in the transcript
check: `T` followed by digits, which it cannot distinguish from a hand-written task-identifier
shape. It is right not to try. The check now splits on the table cell instead.

---

## Recommended next task

```
/speckit-implement 035
```

`EPIC-035` (Defect Room) is the direct unblock: it closes `T995u`/`T1219`, and its `FR-DFR-074`
return path is already specified against this Epic's `fromDefectTransfer`. `EPIC-031` would unblock
more of this Room's journey — decision, application and closure all wait on it — but `EPIC-035` is
the one whose absence leaves a task in this Epic open.

**Not this Epic's to do, and named so they are not lost**: `EPIC-014` `T156` (promotion),
`EPIC-026` (nothing — the identifier hand-off is discharged, see
[identifier-handoff.md](./identifier-handoff.md)), `U-12` (`BR-0154`), `U-17` (`BR-0073`, `BR-0083`).

## Delivery Board

**Stale.** `EPIC-034` is `Implemented` pending the `EPIC-035` joint exercise and promotion; the
board has not been refreshed in this session and should not be read as current.
