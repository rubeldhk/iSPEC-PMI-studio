/**
 * T040 — job state machine: every terminal state, no partial artifact.
 * Written to FAIL before T041 exists (Constitution V).
 *
 * FR-026/FR-027 and SC-005/SC-006.
 */
import { describe, expect, it } from 'vitest';
import {
  applyTransition,
  assertNoPartialArtifact,
  InvalidJobTransitionError,
  isTerminal,
  JOB_STATES,
  requiresFailureReason,
  type JobState,
} from '../../../src/modules/jobs/job-state.machine.js';

describe('states', () => {
  it('declares exactly the six Phase 1 states', () => {
    expect(JOB_STATES).toEqual([
      'queued',
      'running',
      'succeeded',
      'failed',
      'cancelled',
      'timed_out',
    ]);
  });

  it('marks the four terminal states', () => {
    expect(isTerminal('succeeded')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('timed_out')).toBe(true);
    expect(isTerminal('queued')).toBe(false);
    expect(isTerminal('running')).toBe(false);
  });
});

describe('transitions', () => {
  it('permits queued -> running -> succeeded', () => {
    expect(applyTransition('queued', 'running').state).toBe('running');
    expect(applyTransition('running', 'succeeded').state).toBe('succeeded');
  });

  it.each(['failed', 'cancelled', 'timed_out'] as JobState[])(
    'permits running -> %s with a reason',
    (to) => {
      const r = applyTransition('running', to, 'engine_error');
      expect(r.state).toBe(to);
      expect(r.failureReason).toBe('engine_error');
    },
  );

  it('permits cancelling a job that has not started', () => {
    expect(applyTransition('queued', 'cancelled', 'cancelled').state).toBe('cancelled');
  });

  it('refuses to leave a terminal state', () => {
    for (const from of ['succeeded', 'failed', 'cancelled', 'timed_out'] as JobState[]) {
      expect(() => applyTransition(from, 'running')).toThrow(InvalidJobTransitionError);
    }
  });

  it('has NO retry transition — a retry is a new job with a new key', () => {
    expect(() => applyTransition('failed', 'queued')).toThrow(InvalidJobTransitionError);
    expect(() => applyTransition('timed_out', 'running')).toThrow(InvalidJobTransitionError);
  });

  it('refuses to skip running', () => {
    expect(() => applyTransition('queued', 'succeeded')).toThrow(InvalidJobTransitionError);
  });
});

describe('failure reasons', () => {
  it('requires a named reason for every non-success terminal state', () => {
    expect(requiresFailureReason('failed')).toBe(true);
    expect(requiresFailureReason('cancelled')).toBe(true);
    expect(requiresFailureReason('timed_out')).toBe(true);
    expect(requiresFailureReason('succeeded')).toBe(false);
  });

  it('throws when a failure transition has no reason (SC-005)', () => {
    expect(() => applyTransition('running', 'failed')).toThrow(/reason/i);
  });

  it('refuses a reason on a successful transition', () => {
    expect(() => applyTransition('running', 'succeeded', 'engine_error')).toThrow(/succe/i);
  });
});

describe('no partial artifact (FR-027, SC-006)', () => {
  it('accepts an artifact only on success', () => {
    expect(() => assertNoPartialArtifact('succeeded', { id: 'spec1' })).not.toThrow();
    expect(() => assertNoPartialArtifact('succeeded', null)).not.toThrow();
  });

  it.each(['failed', 'cancelled', 'timed_out'] as JobState[])(
    'rejects an artifact on %s',
    (state) => {
      expect(() => assertNoPartialArtifact(state, { id: 'spec1' })).toThrow(/partial/i);
      expect(() => assertNoPartialArtifact(state, null)).not.toThrow();
    },
  );
});
