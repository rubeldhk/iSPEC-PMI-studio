/**
 * `T1171` — the shared Rooms index.
 *
 * Beside `RoomShell.tsx` and for the same reason: `EPIC-034` and `EPIC-035` get
 * this by construction rather than by copying it. `T405d` proved what happens
 * when a Room can quietly differ from its siblings — the region contract is
 * frozen precisely so one Room cannot invent its own vocabulary — and an index
 * built three times would drift the same way, one urgent Friday at a time.
 *
 * ## What it does not do
 *
 * It does not fetch, and it does not navigate. `load`, `onOpen` and `onStart`
 * are supplied by the area view, so this component holds no API client and no
 * router. That is what lets one component serve three route trees, and it is
 * why the tests can drive it through two Room kinds without a server.
 *
 * It does not sort. `EPIC-030`'s `listObjects` orders newest first (`T1177`);
 * re-sorting here would be a second opinion about ordering, and the two would
 * eventually disagree about which Room is most recent.
 */
import { useEffect, useState, type ReactElement } from 'react';

/**
 * The per-Room words. Everything a Room may differ in lives here, so a Room that
 * wants to differ in something else has to add it here — where the other two
 * Rooms' authors will see it.
 */
export interface RoomKind {
  readonly id: string;
  readonly title: string;
  readonly routePrefix: string;
  /** The affordance on an empty index, phrased as an action. */
  readonly openLabel: string;
  /** What this Room is for, shown when there is nothing to list. */
  readonly emptyHint: string;
}

/** One Room, as `EPIC-030` reports it. */
export interface RoomSummary {
  readonly id: string;
  readonly subjectId: string;
  readonly projectId: string;
  readonly currentStage: string;
  readonly createdAt: string;
}

export interface RoomIndexProps {
  readonly kind: RoomKind;
  readonly load: () => Promise<readonly RoomSummary[]>;
  readonly onOpen: (roomObjectId: string) => void;
  readonly onStart: () => void;
}

type State =
  | { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly message: string }
  | { readonly status: 'loaded'; readonly rooms: readonly RoomSummary[] };

export function RoomIndex({ kind, load, onOpen, onStart }: RoomIndexProps): ReactElement {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    void (async (): Promise<void> => {
      try {
        const rooms = await load();
        if (live) setState({ status: 'loaded', rooms });
      } catch {
        // The message is ours. An error from the server is not written for a
        // person reading an index, and echoing it is how internals reach a UI.
        if (live) {
          setState({ status: 'failed', message: 'These could not be loaded. Please try again.' });
        }
      }
    })();
    return (): void => {
      live = false;
    };
    // `load` is the identity of the request. Depending on it rather than on
    // nothing means a kind change refetches, and a stable `load` does not.
  }, [load]);

  return (
    <section>
      <h2>{kind.title}</h2>

      {/*
        Before the list, deliberately. A person arriving here most often wants
        to begin, and in document order that is also tab order — so the way in
        is never behind an unbounded list of Rooms.
      */}
      <button type="button" onClick={onStart}>
        {kind.openLabel}
      </button>

      {state.status === 'loading' && <p>Loading…</p>}

      {state.status === 'failed' && (
        // `role="alert"`, and NOT the empty state. A failure rendered as
        // emptiness tells a person their workspace is empty when the truth is
        // that nobody currently knows.
        <p role="alert">{state.message}</p>
      )}

      {state.status === 'loaded' && state.rooms.length === 0 && (
        // `UX-0032`'s posture. "No results" is a status; this is an affordance.
        <p>{kind.emptyHint}</p>
      )}

      {state.status === 'loaded' && state.rooms.length > 0 && (
        <ul aria-label={`${kind.title} rooms`}>
          {state.rooms.map((room) => (
            <li key={room.id}>
              {/*
                A real button. A row with an onClick looks identical and is
                reachable by neither Tab nor a screen reader.
              */}
              <button type="button" onClick={() => onOpen(room.id)}>
                {room.subjectId}
              </button>{' '}
              {/* The loop's stage, rendered — never re-derived (`FR-RQR-074`). */}
              <span>{room.currentStage}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
