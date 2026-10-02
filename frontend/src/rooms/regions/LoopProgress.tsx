/**
 * `T403p` — loop progress, rendered from EPIC-030's projection. `FR-RQR-074`.
 *
 * **No Room-local translation.** The stage names, their order, their status and
 * the omitted flag all arrive from `projectProgress` in `@pmi/loop-contract` and
 * are rendered as they came. A Room that renamed a stage for display would make
 * "Analyze" mean one thing in this Room and another in the Change Room, which is
 * exactly the drift `UX-0035` exists to prevent — and the projection is shared
 * precisely so the three Rooms cannot compute *completed* three ways.
 *
 * **`omitted` is rendered, not filtered.** `FR-GEL-008` keeps a stage the
 * workflow does not use visible rather than absent, because a missing row and a
 * skipped one look identical once the row is gone. A reader comparing two Rooms
 * needs to see that this workflow has no Execute stage, not to wonder where it
 * went.
 */
import type { ReactElement } from 'react';
import type { LoopProgress as LoopProgressRow } from '@pmi/loop-contract';

export interface LoopProgressProps {
  /** `null` while it has not arrived. Distinct from an empty workflow. */
  readonly progress: readonly LoopProgressRow[] | null;
  readonly error?: string | undefined;
}

/**
 * Status → what a screen reader says.
 *
 * The visual state is a class; this is the text equivalent, because a stage
 * distinguished only by colour is not distinguished for everyone.
 */
const STATUS_TEXT = {
  done: 'complete',
  current: 'in progress',
  pending: 'not started',
} as const;

export function LoopProgress({ progress, error }: LoopProgressProps): ReactElement {
  if (error !== undefined) {
    return (
      <p className="room-progress__state room-progress__state--error" role="status">
        {error}
      </p>
    );
  }
  if (progress === null) {
    return <p className="room-progress__state room-progress__state--loading">Loading progress…</p>;
  }
  if (progress.length === 0) {
    // Said out loud rather than rendered as an empty list, for the same reason
    // `omitted` is kept: absence and emptiness must not look alike.
    return (
      <p className="room-progress__state room-progress__state--empty">
        This object has no configured stages.
      </p>
    );
  }

  return (
    <ol className="room-progress" data-testid="room-progress">
      {progress.map((row) => (
        <li
          key={row.stage}
          className={`room-progress__stage room-progress__stage--${row.status}${
            row.omitted ? ' room-progress__stage--omitted' : ''
          }`}
          data-stage={row.stage}
          data-status={row.status}
          {...(row.omitted ? { 'data-omitted': 'true' } : {})}
        >
          <span className="room-progress__name">{row.stage}</span>
          <span className="room-progress__status">
            {row.omitted ? 'not used by this workflow' : STATUS_TEXT[row.status]}
          </span>
        </li>
      ))}
    </ol>
  );
}
