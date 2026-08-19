# Contract: Steering File Format

**Epic**: `EPIC-018` | **Date**: 2026-08-04 | **Research**: [R-018-3](../research.md)

Steering files are read by **people** and loaded as context by **agent sessions**. This format serves
both: structured front matter an agent can parse without guessing, and a prose body a person will
actually read.

## File location and naming

`governance/steering/<subject>.md` — one file per subject, named for the subject. Ten subjects
(`FR-RGP-001`): `organization`, `workspace`, `product`, `architecture`, `coding-standards`,
`security`, `ui-standards`, `business-rules`, `technology-stack`, `ai-governance`.

The exact directory is fixed by the layout mapping (F-18.3), which is authored before the steering
files themselves — see the build order in [plan.md](../plan.md).

## Structure

```markdown
---
subject: coding-standards
scope: repository
version: 1
status: active
owner: tech-lead            # tech-lead | product-owner | project-owner
last_reviewed: 2026-08-05  # ISO date; reported when older than 90 days
supersedes: null
---

# Coding Standards

## Why this exists

<One paragraph. What breaks if these standards are not followed.>

## Standards

### CS-001 · Explicit return types on exported functions

Every exported function declares an explicit return type.

**Check**: lint rule / a stated automated check.
**Rationale**: <why — one or two sentences>

### CS-002 · ...

## Deliberately not covered here

<What a reader might expect to find and will not, with a link to where it lives.>
```

## Rules

- **SF-1** — Front matter is required and complete. A file missing `subject`, `version`, `status`, or
  `owner` fails conformance. `owner` is one of the three programme roles — `tech-lead`, `product-owner`, `project-owner` (clarified 2026-08-05) — not an individual, so the file survives staff changes. An unowned standard is an unmaintained standard.
- **SF-2** — Each standard carries a **stable identifier** (`CS-001`) so it can be cited, linked, and
  checked. "The third bullet in coding standards" is not a citation.
- **SF-3** — Each standard states a condition an artifact can be **held against**. "Write clean code"
  fails `FR-RGP-002`; "every exported function declares an explicit return type" passes.
- **SF-4** — Each standard states a **check** — automated where possible, a named manual review step
  where not. A standard with no check is a preference.
- **SF-5** — Each standard states a **rationale**. This is not decoration: a standard whose reason is
  unknown cannot be correctly relaxed, and will either be followed superstitiously or dropped.
- **SF-6** — **No verbatim duplication** of constitution or template text. Where they overlap, link.
  Enforced by the overlap check (`SC-RGP-003`) — the highest-value automated check in this epic,
  because the failure it prevents is silent.
- **SF-7** — Where a standard conflicts with the constitution, **the constitution wins**. The steering
  file is corrected. There is no override direction.
- **SF-8** — `status: superseded` files are **retained**, with `supersedes` pointing at the successor.
  History is not deleted, matching how the platform treats retired requirements.
- **SF-10** — `last_reviewed` is **required** and is an ISO date. A file past **90 days** is
  reported by check **G-07**, not failed — staleness is a prompt to look, not a reason to stop the
  build. A file that is well-formed but no longer true is worse than a missing one, because agents
  load it as context.
- **SF-9** — The "Deliberately not covered here" section is **required**, even when empty. It is what
  stops a reader concluding a standard does not exist when it merely lives elsewhere — the failure the
  `_shared/` "Known limitation" note in the README had to be written to fix.

## Conformance checks

Run under Vitest in `tests/governance/`, alongside `pnpm test:arch` (R-018-4).

| Check | Asserts | Criterion |
|---|---|---|
| **G-01** | All ten subjects have an active file, or absence is recorded with a reason | `SC-RGP-002` |
| **G-02** | Front matter complete on every file | SF-1 |
| **G-03** | Every standard has an identifier, a check, and a rationale | SF-2, SF-4, SF-5 |
| **G-04** | No substantial verbatim overlap with the constitution or templates | `SC-RGP-003`, SF-6 |
| **G-05** | Every file has a "Deliberately not covered here" section | SF-9 |
| **G-06** | No two active files share a subject | data-model validation |
| **G-07** | No steering file is past its 90-day review interval unreported | `SC-RGP-009`, SF-10 |

**G-04 is the one that matters most.** The others catch omissions, which are visible. G-04 catches
duplication, which is invisible until two copies disagree — and by then both are believed.

## What this format is not

- It is **not** the product Steering Engine's data shape. That is
  [EPIC-017](../../017-enhancement-model/contracts/steering-contract.md), where steering is structured
  input to an engine contract. These share a name and nothing else.
- It is **not** a substitute for the constitution. Steering states standards content must meet;
  the constitution states rules the process must follow.
