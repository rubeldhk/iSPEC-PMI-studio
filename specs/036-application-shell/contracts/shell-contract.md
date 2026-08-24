# Contract: the application shell

**Epic**: `EPIC-036` · **Phase**: 1 · **Date**: 2026-08-24 · **Plan**: [../plan.md](../plan.md)

What the shell exposes, what it consumes, and what it must never contain. Entities in
[data-model.md](../data-model.md); decisions in [research.md](../research.md).

---

## 1. The area registry — one declaration, three consumers

```ts
export type AreaGroup = 'overview' | 'intent-and-control' | 'delivery' | 'platform';

/**
 * Three states, not two. `declared-not-delivered` is an area whose Epic IS
 * declared but whose screen does not exist — see data-model.md and the C1
 * finding in analysis.md. A boolean could not hold it, and the value it was
 * forced into required an `element` nothing could supply.
 */
export type AreaStatus = 'delivered' | 'declared-not-delivered' | 'undeclared';

export interface Area {
  readonly id: string;
  readonly group: AreaGroup;
  readonly label: string;
  /** The address. Unique, leading `/`. */
  readonly path: string;
  /** The Epic that owns this area's content, or null where PMI-DOC-006 names no owner. */
  readonly epic: string | null;
  readonly status: AreaStatus;
  /** What renders. Present ONLY when `status` is 'delivered'. */
  readonly element?: () => ReactElement;
}

export const AREAS: readonly Area[];
```

**Six areas are `delivered`, three are `declared-not-delivered`, nine are `undeclared`.** Only the
first six reach navigation and the route tree. The middle three carry their owning Epic's
identifier so the outstanding obligation has a name rather than disappearing.

**Navigation, the route tree and `FR-SHL-016`'s check all read `AREAS` and nothing else.** That is
the whole point of the shape: `SC-SHL-004` requires a **delivered** area to reach navigation with zero
shell code changes, which is only true when there is one list. Three lists that must agree is
`DEF-010-001`'s shape — nine pages, four imported, every check green.

**`group` is a closed union, not a string.** A mistyped group is a compile error rather than a
heading nobody notices is empty.

**Every non-`delivered` area stays in `AREAS`** with no `element`. It is how the eighteen of
PMI-DOC-006 §4.1 are recorded, and how an address naming one is answered *not found* rather than
*unknown path*. Deleting them would make a specified area indistinguishable from a typo.

---

## 2. Routes — derived, never hand-written

```
/                              → Home                       delivered  (this Epic)
/projects                      → Projects                   delivered
/projects/:projectId           → a project                  sub-view
/traceability                  → (within Projects)          sub-view
/specifications                → Specifications             delivered
/specifications/:id            → one specification          sub-view
/specifications/:id/tasks      → Plan & Tasks               delivered
/runs                          → Runs                       delivered
/runs/:runId                   → a run's review session     sub-view
/storage                       → Workspace & Administration delivered
*                              → not found
```

**Six routed areas, and that is the whole table.** `/architecture` and `/governance` were listed
here as declared until the analysis of 2026-08-24 ([../analysis.md](../analysis.md) `I1`); neither
has a component to render, and `QA & Releases` was never given a path at all — which is how the
eight-versus-nine disagreement surfaced. All three are now `declared-not-delivered` and have **no
route**: their addresses answer not-found until their owners ship, exactly as an undeclared area's
does.

**Every path above is `Area.path` or a sub-view of one**, and the tree is generated from `AREAS`.
A route added by hand would be reachable and invisible to `FR-SHL-016`, which is the defect this
contract exists to prevent.

`*` answers **not found** for every address that is not one of the ten above (`FR-SHL-017`) —
including one naming an area that is specified but not delivered. *Not found* is the honest answer
to *"that screen does not exist"*; a blank area inside working chrome is not.

> **`DEF-001-006` is not this Epic's to fix, and must not be made worse.** Every unmatched path in
> the *API* currently answers `500` rather than `404` because `ErrorFilter` is a bare `@Catch()`.
> That is `EPIC-001`'s open defect. The client's not-found route is separate and must be a real
> not-found, not a blank shell with working chrome around it.

---

## 3. What the shell consumes, and never defines

| From | What | Contract |
|---|---|---|
| `EPIC-029` | tokens, components, states | `specs/029-design-system/contracts/components.md`. A component the shell needs that `components.md` lacks is built **against that contract** — the clause `prototype-parity.md` reserves for exactly this |
| `EPIC-033` | the Room regions | `packages/room-contract` — `ROOM_REGIONS`, `RoomShellProps`. **Adopted, never re-derived** (`FR-SHL-042`) |
| `EPIC-004` | the selectable workspace/project set and its rules | `FR-SHL-025`. The shell renders the control; it does not decide what may be selected |
| `EPIC-023` | runs awaiting review | `GET /v1/projects/:projectId/runs`, `GET /v1/runs/:id/review` |
| `EPIC-005` | the signed-in identity | `GET /v1/auth/me` → `workspace.id` |

**No new endpoint.** `FR-SHL-034` forbids an aggregation endpoint no other client can call, so Home
composes existing ones.

---

## 4. Home — three sections, one of which has a source

```ts
export interface AttentionItem {
  readonly kind: 'pending-approval' | 'policy-block' | 'missing-evidence';
  readonly subject: string;
  readonly projectId: string;
  /** An Area.path, never an invented route. */
  readonly href: string;
  /** For a policy-block, the policy that produced it (BR-0174). */
  readonly detail?: string;
}

export interface SourceStatus {
  readonly kind: AttentionItem['kind'];
  readonly state: 'available' | 'unavailable' | 'failed';
  /** Why, when not available. Names the Epic that will supply it. */
  readonly reason?: string;
}

export interface HomeModel {
  readonly items: readonly AttentionItem[];
  readonly sources: readonly SourceStatus[];   // always three
}
```

**`sources` always has three entries, and is not optional.** Today two are `unavailable`:
`policy-block` names `EPIC-031` (0 of 92) and `missing-evidence` names `EPIC-032` (0 of 83).

A `HomeModel` carrying only `items` would let a Home with one working source render as though
nothing were blocked — the confident blank screen. Making `sources` required means the absence has
to be rendered or deliberately discarded, and `FR-SHL-062` forbids the second.

---

## 5. Region vocabulary — the shell frames, the Room fills

The shell supplies the frame; `packages/room-contract`'s six regions are the Room's. Neither
restates the other (`FR-SHL-040`, `FR-SHL-043`).

`EPIC-034` `T994t` and `EPIC-035` `T998y` compare their region names against `ROOM_REGIONS` by
**comparison rather than review**. A seventh region declared here would make those comparisons pass
against a vocabulary that had quietly grown — so the shell declares none.

---

## 6. What this contract must never contain

Asserted by the Epic's own architecture check:

- **no permission or role model** — `FR-SHL-014` is deferred to `EPIC-024`, and a second
  authorization model is what `FR-SHL-003` forbids;
- **no area content** — the shell hosts screens and implements none;
- **no second region vocabulary** — `ROOM_REGIONS` is the one;
- **no workspace/project selection rules** — `EPIC-004`'s, consumed;
- **no persisted state** — no table, no migration, no store;
- **no design token values** — `PMI-DOC-005` is authoritative, and `prototype-parity.md` already
  declined the prototype's own values as illustrative.

---

## 7. Reachability — `FR-SHL-016`, and how it differs from `T200a`

| Check | Asks | Level |
|---|---|---|
| `T200a` (`EPIC-010`, exists) | is every delivered page module imported and rendered from the application root? | import graph |
| `FR-SHL-016` (this Epic) | is every **`delivered` area** reachable from primary navigation in the built application? | `G-UX-01`'s navigation half |

**Both are kept** (`R-036-5`). `T200a`'s own header states it cannot see route reachability;
`FR-SHL-016` drives the real `App` and clicks. Merging them yields one check that half-answers both.

`FR-SHL-016` is **mutation-verified** by removing one area's route and observing it fail —
`T200c`'s standard, and `SC-SHL-001` states it as a number.

`EPIC-010` `T200e`'s four buttons on the project view **are superseded** by navigation, and its
`shell-page-routes.spec.tsx` is replaced by the shell's own. `T200a` is not.
