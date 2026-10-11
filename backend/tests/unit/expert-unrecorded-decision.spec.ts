/**
 * `T2574` (EPIC-047 Convergence) — a decision `EPIC-031` could not take is not
 * a decision.
 *
 * `R-047-5`, `R-047-17`, `FR-EXP-005`, fourth audit finding F3. When a source
 * cannot be read, `EPIC-031` refuses without evaluating (`FR-DPE-050`); when
 * even that refusal cannot be stored it answers `decisionId: 'unrecorded'`.
 * Storing either on a version made it unreadable — reading `'unrecorded'`
 * throws, which failed the whole registry list — and unsubmittable forever.
 *
 * Now: a fail-closed submission stores nothing and the version stays a draft;
 * a policy refusal may be resubmitted (`EPIC-031` has no human "reject", so
 * every refusal is policy's, and resubmitting goes through the same policy);
 * and one decision that cannot be read never fails the list.
 */
import { describe, expect, it } from 'vitest';
import type { DecisionOutcome, DecisionRequest, DecisionResult } from '@pmi/decision-contract';
import { ConflictError, GovernanceSeamUnboundError } from '../../src/core/errors.js';
import { decisionApprovals } from '../../src/modules/experts/adapters/decisions.adapter.js';
import { Authoring } from '../../src/modules/experts/authoring.js';
import { InMemoryExpertsStore } from '../../src/modules/experts/experts.store.js';
import type { ContractApprovals } from '../../src/modules/experts/experts.tokens.js';
import { RegistryService } from '../../src/modules/experts/registry.service.js';
import { authorOfWs1, contract, evidenceKnowing, recordingApprovals } from '../helpers/expert-fixtures.js';

function result(decisionId: string, outcome: DecisionOutcome, constraintCited?: string): DecisionResult {
  return {
    decisionId,
    outcome,
    effectiveClass: 'high',
    explanation: {
      policyVersion: '0',
      matchedRule: null,
      riskClass: 'high',
      authorityApplied: 'refused without evaluation',
      ...(constraintCited !== undefined ? { constraintCited } : {}),
    },
    gateOutcomes: [],
  } as unknown as DecisionResult;
}

function engineAnswering(answer: DecisionResult) {
  const requests: DecisionRequest[] = [];
  return {
    requests,
    decisions: {
      async decide(request: DecisionRequest) {
        requests.push(request);
        return answer;
      },
    },
    reads: {
      async standing() {
        return null;
      },
      async withdraw() {},
    },
  };
}

function registry(approvals: ContractApprovals) {
  const store = new InMemoryExpertsStore();
  let n = 0;
  const service = new RegistryService(store, {
    authoring: new Authoring(authorOfWs1()),
    approvals,
    evidence: evidenceKnowing('implementation@1'),
    clock: () => '2026-10-10T09:00:00.000Z',
    ids: () => `id_${(n += 1)}`,
  });
  return { store, service };
}

const input = { key: 'test-engineer', name: 'Test Engineer', contract: contract() };
const submission = {
  workspaceId: 'ws_1',
  actionType: 'expert-contract.approve.medium',
  targetType: 'expert-contract-version',
  targetId: 'cv_1',
  objectVersion: 1,
  riskClass: 'medium' as const,
  actorId: 'u_1',
};

describe('T2574 · the adapter never hands back a decision EPIC-031 did not take', () => {
  it("an unrecorded refusal ('unrecorded') is a 503, not a decision id", async () => {
    const e = engineAnswering(result('unrecorded', 'refused', 'fail closed — no AuditSink is bound'));
    const err = await decisionApprovals(e.decisions, e.reads).submit(submission).catch((x: unknown) => x);
    expect(err).toBeInstanceOf(GovernanceSeamUnboundError);
    expect((err as Error).message).toMatch(/could not be recorded|unrecorded/i);
  });

  it('a recorded fail-closed refusal is a 503 too, naming why, so nothing is stored', async () => {
    const e = engineAnswering(result('dec_9', 'refused', 'fail closed — the tenant policy could not be read'));
    const err = await decisionApprovals(e.decisions, e.reads).submit(submission).catch((x: unknown) => x);
    expect(err).toBeInstanceOf(GovernanceSeamUnboundError);
    expect((err as Error).message).toMatch(/tenant policy could not be read/);
  });

  it('an evaluated refusal is a decision like any other', async () => {
    const e = engineAnswering(result('dec_3', 'refused'));
    await expect(decisionApprovals(e.decisions, e.reads).submit(submission)).resolves.toEqual({ decisionId: 'dec_3' });
  });
});

describe('T2574 · the registry around a decision that could not be taken', () => {
  it('a fail-closed submission leaves the version a draft that can be submitted again', async () => {
    const approvals = recordingApprovals();
    const { store, service } = registry(approvals);
    const { expert } = await service.register('ws_1', 'u_1', input);
    const failing: ContractApprovals = {
      ...approvals,
      async submit() {
        throw new GovernanceSeamUnboundError('EPIC-031 refused without evaluating');
      },
    };
    const broken = new RegistryService(store, {
      authoring: new Authoring(authorOfWs1()),
      approvals: failing,
      evidence: evidenceKnowing('implementation@1'),
    });
    await expect(broken.submit('ws_1', 'u_1', expert.id, 1)).rejects.toBeInstanceOf(GovernanceSeamUnboundError);
    expect((await service.get('ws_1', 'u_1', expert.id)).versions[0]?.status).toBe('draft');
    await expect(service.submit('ws_1', 'u_1', expert.id, 1)).resolves.toMatchObject({ status: 'submitted' });
  });

  it("a version already holding 'unrecorded' (stored before this fix) reads as a draft and can be submitted", async () => {
    const approvals = recordingApprovals();
    const { store, service } = registry(approvals);
    const { expert, version } = await service.register('ws_1', 'u_1', input);
    await store.recordDecision('ws_1', version.id, 'unrecorded');
    const list = await service.list('ws_1', 'u_1');
    expect(list).toHaveLength(1);
    expect((await service.get('ws_1', 'u_1', expert.id)).versions[0]?.status).toBe('draft');
    await expect(service.submit('ws_1', 'u_1', expert.id, 1)).resolves.toMatchObject({ status: 'submitted' });
  });

  it('a refused version may be resubmitted; a pending or approved one may not', async () => {
    const approvals = recordingApprovals();
    const { service } = registry(approvals);
    const { expert } = await service.register('ws_1', 'u_1', input);
    const first = await service.submit('ws_1', 'u_1', expert.id, 1);
    await expect(service.submit('ws_1', 'u_1', expert.id, 1)).rejects.toBeInstanceOf(ConflictError);
    approvals.resolve(first.decisionId!, 'refused');
    const second = await service.submit('ws_1', 'u_1', expert.id, 1);
    expect(second.decisionId).not.toBe(first.decisionId);
    expect(second.status).toBe('submitted');
    approvals.resolve(second.decisionId!, 'approved');
    await expect(service.submit('ws_1', 'u_1', expert.id, 1)).rejects.toBeInstanceOf(ConflictError);
  });

  it('one decision that cannot be read never fails the list, and shows as unreadable', async () => {
    const approvals = recordingApprovals();
    const { service } = registry({
      ...approvals,
      async resolutionOf(ws, id) {
        if (id === 'd_1') throw new Error('EPIC-031 has no decision d_1');
        return approvals.resolutionOf(ws, id);
      },
    });
    const a = await service.register('ws_1', 'u_1', input);
    const b = await service.register('ws_1', 'u_1', { ...input, key: 'reviewer' });
    await service.submit('ws_1', 'u_1', a.expert.id, 1).catch(() => undefined);
    const list = await service.list('ws_1', 'u_1');
    expect(list.map((e) => e.key).sort()).toEqual(['reviewer', 'test-engineer']);
    expect((await service.get('ws_1', 'u_1', a.expert.id)).versions[0]?.status).toBe('unreadable');
    expect((await service.get('ws_1', 'u_1', b.expert.id)).versions[0]?.status).toBe('draft');
  });
});
