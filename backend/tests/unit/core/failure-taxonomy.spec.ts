/**
 * T019 — every failure reason maps to a distinct code, with no generic fallback.
 * Written to FAIL before T020 exists (Constitution V).
 *
 * FR-026 / SC-005: a generic error is a defect, not a fallback.
 */
import { describe, expect, it } from 'vitest';
import { ENGINE_FAILURE_REASONS } from '@pmi/engine-contract';
import {
  FAILURE_MESSAGES,
  describeFailure,
  isTerminalFailureState,
  JOB_TERMINAL_FAILURE_STATES,
} from '../../../src/core/failure-taxonomy.js';

describe('failure taxonomy', () => {
  it('covers every reason declared by the engine contract', () => {
    for (const reason of ENGINE_FAILURE_REASONS) {
      expect(FAILURE_MESSAGES[reason], `missing message for ${reason}`).toBeTruthy();
    }
  });

  it('has no generic or unknown member', () => {
    expect(ENGINE_FAILURE_REASONS).not.toContain('unknown' as never);
    expect(Object.keys(FAILURE_MESSAGES)).not.toContain('unknown');
    expect(Object.keys(FAILURE_MESSAGES)).not.toContain('generic');
  });

  it('gives every reason a DISTINCT user-facing message', () => {
    const messages = Object.values(FAILURE_MESSAGES);
    expect(new Set(messages).size).toBe(messages.length);
  });

  it('describes a failure without leaking diagnostics', () => {
    const d = describeFailure({
      reason: 'engine_error',
      message: 'Generation failed.',
      diagnostics: 'stderr: token sk-abc123',
    });
    expect(d.code).toBe('engine_error');
    expect(JSON.stringify(d)).not.toContain('sk-abc123');
  });

  it('distinguishes engine_unavailable from engine_error', () => {
    expect(FAILURE_MESSAGES.engine_unavailable).not.toBe(FAILURE_MESSAGES.engine_error);
  });

  it('treats empty output as a failure, never as an empty specification', () => {
    expect(FAILURE_MESSAGES.empty_output).toBeTruthy();
    expect(ENGINE_FAILURE_REASONS).toContain('empty_output');
  });
});

describe('terminal job states', () => {
  it('requires a named reason for every non-success terminal state', () => {
    expect(JOB_TERMINAL_FAILURE_STATES).toEqual(['failed', 'cancelled', 'timed_out']);
    for (const s of JOB_TERMINAL_FAILURE_STATES) {
      expect(isTerminalFailureState(s)).toBe(true);
    }
    expect(isTerminalFailureState('succeeded')).toBe(false);
    expect(isTerminalFailureState('running')).toBe(false);
  });
});
