/**
 * T337n — the shared Room shell. `FR-RQR-070`, `FR-RQR-071`, `UX-0030`,
 * `UX-0040`, `UX-0041`, `UX-0042`, `UX-0035`.
 *
 * **One component, three Rooms.** `EPIC-034` and `EPIC-035` import this and
 * derive nothing — their first tasks stop if it is not built. The whole reason
 * it exists is that `UX-0042` requires state, decision and evidence to stay
 * visible at 360px, and *one component honouring that is better than three
 * agreeing to*.
 *
 * **It owns the breakpoints and takes no layout prop.** No `className`, no
 * width, no breakpoint override. The bypass that would end the guarantee is not
 * a redesign — it is a convenience prop nobody argues about, added for one Room
 * and then used by the other two differently.
 *
 * **The region vocabulary is the prop names**, imported from
 * `@pmi/room-contract`. This component does not restate them, so it cannot
 * disagree with the tuple `EPIC-034` `T994t` and `EPIC-035` `T998y` compare
 * against.
 */
import type { ReactElement, ReactNode } from 'react';
import { type RoomShellProps } from '@pmi/room-contract';

/**
 * The three `UX-0042` names as surviving the narrowest viewport.
 *
 * Held here rather than per Room, so a Room cannot decide for itself which of
 * its regions is expendable — and so the other two inherit the same three
 * without re-deciding.
 *
 * `retained` is about **priority, not removal**: all six stay in the DOM at
 * every width. Dropping three at 360px would take them from a screen reader
 * too, on the viewport size most correlated with a phone.
 */
const RETAINED_AT_360 = new Set(['objectState', 'decision', 'evidence']);

/** Accessible names. Six unlabelled regions sound identical to a screen reader. */
const REGION_LABELS: Record<keyof RoomShellProps<unknown>, string> = {
  objectState: 'Object state',
  loopProgress: 'Loop progress',
  aiAnalysis: 'AI analysis',
  decision: 'Decision',
  evidence: 'Evidence',
  activityTimeline: 'Activity timeline',
};

/** Model order, so every Room lays its regions out the same way. */
const RENDER_ORDER = [
  'objectState',
  'loopProgress',
  'aiAnalysis',
  'decision',
  'evidence',
  'activityTimeline',
] as const;

export function RoomShell(props: RoomShellProps<ReactNode>): ReactElement {
  return (
    <div className="room-shell" data-testid="room-shell">
      {RENDER_ORDER.map((region) => (
        <section
          key={region}
          className={`room-shell__region room-shell__region--${region}`}
          data-testid={`room-region-${region}`}
          aria-label={REGION_LABELS[region]}
          {...(RETAINED_AT_360.has(region) ? { 'data-narrow-viewport': 'retained' } : {})}
        >
          {props[region]}
        </section>
      ))}
    </div>
  );
}
