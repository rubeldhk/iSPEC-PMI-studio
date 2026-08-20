# Data Model: Design System (EPIC-029)

**Phase 1** · 2026-08-20 · entities from [spec.md](./spec.md) §Key Entities

This Epic has no database. Its "data" is a small set of declarations that live in the repository
and are read by components, by the lint rule, and by the conformance checks. Modelling them
explicitly is what lets a check assert their shape.

## Token

A named visual decision with exactly one definition (`FR-DS-002`).

| Field | Rule |
|---|---|
| `name` | CSS custom property, `--<category>-<scale>` — e.g. `--space-3`, `--color-text-muted` |
| `category` | one of `color`, `space`, `type`, `radius`, `elevation`, `motion` |
| `value` | a literal — **the only place literals may appear** (`FR-DS-051`) |
| `themed` | whether the value differs per theme. Every `color` token is themed; no `space` token is |

**Validation**

- Every token name MUST appear in `tokens.css` exactly once (`FR-DS-002`).
- Every themed token MUST have a value in **both** themes; a token defined in one is a defect
  (`FR-DS-010`) and the conformance check names it.
- The `space` scale MUST be a fixed ratio, not ad-hoc values (`FR-DS-003`).
- The `type` scale MUST define **at most seven** sizes, each with line height and weight
  (`FR-DS-004`). Seven is a ceiling, not a target.

**State transitions**: none. Tokens are static; the *theme* selects which value applies.

## Theme

A complete set of values for every themed token (`FR-DS-010`).

| Field | Rule |
|---|---|
| `name` | `light` \| `dark` — exactly two in Phase 1 |
| `values` | one per themed token; completeness is asserted, not assumed |

**Validation**

- Selection follows the operating-system preference by default and accepts a persistent override
  (`FR-DS-011`).
- Every text-on-surface pair MUST meet WCAG 2.2 AA contrast **in both themes**, computed from the
  values rather than observed in a browser (`SC-DS-007`, research `R-029-3`).

**State transitions**: `system → light`, `system → dark`, and back to `system`. The override
persists; clearing it returns to following the OS.

## Component

A reusable element with a contract and a defined set of states (`FR-DS-020`).

| Field | Rule |
|---|---|
| `name` | one of the fifteen in the Phase 1 inventory (`FR-DS-023`) |
| `states` | the subset of `default, hover, focus, active, disabled, loading, error, empty` that applies |
| `props` | its contract — what a consumer may set |

**Validation**

- Every applicable state MUST be implemented **and asserted by a test** (`SC-DS-004`). "Applicable"
  is declared per component in `contracts/components.md`, so the assertion knows what to look for
  and a missing state is a failure rather than an omission nobody notices.
- A component MUST contain **no literal visual value** (`FR-DS-051`, enforced by lint).
- Every interactive component MUST be keyboard-operable with a visible focus indicator
  (`FR-DS-033`).

**State transitions**: `default → hover → active` (pointer), `default → focus` (keyboard),
`* → disabled` (prop), `* → loading` (async), `* → error` (failure). `empty` applies only to
collection-rendering components.

## Accessibility Record

The evidence artifact for the manual pass (`FR-DS-034`), modelled because a check reads it.

| Field | Rule |
|---|---|
| `tool` | screen reader used, named |
| `version` | its version |
| `journeys` | each journey walked, listed |
| `date` | when |

**Validation**: the record MUST exist and MUST name a screen reader and at least one journey. A
governance check asserts this — a file that says only "passed" fails, which is the difference
between a transcript and a tick (`SC-DS-008`).

## Relationships

```text
Theme ──provides values for──▶ Token ──consumed by──▶ Component ──composed into──▶ Page
                                 ▲                        │
                                 └── the ONLY place ───────┘
                                     literals may live
```

One direction only. A component never defines a token; a page never defines a component's visuals.
That single-direction rule is what the lint rule enforces mechanically.
