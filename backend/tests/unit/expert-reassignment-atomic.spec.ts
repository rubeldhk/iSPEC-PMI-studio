/**
 * `T2599` (EPIC-047 Convergence) — reassignment never leaves a task holding
 * nothing.
 *
 * `FR-EXP-055`, `FR-EXP-054`, Phase 17 finding F1. Reassignment superseded the
 * old assignment, then withdrew its pending decision, then recorded the new
 * one. A withdrawal that failed — a reviewer approved the decision a moment
 * earlier, so `EPIC-031` answers 409, or `EPIC-031` was unreachable — threw
 * after the old assignment was gone and before the new one existed.
 *
 * Now the new assignment is recorded first; the withdrawal comes last and its
 * failure does not undo a reassignment that has already happened. A decision
 * already resolved is simply nothing to withdraw.
 */
import { describe, expect, it } from 'vitest';
import { ConflictError } from '../../src/core/errors.js';
import { AssignmentService } from '../../src/modules/experts/assignment.service.js';
import { Authoring } from '../../src/modules/experts/authoring.js';
import { InMemoryExpertsStore } from '../../src/modules/experts/experts.store.js';
import type { ContractApprovals } from '../../src/modules/experts/experts.tokens.js';
import { accessFrom, contract, expert, recordingApprovals, version } from '../helpers/expert-fixtures.js';

async function setup(withdraw: ContractApprovals['withdraw']) {
  const store = new InMemoryExpertsStore();
  const approvals = recordingApprovals();
  await store.addExpert(expert());
  await store.addVersion(version({ contract: contract({ capabilities: ['test'] }), decisionId: 'd_ok' }));
  approvals.resolve('d_ok', 'approved');
  let n = 0;
  const service = new AssignmentService(store, {
    authoring: new Authoring(accessFrom({ 'u_1:task:t_1': 'edit' })),
    approvals: { ...approvals, withdraw },
    tasks: { exists: async (_ws, id) => id === 't_1' },
    clock: () => `2026-10-10T09:00:0${(n += 1)}.000Z`,
    ids: () => `as_${n}`,
  });
  return { service };
}

const gated = { assigneeKind: 'expert' as const, assigneeId: 'ex_test', capabilities: ['test'], riskClass: 'high' as const };
const toPerson = { assigneeKind: 'person' as const, assigneeId: 'u_9' };

async function current(service: AssignmentService) {
  return (await service.history('ws_1', 'u_1', 't_1')).filter((a) => a.supersededAt === null);
}

describe('T2599 · reassignment leaves exactly one current assignment', () => {
  it('when EPIC-031 answers that the decision was already resolved (409), the reassignment stands', async () => {
    const { service } = await setup(async () => {
      throw new ConflictError('decision d_1 is already resolved');
    });
    await service.assign('ws_1', 'u_1', 't_1', gated);
    await expect(service.assign('ws_1', 'u_1', 't_1', toPerson)).resolves.toMatchObject({ assigneeId: 'u_9' });
    expect((await current(service)).map((a) => a.assigneeId)).toEqual(['u_9']);
  });

  it('when EPIC-031 is unreachable, the reassignment still stands — never the old one superseded and no new one', async () => {
    const { service } = await setup(async () => {
      throw new Error('connection refused');
    });
    await service.assign('ws_1', 'u_1', 't_1', gated);
    await expect(service.assign('ws_1', 'u_1', 't_1', toPerson)).resolves.toMatchObject({ assigneeId: 'u_9' });
    const history = await service.history('ws_1', 'u_1', 't_1');
    expect(history.map((a) => [a.assigneeId, a.supersededAt === null])).toEqual([
      ['u_9', true],
      ['ex_test', false],
    ]);
  });
});
