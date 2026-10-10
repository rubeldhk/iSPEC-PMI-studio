/**
 * `T1935` (EPIC-047) — registered before it runs; refused on the record.
 *
 * `FR-EXP-060`, `FR-EXP-061`, `FR-EXP-062`, Constitution XII. The execution is
 * registered with `EPIC-037` **before** the runner is called. A refusal after
 * that point is an `expert-governance-recorded` event of kind
 * `dispatch-refused` on that execution, and the error carries its id — so a
 * refused dispatch is a fact somebody can open, not a log line. A run that
 * starts names the contract version it started under, whatever is approved
 * while it runs.
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import { ACTOR, ask, world } from '../helpers/expert-dispatch.js';
import { runner } from '../helpers/expert-fixtures.js';

describe('T1935 · registration order and recorded refusals', () => {
  it('registers before the runner is called, naming Expert, version and model', async () => {
    const order: string[] = [];
    const w = await world();
    const register = w.executions.register.bind(w.executions);
    w.ports.executions = {
      ...w.executions,
      async register(input) {
        order.push('register');
        return register(input);
      },
    };
    const run = w.preferred.run.bind(w.preferred);
    w.preferred.run = async (invocation, ctx) => {
      order.push('run');
      return run(invocation, ctx);
    };
    await w.service.dispatch(ACTOR, ask());
    expect(order).toEqual(['register', 'run']);
    expect(w.executions.registered[0]).toMatchObject({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      command: 'implement',
      actorId: 'u_1',
      expertKey: 'test-engineer',
      contractVersion: 1,
    });
  });

  it('a refusal is a dispatch-refused event on a registered execution, and the error carries its id', async () => {
    const w = await world();
    const error = await w.service.dispatch(ACTOR, ask({ tools: ['shell'] })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationFailedError);
    const executionId = ((error as ValidationFailedError).details as { executionId?: string }).executionId;
    expect(executionId).toBe('exe_1');
    expect(w.executions.kindsFor('exe_1')).toEqual(['dispatch-refused']);
    expect(w.executions.events[0]?.detail).toMatchObject({ reason: expect.stringMatching(/shell/) });
    // Refused before it ran: closed as cancelled, and nothing executed.
    expect(w.executions.completed).toEqual([expect.objectContaining({ executionId: 'exe_1', outcome: 'cancelled' })]);
    expect(w.preferred.runs).toHaveLength(0);
  });

  it('a run records a session naming the version it started under (FR-EXP-062)', async () => {
    const w = await world();
    const result = await w.service.dispatch(ACTOR, ask());
    const session = await w.store.findSession('ws_1', result.executionId);
    expect(session).toMatchObject({ contractVersionId: 'cv_1', expertId: 'ex_test', depth: 0, delegatedFromExecutionId: null });
    expect(result).toMatchObject({ executionId: 'exe_1', contractVersion: 1, model: 'claude-opus-5-5', usedFallback: false });
  });

  it('a fallback is recorded as an event and on the session', async () => {
    const w = await world({ runners: { 'claude-sonnet-5-5': [runner({ model: 'claude-sonnet-5-5' })] } });
    const result = await w.service.dispatch(ACTOR, ask());
    expect(result).toMatchObject({ model: 'claude-sonnet-5-5', usedFallback: true });
    expect(w.executions.kindsFor(result.executionId)).toContain('fallback-used');
    expect((await w.store.findSession('ws_1', result.executionId))?.fallbackReason).toMatch(/claude-opus-5-5/);
  });

  it('a successful run completes its execution', async () => {
    const w = await world();
    const result = await w.service.dispatch(ACTOR, ask());
    expect(result.outcome).toBe('succeeded');
    expect(w.executions.completed).toEqual([expect.objectContaining({ executionId: result.executionId, outcome: 'completed' })]);
  });
});
