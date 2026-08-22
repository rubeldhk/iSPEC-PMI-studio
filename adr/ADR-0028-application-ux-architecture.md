# ADR-0028 — Application UX architecture as a document separate from the design system

**Status**: Accepted
**Date**: 2026-08-21
**Deciders**: Project owner · design (EPIC-029) · tech lead

> Created by **PMI-DOC-004 v2.0** under PMI-DOC-004A §12 decision 11 and §14 decision 6.

## Context

PMI-DOC-005 declares screen design out of scope, and it is right to. It is a token and component
standard: 46 tokens implemented and verified in-browser, zero contrast failures across both themes.

PMI-DOC-004A `G-30` records the consequence — this is *"not a defect in DOC-005, but a missing
artifact"*. Nothing owned the question of what screens exist and how a user moves between them.

The cost was already paid before the gap was named. `docs/design/PMI-Studio-Product-Screens.md` §0
records that **nine page components exist and four are reachable**: `Specification`,
`SpecificationList`, `Tasks`, `ReviewSession` and `StorageConnections` are built, tested, and
imported by nothing (`DEF-010-001`). Five screens were built to specification and never connected,
because the navigation decision had no owner.

PMI-DOC-004 v2.0 then adds seventeen navigation areas and three Rooms that must share one
interaction model (`BR-0190`, `BR-0191`) — considerably more structure to get wrong.

`G-32` is the same problem at a different scale: PMI-DOC-005 delegates viewport to each Epic, so
every Epic can pick a different minimum width independently.

## Decision

**Create PMI-DOC-006 Application UX Architecture. Keep PMI-DOC-005 screen-agnostic.**

The split is by **rate of change and by authority**, not by convenience:

| Document | Owns | Changes when |
|---|---|---|
| **PMI-DOC-005** | Tokens, type, spacing, color, component appearance and states, accessibility standards | The visual language changes |
| **PMI-DOC-006** | Navigation structure, application shell, Room pattern, cross-cutting surfaces, shell viewport policy, screen states | The product's capability structure changes |
| **Each Epic spec** | Field-level layout within its screens | That capability changes |
| **`docs/design/`** | Mockups and screen inventory as they exist today | Drawings are made |

**Precedence.** On appearance, PMI-DOC-005 wins. On structure, PMI-DOC-006 wins. On either against
business requirements, PMI-DOC-004 wins (Constitution II).

**Three rules are placed in PMI-DOC-006 because nowhere else could hold them:**

1. **Reachability** (`UX-0003`) — every navigation area must be reachable from primary navigation. A
   built screen nothing links to is a defect. This is the rule whose absence produced
   `DEF-010-001`.
2. **One shell viewport policy** (`UX-0040`, `UX-0041`) — minimum 360px, three breakpoints, and an
   Epic may not raise the minimum. This closes `G-32` by making the decision once.
3. **One Room pattern** (`UX-0030`, `UX-0035`) — Requirement, Change and Defect Rooms share six
   required regions, because they are three instances of one Governed Engineering Loop
   (`ADR-0018`). If one Room needs a seventh region, the pattern changes for all three.

The V2 prototype is filed as a **reference artifact**, explicitly not a specification and not the
design system (PMI-DOC-006 §3). Its token values are illustrative; `G-31` already ruled that the
design Epic implements the real ones.

## Consequences

**Positive** — the reachability rule is mechanizable (`G-UX-01`), turning the `DEF-010-001` class of
defect from something noticed during a design audit into something CI can fail on.

**Positive** — PMI-DOC-005 stays small and stable. A navigation change no longer requires touching
the token standard, and a token change no longer implies a product decision.

**Negative** — four documents now describe the interface, and a reader must know which one answers
their question. The precedence table above is the mitigation; it will still be got wrong sometimes.

**Negative** — PMI-DOC-006 specifies areas whose Epics do not exist (`UX-0060` forbids building
them). Designing ahead of ownership risks the design being wrong by the time the Epic is declared —
accepted deliberately, because the alternative is what already happened: unreachable screens
delivered one Epic at a time.

## Traceability

PMI-DOC-004 v2.0 §6.20 (`BR-0190`–`BR-0195`) · PMI-DOC-004A `G-30`, `G-31`, `G-32`, `G-33`, `G-34`,
Amendment G, §14 decision 6 · PMI-DOC-005 (upheld, unchanged) · PMI-DOC-006 (created) ·
`EPIC-029` (design system, delivered) · `DEF-010-001` (unreachable screens) · `ADR-0018` (Room
pattern derives from the loop)
