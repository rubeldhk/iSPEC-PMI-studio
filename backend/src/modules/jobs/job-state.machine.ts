/**
 * T041 — the generation job state machine.
 *
 * Two rules do most of the work here:
 *
 *   1. Every non-success terminal state MUST name a reason (FR-026, SC-005).
 *      The database CHECK constraint enforces the same thing, so a generic
 *      failure cannot even be stored.
 *
 *   2. There is NO retry transition. A retry is a new job with a new job key,
 *      which keeps the trail honest about how many times an engine was actually
 *      invoked — and therefore how much was spent (RAID R-02).
 *
 * Framework-free (PC-1).
 */
import type { EngineFailureReason } from '@pmi/engine-contract';

export const JOB_STATES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'timed_out',
] as const;

export type JobState = (typeof JOB_STATES)[number];

const TERMINAL: readonly JobState[] = ['succeeded', 'failed', 'cancelled', 'timed_out'];
const FAILURE_TERMINAL: readonly JobState[] = ['failed', 'cancelled', 'timed_out'];

/** The complete transition table. Anything absent is refused. */
const PERMITTED: Record<JobState, readonly JobState[]> = {
  queued: ['running', 'cancelled'],
  running: ['succeeded', 'failed', 'cancelled', 'timed_out'],
  succeeded: [],
  failed: [],
  cancelled: [],
  timed_out: [],
};

export class InvalidJobTransitionError extends Error {
  constructor(from: JobState, to: JobState) {
    super(
      `Cannot move a job from "${from}" to "${to}". Permitted: ` +
        `${PERMITTED[from].length ? PERMITTED[from].join(', ') : '(none — terminal)'}.`,
    );
    this.name = 'InvalidJobTransitionError';
  }
}

export function isTerminal(state: JobState): boolean {
  return TERMINAL.includes(state);
}

export function requiresFailureReason(state: JobState): boolean {
  return FAILURE_TERMINAL.includes(state);
}

export interface JobTransition {
  state: JobState;
  failureReason?: EngineFailureReason;
  endedAt?: Date;
}

export function applyTransition(
  from: JobState,
  to: JobState,
  failureReason?: EngineFailureReason,
): JobTransition {
  if (!PERMITTED[from].includes(to)) throw new InvalidJobTransitionError(from, to);

  if (requiresFailureReason(to) && !failureReason) {
    throw new Error(
      `Moving a job to "${to}" requires a named failure reason. ` +
        `A generic failure is a defect, not a fallback (FR-026).`,
    );
  }
  if (!requiresFailureReason(to) && failureReason) {
    throw new Error(`A job moving to "${to}" succeeded and must not carry a failure reason.`);
  }

  const t: JobTransition = { state: to };
  if (failureReason) t.failureReason = failureReason;
  if (isTerminal(to)) t.endedAt = new Date();
  return t;
}

/**
 * FR-027 / SC-006: a failed, cancelled, or timed-out job leaves NOTHING behind.
 * Called before persisting a terminal state.
 */
export function assertNoPartialArtifact(state: JobState, artifact: unknown): void {
  if (requiresFailureReason(state) && artifact != null) {
    throw new Error(
      `Refusing to store a partial artifact for a job in state "${state}" (FR-027).`,
    );
  }
}
