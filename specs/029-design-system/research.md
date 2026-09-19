# Research: Design System (EPIC-029)

**Phase 0** · 2026-08-20 · resolves every `NEEDS CLARIFICATION` in [plan.md](./plan.md)

| ID | Question | Status |
|---|---|---|
| **R-029-1** | Where does the system live — a `packages/` module or inside `frontend/`? | 🟢 Answered |
| **R-029-2** | How is WCAG 2.2 AA actually checked, and what does the tooling really cover? | 🟢 Answered — **with a trap** |
| **R-029-3** | How is contrast verified, given jsdom has no layout? | 🟢 Answered |
| **R-029-4** | What is the minimum supported viewport (`FR-DS-040`)? | 🟢 Answered |
| **R-029-5** | How does a lint rule detect a literal visual value? | 🟢 Answered |
| **R-029-6** | Build or adopt a component library? | 🟢 Answered — **`D-42`, decided 2026-08-20** |

---

## R-029-1 · Where the system lives — answered 🟢

**Decision**: `frontend/src/design/`. Not a `packages/` workspace module.

**Rationale**: the repository reserves `packages/` for code with **more than one consumer** —
`@pmi/execution-contract` is shared by the worker and the Docker provider, `@pmi/observability` by
the API and the worker (that second consumer is precisely what `DEF-001-001` was about). The design
system has exactly one consumer today: `frontend/`. Extracting it now would be a guess about a
second, and the ESLint boundary rules would need an edge for a dependency that does not exist.

**Alternatives considered**: `packages/design-system` — correct the moment a second frontend
appears (an admin surface, a customer portal), and cheap to do then because the token layer has no
imports to rewrite. Recorded so the future move is a decision rather than a discovery.

## R-029-2 · How WCAG 2.2 AA is actually checked — answered 🟢, and it contains a trap

**Decision**: `axe-core` in the existing Vitest `frontend` project (jsdom), run per component and
per page, with the tag set stated **explicitly** and `target-size` **explicitly enabled**.

**The trap, verified against current axe-core documentation (Context7 `/dequelabs/axe-core`,
2026-08-20)** — and it is exactly the failure mode this programme keeps hitting:

- There is **no aggregate tag** for a WCAG level. `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and
  `wcag22aa` are five distinct tags; asking for "WCAG 2.2 AA" means listing all five, because 2.2
  is a superset of 2.1 which is a superset of 2.0.
- **`wcag22aa` contains exactly one rule — `target-size` — and it ships `"enabled": false`.**

So the intuitive configuration `runOnly: ['wcag22aa']` runs **one disabled rule**: zero checks, a
green result, and a suite that reports conformance to a standard it never tested. That is
`DEF-028-003` (a freeze check that never ran) and `DEF-001-004` (a status that could not be wrong)
in a third costume.

**Therefore the tasks MUST**:

1. configure `runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] }`;
2. call `axe.configure()` to **enable `target-size`**, since the WCAG 2.2 delta is otherwise
   untested;
3. carry a **meta-test that asserts the harness detects a known violation** — an unlabelled input,
   say — so the harness itself cannot silently stop working. A check that cannot fail is
   decoration (Constitution V).

**Alternatives considered**: Playwright + `@axe-core/playwright` gives real layout and therefore
real contrast results, but adds a browser runner to CI for an Epic whose components are unit-
testable. Recorded as the natural upgrade when EPIC-015 builds end-to-end coverage.

## R-029-3 · How contrast is verified — answered 🟢

**Decision**: compute contrast **from the token values directly**, in a governance check, rather
than asking axe.

**Rationale**: axe's `color-contrast` rule needs computed layout and canvas, and **jsdom has
neither** — the rule reports "incomplete" rather than pass or fail. A suite relying on it for
`SC-DS-007` would be relying on a result that never arrives. Reading the token file and computing
the WCAG contrast ratio for every declared text-on-surface pair is deterministic, runs in
milliseconds, covers **both themes**, and fails with the pair and the ratio named.

**Alternatives considered**: a real browser (see R-029-2) — better fidelity, disproportionate for
values that are static by construction.

## R-029-4 · Minimum supported viewport — answered 🟢

**Decision**: **360 × 640 CSS pixels**, and layouts must also survive **200% text zoom** without
clipping (WCAG 1.4.4, already in the spec's edge cases).

**Rationale**: 360px is the narrowest width in common current use; below it, layout cost rises
sharply for users this enterprise platform does not have. Stating it once here is the point —
`FR-DS-040` exists because otherwise each screen picks its own and none of them agree.

**Alternatives considered**: 320px (iPhone SE) — defensible, and rejected because no requirement
in the programme names a phone-first journey; the platform's work is desk work. Revisit if a
mobile journey is specified.

## R-029-5 · How the lint rule detects a literal — answered 🟢

**Decision**: an ESLint rule over `frontend/src/**` (excluding `design/tokens.css` and
`design/themes.css`) that fails on hex colours, `rgb()`/`hsl()` literals, and length units outside
a small allowlist, in both stylesheets and inline `style=` props.

**Rationale**: `FR-DS-051` must be enforced by something that fails a build, not by review. The
repository already extends `eslint.config.js` for dependency boundaries (`T541`), so the mechanism
and its test pattern exist.

**Allowlist, stated so it is not invented per-file**: `0`, `1px` (hairlines), `100%`, `100vh`,
`auto`, and `currentColor`. Anything else is a token.

**Mutation requirement**: the rule's test MUST verify it fails on a literal — the rule is itself a
check, and a check that cannot fail is decoration.

## R-029-6 · Build or adopt a component library — answered 🟢

**Decision**: **build**, on native HTML elements, with **no component-library dependency**. Recorded
as [`D-42`](../_shared/decisions/D-42-component-library-build-vs-adopt.md), decided 2026-08-20 by the
project owner, as `PMI-DOC-005` `RULE-05` requires. `PP-008` is **not triggered** — no third-party
UI dependency is taken.

### The table this section first published was wrong

It is left below, struck through, because how it was wrong is the useful part:

| | Adopt (e.g. Radix Primitives, React Aria) | ~~Build~~ |
|---|---|---|
| Accessibility | Inherits focus management, ARIA and keyboard behaviour that take real expertise | ~~Every component must earn WCAG 2.2 AA itself~~ |
| Visual identity | Unstyled primitives leave identity fully open; styled kits constrain it | Complete freedom |
| Dependency | New third-party surface, security review, upgrade duty (`PP-008`) | None |
| Cost | Days | ~~Weeks, and the accessibility work is the expensive part~~ |

**The error: it costed a div-based reimplementation.** Every row about accessibility assumed each
component starts from `<div>` and must build role, keyboard operation and focus from nothing. That
is true only if you decline what the platform already gives you — and `PMI-DOC-005` `UI-0006` puts
the browser floor at the **last two versions of Chrome, Edge, Firefox and Safari**, where every
native element this inventory needs is available.

Against that floor the fifteen rows of [contracts/components.md](./contracts/components.md) divide:

| Depth | Components | What carries the accessibility |
|---|---|---|
| Native element + token styling | Button, TextInput, Select, Checkbox, Radio, PageHeader, StatusPill, EmptyState, ErrorState, LoadingIndicator | The element itself — role, keyboard operation and focus are the platform's |
| Native element + known wiring | FormField, Navigation, Table | `aria-describedby`, `aria-current`, real `<table>` semantics |
| Platform solves the hard part | Modal | `<dialog>` gives focus trap, Escape-to-close and an inert backdrop with no JavaScript |
| Genuine care required | Toast | `aria-live` politeness and announcement timing |

**Only Toast has depth a library would not hand straight back** — and its difficulty is deciding
*when* to announce, a product judgement no dependency makes for us.

So adopting would still require fifteen wrappers, every state style and every test; the library
replaces the internals of roughly four components. Against that narrow saving sit a third-party
surface in the render path of every screen, a `PP-008` review, a standing upgrade duty, and a
foreign API that `contracts/components.md` would have to be **mapped onto** rather than satisfied —
while `FR-DS-030` is explicit that an adopted library *"does not get to redefine"* the contract.

**Alternatives considered**: adopting unstyled primitives is the right answer for an inventory rich
in comboboxes, date pickers and menus. Those are [explicitly out of Phase 1](./contracts/components.md).
Revisit when a screen needs one — per `D-42`, **per component, not wholesale**.

**What this obliges**: components are built on native elements. A div-based reimplementation of
something the platform provides is a defect against `D-42`, not a style preference. Native is the
starting point, **not the evidence** — every component still has to prove `FR-DS-030` and its
declared states through the harness (`T880`) and the state-coverage check (`T886`).

## Docs consulted

| Source | Topic | Library ID |
|---|---|---|
| axe-core | jsdom usage, WCAG tag semantics, `target-size` default state | `/dequelabs/axe-core` (Context7, 2026-08-20) |

Everything else here is decided from repository evidence (`packages/` convention, `eslint.config.js`
precedent, EPIC-010's clarification) rather than from external documentation.
