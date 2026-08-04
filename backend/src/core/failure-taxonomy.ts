/**
 * T020 — the failure taxonomy.
 *
 * FR-026 / SC-005: every non-success terminal state names a specific reason.
 * There is no `unknown` member and no default branch. Adding a reason to the
 * engine contract without adding a message here is a COMPILE error, which is
 * the point.
 */
import type { EngineFailure, EngineFailureReason } from '@pmi/engine-contract';

/** User-facing text. Every entry must be distinct — asserted by T019. */
export const FAILURE_MESSAGES: Record<EngineFailureReason, string> = {
  engine_unavailable: 'The specification engine is unavailable. Try again shortly.',
  engine_error: 'The specification engine failed while generating.',
  malformed_output: 'The engine returned output that could not be understood.',
  empty_output: 'The engine returned nothing.',
  timeout: 'Generation exceeded its time limit and was stopped.',
  cancelled: 'Generation was cancelled.',
  input_too_large: 'The selection is too large for the engine to process.',
  empty_selection: 'Select at least one requirement before generating.',
};

export const JOB_TERMINAL_FAILURE_STATES = ['failed', 'cancelled', 'timed_out'] as const;
export type JobTerminalFailureState = (typeof JOB_TERMINAL_FAILURE_STATES)[number];

export function isTerminalFailureState(state: string): state is JobTerminalFailureState {
  return (JOB_TERMINAL_FAILURE_STATES as readonly string[]).includes(state);
}

export interface DescribedFailure {
  code: EngineFailureReason;
  message: string;
}

/**
 * Translate an engine failure for a user.
 *
 * `diagnostics` is intentionally dropped: it is operator-facing and may contain
 * engine output or a credential (research R-011, contract rule E9).
 */
export function describeFailure(failure: EngineFailure): DescribedFailure {
  return { code: failure.reason, message: FAILURE_MESSAGES[failure.reason] };
}

/** Which reasons are decided BEFORE work starts (contract rule E7). */
export const PRE_FLIGHT_REASONS: readonly EngineFailureReason[] = [
  'empty_selection',
  'input_too_large',
];

export function isPreFlightReason(reason: EngineFailureReason): boolean {
  return PRE_FLIGHT_REASONS.includes(reason);
}
