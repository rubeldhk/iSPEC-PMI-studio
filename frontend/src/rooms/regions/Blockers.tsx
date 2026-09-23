/**
 * `T403r` — what is blocking, where the reader already is. `FR-RQR-073`,
 * `UX-0032`.
 *
 * The backend derives this in `readiness.projection.ts`, and this renders it.
 * **It does not re-derive `ready`.** A second derivation is how the Room and the
 * projection end up disagreeing about whether an object can be baselined, and
 * the Room is the half a person would believe.
 *
 * `subject` and `detail` are rendered because `UX-0032` is about not sending the
 * reader elsewhere. A list of kinds — *pending-decision*, *unmet-evidence* — is
 * a table of contents for a screen they now have to go and find.
 *
 * The three non-ready states are kept distinguishable: **loading**, **failed**
 * and **blocked** all render nothing useful if they are collapsed, and a failed
 * readiness call that reads as "nothing is blocking" is the worst of the three.
 */
import type { ReactElement } from 'react';

/**
 * Mirrors `readiness.projection.ts`.
 *
 * Declared here rather than imported: `frontend` does not depend on `backend`,
 * and promoting it to `@pmi/room-contract` would change a package three Epics
 * consume for one Room's region. If a second Room needs the same shape, that is
 * the moment to promote it — `UX-0035`'s rule, applied to a type.
 */
export type BlockerKind =
  | 'open-clarification'
  | 'missing-acceptance-criteria'
  | 'pending-decision'
  | 'unmet-evidence';

export interface Blocker {
  readonly kind: BlockerKind;
  /** The candidate, clarification or contract this is about. */
  readonly subject: string;
  /** Enough to act on without opening another screen. */
  readonly detail: string;
}

export interface Readiness {
  readonly ready: boolean;
  readonly blockers: readonly Blocker[];
}

export interface BlockersProps {
  /** `null` while it has not arrived — which is not the same as "none". */
  readonly readiness: Readiness | null;
  /** Set when the projection could not be read at all. */
  readonly error?: string | undefined;
}

/** A person reads a sentence, not an identifier. */
const KIND_LABELS: Record<BlockerKind, string> = {
  'open-clarification': 'Open clarification',
  'missing-acceptance-criteria': 'Missing acceptance criteria',
  'pending-decision': 'Pending decision',
  'unmet-evidence': 'Unmet evidence',
};

export function Blockers({ readiness, error }: BlockersProps): ReactElement {
  // Ordered most-certain-first. `error` before `null` because a failed read is
  // a stronger fact than an absent one, and the two arrive together.
  const body = ((): ReactElement => {
    if (error !== undefined) {
      return (
        <p className="room-blockers__state room-blockers__state--error" role="status">
          {error}
        </p>
      );
    }
    if (readiness === null) {
      return (
        <p className="room-blockers__state room-blockers__state--loading">
          Loading what is blocking…
        </p>
      );
    }
    if (readiness.ready) {
      return (
        <p className="room-blockers__state room-blockers__state--ready">
          Ready to baseline — nothing is blocking.
        </p>
      );
    }
    if (readiness.blockers.length === 0) {
      // Not ready, and the projection named nothing. Reported as-is rather than
      // rounded to "ready": the projection is the authority on both fields, and
      // disagreeing with it here would hide the disagreement.
      return (
        <p className="room-blockers__state room-blockers__state--unexplained">
          Not ready to baseline. The readiness projection listed no reason.
        </p>
      );
    }
    return (
      <ul className="room-blockers__list">
        {readiness.blockers.map((blocker) => (
          <li
            key={`${blocker.kind}:${blocker.subject}`}
            className={`room-blockers__item room-blockers__item--${blocker.kind}`}
          >
            <span className="room-blockers__kind">{KIND_LABELS[blocker.kind]}</span>
            <span className="room-blockers__subject">{blocker.subject}</span>
            <span className="room-blockers__detail">{blocker.detail}</span>
          </li>
        ))}
      </ul>
    );
  })();

  return (
    // `polite` rather than `assertive`: blockers clear while a person works in
    // the Room, and they should hear about it at the next pause rather than be
    // interrupted mid-sentence.
    <div className="room-blockers" aria-live="polite" data-testid="room-blockers">
      {body}
    </div>
  );
}
