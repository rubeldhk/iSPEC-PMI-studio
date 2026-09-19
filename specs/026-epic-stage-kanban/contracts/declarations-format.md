# Contract: Epic Declarations Format

**Epic**: `EPIC-026` | **Requirements**: `FR-ESK-004`, `FR-ESK-005`, `FR-ESK-020`, `FR-ESK-022`,
`FR-ESK-023`, `FR-ESK-024` | **Checks**: `G-26-05`, `G-26-06`

The format of `governance/epic-declarations.json` — **the only hand-authored input to the register**,
and therefore the only place the register can be lied to.

Everything else is derived from the file tree and cannot disagree with it. What lives here is what no
artifact can express: *what an Epic is*, *why it deliberately stopped*, and *who authorised an
exception*. The file is small on purpose. Every field it gains is a field someone must keep true.

## DF-1 · Shape

```json
{
  "$comment": "Declared state for the EPIC-026 stage register. Derived state lives in the file tree, never here.",
  "epics": {
    "002-team-review-access-storage": {
      "kind": "parent-design",
      "children": ["023-unattended-runs-review", "024-artifact-access-control", "025-external-storage-publishing"],
      "reason": "Holds requirements, clarifications and traceability for three module-aligned children (ruling D-19)."
    },
    "009-spec-lifecycle-versioning": {
      "posture": {
        "kind": "Held",
        "awaiting": "PMI-DOC-004 Business Requirement Specification",
        "reason": "Awaits approved business scope (PMI-TASK-001 T-101, T-106; decision D-10)."
      }
    }
  },
  "waivers": [
    {
      "epic": "014-devops-release",
      "condition": "DOR-09",
      "owner": "tech-lead",
      "reason": "Analysis blocked on the CI rebuild; tasks and tests are complete and reviewed.",
      "expires": "2026-09-30"
    }
  ]
}
```

Keys are **directory names**, not `EPIC-###` labels — the directory is what exists on disk and what
the derivation enumerates. One identity, one spelling.

## DF-2 · An Epic entry declares kind, posture, or both

Every field is optional; an Epic absent from `epics` is a `delivery` Epic with no posture, which is
the common case. **The file lists exceptions, not Epics** — 26 entries repeating the default would
be a second registration step, which `FR-ESK-008` forbids.

| Field | Values | Required with |
|---|---|---|
| `kind` | `delivery` \| `parent-design` | — (default `delivery`) |
| `children` | Epic directory names | **required** when `kind` is `parent-design` |
| `posture.kind` | `Held` \| `Blocked` \| `Superseded` | — |
| `posture.awaiting` | free text naming a document or decision | **required** when kind is `Held` |
| `posture.blockedBy` | an Epic directory name | **required** when kind is `Blocked` |
| `posture.replacedBy` | an Epic directory name | **required** when kind is `Superseded` |
| `posture.reason` | free text | **required** with any posture |
| `reason` | free text | **required** when `kind` is `parent-design` |

## DF-3 · Every declaration names its object

A posture with no releasing input is **reported as incomplete** (`FR-ESK-005`), and a parent design
naming no children likewise (`FR-ESK-024`).

This is the rule that keeps the file honest. "Held — pending" names nothing, cannot be released by
anyone, and is indistinguishable from having given up. A declaration that points at nothing is a
stall wearing a label.

`children`, `blockedBy` and `replacedBy` MUST name Epic directories that exist on disk. A reference
to a directory that has never existed, or has since been renamed, is reported.

## DF-4 · Kind is not posture

`parent-design` is **not** a fourth posture kind and MUST NOT appear in `posture.kind`. Posture
answers *"why has this stopped?"*; a parent design has not stopped — it finished at a different line.

The two combine freely and mean different things: a parent design may also be `Held`. It is then a
design container awaiting an input, which is exactly EPIC-017's situation.

## DF-5 · A waiver covers exactly one condition

| Field | Rule |
|---|---|
| `epic` | Epic directory name; must exist |
| `condition` | Exactly one `DOR-nn`; must be in the current DOR set |
| `owner` | `tech-lead` \| `product-owner` \| `project-owner` — read from `governance.config.json`, not restated here |
| `reason` | Non-empty |
| `expires` | `YYYY-MM-DD` |

**No arrays of conditions, no wildcard, no waiver of "the DOR".** Waiving one named condition is a
decision someone can review. Waiving a gate is a decision nobody can.

Two waivers on one Epic are permitted — as two records, each owned, each expiring, each visible in
the register. The cost of an exception should scale with how many you take.

## DF-6 · Expiry is mandatory and enforced

An expired waiver **fails the build** (`FR-ESK-023`), and the Epic ceases to be Ready by any reading.

Renewal is a fresh record with a new date, not an edited one — so a condition waived four times in a
row is four dated decisions in the history rather than one field quietly moved forward. The design
does not prevent perpetual renewal; it prevents perpetual renewal going unnoticed.

## DF-7 · Nothing derivable appears here

The file MUST NOT contain a stage, a readiness verdict, a next command, a task count, or any other
value the tree already knows. `G-26-05` fails on a `stage` or `readiness` key at any depth.

Without this rule the file becomes a hand-maintained shadow register — the exact artifact this epic
exists to abolish, reintroduced through the one door left open.
