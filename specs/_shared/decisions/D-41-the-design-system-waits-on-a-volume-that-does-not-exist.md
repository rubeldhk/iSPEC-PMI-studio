# D-41 — the design system waits on a volume that does not exist

**Status**: **DECIDED AND DISCHARGED 2026-08-20** by the project owner · **Scope**: programme-wide
**Supersedes the trigger of**: RAID `D-J` ("Revisit when Volume 8 exists")
**Raised by**: the second local UAT session, from a question about design and UI coverage

## The finding

Four documents defer the platform's design system to **SRS Volume 8**:

| Document | What it says |
|---|---|
| `specs/_shared/dependencies.md` | *"No component library is listed deliberately — SRS Volume 8 defines a design system that does not exist yet."* |
| `specs/_shared/raid-log.md` (`D-J`) | *"Phase 1 UI is deliberately plain; no component library chosen. **Revisit when Volume 8 exists**."* |
| `specs/_shared/research.md` | *"a UI framework decision now, standards when the design system arrives (SRS Volume 8)."* |
| `specs/010-specification-interface/spec.md` | *"No component library is chosen. SRS Volume 8 defines a design system that does not exist yet; picking one now would pre-empt it."* |

**The Master Product Specification has six volumes.** `SRS/new/` contains Volumes 1–6 — Executive
Vision, Core Platform Domains, AI Platform, Engineering Platform, Reference Architecture,
Implementation Framework. There is no Volume 7, and no Volume 8. The reference is to a document
that was never planned, not one that is late.

So `D-J`'s trigger can never fire. The deferral is not a deferral; it is a permanent silence with
the appearance of a schedule — and it holds down an obligation the programme's own standard
imposes: `PMI-DOC-000` §1 lists **UI/UX** among the mandatory deliverables, and
`PMI_Studio_Module_Based_Requirements_and_Epics` repeats it for all sixteen modules.

Meanwhile 39 UI implementation tasks across 13 Epics build pages with no shared visual language,
and the first UAT session rendered exactly that: browser-default type and controls.

## The decision

**Volume 8 is not coming. The design system gets its own document and its own Epic.**

1. **`D-J`'s trigger is void.** It is replaced by this record: the design system is owned work,
   scheduled like any other, not a wait.
2. **`PMI-DOC-005 — Design System & UX Standards`** becomes the authority the four documents above
   were pointing at, in the `PMI-DOC-00x` series governed by `PMI-DOC-000`. Markdown is
   authoritative (`PMI-DOC-000` §7), as `PMI-DOC-004` established.
3. **A design Epic is declared** to implement it. Until that Epic lands, "no component library
   chosen" remains correct and the four citations stay true — they simply point at
   `PMI-DOC-005` instead of a phantom.
4. **What is already settled stays settled.** EPIC-010 clarified **WCAG 2.2 Level AA** on
   2026-08-19 with automated CI checks plus a manual keyboard and screen-reader pass at Epic exit.
   `PMI-DOC-005` inherits that target; it does not get to redefine it.

## Why decide this before writing the document

The same shape as `D-40`, found the same day: a configuration pointing at something that is not
there, with nobody owning the difference. `emitDecoratorMetadata` was set while nothing compiled
with `tsc`; the design system was deferred to a volume nobody wrote. In both cases the artifact
read as though the question had an owner, and it did not.

Writing `PMI-DOC-005` without this record would leave four documents still citing Volume 8 and no
statement anywhere that the citation was wrong. The document is the answer; this is the record
that the previous answer was a phantom.

## Consequences

- `PMI-DOC-005` must be written and approved (owner: project owner), then the four citations above
  updated to point at it.
- A design Epic enters the register through the normal chain — it does not become Ready by
  declaration (EPIC-026 gate).
- The 39 existing UI tasks are **not** blocked by this. They ship plain, and are restyled when the
  design system lands — the cost the programme already accepted when it chose to proceed without
  a component library.

## Discharged — 2026-08-20

Every consequence this decision named is complete, the same day it was taken:

- **`PMI-DOC-005` written and approved v1.0** by the Project Owner, with the four requirements
  EPIC-029's clarification session settled back-filled at approval (`UI-0005` palette source,
  `UI-0006` browser floor, `UI-0035` accessibility evidence, `RULE-04` restyle ownership) —
  Constitution II satisfied rather than deferred.
- **All four Volume 8 citations repointed**: `dependencies.md`, `research.md`,
  `010-specification-interface/spec.md`, and `ai-native-architecture.md` — one more than this
  record originally listed. Each keeps a note of what it used to say, so the correction is visible
  rather than silent.
- **`RAID D-J` discharged**: its trigger fired, which is what it could never do while it pointed at
  a volume nobody wrote.
- **EPIC-029 declared** and taken through specify → clarify → plan → tasks → analyze, with 42 tasks
  and one CRITICAL finding already remediated.

**What remains is one decision, and it has an owner**: `D-42`, the component-library build-vs-adopt
choice, is EPIC-029 `T890` at the head of Phase 5. Twenty-one of the Epic's tasks do not wait on it.
