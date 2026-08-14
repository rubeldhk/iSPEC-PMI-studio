# Contract: Reconciliation Register

**Epic**: `EPIC-027` | **Date**: 2026-08-13 | **Status**: ✅ **BUILT BY THIS EPIC**

**Source**: `FR-AMD-002` to `FR-AMD-015`; Constitution V (v1.2.0); research `R-027-1`

Unlike the other two contracts in this folder, this one **is** EPIC-027's own output. It defines the
interface between the reconciliation documents a human reads and the conformance checks CI runs.

---

## Why a machine-readable projection exists

Constitution V requires an executable check that **can fail**, and states the reason bluntly:

> *"A conformance check MUST be able to fail. A check that cannot fail is decoration."*
> *"…a specification, standard, or layout that no check reads is a document that silently rots, and
> rotted governance is worse than none because it is still trusted."*

A twenty-five-section impact report with a clause register of ~340 rows is exactly the artifact that
rots. Checking it by regex over prose produces a check that passes on malformed input — which is
worse than no check, because it manufactures confidence.

**Therefore**: humans read markdown; checks read a JSON projection generated from it. One source, two
renderings, and a check that the two agree.

## Files

```text
specs/027-ai-native-amendment/
├── register/
│   ├── clauses.md              # human-readable, authoritative
│   ├── verdicts.md
│   ├── capabilities.md
│   ├── premises.md
│   ├── decisions.md
│   ├── research.md             # projection of ./research.md's two registers
│   ├── adrs.md
│   └── register.json           # generated projection — never hand-edited
└── impact-report.md            # the §18 deliverable, 25 sections
```

`register.json` carries a `generated_from` digest of each source file. A check compares the digest to
the file, so a hand-edited projection or a stale one fails rather than passing quietly. **This is the
check most likely to catch a real mistake**, because regenerating is the step people skip.

---

## Schema

```jsonc
{
  "version": "1.0",
  "generated_from": { "clauses.md": "<sha256>", "...": "<sha256>" },

  "clauses": [{
    "id": "CLA-001",
    "document": "plan-amendment",          // | native-speckit | lifecycle | defect-management
    "section": "§19",
    "text": "This amendment is evolutionary, not a product reset.",
    "normativity": "shall",                // | must | should | may | narrative
    "duplicates": ["CLA-118"]
  }],

  "verdicts": [{
    "clause": "CLA-001",
    "verdict": "already-covered",          // | needs-enhancement | missing | conflicting | should-integrate
    "owner": "FR-AMD-001",                 // or the literal "NO-EXISTING-COVERAGE"
    "reasoning": "…",
    "action": "none — recorded as the governing constraint",
    "new_identifier": null,
    "necessity": null                      // REQUIRED when new_identifier is set
  }],

  "capabilities": [{
    "id": "CAP-001",
    "capability": "Source control",
    "ownership": "integrated",             // | native | hybrid
    "reason": "PMI Studio need not control git hosting to maintain its end-to-end workflow",
    "abstraction_boundary": "CreateImplementationBranch()",   // REQUIRED when integrated|hybrid
    "existing_home": null,
    "removed_because_external": false      // MUST be false — §2
  }],

  "premises": [{
    "id": "PRE-001",
    "claimed_capability": "the existing Change Room",
    "claim_source": "CLA-042",
    "search_performed": "grep -ri 'change room' specs/",
    "occurrence_count": 0,
    "locations": [],
    "verdict": "refuted"                   // | confirmed | partial
  }],

  "decisions": [{
    "id": "D-21",
    "question": "…",
    "options": [{ "label": "…", "consequence": "…" }],   // >= 2
    "recommendation": "…",
    "owner": "project owner",
    "status": "open",                      // | decided | blocked
    "blocking_research": ["R-AI-010"]
  }],

  "adrs": [{
    "subject": "AI Agent Gateway and provider independence",
    "status": "open",                      // | decided
    "awaits": "D-20",
    "supersedes": null,
    "superseded_reasoning": null           // REQUIRED when supersedes is set
  }],

  "preserved_element_changes": [{
    "element": "Docker isolation",
    "reason": "…", "affected_requirement": "…", "migration_impact": "…",
    "compatibility_impact": "…", "alternative_considered": "…"   // all five REQUIRED — §28
  }],

  "capability_areas": [{                 // exactly 17 — G-27-13
    "area": "Agent Gateway + agent contract",
    "verdict": "missing", "home": "EPIC-028", "posture": "proceeds"
  }],

  "epic_status_changes": [{              // normally EMPTY — FR-AMD-017
    "epic": "EPIC-0nn", "from": "held", "to": "proceeding",
    "reason": "…", "clause": "CLA-###"
  }],

  "impact_report": { "sections": 25, "empty_with_reason": ["…"], "placeholders": 0 }
}
```

---

## Conformance checks

Each maps to one success criterion. Each **can fail**, and the fixture case that proves it can is
named in [quickstart.md](../quickstart.md).

| Check | Asserts | Criterion |
|---|---|---|
| `G-27-01` | Every clause has exactly one verdict; zero clauses have none or two | `SC-AMD-001` |
| `G-27-02` | Every verdict has a non-empty `owner`, or the explicit `NO-EXISTING-COVERAGE` sentinel | `SC-AMD-002` |
| `G-27-03` | Every `new_identifier` carries a `necessity` | `SC-AMD-003` |
| `G-27-04` | Every capability has an `ownership`; every `integrated`/`hybrid` names a boundary; `removed_because_external` is false throughout | `SC-AMD-004` |
| `G-27-05` | Every premise has a count and, when count > 0, locations | `SC-AMD-005` |
| `G-27-06` | Impact report has exactly 25 sections and zero placeholders | `SC-AMD-006` |
| `G-27-07` | All 12 Native §27 ADR subjects present; every `open` names what it awaits; every `supersedes` carries reasoning | `SC-AMD-007` |
| `G-27-08` | All 14 `R-AI-*` items registered with `blocks`; no decision is `decided` while `blocking_research` is unanswered | `SC-AMD-008` |
| `G-27-09` | Zero product source files changed by this epic — `git diff --name-only` touches nothing under `backend/`, `worker/`, `packages/`, `engine-adapters/`, `frontend/` | `SC-AMD-009` |
| `G-27-10` | Every decision has ≥2 options, a consequence per option, and an owner | `SC-AMD-012` |
| `G-27-11` | `generated_from` digests match the source files | `R-027-1` |
| `G-27-12` | Every `preserved_element_changes` row has all five §28 fields non-empty | `FR-AMD-015` |
| `G-27-13` | The capability-area table has exactly **17** rows; every row carries a verdict, a named home and a posture; the count matches the figure quoted in `spec.md` | `SC-AMD-011` |
| `G-27-14` | No other epic's **Delivery posture** line is modified by this epic's diff unless a matching `epic_status_changes` row exists, carrying `epic`, `from`, `to`, `reason` and the `CLA-###` responsible | `SC-AMD-010` |

**`G-27-09` is the one that enforces `FR-AMD-016`.** It is also the only check here that inspects the
repository rather than the register, and it is the reason "analysis only" is a property of this epic
rather than a promise about it.

## Blocking policy

Per Constitution V, whether a failing check blocks CI is a per-epic decision recorded in the spec.

**Decision for EPIC-027**: all fourteen **report** rather than block, matching EPIC-018's precedent
where only the duplication check blocks — **except `G-27-09` and `G-27-14`, which block.** Both guard
the same boundary: a reconciliation epic that has quietly modified product code, or quietly changed
another epic's delivery posture, is not a reporting matter. `FR-AMD-016` and `FR-AMD-017` are the two
constraints the project owner asked for by name, and a reporting-only check on either would leave
the scope-creep concern defended by good intentions.

## What the register does not do

- It does not decide anything. `decisions[].status` is `open` until a human changes it.
- It does not track implementation. Every build it identifies names an owning epic, and that epic's
  own `tasks.md` tracks it.
- It does not supersede `srs-alignment.md`. `C-19`+ and `D-20`+ **continue** that register's
  numbering; the two are read together, and the impact report links back rather than restating.
