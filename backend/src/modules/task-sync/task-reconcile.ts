/**
 * `T1699` (EPIC-046, `R-046-4`) — reconciliation. The whole of `FR-KAN-020` to
 * `FR-KAN-027`, as one pure function.
 *
 * PMI-DOC-007 §10 says of this Epic: *"parser is small; the rules are the
 * work."* This is the rules, and they are here — no I/O, no clock, no store —
 * so they can be reviewed as a table and mutated by a test.
 *
 * ## Which side wins, and why it is not a preference
 *
 * PMI-DOC-007 §2.3 makes `tasks.md`'s checkboxes **as observed** authoritative
 * for task status, and the PMI row its mirror. So:
 *
 *   - the file wins for the two states a checkbox can express;
 *   - a status a person set — `in_progress`, `blocked` — survives only while the
 *     file is *silent* about it, and is marked `aheadOfFile` while it does;
 *   - the moment the file speaks, it wins, and the row is marked
 *     `supersededByFile` so nobody has to guess what happened.
 *
 * The alternative — last write wins, whichever side it came from — would make
 * the board authoritative for a field the source-of-truth table says it mirrors,
 * and would let a click override a developer's own file. It was rejected in the
 * specification (Assumption 4) and is rejected here.
 *
 * ## What this function must not do
 *
 * `FR-KAN-022`: **no proposal record is deleted or amended** when the file
 * supersedes it. This function returns a *marker*; it never reaches for the
 * proposal. A superseded proposal stays readable, which is the difference
 * between a board that reconciles and a board that quietly forgets.
 *
 * `FR-KAN-020`: a disagreement is *surfaced*, never resolved silently. The
 * marker is how it surfaces, and the caller records it on the manifest line so
 * the board can name the rule that decided the outcome.
 */
import type { Marker, StatusSource, TaskStatusValue } from './task-sync.store.js';

export interface Previous {
  readonly status: TaskStatusValue;
  readonly statusSource: StatusSource;
}

export interface ParsedState {
  readonly checked: boolean;
}

export interface Reconciled {
  readonly status: TaskStatusValue;
  readonly statusSource: StatusSource;
  readonly marker: Marker | null;
}

/** A status a person set, which the file cannot express and therefore cannot confirm. */
function isManualMiddleState(previous: Previous): boolean {
  return previous.statusSource === 'proposal' && (previous.status === 'in_progress' || previous.status === 'blocked');
}

export function reconcile(previous: Previous | null, parsed: ParsedState): Reconciled {
  // A key the Epic has not seen before: the checkbox is all there is.
  if (previous === null) {
    return { status: parsed.checked ? 'done' : 'not_started', statusSource: 'parse', marker: null };
  }

  if (parsed.checked) {
    // The file says done. It wins outright — and where it overrode a person's
    // own statement, the row says so (FR-KAN-022).
    const superseded = previous.statusSource === 'proposal' && previous.status !== 'done';
    return { status: 'done', statusSource: 'parse', marker: superseded ? 'supersededByFile' : null };
  }

  // The file says NOT done.
  if (isManualMiddleState(previous)) {
    // It is silent about `in_progress` and `blocked` — a checkbox cannot express
    // either — so a person's statement stands, and is marked as running ahead of
    // what the file can confirm (FR-KAN-021, FR-KAN-024).
    return { status: previous.status, statusSource: 'proposal', marker: 'aheadOfFile' };
  }

  // Everything else follows the file to `not_started`. That includes a `done`
  // the file no longer shows — whoever unticked the line meant it.
  const superseded = previous.statusSource === 'proposal' && previous.status !== 'not_started';
  return { status: 'not_started', statusSource: 'parse', marker: superseded ? 'supersededByFile' : null };
}
