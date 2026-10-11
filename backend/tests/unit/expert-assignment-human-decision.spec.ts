/**
 * `T2572` (EPIC-047 Convergence) — a gated assignment stands only on a
 * **human** decision.
 *
 * `FR-EXP-054`, fourth audit finding F2. Above the workspace's unattended
 * maximum, an assignment needs "a human decision through `EPIC-031`". But
 * `EPIC-031` classifies by its own steering: a tenant rule putting `task.*` in
 * the low band makes the decision **auto-execute**, with no human at all. That
 * outcome must not read as standing. Nor may a refusal — a gate refusal or a
 * fail-closed one — leave the task silently held: it needs reassignment.
 */
import { describe, expect, it } from 'vitest';
import { AssignmentService } from '../../src/modules/experts/assignment.service.js';
import { Authoring } from '../../src/modules/experts/authoring.js';
import { InMemoryExpertsStore } from '../../src/modules/experts/experts.store.js';
import type { Resolution } from '../../src/modules/experts/experts.tokens.js';
import { accessFrom, contract, expert, recordingApprovals, version } from '../helpers/expert-fixtures.js';

async function setup() {
  const store = new InMemoryExpertsStore();
  const approvals = recordingApprovals();
  await store.addExpert(expert());
  await store.addVersion(version({ contract: contract({ capabilities: ['test'] }), decisionId: 'd_ok' }));
  approvals.resolve('d_ok', 'approved');
  await store.putPolicy({
    workspaceId: 'ws_1', maxDepth: 3, maxFanOut: 5, allowedPairs: [], maxUnattendedBand: 'low',
    updatedBy: 'u_1', updatedAt: '2026-10-10T09:00:00.000Z',
  });
  let n = 0;
  const service = new AssignmentService(store, {
    authoring: new Authoring(accessFrom({ 'u_1:task:t_1': 'edit' })),
    approvals,
    tasks: { exists: async (_ws, id) => id === 't_1' },
    clock: () => `2026-10-10T09:00:0${(n += 1)}.000Z`,
    ids: () => `as_${n}`,
  });
  return { approvals, service };
}

/** A high-band task: above the unattended maximum of low, so a human must decide. */
const gated = { assigneeKind: 'expert' as const, assigneeId: 'ex_test', capabilities: ['test'], riskClass: 'high' as const };

async function assignedThenResolved(resolution: Resolution) {
  const { approvals, service } = await setup();
  const a = await service.assign('ws_1', 'u_1', 't_1', gated);
  expect(a.state).toBe('pending-decision');
  approvals.resolve(a.decisionId!, resolution);
  const [current] = await service.history('ws_1', 'u_1', 't_1');
  return current!;
}

describe('T2572 · a gated assignment stands only on a human approval (FR-EXP-054)', () => {
  it('a human approval makes it stand', async () => {
    const current = await assignedThenResolved('approved');
    expect([current.state, current.needsReassignment]).toEqual(['standing', false]);
  });

  it('an approval no human gave — auto-executed by a low rule for task.* — does not make it stand', async () => {
    const current = await assignedThenResolved('approved-unattended');
    expect(current.state).not.toBe('standing');
    expect(current.needsReassignment).toBe(true);
  });

  it('a refusal (a gate refusal, or a fail-closed one) leaves the task needing reassignment', async () => {
    const current = await assignedThenResolved('refused');
    expect([current.state, current.needsReassignment]).toEqual(['refused', true]);
  });

  it('an assignment within the unattended maximum needs no decision at all', async () => {
    const { approvals, service } = await setup();
    const a = await service.assign('ws_1', 'u_1', 't_1', { ...gated, riskClass: 'low' });
    expect([a.state, a.decisionId]).toEqual(['standing', null]);
    expect(approvals.submitted).toHaveLength(0);
  });
});
