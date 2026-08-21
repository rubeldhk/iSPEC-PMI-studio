# PMI-DOC-005 — Design System & UX Standards

**Document ID**: PMI-DOC-005 · **Version**: 0.1 (DRAFT — awaiting owner approval)
**Owner**: Project Owner (Product) · **Author**: drafted with Claude, 2026-08-20
**Depends on**: PMI-DOC-000 (structure, identifiers), PMI-DOC-001 (vision), PMI-DOC-003 (principles)
**Authorised by**: decision [`D-41`](../specs/_shared/decisions/D-41-the-design-system-waits-on-a-volume-that-does-not-exist.md)

> **Why this document exists.** Four programme documents defer the design system to *SRS Volume 8*.
> The MPS has six volumes; Volume 8 was never written. `D-41` ruled that the deferral was pointing
> at a phantom and that the design system gets its own document and its own Epic. This is that
> document — it replaces the citation, and it is what `RAID D-J` now waits on.

## 1. Executive Summary

PMI Studio has 39 UI implementation tasks across 13 Epics, four delivered pages, two components —
and **no stylesheet of any kind**. Local UAT on 2026-08-20 rendered the product in browser-default
Times New Roman with unstyled controls, which is the absence of this document made visible.

This document defines the standards every interface in the platform is built to: the token system
colour and type are expressed in, the accessibility bar (inherited, not renegotiated), the states
every component must implement, and the rules that keep a UI built by many Epics reading as one
product. It defines **standards, not screens** — screen design belongs to the Epics that own each
capability.

## 2. Business Objective

Serves **BG-01** (reduce ambiguity), **BG-05** (enterprise governance) and **BG-06** (reduce rework)
from `PMI-DOC-004`:

| Goal | How a design system serves it |
|---|---|
| BG-06 | 13 Epics each inventing spacing, colour and states is rework by construction — the second Epic pays for the first Epic's absence of a standard |
| BG-05 | Accessibility and consistency are auditable properties; without a stated bar they are opinions |
| BG-01 | A named component with defined states is unambiguous in a specification; "a button" is not |

## 3. Scope

**In scope**: design tokens (colour, type, space, radius, elevation, motion); the component
inventory Phase 1 requires and each component's mandatory states; accessibility standards and how
they are tested; layout and responsive rules; content and microcopy conventions; the theming
contract (light and dark).

**Out of scope**: brand identity, logo and marketing design; per-screen visual design (owned by the
Epic that owns the capability); a design tool workflow (Figma or otherwise) — this document
governs what ships in code, and code is the source of truth (`PMI-DOC-000` §7).

**Deferred, with the decision named** — see §7 `RULE-05`: the component-library choice. This
document defines what any library must satisfy; it does not pick one.

## 4. Stakeholders

Project Owner (approves) · Product Management · Engineering (implements; consumes tokens) ·
QA (tests the accessibility gate) · Security (reviews any third-party UI dependency) ·
Enterprise Customers (the accessibility obligation is often theirs, contractually).

## 5. Definitions

| Term | Meaning |
|---|---|
| **Design token** | A named design decision (`--space-3`, `--color-danger`) with one definition, consumed everywhere. The unit this document standardises |
| **Component** | A reusable interface element with defined states and a defined contract |
| **State** | A condition a component must visibly express: default, hover, focus, active, disabled, loading, error, empty |
| **Theme** | A complete token set. Two are required: light and dark |

## 6. Requirements

Identifiers per `PMI-DOC-000` §3 (`UI-xxxx`, corpus-wide, four digits).

### 6.1 Tokens

- **UI-0001** — Every colour, type size, space, radius and duration used by the interface MUST be a
  token. A literal value in a component is a defect, detectable by a lint rule.
- **UI-0002** — Tokens MUST be defined once, in one file, and consumed by reference. Two definitions
  of the same decision is the drift this document exists to prevent.
- **UI-0003** — The space scale MUST be a fixed ratio scale, not ad-hoc values, so vertical rhythm
  is a consequence of the system rather than of each author's judgment.
- **UI-0004** — The type scale MUST define at most seven sizes with their line heights and weights.
  A scale nobody can hold in mind is not a scale.

### 6.2 Themes

- **UI-0010** — Light and dark themes MUST both be complete: every token defined in both, no
  component defining a colour only for one.
- **UI-0011** — Theme selection MUST honour the operating-system preference by default and allow an
  explicit override that persists.
- **UI-0012** — Colour MUST NOT be the sole carrier of meaning (WCAG 1.4.1); status is expressed by
  shape, icon or text as well.

### 6.3 Components

- **UI-0020** — A component MUST implement every state in §5 that applies to it. A control with no
  visible focus state fails this and the accessibility gate.
- **UI-0021** — Every asynchronous surface MUST define its **loading**, **empty** and **error**
  presentations. The first UAT session met an error state reading *"An unexpected error occurred"*
  with no recovery path — permitted by no requirement, prevented by none either, until now.
- **UI-0022** — Error presentations MUST say what went wrong and what to do next; they MUST NOT
  expose internal detail (mirrors `ErrorFilter`'s server-side rule).
- **UI-0023** — Phase 1 component inventory: button, text input, select, checkbox, radio, form
  field with label and error, table, empty state, error state, loading indicator, modal, toast,
  navigation, page header, badge/status pill.

### 6.4 Accessibility

- **UI-0030** — **WCAG 2.2 Level AA.** Inherited from EPIC-010's clarification of 2026-08-19 and
  **not renegotiable by this document** — a later component library must meet it; it does not get
  to redefine it.
- **UI-0031** — Automated accessibility checks MUST run in CI on every page and component.
- **UI-0032** — A manual keyboard and screen-reader pass MUST be recorded at each UI-bearing Epic's
  exit. Automated checks cannot see focus order or announcement quality.
- **UI-0033** — Every interactive element MUST be reachable and operable by keyboard alone, with a
  visible focus indicator meeting contrast requirements.

### 6.5 Layout and content

- **UI-0040** — Layouts MUST be responsive to a stated minimum viewport; the minimum is a decision
  recorded in the implementing Epic, not assumed per screen.
- **UI-0041** — Every data table MUST offer filtering. A table a user cannot narrow is a list they
  must read.
- **UI-0042** — Controls MUST state what happens and confirmations MUST state what happened — a
  `Save` control pairs with a `Saved` confirmation, not a generic `Success`. **Testable**, and
  asserted by EPIC-029 `T888a`.
- **UI-0043** — Microcopy SHOULD name things as a user recognises them, not as the system
  implements them (a person manages *notifications*, not *webhook config*). **A convention, not
  a requirement** — split from `UI-0042` on 2026-08-20 by EPIC-029's analysis pass (`C1`),
  because no check can fail on it and Constitution V holds that manual review does not satisfy
  a requirement. Stating it as SHOULD is honest; stating it as MUST would have been a
  requirement no Epic could ever discharge.

## 7. Business Rules

- **RULE-01** — Tokens are the only source of visual values (UI-0001/0002).
- **RULE-02** — WCAG 2.2 AA is a floor, never a target to negotiate down (UI-0030).
- **RULE-03** — This document defines standards; Epics own their screens. A screen decision does
  not belong here, and a standard does not belong in a screen.
- **RULE-04** — Existing UI ships plain and is restyled when this system lands. No Epic is blocked
  by this document (`D-41`).
- **RULE-05** — **The component library is chosen by a recorded decision**, evaluated against §6.
  Build-vs-adopt is genuinely open: adopting inherits accessibility work and constrains visual
  identity; building inverts both. Whoever decides records why, as `D-42`.

## 8. Constraints

- React 18 is the frontend (`ai-native-architecture.md`); any library must suit it.
- No component library is currently a dependency — deliberately (`dependencies.md`), and that
  remains true until `RULE-05`'s decision.
- Security review applies to any third-party UI dependency (`PP-008`).
- The 20 principles of `PMI-DOC-003` bind this document as they bind every other.

## 9. Dependencies

- **Upstream**: `PMI-DOC-000`, `PMI-DOC-001`, `PMI-DOC-003`, `PMI-DOC-004` (BG-01/05/06); decision
  `D-41`.
- **Downstream**: the design Epic that implements this; EPIC-010 and the 12 other Epics carrying UI
  tasks; `RAID D-J`, whose trigger is now this document's approval.

## 10. Acceptance Criteria

1. Every §6 requirement is testable — by a lint rule, an automated accessibility check, or a
   recorded manual pass. A requirement with no such route is rewritten or removed.
2. `RAID D-J` cites this document, and the four Volume-8 citations are corrected (`D-41`).
3. The implementing Epic can be specified from §6 without asking what a token or a state means.
4. WCAG 2.2 AA appears exactly once as a normative statement (UI-0030) — restated nowhere, so it
   cannot drift.

## 11. Traceability

`BG-01 / BG-05 / BG-06` (`PMI-DOC-004` §2) → `UI-0001`–`UI-0042` (§6) → design Epic → its features,
tasks, and the lint/CI checks that enforce them → the 13 Epics carrying UI tasks, which consume the
tokens and components.

## 12. Related Documents

`PMI-DOC-000` (standard) · `PMI-DOC-001` (vision) · `PMI-DOC-003` (principles) ·
`PMI-DOC-004` (BRS) · [`D-41`](../specs/_shared/decisions/D-41-the-design-system-waits-on-a-volume-that-does-not-exist.md) ·
`specs/010-specification-interface/spec.md` (WCAG 2.2 AA clarification) · `specs/_shared/raid-log.md` (`D-J`)

## 13. Revision History

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-08-20 | Initial draft under `D-41`: 20 requirements across tokens, themes, components, accessibility, layout and content; component-library choice deferred to a named decision (`RULE-05`) |
| 0.1.1 | 2026-08-20 | `UI-0042` split by EPIC-029 analysis `C1`: the testable half stays a requirement, the naming half becomes `UI-0043`, a SHOULD convention — a MUST no check can fail is one no Epic can discharge |
