/**
 * `T1967` (EPIC-047) — risky work does not go to an Expert on a field edit.
 *
 * `FR-EXP-054`. Where the task's band exceeds what the workspace lets an
 * Expert take unattended, the assignment is `pending-decision` with an
 * `EPIC-031` decision, and stands only when that decision is approved. With no
 * policy at all, every Expert assignment needs a decision: the absence of a
 * rule is not a permission. Unbound, the decision path refuses `503`.
 */
import { describe, expect, it } from 'vitest';
import { GovernanceSeamUnboundError } from '../../src/core/errors.js';
import { AssignmentService } from '../../src/modules/experts/assignment.service.js';
import { Authoring } from '../../src/modules/experts/authoring.js';
import type { RiskBand } from '../../src/modules/experts/expert.types.js';
import { InMemoryExpertsStore } from '../../src/modules/experts/experts.store.js';
import { refusingContractApprovals, type ContractApprovals } from '../../src/modules/experts/experts.tokens.js';
import { accessFrom, contract, expert, recordingApprovals, version } from '../helpers/expert-fixtures.js';

async function setup(maxUnattendedBand: RiskBand | null, approvals: ContractApprovals = recordingApprovals()) {
  const store = new InMemoryExpertsStore();
  await store.addExpert(expert());
  await store.addVersion(version({ contract: contract(), decisionId: 'd_ok' }));
  const ok = recordingApprovals();
  ok.resolve('d_ok', 'approved');
  if (maxUnattendedBand !== null) {
    await store.putPolicy({
      workspaceId: 'ws_1', maxDepth: 3, maxFanOut: 5, allowedPairs: [], maxUnattendedBand,
      updatedBy: 'u_1', updatedAt: '2026-10-09T09:00:00.000Z',
    });
  }
  // Contract approval reads `d_ok`; assignment decisions go to `approvals`.
  const both: ContractApprovals = {
    submit: (input) => approvals.submit(input),
    resolutionOf: (ws, id) => (id === 'd_ok' ? ok.resolutionOf(ws, id) : approvals.resolutionOf(ws, id)),
  };
  const service = new AssignmentService(store, {
    authoring: new Authoring(accessFrom({ 'u_1:task:t_1': 'edit' })),
    approvals: both,
    tasks: { exists: async () => true },
  });
  return { store, service };
}

const assign = (riskClass: RiskBand) => ({ assigneeKind: 'expert' as const, assigneeId: 'ex_test', capabilities: ['test'], riskClass });

describe('T1967 · the assignment risk gate', () => {
  it('a band above the policy maximum is pending a decision, sent to EPIC-031 with that band', async () => {
    const approvals = recordingApprovals();
    const { service } = await setup('medium', approvals);
    const a = await service.assign('ws_1', 'u_1', 't_1', assign('high'));
    expect(a).toMatchObject({ state: 'pending-decision', decisionId: 'd_1' });
    expect(approvals.submitted[0]).toMatchObject({ actionType: 'task.assign-expert', targetType: 'task', targetId: 't_1', riskClass: 'high' });
  });

  it('it stands once approved, and reads refused if refused', async () => {
    const approvals = recordingApprovals();
    const { service } = await setup('medium', approvals);
    await service.assign('ws_1', 'u_1', 't_1', assign('high'));
    approvals.resolve('d_1', 'approved');
    expect((await service.history('ws_1', 'u_1', 't_1'))[0]?.state).toBe('standing');
    approvals.resolve('d_1', 'refused');
    expect((await service.history('ws_1', 'u_1', 't_1'))[0]?.state).toBe('refused');
  });

  it('a band within the maximum stands at once', async () => {
    const { service } = await setup('medium');
    expect((await service.assign('ws_1', 'u_1', 't_1', assign('medium'))).state).toBe('standing');
  });

  it('with no policy, every Expert assignment needs a decision', async () => {
    const { service } = await setup(null);
    expect((await service.assign('ws_1', 'u_1', 't_1', assign('low'))).state).toBe('pending-decision');
  });

  it('unbound, the decision path refuses 503 rather than assigning ungated', async () => {
    const { service } = await setup('low', refusingContractApprovals());
    await expect(service.assign('ws_1', 'u_1', 't_1', assign('high'))).rejects.toBeInstanceOf(GovernanceSeamUnboundError);
  });
});
