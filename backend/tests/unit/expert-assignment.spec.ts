/**
 * `T1965` (EPIC-047) — a task goes to a person or an Expert, with the reason
 * on the record.
 *
 * `FR-EXP-050`…`FR-EXP-053`, `FR-EXP-055`, analysis finding C5. An Expert
 * lacking a capability the task needs is refused, naming it; a retired Expert
 * takes nothing new; every assignment records the rule that permitted it;
 * reassignment supersedes and keeps history; and assigning **runs nothing**.
 * A task whose Expert is retired later reads as needing reassignment, without
 * its row changing.
 */
import { describe, expect, it } from 'vitest';
import { ForbiddenError, NotFoundError, ValidationFailedError } from '../../src/core/errors.js';
import { AssignmentService } from '../../src/modules/experts/assignment.service.js';
import { Authoring } from '../../src/modules/experts/authoring.js';
import { InMemoryExpertsStore } from '../../src/modules/experts/experts.store.js';
import { accessFrom, contract, expert, recordingApprovals, recordingExecutions, version } from '../helpers/expert-fixtures.js';

async function setup(grants: Record<string, 'read' | 'edit'> = { 'u_1:task:t_1': 'edit' }) {
  const store = new InMemoryExpertsStore();
  const approvals = recordingApprovals();
  const executions = recordingExecutions();
  await store.addExpert(expert());
  await store.addVersion(version({ contract: contract({ capabilities: ['test', 'analyze'] }), decisionId: 'd_ok' }));
  approvals.resolve('d_ok', 'approved');
  await store.putPolicy({
    workspaceId: 'ws_1', maxDepth: 3, maxFanOut: 5, allowedPairs: [], maxUnattendedBand: 'high',
    updatedBy: 'u_1', updatedAt: '2026-10-09T09:00:00.000Z',
  });
  let n = 0;
  const service = new AssignmentService(store, {
    authoring: new Authoring(accessFrom(grants)),
    approvals,
    tasks: { exists: async (_ws, id) => id === 't_1' },
    clock: () => `2026-10-09T09:00:0${(n += 1)}.000Z`,
    ids: () => `as_${n}`,
  });
  return { store, approvals, executions, service };
}

const toExpert = { assigneeKind: 'expert' as const, assigneeId: 'ex_test', capabilities: ['test'], riskClass: 'low' as const };

describe('T1965 · assignment', () => {
  it('an Expert whose capabilities cover the task is assigned, with the rule that permitted it', async () => {
    const { service } = await setup();
    const a = await service.assign('ws_1', 'u_1', 't_1', toExpert);
    expect(a).toMatchObject({ state: 'standing', assigneeKind: 'expert', assigneeId: 'ex_test', decisionId: null });
    expect(a.rule).toMatch(/capabilities.*test.*cover/);
  });

  it('an Expert lacking a capability is refused, naming it (FR-EXP-051)', async () => {
    const { service } = await setup();
    const e = await service.assign('ws_1', 'u_1', 't_1', { ...toExpert, capabilities: ['test', 'generate'] }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ValidationFailedError);
    expect((e as Error).message).toMatch(/generate/);
  });

  it('a retired Expert takes nothing new', async () => {
    const { service, store } = await setup();
    await store.retireExpert('ws_1', 'ex_test', 'u_1', '2026-10-09T08:00:00.000Z');
    await expect(service.assign('ws_1', 'u_1', 't_1', toExpert)).rejects.toThrow(/retired/);
  });

  it('a person is assigned with a rule too', async () => {
    const { service } = await setup();
    const a = await service.assign('ws_1', 'u_1', 't_1', { assigneeKind: 'person', assigneeId: 'u_9' });
    expect(a).toMatchObject({ state: 'standing', assigneeKind: 'person', assigneeId: 'u_9' });
    expect(a.rule).toMatch(/person/);
  });

  it('reassignment supersedes the earlier one and keeps it in history (FR-EXP-055)', async () => {
    const { service } = await setup();
    await service.assign('ws_1', 'u_1', 't_1', toExpert);
    await service.assign('ws_1', 'u_1', 't_1', { assigneeKind: 'person', assigneeId: 'u_9' });
    const history = await service.history('ws_1', 'u_1', 't_1');
    expect(history.map((h) => [h.assigneeId, h.supersededBy !== null])).toEqual([
      ['u_9', false],
      ['ex_test', true],
    ]);
  });

  it('a later-retired Expert reads as needing reassignment, its row unchanged (analysis C5)', async () => {
    const { service, store } = await setup();
    await service.assign('ws_1', 'u_1', 't_1', toExpert);
    await store.retireExpert('ws_1', 'ex_test', 'u_1', '2026-10-10T00:00:00.000Z');
    const [current] = await service.history('ws_1', 'u_1', 't_1');
    expect(current).toMatchObject({ assigneeRetired: true, needsReassignment: true, state: 'standing' });
  });

  it('assigning runs nothing (FR-EXP-053)', async () => {
    const { service, executions } = await setup();
    await service.assign('ws_1', 'u_1', 't_1', toExpert);
    expect(executions.registered).toEqual([]);
  });

  it('needs edit on the task; an unknown task is not found', async () => {
    const { service } = await setup({ 'u_1:task:t_1': 'read' });
    await expect(service.assign('ws_1', 'u_1', 't_1', toExpert)).rejects.toBeInstanceOf(ForbiddenError);
    const open = (await setup({ 'u_1:task:t_2': 'edit' })).service;
    await expect(open.assign('ws_1', 'u_1', 't_2', toExpert)).rejects.toBeInstanceOf(NotFoundError);
  });
});
