# PMI Studio — Design Brief for Figma

**Purpose**: everything needed to build mockups of PMI Studio without reading the codebase.
**Generated**: 2026-08-21 from the **implemented** design system, not from a proposal.
**Sources**: `SRS/PMI-DOC-005` (`UI-0001`–`UI-0043`), EPIC-029 `spec.md` (`FR-DS-*`, `SC-DS-*`),
`contracts/tokens.md`, `contracts/components.md`, and the built token layer itself.

> **Every value below is real.** The design system is implemented and verified in a browser —
> 46 tokens, all resolving, zero contrast failures across 56 text elements in both themes. These are
> not suggestions to design against; they are what the product currently renders.

> ### ⚠️ Two sections are known stale as of 2026-08-21
>
> After this brief was generated, `T905` wired the theme system to the application root and added a
> **`ThemeControl`** ("Follow system / Light / Dark", built from FormField + Select) inside a new
> **`.ds-app-bar`** that wraps **every** view.
>
> - **§7 Component inventory** lists fifteen components. `ThemeControl` is a sixteenth surface —
>   a *composition* of two existing components rather than a new primitive, but it appears on
>   every screen and should be mocked.
> - **§8 Screens** describes no top bar. Every screen now has one.
>
> **The tokens, type scale, spacing, radius, elevation and motion in §3–§6 are unaffected** — those
> are the token layer, and `T905` added no tokens. Design against them with confidence; treat the
> screen inventory as needing one revision.
>
> This brief is generated from the built system, so it is only ever as current as the tree it was
> read from. It will be regenerated once EPIC-029 stops changing.

---

## 1. What PMI Studio is

A specification-driven delivery platform. Teams capture **requirements**, generate and version
**specifications** from them, track **traceability** between the two, and run AI **generation jobs**
against them. Enterprise, multi-tenant, desk work — **not** a phone-first product.

**Design temperament**: restrained and utilitarian. Dense information, long sessions, high
legibility. The palette makes **no brand claim** (`FR-DS-005`); it is a neutral system palette
chosen so it can be replaced by a real brand later without touching a single component.

---

## 2. Non-negotiable constraints

Break any of these and the mock cannot be built as drawn.

| Constraint | Value | Source |
|---|---|---|
| Accessibility | **WCAG 2.2 Level AA** | `FR-DS-030` |
| Text contrast | ≥ **4.5:1** normal, ≥ **3:1** large (≥24px, or ≥18.66px bold) | `SC-DS-007` |
| Focus indicator contrast | ≥ **3:1** against every surface it sits on | `FR-DS-033` |
| Minimum viewport | **360 × 640** — no horizontal page scroll | `FR-DS-040` |
| Text zoom | Must survive **200%** with no clipping or overlap | WCAG 1.4.4 |
| Colour alone | **Never** the sole carrier of meaning — always text or icon too | `FR-DS-012` |
| Themes | **Light and dark, both complete.** Every colour token has both values | `FR-DS-010` |
| Browsers | Last two versions of Chrome, Edge, Firefox, Safari | `UI-0006` |

**Wide content scrolls inside its own container.** Tables never make the page scroll sideways.

---

## 3. Colour tokens — use these exact values

Colours are named by **role, never by hue**. There is no `blue-500`; there is `--color-accent`.
Re-theming works because no component knows what colour anything is.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--color-text` | `#1a1d21` | `#e5e7eb` | Body text, headings |
| `--color-text-muted` | `#4b5563` | `#9ca3af` | Secondary text, hints, captions |
| `--color-surface` | `#ffffff` | `#111827` | Page background |
| `--color-surface-raised` | `#f3f4f6` | `#1f2937` | Cards, table headers, panels |
| `--color-border` | `#d1d5db` | `#374151` | Dividers, input borders, table rules |
| `--color-accent` | `#1d4ed8` | `#60a5fa` | Primary buttons, links, active state |
| `--color-on-accent` | `#ffffff` | `#111827` | Text **on** an accent fill |
| `--color-danger` | `#b91c1c` | `#f87171` | Errors, destructive actions |
| `--color-success` | `#166534` | `#4ade80` | Success, healthy status |
| `--color-warning` | `#854d0e` | `#facc15` | Warnings, degraded status |
| `--color-focus` | `#1d4ed8` | `#60a5fa` | Focus ring |

**In Figma**: create these as two colour-variable modes — `Light` and `Dark` — on one collection.
Every fill in the mock should reference a variable, never a raw hex.

> **Dark is not an inversion.** Accent *lightens* (`#1d4ed8` → `#60a5fa`) and `--color-on-accent`
> *darkens*, because contrast must hold in both directions. Do not derive dark by flipping light.

---

## 4. Type scale — five steps, ceiling of seven

**Family**: `system-ui, -apple-system, "Segoe UI", sans-serif`.
In Figma use **Inter** (or SF Pro / Segoe UI) as the closest proxy.

| Step | Size | Line height | Weight | Use |
|---|---|---|---|---|
| `type-1` | **12px** | 16px | 400 | Captions, table meta, badge text |
| `type-2` | **14px** | 20px | 400 | Secondary text, labels, dense table cells |
| `type-3` | **16px** | 24px | 400 | Body — the default |
| `type-4` | **20px** | 28px | 600 | Section headings |
| `type-5` | **24px** | 32px | 600 | Page titles |

Five steps are defined against a ceiling of seven (`FR-DS-004`). **Do not invent a sixth.** If a
mock seems to need one, it is usually asking for a weight or colour change instead.

---

## 5. Spacing — a fixed 1.5 ratio

Not an ad-hoc set (`FR-DS-003`). Every gap, pad and margin comes from here.

| Token | rem | **px** |
|---|---|---|
| `--space-0` | 0 | **0** |
| `--space-1` | 0.25 | **4** |
| `--space-2` | 0.375 | **6** |
| `--space-3` | 0.5625 | **9** |
| `--space-4` | 0.84375 | **13.5** |
| `--space-5` | 1.265625 | **20.25** |
| `--space-6` | 1.8984375 | **30.5** |
| `--space-7` | 2.84765625 | **45.5** |
| `--space-8` | 4.271484375 | **68.5** |

The fractional pixels are real — the ratio is geometric, not rounded. Round only for drawing, and
keep the token name as the source of truth.

## 6. Radius, elevation, motion

**Radius**: `sm` 4px · `md` 6px · `lg` 8px · `full` 9999px (pills, avatars)

**Elevation** — themed, because shadows behave differently on dark surfaces:

| Token | Light | Dark |
|---|---|---|
| `--elevation-0` | none | none |
| `--elevation-1` | `0 1px 2px rgba(17,24,39,.08)` | `0 1px 2px rgba(0,0,0,.4)` |
| `--elevation-2` | `0 2px 8px rgba(17,24,39,.12)` | `0 2px 8px rgba(0,0,0,.5)` |
| `--elevation-3` | `0 8px 24px rgba(17,24,39,.16)` | `0 8px 24px rgba(0,0,0,.6)` |

**Motion**: `fast` 100ms · `base` 200ms · `slow` 400ms — all zeroed under
`prefers-reduced-motion`, and **only durations change**; layout must not move.

**Focus ring**: `2px solid var(--color-focus)`, `outline-offset: 2px`. Global, not per-component.
Show it on keyboard focus only — not on mouse click.

---

## 7. Component inventory — fifteen, with required states

The **states column is the contract**. A mock of a component should show every state its row
declares, because each is implemented and tested.

**D**efault · **H**over · **F**ocus · **A**ctive · **Di**sabled · **L**oading · **E**rror · **Em**pty

| # | Component | D | H | F | A | Di | L | E | Em | Notes for the mock |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Button | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | Loading **keeps its label** — a spinner replacing text loses the announcement |
| 2 | TextInput | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | — | Error pairs with FormField's message |
| 3 | Select | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | Native dropdown. Empty = no options to choose |
| 4 | Checkbox | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | — | Indeterminate is a *value*, not a state |
| 5 | Radio | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | — | Grouped |
| 6 | FormField | ✓ | — | — | — | ✓ | — | ✓ | — | Owns label, hint and the error message |
| 7 | Table | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | **Must offer filtering.** Row hover and row focus are *distinct* |
| 8 | EmptyState | ✓ | — | — | — | — | — | — | — | Explains **why** empty and what to do next |
| 9 | ErrorState | ✓ | — | — | — | — | — | — | — | Says what went wrong and what to do; **no internal detail** |
| 10 | LoadingIndicator | ✓ | — | — | — | — | — | — | — | Must not block unrelated interaction |
| 11 | Modal | ✓ | — | ✓ | — | — | ✓ | ✓ | — | Focus trapped on open, restored on close; Escape closes |
| 12 | Toast | ✓ | ✓ | ✓ | — | — | — | ✓ | — | Announced politely; never the only carrier of an error |
| 13 | Navigation | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | Current location marked by **more than colour** |
| 14 | PageHeader | ✓ | — | — | — | — | ✓ | — | — | Title, optional actions |
| 15 | StatusPill | ✓ | — | — | — | — | — | — | — | Status by **text or icon as well as colour** |

**Deliberately not in scope**: tabs, accordion, date picker, combobox, tooltip, drawer, pagination.
Each is real accessibility work and none is required by a delivered screen. **Do not mock them** —
they would imply a commitment that does not exist.

All fifteen are built on **native HTML elements** (decision `D-42`) — `<button>`, `<input>`,
`<select>`, `<dialog>`, `<table>`, `<nav>`. This matters for a mock because it constrains behaviour:
the Select is a native dropdown, not a custom popup.

---

## 8. Screens

### In scope — styled, and the ones to mock first

| Screen | Content |
|---|---|
| **Sign in** | Centred card. App title, Email, Password, primary "Sign in". Error on failure |
| **Projects** | Page title. Create-project form (name + Create). List of projects |
| **Project / Requirements** | Back link, project title, Archive. Rename form. Engine selector. Traceability link. **Requirements table** with Type / Priority / Status filters, plus a "New requirement" form (Description, Type, Priority, Save) |
| **Traceability** | Coverage view — which requirements are covered by which specifications |

**Requirements table columns**: Reference (`REQ-001`), Description, Type, Priority, Status.
**Type**: business · functional · non_functional · constraint
**Priority**: p1 · p2 · p3 **Status**: active · retired

Every one of those renders as **text**, not colour alone.

**Real empty-state copy**, worth matching in tone:

> **No requirements match.**
> Nothing in this project fits the filters above — clear one to widen the search.

That is the standard: say why, and say what to do next.

### Out of scope — do not mock as styled

`Specification`, `SpecificationList`, `Tasks`, `ReviewSession`, `StorageConnections`, and the
components `JobProgress`, `LifecycleControls`, `ValidationFindings`, `VersionDiff`,
`VersionHistory`, `AccessGrants`.

These are **deliberately** unstyled today: `FR-DS-052` gives each Epic responsibility for styling its
own UI. Mocking them now would design work nobody has specified. If you want them designed, that is
a **new scope decision**, not an omission to fill in.

---

## 9. Voice — microcopy rules

- Controls say **what happens**; confirmations say **what happened**. `Save` pairs with `Saved`,
  never a generic `Success` (`FR-DS-042`).
- Name things as a **user** recognises them, not as the system models them (`FR-DS-043`, a SHOULD).
- Errors: what went wrong, what to do next, and **never** an internal detail — no stack traces, no
  SQL, no connection strings (`FR-DS-022`).

---

## 10. What to deliver back

1. **Both themes** for every screen — dark is not optional and not an inversion.
2. **360px** width for every screen, alongside desktop.
3. Every component state from §7 that its row declares.
4. Colour applied via **variables**, so a future brand swaps values not components.
5. Any new visual value called out explicitly — the build **fails** on a literal colour, size,
   space, radius or duration outside the token file (`FR-DS-051`). A mock that needs a value not in
   §3–§6 is a **token request**, and should be raised as one rather than drawn silently.

## Verification already in place

Not aspirations — these run and can fail:

- axe-core over every page and component, all five WCAG tags, `target-size` explicitly enabled
- Contrast computed from token values, both themes, every text-on-surface pair
- A lint rule failing the build on any literal visual value outside the token file
- A browser UAT: 46/46 tokens resolving, 56 text elements, **zero** contrast failures both themes,
  360px clean at 100% and 200% zoom
