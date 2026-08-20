# Research: Design System (EPIC-029)

**Phase 0** · 2026-08-20 · resolves every `NEEDS CLARIFICATION` in [plan.md](./plan.md)

| ID | Question | Status |
|---|---|---|
| **R-029-1** | Where does the system live — a `packages/` module or inside `frontend/`? | 🟢 Answered |
| **R-029-2** | How is WCAG 2.2 AA actually checked, and what does the tooling really cover? | 🟢 Answered — **with a trap** |
| **R-029-3** | How is contrast verified, given jsdom has no layout? | 🟢 Answered |
| **R-029-4** | What is the minimum supported viewport (`FR-DS-040`)? | 🟢 Answered |
| **R-029-5** | How does a lint rule detect a literal visual value? | 🟢 Answered |
| **R-029-6** | Build or adopt a component library? | 🔴 **OPEN by design — decision `D-42`** |

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

## R-029-6 · Build or adopt a component library — OPEN 🔴

**Deliberately unresolved.** `PMI-DOC-005` `RULE-05` requires this be recorded as decision `D-42`,
with security review if a dependency is adopted (`PP-008`).

**What is already known, so the decision has inputs rather than opinions**:

| | Adopt (e.g. Radix Primitives, React Aria) | Build |
|---|---|---|
| Accessibility | Inherits focus management, ARIA and keyboard behaviour that take real expertise | Every component must earn WCAG 2.2 AA itself |
| Visual identity | Unstyled primitives leave identity fully open; styled kits constrain it | Complete freedom |
| Dependency | New third-party surface, security review, upgrade duty (`PP-008`) | None |
| Cost | Days | Weeks, and the accessibility work is the expensive part |

**What this Epic can do without it**: tokens, themes, the lint rule, the accessibility harness, the
contrast check, and the viewport decision — everything in `F-29.1` and `F-29.2`. Only the component
layer and the restyling wait.

## Docs consulted

| Source | Topic | Library ID |
|---|---|---|
| axe-core | jsdom usage, WCAG tag semantics, `target-size` default state | `/dequelabs/axe-core` (Context7, 2026-08-20) |

Everything else here is decided from repository evidence (`packages/` convention, `eslint.config.js`
precedent, EPIC-010's clarification) rather than from external documentation.
