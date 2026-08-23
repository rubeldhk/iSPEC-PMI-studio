# Contract: Prototype Parity

**EPIC-029** · Phase 9 · which patterns of
[`docs/design/PMI-Studio-V2-Application-Prototype.html`](../../../docs/design/PMI-Studio-V2-Application-Prototype.html)
this Epic adopts, and which it declines — each with its reason.

## Why this contract exists

The prototype is a **reference artifact**, filed 2026-08-21 under `PMI-DOC-004A` Amendment G. Its
own header states three things this contract is built around:

1. its **token values are illustrative** — `PMI-DOC-005` and the implemented token layer are
   authoritative, so a colour or radius here that disagrees with the token layer is wrong by
   definition;
2. it is **not a build target** — screens whose requirements are unowned must not be implemented
   ahead of the Epic that owns them (`PMI-DOC-006` `UX-0060`, `PMI-DOC-004` `RULE-01`);
3. what it *is* good for is showing **one coherent shell** and the interaction patterns in motion.

So the prototype is authoritative over **form and behaviour**, and has no authority over
**values or screens**. That split is the whole of this contract, and it is what "follow the
prototype" resolves to inside an Epic whose scope is `FR-DS-050`/`FR-DS-052` — restyle what
existed at this Epic's start, and nothing else.

## Adopted — the prototype's form, expressed in this Epic's tokens

Each row is a task. The **check** column names what would fail if the row silently regressed;
`frontend/tests/unit/design/prototype-parity.spec.tsx` reads *this table* and asserts each adopted
row is present, the way `T886` reads `components.md`.

| # | Prototype pattern | Where it lives in the prototype | Adopted as | Task |
|---|---|---|---|---|
| 1 | **Canvas behind surfaces** — the page ground is a step below the cards on it | `--bg` vs `--surface` | `--color-canvas` token, themed, contrast-proven | `T915` |
| 2 | **Tinted status tints** — a pill is a wash of its own hue, not an outline | `.pill.ok/.warn/.bad` via `color-mix` | four `--color-*-subtle` tokens (accent, success, warning, danger) — explicit tokens, because `color-mix(… 12% …)` is a literal the rule correctly rejects | `T915` |
| 3 | **Card surface** — bordered, rounded, raised; the dominant container | `.card` / `.card-pad` | `.ds-card` layout class (not a 16th component — the inventory is fixed at fifteen by `T886`) | `T916` |
| 4 | **Page header carries a description** — a title, a sentence saying what the page is for, actions to the right | `.pagehead` `h1` + `p` + `.page-actions` | `PageHeader` gains `description` | `T917` |
| 5 | **Table tools bar** — filtering sits in a bordered bar above the grid, with column headers set small, uppercase and muted on a raised ground | `.table-tools`, `th` | `Table` filter moves into `.ds-table__tools`; header treatment in CSS | `T918` |
| 6 | **Filled status pill** | `.pill` | `StatusPill` tones become tinted grounds | `T919` |
| 7 | **Four button variants, secondary as the default weight** — the prototype's bare `.btn` is a bordered surface control; `primary` is the accent-filled one | `.btn`, `.btn.primary`, `.btn.ghost`, `.btn.danger` | `Button` gains `secondary`; `ghost` becomes genuinely borderless | `T920` |
| 8 | **Modal head / body / foot** — titled header with its own close affordance, actions collected in a footer | `.modalhead` / `.modalbody` / `.modalfoot` | `Modal` gains `actions`; close moves into the header | `T921` |
| 9 | **Vertical primary navigation with counts** — the sidebar's grouped destinations, each able to carry a number | `.nav-item`, `.nav-item .n` | `Navigation` gains `orientation` and per-item `count` | `T922` |
| 10 | **Application shell** — a sticky top bar carrying location and global actions, above a bounded content column | `.topbar`, `.breadcrumb`, `.content` | the shell in `frontend/src/main.tsx`, composed from inventory components only | `T923` (with `T914`) |

## Declined — and why

Declining is the substance of this contract, not its footnote. Each of these is real design work
that the prototype shows well and that **this Epic may not build**.

| Prototype pattern | Why not here |
|---|---|
| The **seventeen navigation areas** (Decision Inbox, Change Room, Defect Room, Agent Runs, Evidence & Compliance, Reports, Governance, …) | `PMI-DOC-006` `UX-0060` and `PMI-DOC-004` `RULE-01`: a screen belongs to the Epic that owns its requirements. Four pages existed when this Epic started; those four are its restyle scope (`FR-DS-050`, `FR-DS-052`) |
| **Tabs**, tooltip, drawer, combobox, date picker, accordion, pagination | [`components.md`](./components.md) puts each deliberately out of Phase 1. They arrive when a screen needs them, against that same contract |
| **Metric tiles, kanban board, timeline, flow stepper, AI box, callout, dependency graph** | Screen patterns for unowned screens — `PMI-DOC-005` `RULE-03` ("this document defines standards; Epics own their screens") |
| **Command palette** (`⌘K`) | A product capability with its own requirements, owned by no Epic yet. Not a design-system component |
| **Workspace / project switcher** in the sidebar | EPIC-004 owns workspace scoping; the shell may not invent its selector |
| The prototype's **token values** (`#3558d4`, `--r:10px`, the 4/8/12/16/24/32 space scale) | The prototype's own header rules them illustrative. `FR-DS-003` requires a *fixed ratio* scale, which the prototype's is not, and `SC-DS-007` requires computed AA, which its values were never checked against |
| The prototype's **focus ring** (`box-shadow: 0 0 0 3px rgba(accent,.22)`) | The token layer's `outline` treatment is already proven ≥3:1 on every surface in both themes (`T882`) and is the indicator the recorded keyboard evidence describes. A translucent ring would have to re-earn both |
| **`Inter`** as the type face | No font is a dependency of this platform, and adding a network-loaded one is a decision (`PP-008` territory), not a restyle |

## What a future Epic inherits

A screen Epic that needs one of the declined patterns builds it **against `components.md`** — the
state matrix, the native-element table, the axe harness and the literal-value rule apply to it
unchanged. This contract does not reserve that work; it records that EPIC-029 was not the Epic
entitled to do it.
