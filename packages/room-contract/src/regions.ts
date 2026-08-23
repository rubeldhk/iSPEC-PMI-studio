/**
 * T337g — the six regions. `FR-RQR-071`, `UX-0030`, `UX-0035`.
 *
 * **The region vocabulary is the prop names.** Defined once, in this file,
 * imported by three Epics. `EPIC-034` and `EPIC-035` both hard-stop if this
 * package is not built, because a second derivation of the pattern is precisely
 * how `UX-0035` — *"if one Room needs a seventh region, the pattern changes for
 * all three"* — would stop being true.
 *
 * **Six required named props, and deliberately no `children`.**
 *
 *   - A Room omitting a region **does not compile**, so `UX-0030` stops being a
 *     convention nobody re-reads.
 *   - A Room inventing a seventh has **nowhere to put it**. Adding one means
 *     changing this file, which is what `UX-0035` asks for and what a `children`
 *     hole would quietly permit instead.
 *
 * React's own documentation names the mechanism (`R-033-3`): `children` is for a
 * hole filled with arbitrary JSX; a separate named prop is for *"if you want
 * every `Card` to always have a title"*. Six always-required regions is that
 * case, six times.
 *
 * **Generic over the node type, and framework-free.** The contract must not
 * import React — `packages/` holds no framework dependency, and a Room's tests
 * need to construct these props without a renderer. `frontend/src/rooms/RoomShell.tsx`
 * instantiates it as `RoomShellProps<React.ReactNode>`.
 */

export const ROOM_REGIONS = Object.freeze([
  'objectState',
  'loopProgress',
  'aiAnalysis',
  'decision',
  'evidence',
  'activityTimeline',
] as const);

export type RoomRegion = (typeof ROOM_REGIONS)[number];

/**
 * The six regions every Room renders.
 *
 * `Record<RoomRegion, TNode>` rather than six hand-written properties: the tuple
 * above and this type cannot drift, so a Room cannot satisfy the type while
 * rendering a region the vocabulary does not have. `EPIC-034` `T994t` and
 * `EPIC-035` `T998y` compare their region names against `ROOM_REGIONS`, and that
 * comparison is only worth running if the two are the same fact.
 */
export type RoomShellProps<TNode> = Record<RoomRegion, TNode>;

/** Narrow an untrusted string, for a renderer iterating the vocabulary. */
export function isRoomRegion(candidate: string): candidate is RoomRegion {
  return (ROOM_REGIONS as readonly string[]).includes(candidate);
}
