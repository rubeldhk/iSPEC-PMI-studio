# Cross-Artifact Analysis — `EPIC-037` Governed Execution Registry

**Session**: 2026-08-25

Read-only pass over `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`,
`contracts/*` and `quickstart.md`, against the thirteen gate conditions Step C1 named.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| **A1** ✅ | Coverage Gap | **HIGH** | `tasks.md`, `quickstart.md` | `AC-EXR-01`–`21` were cited **sixteen times** while defined **nowhere in the Epic** — they existed only in the remediation package, outside `specs/`. A task citing an acceptance criterion the Epic does not carry is a dangling reference, and the criterion could not be checked at convergence | **Fixed**: `## Acceptance Criteria` added to `spec.md`, 24 rows, each mapped to its requirement and scenario |
| **A2** ✅ | Coverage Gap | **HIGH** | `tasks.md` | **20 of 22** requirements were reachable only through an acceptance criterion or scenario id, never by requirement identifier — `grep FR-EXR-012 tasks.md` returned nothing, so the requirement looked unowned | **Fixed**: `## Traceability matrix` added to `tasks.md` mapping every requirement to its tasks, acceptance criteria and scenario |
| **A3** ✅ | Coverage Gap | MEDIUM | `spec.md` `SC-EXR-010` | *"A person can answer what has been run against this artifact from one screen"* had no task and no scenario | **Fixed by recording ownership, not by inventing a task**: it is a **screen** outcome, and screens belong to EPIC-031/033/036 under the Step C1 boundary. This Epic delivers the query they read (`FR-EXR-016`). Recorded in the matrix so the criterion keeps a visible owner rather than disappearing |

**No CRITICAL findings. No constitution violation. No duplication with a neighbouring Epic.**

## Gate conditions — Step C1

| # | Condition | Result |
|---|---|---|
| 1 | No requirement duplication with EPIC-023, 028, 030, 031, 032, 033, 036, 039 | **PASS** — no `FR-` identifier is duplicated anywhere in the corpus. Every neighbouring capability is consumed through the Dependencies table, and `FR-EXR-006`/`007` explicitly annotate *"adjudication is EPIC-030's"* rather than restating its rules |
| 2 | Every requirement has an owner | **PASS** — after `A2`. 22 of 22 requirements map to tasks |
| 3 | Every acceptance criterion maps to requirements and tasks | **PASS** — after `A1`. **23 live** criteria, each with a requirement and a scenario. `AC-EXR-11` is retired, marked non-normative, and mapped to nothing |
| 4 | Event names have one unambiguous meaning | **PASS** — 29 live events, zero duplicates. The three withdrawn names appear **only** in the withdrawal table that exists to prevent their reintroduction, and `T1024` asserts their absence from the live union |
| 5 | All three state machines internally consistent | **PASS** — `contracts/state-machines.md` defines all three with transition tables; terminality is scoped to lifecycle in all three documents that mention it |
| 6 | REST, MCP and SDK contracts have semantic parity | **PASS** — parity table in `contracts/execution-contract.md` §5; asserted by `AC-EXR-01`–`04` as **semantic equivalence, not byte identity** |
| 7 | No mutable field acts as authoritative adjudication | **PASS** — `status_transition_proposals` has no adjudication column; every verdict is one of eleven governance events; `T1055` asserts the absence |
| 8 | No output-only identity required at registration | **PASS** — every `commitAfter` mention in the Epic is a **prohibition** (`AC-EXR-17b`) or a historical note recording the Rev 2 error |
| 9 | No governance event incorrectly prohibited after terminal execution | **PASS** — `FR-EXR-018` scopes terminality to lifecycle; `AC-EXR-18` asserts acceptance, `AC-EXR-19` asserts refusal, and both are driven by `V37-4` |
| 10 | No connector interprets status policy | **PASS** — `FR-EXR-006`, `AC-EXR-16`, `T1059`; a connector applying a transition is refused as a contract violation |
| 11 | No direct database access permitted | **PASS** — `FR-EXR-019` enforced by the architecture test `T1027`, the same mechanism that keeps `FR-AGT-004` honest today |
| 12 | Constitutional checks pass | **PASS** — 14 gates in `plan.md`, re-evaluated post-design. Principle XI Tier 2 is recorded **not applicable with a reason** rather than passed silently |
| 13 | No duplicate requirement or task identifiers | **PASS** — task ids `T1018`–`T1081`, zero duplicates within the Epic and zero collisions corpus-wide; zero `FR-` duplicates corpus-wide |

## Coverage summary

| Requirement group | Requirements | With tasks | With acceptance |
|---|---|---|---|
| Registration & intake | FR-EXR-001, 002, 003, 013 | 4/4 | 4/4 |
| Version binding | FR-EXR-004, 005 | 2/2 | 2/2 |
| Completion & governance hand-off | FR-EXR-006, 007, 014, 015 | 4/4 | 4/4 |
| Integrity | FR-EXR-008, 009, 017, 018 | 4/4 | 3/4 *(008 has no dedicated AC; covered by V37-1)* |
| Offline & reconciliation | FR-EXR-010, 011, 012 | 3/3 | 3/3 |
| Queries, contracts, retention | FR-EXR-016, 019, 020, 021, 022 | 5/5 | 3/5 *(016, 021 verified by scenario and task)* |

## Metrics

- **Requirements**: 22 · **Success criteria**: 10 · **Acceptance criteria**: **23 live** (+1 retired, 24 rows) · **Tasks**: 64
- **Coverage**: requirements with ≥1 task **100%** · acceptance criteria defined **100%**
- **Ambiguity count**: 0 unresolved · 7 resolved at `/speckit-clarify`, **0 escalated**
- **Duplication count**: 0
- **Critical issues**: 0

## Two false positives from this analysis's own checks

Recorded because a checker that cries wolf gets switched off, and because both were caught by
reading the hits rather than trusting the count:

1. **"Withdrawn event names still live"** — the scan counted 32 event names where 29 exist. The
   extra three were the withdrawal table's own rows. The table exists to prevent reintroduction;
   a scan that reports it is reporting the guard as the fault.
2. **"`commitAfter` required at registration"** — matched `Registration **MUST NOT** require
   `commitAfter``. The scan could not tell a prohibition from a requirement.

Neither changed a verdict, but both would have if accepted at face value — which is the failure mode
this corpus has recorded four times already.

## C1 closure corrections — 2026-08-25

Five corrections applied at closure. **No specification revision and no re-run of the definition
journey**; each is a targeted fix with its gate re-run.

| # | Correction | Was | Now |
|---|---|---|---|
| 1 | **Epic accounting double-counted EPIC-037** | 24 + 6 + 5 + 2 + 3 + 1 = **41** | 24 + 6 + **5** + 2 + 3 = **40**. EPIC-037 sits in **not started** and nowhere else. "Newly specified" is an *attribute* of that row, not a sixth category |
| 2 | **Acceptance-criterion count was ambiguous** | "24 acceptance criteria" | **23 live** · **1 retired** (`AC-EXR-11`, now marked **NON-NORMATIVE**, mapped to no task) · **24** table rows · **21** base identifiers, `17` split four ways |
| 3 | **Immutability claim overstated** | "the trigger already applies to four tables" | The **function** exists and is bound by **17 triggers** elsewhere. **No EPIC-037 table is protected until `T1026` attaches one.** `T1025` now asserts UPDATE, DELETE, append-only correction and append-only redaction separately; `T1080` asserts the application role cannot bypass; `T1081` requires sequence allocation and insert in **one transaction** |
| 4 | **No implementation stop boundary** | "Phases 1–5" | Explicit bands: **A** `T1018`–`T1059` + `T1080`, `T1081` (44 tasks) · **C** `T1066`–`T1067` · **D** `T1060`–`T1065` · **E** `T1068`–`T1074` · **F** `T1075`–`T1079`. Band **B** (Requirement Room S1) is **empty** — S1 consumes nothing from this Epic |
| 5 | Checkpoint | commit `5be394e` | amended; see the C1 report |

**Two of my own earlier statements were wrong and are corrected here rather than left standing**: the
epic total (41, arithmetic that double-counted) and the trigger coverage ("four tables" — sampled
from a truncated grep rather than counted). Both were reported confidently, which is what made them
worth recording.

## Next actions

`/speckit-implement` is **not** authorised. Step C1 ends here, pending the project owner's review of
this analysis and the C1 checkpoint.
