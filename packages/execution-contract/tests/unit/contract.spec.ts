/**
 * T545 — the execution contract's shape, including the claim that is a TYPE.
 *
 * The `WorkspaceBinding` union is the mechanism by which Native §5's *"no
 * sandbox state may implicitly become authoritative project state"* becomes
 * structural rather than conventional. An untested type claim is a comment, so
 * the negative cases are asserted at compile time with `@ts-expect-error`.
 */
import { describe, expect, it } from 'vitest';
import {
  EXECUTION_FAILURE_REASONS,
  executionFail,
  executionOk,
  isExecutionFailure,
  type ExecutionEnvironmentDescriptor,
  type WorkspaceBinding,
} from '../../src/index.js';

describe('T545 · result narrowing', () => {
  it('narrows a success to its value', () => {
    const r = executionOk({ id: 'sess-1' });
    expect(isExecutionFailure(r)).toBe(false);
    if (!isExecutionFailure(r)) expect(r.value.id).toBe('sess-1');
  });

  it('narrows a failure to a named reason', () => {
    const r = executionFail('provider_unavailable', 'The runtime is unreachable.');
    expect(isExecutionFailure(r)).toBe(true);
    if (isExecutionFailure(r)) expect(r.failure.reason).toBe('provider_unavailable');
  });

  it('keeps diagnostics off the result unless supplied', () => {
    // Operator-facing detail may quote a command line containing a token (PC-3).
    const bare = executionFail('provider_error', 'msg');
    expect(isExecutionFailure(bare) && 'diagnostics' in bare.failure).toBe(false);
  });

  it('has no generic fallback reason', () => {
    // As with EngineFailureReason: a generic failure is a defect, not a fallback.
    expect(EXECUTION_FAILURE_REASONS).not.toContain('unknown');
    expect(new Set(EXECUTION_FAILURE_REASONS).size).toBe(EXECUTION_FAILURE_REASONS.length);
  });
});

describe('T545 · WorkspaceBinding makes the unsafe state unrepresentable (FR-AGT-008)', () => {
  it('accepts an ephemeral binding with a scratch path', () => {
    const b: WorkspaceBinding = { kind: 'ephemeral', scratchPath: '/work' };
    expect(b.kind).toBe('ephemeral');
  });

  it('accepts a persistent binding that names a branch', () => {
    const b: WorkspaceBinding = {
      kind: 'persistent',
      projectRef: 'git@example:proj.git',
      mode: 'read-write',
      branch: 'agent/task-589',
    };
    expect(b.kind === 'persistent' && b.branch).toBe('agent/task-589');
  });

  it('does NOT compile a persistent binding without a branch', () => {
    // @ts-expect-error — a persistent binding without `branch` is the exact
    // state Native §5 forbids: durable, and unnamed.
    const b: WorkspaceBinding = { kind: 'persistent', projectRef: 'r', mode: 'read-only' };
    expect(b).toBeDefined();
  });

  it('does NOT compile an ephemeral binding carrying a project ref', () => {
    // @ts-expect-error — scratch space is not a project.
    const b: WorkspaceBinding = { kind: 'ephemeral', scratchPath: '/w', projectRef: 'r' };
    expect(b).toBeDefined();
  });
});

describe('T545 · descriptor consistency', () => {
  it('cannot claim persistent state while supporting only ephemeral', () => {
    const d: ExecutionEnvironmentDescriptor = {
      provider: 'docker',
      supportedLifecycles: ['ephemeral'],
      supportsPersistentState: false,
      supportsNetworkPolicy: true,
      maxWallClockMs: 900_000,
    };
    expect(d.supportsPersistentState).toBe(d.supportedLifecycles.includes('persistent'));
  });
});
