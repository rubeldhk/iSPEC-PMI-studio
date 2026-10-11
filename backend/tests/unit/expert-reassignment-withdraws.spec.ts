/**
 * `T2576` (EPIC-047 Convergence) — reassigning a task withdraws the decision
 * its superseded assignment was waiting on.
 *
 * `FR-EXP-055`, `FR-EXP-054`, fourth audit finding F4. A gated assignment puts
 * a pending decision in reviewers' Decision Inbox. Reassigning the task
 * supersedes the assignment — and, before this, left the decision there: a
 * reviewer could be asked to approve an assignment that no longer exists.
 *
 * Two halves: the Experts module withdraws the decision on reassignment, and
 * `EPIC-031` gains the withdrawal — a resolving record, so the decision leaves
 * the inbox, and never a "blocked" entry for the person who reassigned.
 */
import { describe, expect, it } from 'vitest';
import type { AuditSink, DecisionRequest } from '@pmi/decision-contract';
import { ConflictError } from '../../src/core/errors.js';
import { InMemoryDecisionRepository } from '../../src/modules/decision/decision.repository.js';
import { DecisionService } from '../../src/modules/decision/decision.service.js';
import { DecisionEngine } from '../../src/modules/decision/evaluator.js';
import { PLATFORM_DEFAULT_POLICY } from '../../src/modules/decision/policy.loader.js';
import { AssignmentService } from '../../src/modules/experts/assignment.service.js';
import { Authoring } from '../../src/modules/experts/authoring.js';
import { InMemoryExpertsStore } from '../../src/modules/experts/experts.store.js';
import { accessFrom, contract, expert, recordingApprovals, version } from '../helpers/expert-fixtures.js';

async function assignments() {
  const store = new InMemoryExpertsStore();
  const approvals = recordingApprovals();
  await store.addExpert(expert());
  await store.addVersion(version({ contract: contract({ capabilities: ['test'] }), decisionId: 'd_ok' }));
  approvals.resolve('d_ok', 'approved');
  let n = 0;
  const service = new AssignmentService(store, {
    authoring: new Authoring(accessFrom({ 'u_1:task:t_1': 'edit', 'u_2:task:t_1': 'edit' })),
    approvals,
    tasks: { exists: async (_ws, id) => id === 't_1' },
    clock: () => `2026-10-10T09:00:0${(n += 1)}.000Z`,
    ids: () => `as_${n}`,
  });
  return { approvals, service };
}

const gated = { assigneeKind: 'expert' as const, assigneeId: 'ex_test', capabilities: ['test'], riskClass: 'high' as const };

describe('T2576 · reassignment withdraws the superseded assignment’s pending decision', () => {
  it('reassigning to a person withdraws the decision, naming who and why', async () => {
    const { approvals, service } = await assignments();
    const first = await service.assign('ws_1', 'u_1', 't_1', gated);
    expect(first.state).toBe('pending-decision');
    await service.assign('ws_1', 'u_2', 't_1', { assigneeKind: 'person', assigneeId: 'u_9' });
    expect(approvals.withdrawn).toEqual([
      expect.objectContaining({ workspaceId: 'ws_1', decisionId: first.decisionId, actorId: 'u_2' }),
    ]);
    expect(approvals.withdrawn[0]?.reason).toMatch(/reassign|supersed/i);
  });

  it('reassigning to another gated Expert withdraws only the superseded decision', async () => {
    const { approvals, service } = await assignments();
    const first = await service.assign('ws_1', 'u_1', 't_1', gated);
    const second = await service.assign('ws_1', 'u_1', 't_1', gated);
    expect(approvals.withdrawn.map((w) => w.decisionId)).toEqual([first.decisionId]);
    expect(second.state).toBe('pending-decision');
  });

  it('a superseded assignment that already stood, or needed no decision, withdraws nothing', async () => {
    const { approvals, service } = await assignments();
    const first = await service.assign('ws_1', 'u_1', 't_1', gated);
    approvals.resolve(first.decisionId!, 'approved');
    await service.assign('ws_1', 'u_1', 't_1', { assigneeKind: 'person', assigneeId: 'u_9' });
    await service.assign('ws_1', 'u_1', 't_1', { assigneeKind: 'person', assigneeId: 'u_8' });
    expect(approvals.withdrawn).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────── the EPIC-031 half

function decisions() {
  const repository = new InMemoryDecisionRepository();
  const audit: AuditSink = { async record() {} };
  const policies = { current: async () => PLATFORM_DEFAULT_POLICY };
  const engine = new DecisionEngine({
    steering: { rulesetFor: async () => ({ rules: [], source: null }) },
    policies,
    gates: null,
    audit,
    repository,
  });
  return { engine, service: new DecisionService(engine, repository, policies) };
}

const request: DecisionRequest = {
  workspaceId: 'ws_1',
  projectId: '(workspace)',
  actionType: 'task.assign-expert',
  target: { type: 'task', id: 't_1' },
  objectVersion: '1',
  actor: { kind: 'human', id: 'u_1' },
  requestedBy: 'u_1',
  requiredGates: [],
  proposedClass: 'high',
};

describe('T2576 · EPIC-031 withdraws a pending decision', () => {
  it('the withdrawn decision leaves every inbox, and the withdrawal blocks no one', async () => {
    const { engine, service } = decisions();
    const { decisionId, outcome } = await engine.decide(request);
    expect(outcome).toBe('pending');
    expect((await service.inbox({ workspaceId: 'ws_1', userId: 'u_2' })).entries).toHaveLength(1);

    await service.withdraw('ws_1', decisionId, 'u_3', 'the task was reassigned');

    for (const userId of ['u_1', 'u_2', 'u_3']) {
      expect((await service.inbox({ workspaceId: 'ws_1', userId })).entries).toEqual([]);
    }
    expect(await service.standing('ws_1', decisionId)).toMatchObject({ outcome: 'refused', byHuman: false });
  });

  it('withdrawing a decision already resolved, or not pending, is a conflict', async () => {
    const { engine, service } = decisions();
    const { decisionId } = await engine.decide(request);
    await service.approve({ workspaceId: 'ws_1', userId: 'u_2' }, decisionId);
    await expect(service.withdraw('ws_1', decisionId, 'u_1', 'too late')).rejects.toBeInstanceOf(ConflictError);
  });

  it('a withdrawal states its reason', async () => {
    const { engine, service } = decisions();
    const { decisionId } = await engine.decide(request);
    await expect(service.withdraw('ws_1', decisionId, 'u_1', '  ')).rejects.toThrow(/reason/);
  });
});
