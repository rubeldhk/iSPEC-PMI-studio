# D-42 — the component library is built on native elements, not adopted

**Status**: **DECIDED 2026-08-20** by the project owner · **Scope**: EPIC-029, and every Epic that
later consumes the component layer
**Required by**: `PMI-DOC-005` `RULE-05` — *"The component library is chosen by a recorded
decision, evaluated against §6"*
**Discharges**: the `NEEDS CLARIFICATION` left open by design in EPIC-029 research `R-029-6`
**Gates**: EPIC-029 Phase 5 (`T886`–`T894`) and Phase 6 (`T895`–`T900`)

## The decision

**Build the fifteen Phase 1 components on native HTML elements. Take no component-library
dependency.**

`PP-008` — security review of any third-party UI dependency — is therefore **not triggered by this
Epic**. It remains in force for any future proposal to adopt one.

## Why

EPIC-029 research `R-029-6` framed the choice with a cost table concluding that building means
*"weeks, and the accessibility work is the expensive part."* **That framing assumed div-based
components, and it is wrong for this programme**, because `PMI-DOC-005` `UI-0006` sets the browser
floor at the **last two versions of Chrome, Edge, Firefox and Safari**. Every native element the
inventory needs is available across that whole floor.

Against that floor, the fifteen rows of [contracts/components.md](../../029-design-system/contracts/components.md)
divide as:

| Depth | Components | What carries the accessibility |
|---|---|---|
| Native element plus token styling | Button, TextInput, Select, Checkbox, Radio, PageHeader, StatusPill, EmptyState, ErrorState, LoadingIndicator | The element itself — role, keyboard operation and focus are the platform's |
| Native element with known wiring | FormField, Navigation, Table | `aria-describedby`, `aria-current`, real `<table>` semantics |
| Platform solves the hard part | Modal | `<dialog>` gives focus trap, Escape-to-close and an inert backdrop without a line of JavaScript |
| Genuine care required | Toast | `aria-live` politeness and announcement timing |

**Only Toast has depth a library would not simply hand back**, and its difficulty is deciding *when*
to announce — a product judgement, not an implementation the library makes for us.

So the saving from adopting is far narrower than the research table implied. Adopting still requires
fifteen wrappers, every state style and every test; the library would replace the internals of
roughly four components. Set against that saving:

- a third-party surface and a `PP-008` security review;
- a standing upgrade duty for a dependency in the render path of every screen;
- a foreign component API that `contracts/components.md` would have to be **mapped onto** rather
  than simply satisfied — and `FR-DS-030` is explicit that an adopted library *"does not get to
  redefine"* the contract.

Building keeps the visual identity fully open, which `UI-0005` (a neutral palette this Epic derives,
making no brand claim) needs, and leaves the contract as the single source of truth.

## Considered and rejected

**Adopt unstyled primitives** (Radix Primitives, React Aria Components) — the right answer if the
inventory were rich in comboboxes, date pickers and menus. It is not: those are explicitly
[out of Phase 1](../../029-design-system/contracts/components.md). Revisit when a screen needs one.

**Hybrid — adopt for Modal and Select only** — rejected because `<dialog>` already solves Modal and
a native `<select>` already solves Select. The hybrid buys nothing and costs a second idiom in the
codebase plus a `PP-008` review for a two-component subset.

**Defer the component layer to a later Epic** — viable, and rejected because the four delivered
pages need components to restyle onto; deferring would leave `FR-DS-050` unsatisfiable and split
one coherent Epic across two.

## What this obliges

1. Components are built **on native elements**. A div-based reimplementation of something the
   platform provides is a defect against this decision, not a style preference.
2. The accessibility harness (`T880`) and the state-coverage check (`T886`) apply unchanged — a
   native element still has to **prove** it meets `FR-DS-030` and its declared states. Native is
   the starting point, not the evidence.
3. **Revisit per component, not wholesale.** If a Phase 1 component proves intractable natively,
   that is a new decision recorded against this one — not a licence to adopt a library across the
   inventory.

## Consequences

`T890` records this decision, unblocking Phase 5 and Phase 6. EPIC-029 takes exactly one new
dependency — `axe-core`, as a **dev** dependency (`T865`) — and ships no third-party code to a
user's browser.

## Links

- [EPIC-029 research `R-029-6`](../../029-design-system/research.md) — the open question this closes
- [contracts/components.md](../../029-design-system/contracts/components.md) — the inventory and its state matrix
- `SRS/PMI-DOC-005_Design_System_and_UX_Standards_v1.0.md` — `RULE-05`, `UI-0005`, `UI-0006`, `PP-008`
- [D-41](./D-41-the-design-system-waits-on-a-volume-that-does-not-exist.md) — the decision that authorised EPIC-029
