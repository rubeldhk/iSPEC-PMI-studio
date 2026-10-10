/**
 * `T1969` (EPIC-047) — a run for a task is the run the task was given to.
 *
 * `FR-EXP-053`, `FR-EXP-054`. Dispatching with a `taskId` checks that the
 * task's current assignment is to **this** Expert and **stands** — not pending
 * a decision, not refused, not superseded.
 */
import { describe, expect, it } from 'vitest';
import { ACTOR, ask, world } from '../helpers/expert-dispatch.js';

async function assigned(state: 'standing' | 'pending-decision', assigneeId = 'ex_test') {
  const w = await world();
  await w.store.addAssignment({
    id: 'as_1', workspaceId: 'ws_1', taskId: 't_1', assigneeKind: 'expert', assigneeId,
    rule: 'capabilities cover the task', state, decisionId: state === 'pending-decision' ? 'd_task' : null,
    assignedBy: 'u_1', assignedAt: '2026-10-09T08:00:00.000Z', supersededAt: null, supersededBy: null,
  });
  return w;
}

describe('T1969 · dispatch by task', () => {
  it('runs when the task stands assigned to this Expert', async () => {
    const w = await assigned('standing');
    expect((await w.service.dispatch(ACTOR, ask({ taskId: 't_1' }))).outcome).toBe('succeeded');
  });

  it('refuses a task assigned to another Expert', async () => {
    const w = await assigned('standing', 'ex_other');
    await expect(w.service.dispatch(ACTOR, ask({ taskId: 't_1' }))).rejects.toThrow(/not assigned to test-engineer/);
  });

  it('refuses a task whose assignment is still pending a decision', async () => {
    const w = await assigned('pending-decision');
    await expect(w.service.dispatch(ACTOR, ask({ taskId: 't_1' }))).rejects.toThrow(/pending-decision/);
  });

  it('refuses a task with no assignment at all', async () => {
    const w = await world();
    await expect(w.service.dispatch(ACTOR, ask({ taskId: 't_9' }))).rejects.toThrow(/not assigned/);
  });
});
