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
| 3 | **Immutability claim overstated** | "the trigger already applies to four tables" | Superseded — see **Trigger accounting** below. The figure was restated as 17 and then as 19 during C2A–C2E; **both were wrong**, and the number is deliberately no longer quoted in this row because it moves with every migration. What does not move: `reject_mutation()` protects nothing until a `CREATE TRIGGER` attaches it, and **no EPIC-037 table is protected until its own migration attaches one.** |
| 4 | **No implementation stop boundary** | "Phases 1–5" | Explicit bands: **A** `T1018`–`T1059` + `T1080`, `T1081` (44 tasks) · **C** `T1066`–`T1067` · **D** `T1060`–`T1065` · **E** `T1068`–`T1074` · **F** `T1075`–`T1079`. Band **B** (Requirement Room S1) is **empty** — S1 consumes nothing from this Epic |
| 5 | Checkpoint | commit `5be394e` | amended; see the C1 report |

**Two of my own earlier statements were wrong and are corrected here rather than left standing**: the
epic total (41, arithmetic that double-counted) and the trigger coverage ("four tables" — sampled
from a truncated grep rather than counted). Both were reported confidently, which is what made them
worth recording.

## Next actions

`/speckit-implement` is **not** authorised. Step C1 ends here, pending the project owner's review of
this analysis and the C1 checkpoint.


---

## Trigger accounting *(corrected 2026-08-27, Step C3A §1A)*

**Baseline: 18 immutability triggers on 18 distinct tables**, as of commit `a29f166`, immediately
**before** EPIC-037's Band A migration exists.

### The authoritative evidence

The live database, not a source scan — a `CREATE TRIGGER` in a migration file is intent, and only
`pg_trigger` records what is actually attached:

```sql
SELECT c.relname
  FROM pg_trigger t
  JOIN pg_class  c ON c.oid = t.tgrelid
  JOIN pg_proc   p ON p.oid = t.tgfoid
 WHERE p.proname = 'reject_mutation'
   AND NOT t.tgisinternal
 ORDER BY 1;
```

Corroborated by `grep -rh "EXECUTE FUNCTION reject_mutation()" backend/prisma/migrations/*/migration.sql | wc -l`,
which also returns **18**. Two independent sources agreeing is the point: the earlier figures were
quoted from memory and neither was checked against either.

The 18: `access_attempt_records`, `access_grants`, `adjudication_records`, `answers`,
`application_intents`, `application_policies`, `audit_entries`, `clarifications`,
`gate_final_outcomes`, `lifecycle_transitions`, `loop_transitions`,
`provisional_approval_overrides`, `publish_records`, `published_file_references`,
`requirement_versions`, `review_sessions`, `specification_versions`, `steering_applications`.

### Why no total is quoted anywhere else

A sentence like *"the function is bound by N triggers"* is false the moment the next migration lands,
and this Epic's own migration will make it false immediately. Three separate reports quoted three
different wrong numbers for exactly that reason. The rule replacing it: **cite the query, not the
count.**

### What EPIC-037's migration must protect

Stated as an obligation, not as a total. Every authoritative immutable table this Epic creates gets
its own `CREATE TRIGGER`, asserted **by name** in `pg_trigger` and by an `UPDATE`/`DELETE` refusal
under the real application role (`T1080`):

- the execution **event** store — the authoritative append-only stream;
- execution **comments** and their redactions — corrections append, never overwrite;
- **evidence/artifact associations** recorded against an execution.

**Projection tables are deliberately excluded.** A current-state projection is rebuildable and
non-authoritative; attaching immutability to one would misclassify derived state as evidence and
make replay impossible.

`ownership_backfill_records` (C2E) carries **no** trigger. It is migration evidence rather than a
governed audit stream, and it is recorded here as a **finding** (`Y1`, LOW) rather than changed:
altering it is outside Band A's authorised scope.

---

# Analysis: EPIC-037 — Step C3A dependency refresh

**Session**: 2026-08-27 · **Scope**: the six dependency corrections in C3A §1, and the identity
preflight in §2. **Band A was not implemented** — the preflight hit the stop condition §2 names.

**Artifacts**: [spec.md](./spec.md), [tasks.md](./tasks.md),
[contracts/event-vocabulary.md](./contracts/event-vocabulary.md) · **Also read**:
`packages/agent-contract/src/`, `packages/execution-contract/src/`,
`backend/src/modules/access/workspace-boundary.service.ts`, EPIC-028's
[spec.md](../028-agent-execution-seam/spec.md), and `backend/prisma/schema.prisma`.

## Findings — Session 2026-08-27 (Step C3A)

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| Y2 | Coverage Gap | CRITICAL | `packages/agent-contract/src/`; `backend/src/modules/access/workspace-boundary.service.ts`; `backend/prisma/schema.prisma` | **No production agent/service identity resolution exists.** `WorkspaceBoundaryService` resolves actors only against the `users` table. `AgentDescriptor` is a capability descriptor — name, provider, model, capabilities — with no workspace, no tenant, no sponsoring human and no frozen snapshot. EPIC-028's specification states no identity requirement. No agent, connector or service-account model exists in the schema, and nothing mints the `proposerIdentitySnapshotId` EPIC-030's proposal contract requires. The Band A fixture connector therefore cannot cross EPIC-024's boundary as an agent | **Stop, per C3A §2.** Every route through is forbidden by name: registering the connector as a `User` (§2), an ad hoc identity model inside EPIC-037 (§12), or weakening EPIC-024 (§12). Needs an owner decision on where agent identity lives |
| Y3 | Inconsistency | MEDIUM | `specs/037-.../analysis.md` finding 3; three prior reports | The immutability trigger total was quoted as 4, then 17, then 19. **The authoritative figure is 18**, confirmed by `pg_trigger` and by the committed migrations independently. Each earlier figure was quoted from memory and checked against neither | **Fixed.** The row no longer quotes a total; it cites the query. A count is false the moment the next migration lands |
| Y1 | Coverage Gap | LOW | `backend/prisma/migrations/20260827000000_epic024_owner_grant_backfill/` | `ownership_backfill_records` (C2E) carries no immutability trigger. It records which artifacts could not be given an owner, which is governance evidence an operator will act on | Recorded, not changed — outside Band A's authorised scope. Attach a trigger when EPIC-024 is next opened |

## Corrections applied (C3A §1)

| § | Correction | Status |
|---|---|---|
| A | Trigger accounting — baseline **18**, authoritative query recorded, no total quoted elsewhere | ✅ |
| B | Refusal mapping — stage → event, `REFUSAL_EVENT_OF`, prose never parsed | ✅ |
| C | All six reconciliation causes; unavailable/stale/pending/unknown are not refusals | ✅ |
| D | `T1058` consumes `PROPOSAL_ADJUDICATOR` only; EPIC-030's ports are unexported | ✅ |
| E | No explicit policy → `validated`, not `applied` | ✅ |
| F | Every referenced specification carries a durable human owner grant; zero grants is inaccessible | ✅ |

## Metrics

- Corrections applied: **6 / 6**
- Findings: **3** — 1 CRITICAL · 1 MEDIUM (fixed) · 1 LOW
- Band A tasks implemented: **0 of 44**. `T1018`–`T1059`, `T1080`, `T1081` remain open.

## Notes

`Y2` is not a defect in EPIC-037. It is a dependency that has never existed, surfaced the same way
`X7` and `X8` were — by a consumer trying to use it and stopping. The specification corrections in
§1 are complete and independent of it, which is why they were applied rather than held.
