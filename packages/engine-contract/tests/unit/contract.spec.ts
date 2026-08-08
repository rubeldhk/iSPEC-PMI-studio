/**
 * T031 — contract type guards and result narrowing.
 *
 * This file was marked complete on 2026-08-05 and did not exist. It was not
 * caught because an empty Vitest project passes silently when sibling projects
 * have tests, so `pnpm test:unit` stayed green with two suites missing.
 *
 * The contract is the one type `backend/` may import (ADR-0001). If its
 * narrowing is wrong, every consumer's error handling is wrong in the same way.
 */
import { describe, it, expect } from 'vitest';
import {
  ENGINE_FAILURE_REASONS,
  MissingCapabilityError,
  PHASE_1_CAPABILITIES,
  assertPhase1Capabilities,
  engineFail,
  engineOk,
  isEngineFailure,
  type EngineDescriptor,
  type EngineResult,
} from '../../src/index';

const descriptor: EngineDescriptor = {
  name: 'test-engine',
  version: 'test-1.0.0+model=none',
  capabilities: [...PHASE_1_CAPABILITIES],
};

describe('Phase 1 capabilities', () => {
  it('declares exactly the three capabilities the contract requires', () => {
    expect([...PHASE_1_CAPABILITIES]).toEqual([
      'generate_specification',
      'generate_tasks',
      'validate_specification',
    ]);
  });

  it('does not include a deferred capability', () => {
    for (const deferred of ['improve_specification', 'estimate_complexity', 'analyze_dependencies']) {
      expect(PHASE_1_CAPABILITIES as readonly string[]).not.toContain(deferred);
    }
  });
});

describe('failure taxonomy (FR-026)', () => {
  it('names all eight reasons', () => {
    expect(ENGINE_FAILURE_REASONS).toHaveLength(8);
  });

  it('has NO catch-all member', () => {
    // A generic reason is where every unclassified failure goes to be ignored.
    for (const catchAll of ['unknown', 'other', 'error', 'unspecified']) {
      expect(ENGINE_FAILURE_REASONS as readonly string[]).not.toContain(catchAll);
    }
  });

  it('distinguishes an engine that could not start from one that ran and failed', () => {
    expect(ENGINE_FAILURE_REASONS).toContain('engine_unavailable');
    expect(ENGINE_FAILURE_REASONS).toContain('engine_error');
  });
});

describe('result construction and narrowing', () => {
  it('engineOk carries the value and the producing descriptor', () => {
    const result = engineOk({ answer: 42 }, descriptor);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ answer: 42 });
      expect(result.producedBy).toBe(descriptor);
    }
  });

  it('engineFail carries the reason and a user-safe message', () => {
    const result = engineFail('timeout', 'The run exceeded its time limit.');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('timeout');
      expect(result.failure.message).toBe('The run exceeded its time limit.');
    }
  });

  it('omits diagnostics entirely when none is supplied', () => {
    const result = engineFail('empty_output', 'The engine produced nothing.');
    if (!result.ok) {
      expect('diagnostics' in result.failure).toBe(false);
    }
  });

  it('includes diagnostics when supplied', () => {
    const result = engineFail('engine_error', 'The engine failed.', 'exit code 3');
    if (!result.ok) {
      expect(result.failure.diagnostics).toBe('exit code 3');
    }
  });

  it('isEngineFailure narrows a union to the failure branch', () => {
    const results: EngineResult<string>[] = [
      engineOk('value', descriptor),
      engineFail('cancelled', 'Cancelled.'),
    ];
    const failures = results.filter(isEngineFailure);
    expect(failures).toHaveLength(1);
    // The narrowing is the point: `.failure` must be reachable without a cast.
    expect(failures[0]?.failure.reason).toBe('cancelled');
  });

  it('a success result never carries a failure, and vice versa', () => {
    const ok = engineOk('v', descriptor);
    const bad = engineFail<string>('engine_error', 'boom');
    expect('failure' in ok).toBe(false);
    expect('value' in bad).toBe(false);
  });
});

describe('assertPhase1Capabilities (FR-021)', () => {
  it('accepts a descriptor declaring all three', () => {
    expect(() => assertPhase1Capabilities(descriptor)).not.toThrow();
  });

  it.each([...PHASE_1_CAPABILITIES])('refuses a descriptor missing %s, naming it', (missing) => {
    const incomplete: EngineDescriptor = {
      ...descriptor,
      capabilities: PHASE_1_CAPABILITIES.filter((c) => c !== missing),
    };
    try {
      assertPhase1Capabilities(incomplete);
      throw new Error('expected assertPhase1Capabilities to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(MissingCapabilityError);
      const failure = error as MissingCapabilityError;
      expect(failure.missing).toEqual([missing]);
      // "Something is missing" is not an actionable message.
      expect(failure.message).toContain(missing);
      expect(failure.message).toContain('test-engine');
    }
  });

  it('names every missing capability, not just the first', () => {
    const bare: EngineDescriptor = { ...descriptor, capabilities: [] };
    try {
      assertPhase1Capabilities(bare);
      throw new Error('expected assertPhase1Capabilities to throw');
    } catch (error) {
      const failure = error as MissingCapabilityError;
      expect(failure.missing).toEqual([...PHASE_1_CAPABILITIES]);
    }
  });
});
