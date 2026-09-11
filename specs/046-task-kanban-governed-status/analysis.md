# Cross-Artifact Analysis — EPIC-046 Task Kanban with Governed Auto-Status

**Session**: 2026-09-06

**Artifacts analysed**: [spec.md](./spec.md) (clarified 2026-09-06, 68 `FR-KAN-`, 9 `SC-KAN-`) ·
[plan.md](./plan.md) · [tasks.md](./tasks.md) (86 tasks, `T1686`–`T1771`) ·
[research.md](./research.md) (`R-046-1`–`R-046-13`) · [data-model.md](./data-model.md) ·
[contracts/tasks-api.md](./contracts/tasks-api.md) · [contracts/board-contract.md](./contracts/board-contract.md) ·
[quickstart.md](./quickstart.md) · `.specify/memory/constitution.md`

**Verdict**: no CRITICAL findings. **Four HIGH** findings should be resolved before
`/speckit-implement`; two of them are requirements with **zero task coverage**, one is a
spec-versus-plan divergence that needs a ruling rather than a fix, and one is a constitution gap
that a single command closes.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 | Coverage gap | HIGH | spec.md `FR-KAN-048`; tasks.md (absent) | The provisional-run requirement added by the 2026-09-06 clarification round has **zero tasks**. Nothing implements or tests *a provisional run syncs no tasks* or *the board states when its parse is older than the Epic's latest execution*. `quickstart.md` scenario 19 asserts it, so the guide promises what no task builds | Append two tasks to Phase 4 (`F-046.4`): a failing unit/integration test for the staleness projection and the absence of a sync for a provisional run, and its implementation in `task-board.service.ts` + `TaskBoard.tsx`. `data-model.md` §8 already defines the **Board staleness** projection — only the task is missing |
| C2 | Coverage gap | HIGH | spec.md `FR-KAN-072`; data-model.md §11; tasks.md (absent) | **Audit has no task.** `data-model.md` §11 defines four audit actions (sync, task status change, proposal created, verdict) and `FR-KAN-072` requires every one of them be recorded immutably, but the word *audit* does not appear in `tasks.md`. `PP-010` is marked Satisfied in the spec on the strength of `FR-KAN-072` | Append a failing unit test and an implementation task to Phase 2 (`F-046.2`) wiring the existing `SyncAuditPort` pattern `EPIC-045` uses, plus one assertion in the Phase 6 proposal tests for the two proposal actions |
| C3 | Underspecification | HIGH | spec.md `FR-KAN-005`; data-model.md §2; contracts/board-contract.md §3 | `FR-KAN-005` requires the parse to record, per task, **the repository paths named in the description** (`DS-1`, *so that a task can be read against what it changes*). No column exists for them in `data-model.md` §2, no card field in `board-contract.md` §3, and no task captures them. The rest of `FR-KAN-005` is covered by `T1696`/`T1697` | Either add a `sourcePaths` column and the card field (a `data-model.md` and `board-contract.md` change plus one task), or narrow `FR-KAN-005` to drop the clause. This is the shape of `EPIC-045`'s `T012a` finding — a column that only exists in prose |
| D1 | Constitution alignment | HIGH | plan.md gate VIII; tasks.md *Branch owed*; constitution VIII | No `epic/046-…` branch exists; the work sits on `epic/045-artifact-sync-markdown-viewer`. Constitution VIII is a SHOULD principle, but its branch-name clause is a MUST *where the environment supports it*, and git does | `git checkout -b epic/046-task-kanban-governed-status` before `T1686`. Already recorded as owed in both `plan.md` and `tasks.md`; this finding exists so it is not the thing everyone assumed someone else did |
| F1 | Inconsistency | HIGH | spec.md `FR-KAN-013`; research.md `R-046-5`; plan.md post-Phase-1 re-check | `FR-KAN-013` says a proposal *MUST be adjudicated through the existing adjudication contract*. `R-046-5` reads *contract* as `EPIC-030`'s **rules and vocabulary** and deliberately does not call `PROPOSAL_ADJUDICATOR`, because `AdjudicationProposal` is hard-typed to `specificationId`/`SpecificationStatus`. The plan states the reading openly and asks for a ruling; until one is given, spec and plan say different things | **Rule on it, do not silently fix it.** Either confirm the reading (and add the clarifying half-sentence to `FR-KAN-013` at a `/speckit-clarify` or a spec amendment), or accept the cross-Epic refactor to widen `EPIC-030`'s proposal to `(targetType, targetId, status)` — which is a change to a `NON-NEGOTIABLE` seam and belongs to `EPIC-030` |
| F2 | Inconsistency | MEDIUM | data-model.md §5; contracts/tasks-api.md §4; tasks.md `T1741` | `task_status_proposals` requires a unique `(workspaceId, idempotencyKey)`, but neither the contract's request body `{ expectedCurrentStatus, requestedStatus, reason }` nor any task says where that key comes from. The sync's key is derived and documented (`R-046-8`); the proposal's is undefined | Derive it the same way — e.g. `task-proposal:<taskId>:<proposerId>:<requestedStatus>:<expectedCurrentStatus>` — and state it in `contracts/tasks-api.md` §4 and `T1739` |
| C4 | Coverage gap | MEDIUM | contracts/board-contract.md §2–§3; spec.md `FR-KAN-003`, US1 | The board contract never says **where the unparsed lines are displayed**. §2 lists the counts and §3 the cards, but `FR-KAN-003` requires refused lines *shown on the board* and US1 scenario 3 requires the list with numbers and reasons. `T1716` tests a list the contract does not describe | Add an *Unparsed lines* subsection to `board-contract.md` §2 naming the fields (line number, text, coded reason) and its empty state |
| F3 | Terminology drift | MEDIUM | spec.md (Key Entities, US1) vs data-model.md §7, contracts, tasks.md | One concept, two names: the spec calls it an **unparsed line** and its board section *Lines not parsed*; `data-model.md`, both contracts and `tasks.md` call it a **refused line** with a `refused` outcome. A reader cannot tell whether they are the same thing | Choose one — *refused line* is the better term, because the outcome column and the code vocabulary already use it — and use it in the UI label too, or state the mapping once in `data-model.md` §7 |
| D2 | Constitution alignment | MEDIUM | tasks.md `T1711`, `T1729` | Two tasks merge a failing test with its implementation in one checkbox (*"Write the failing integration cases … then make them pass"*, *"Extend … with failing expectations and then …"*). Constitution V requires the test be observed failing **before** the implementation; a single checkbox cannot record red-then-green, and every other task in the file splits them | Split each into two tasks. Identifiers are invariant (`DS-2`), so the new ones append after `T1771` with a note saying where they execute — the pattern `EPIC-045` used for `T1682`–`T1685` |
| C5 | Coverage gap | MEDIUM | spec.md `FR-KAN-015`; tasks.md Phase 6 | The backend verdicts are covered by `T1738`, and `GET …/status-proposals` by `T1741`, but no frontend task asserts that **a refused or inconsistent proposal shows its verdict and stage on the card**. `T1747` covers only the open-proposal display | Extend `T1747`'s expectation list, or append one frontend task |
| C6 | Coverage gap | MEDIUM | spec.md `FR-KAN-004`; tasks.md `T1696` | `FR-KAN-004` forbids the parse inventing, completing or correcting a task, and specifically forbids inferring status **from position, section, ordering or prose**. The grammar corpus asserts what is accepted, ignored and refused, but nothing asserts the negative | Add a corpus case to `T1696`: a `- [ ]` line under a heading called *Done* stays `not_started` |
| C7 | Coverage gap | MEDIUM | spec.md `FR-KAN-074`; tasks.md `T1711` | `T1711` proves a **cross-project** credential is refused as absence; nothing proves the **cross-workspace** read or write is. The two are different guards in this codebase | Add the cross-workspace case to `T1711` |
| A1 | Ambiguity | LOW | spec.md `FR-KAN-035` vs data-model.md §2 | `FR-KAN-035` says *every task row* MUST carry the source line and source digest; `data-model.md` §2 makes both nullable because engine-generated rows have neither. Read strictly, the requirement contradicts the model | Narrow the requirement to *every **synced** task row*, matching `FR-KAN-017`'s own distinction |
| C8 | Coverage gap | LOW | spec.md `FR-KAN-064`, `FR-KAN-075` | Two assertions are stated and never tested: *no other refusal code changes meaning* when the tool goes live, and *nothing in this Epic is reachable without authentication* | Fold both into existing tasks — the first into `T1760`'s conformance check, the second into `T1714`'s route test |

## Coverage summary

| Requirement group | Requirements | Covered | Notes |
|---|---|---|---|
| Grammar and parse (`FR-KAN-001`–`009`) | 9 | 8 full, 1 partial | `FR-KAN-004` negative not asserted (C6); `FR-KAN-005` paths clause uncovered (C3) |
| Manual movement (`FR-KAN-010`–`018`) | 9 | 8 full, 1 partial | `FR-KAN-015` frontend half (C5) |
| Reconciliation (`FR-KAN-020`–`027`) | 8 | 8 | `T1698`, `T1749`–`T1754` |
| The sync (`FR-KAN-030`–`039`) | 10 | 10 | `T1696`–`T1711` |
| Automatic movement (`FR-KAN-040`–`048`) | 9 | 8 full, **1 none** | `FR-KAN-048` has no task (C1) |
| Board and progress (`FR-KAN-050`–`059`) | 10 | 10 | `T1712`–`T1737` |
| The contract (`FR-KAN-060`–`066`) | 7 | 6 full, 1 partial | `FR-KAN-064` (C8) |
| Security, tenancy, audit (`FR-KAN-070`–`075`) | 6 | 3 full, 2 partial, **1 none** | `FR-KAN-072` audit has no task (C2); `FR-KAN-074` partial (C7); `FR-KAN-075` partial (C8) |
| Success criteria `SC-KAN-001`–`009` | 9 | 9 | each maps to a task or a mutation observation in `T1768` |

**Unmapped tasks**: none. Every one of the 86 tasks maps to a requirement, a success criterion, a
research decision, or a governance obligation (`R-046-13`'s repairs, Constitution IV/V/IX/XI/XII
closure).

## Constitution alignment

| Principle | State |
|---|---|
| I, II, III, IV, VI, VII, IX, X, XI | Aligned — recorded in `plan.md`'s gate table |
| **VIII** | **Gap (D1)** — no Epic branch; one command closes it |
| V | Aligned in substance, **two exceptions (D2)** — `T1711` and `T1729` merge red and green |
| XII | PARTIAL by design and recorded — the commands building this Epic run unregistered because this repository is not a PMI-managed project; the Epic itself never lets a connector apply a status (`FR-KAN-071`, `T1743`) |

## Metrics

| Metric | Value |
|---|---|
| Total functional requirements | 68 |
| Total success criteria | 9 |
| Total tasks | 86 |
| Requirements with ≥ 1 task | 66 / 68 — **97%** |
| Requirements with **zero** coverage | 2 (`FR-KAN-048`, `FR-KAN-072`) |
| Requirements partially covered | 5 (`FR-KAN-004`, `005`, `015`, `064`, `074`/`075`) |
| Ambiguity count | 2 (`A1`, and `F1`'s reading of *contract*) |
| Duplication count | 0 |
| CRITICAL issues | **0** |
| HIGH issues | 4 (`C1`, `C2`, `C3`, `D1`, `F1` — `D1` and `F1` are process, not code) |

## Next actions

1. **Rule on `F1`** — it is the only finding whose answer is not obvious, and it changes whether a
   cross-Epic refactor enters this Epic's scope.
2. **Append tasks for `C1` and `C2`** — two requirements with zero coverage, both cheap. Identifiers
   append after `T1771` and never renumber (`DS-2`).
3. **Decide `C3`** — capture the paths, or narrow `FR-KAN-005`.
4. **Cut the branch (`D1`)** before `T1686`.
5. `C4`–`C8`, `F2`, `F3`, `D2` and `A1` are safe to fold into the tasks and contracts they touch
   during implementation, provided `D2`'s split happens as new task identifiers rather than an edit
   to `T1711`/`T1729`'s scope.

No finding blocks `/speckit-implement` from starting at Phase 1; `C1`, `C2` and `C3` must land
before their phases (4, 2 and 2 respectively) are declared complete.

## Remediation applied — 2026-09-06

Every finding was remediated in the same session, on the requester's instruction. Two required a
ruling and both took the recommended option; they are recorded as a second dated session in
[spec.md](./spec.md) §Clarifications.

| Finding | Ruling / action | Where it landed |
|---|---|---|
| `F1` | **Option A** — *contract* in `FR-KAN-013` means `EPIC-030`'s **rules and verdict vocabulary**, not its specification-typed interface; widening that interface stays `EPIC-030`'s follow-up | `spec.md` `FR-KAN-013` (one added clause); `spec.md` §Clarifications |
| `C3` | **Option A** — the repository paths a description names are **captured** | `data-model.md` §2 (`sourcePaths`); `contracts/board-contract.md` §3 (the card); tasks `T1776`, `T1777` |
| `C1` | Two tasks added for the provisional-run and staleness requirement | `T1772`, `T1773` (execute in Phase 4) |
| `C2` | Two tasks added wiring the audit port `EPIC-045` established | `T1774`, `T1775` (execute in Phase 2) |
| `D1` | Branch `epic/046-task-kanban-governed-status` cut | Gate VIII now **PASS** in `plan.md`; the *Branch owed* note in `tasks.md` replaced |
| `D2` | `T1711` and `T1729` narrowed to red only; their green halves became new identifiers | `T1778`, `T1779` (`DS-2` — nothing renumbered) |
| `F2` | The proposal's idempotency key derived and documented | `contracts/tasks-api.md` §4; `data-model.md` §5; `T1739` |
| `F3` | Standardised on **refused line**; *unparsed* removed from `spec.md`, `tasks.md`, `quickstart.md` | 8 edits in `spec.md`, 1 each in `tasks.md` and `quickstart.md` |
| `C4` | New **§2a · Refused lines** section | `contracts/board-contract.md` |
| `C5` | The refused/inconsistent verdict on the card | `T1747` |
| `C6` | The negative case — an unchecked line under a heading called *Done* stays `not_started` | `T1696` corpus |
| `C7` | The cross-workspace guard proved beside the cross-project one | `T1711` |
| `C8` | The two untested assertions folded in | `T1714`, `T1760` |
| `A1` | `FR-KAN-035` narrowed to *every **synced** task row* | `spec.md` |

**Post-remediation state**: **94 tasks**, `T1686`–`T1779`, contiguous, no duplicates, every task
naming a file path (`DS-1`) and every implementation task naming its failing-first test
(Constitution V). Requirements with zero coverage: **none**. Constitution gates: VIII closed; XII
remains PARTIAL by design and is recorded in `plan.md`'s Complexity Tracking.

`quickstart.md` gained scenarios 24 (paths on the card) and 25 (the four audit rows), taking it to
**25 scenarios**.

Findings are left in the table above as they were found. This record is the analysis; the
remediation is appended rather than folded into it, so a later reader sees what the step actually
caught.
