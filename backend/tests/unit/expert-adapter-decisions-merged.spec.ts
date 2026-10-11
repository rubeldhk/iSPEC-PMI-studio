/**
 * `T2542` (EPIC-047 Convergence) — contract approval through the merged
 * `EPIC-031` decision engine. Supersedes `T1977`.
 *
 * `R-047-5`, `R-047-6`, `R-047-16`, `FR-EXP-005`, `FR-EXP-054`. Submission
 * builds a real `DecisionRequest`: the project is the workspace scope recorded
 * in `R-047-16`, the version a string, the submitter a human `ActorRef` who
 * also `requestedBy` (so `EPIC-031` refuses self-approval), the contract's risk
 * class proposed — never assigned. Resolution is read through `EPIC-031`'s
 * exported `DecisionService.standing`, which follows a pending decision to the
 * record that resolved it.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { DecisionOutcome, DecisionRequest, DecisionResult, RiskBand as DecisionBand } from '@pmi/decision-contract';
import { RISK_BANDS as DECISION_BANDS } from '@pmi/decision-contract';
import { decisionApprovals, WORKSPACE_SCOPE } from '../../src/modules/experts/adapters/decisions.adapter.js';
import { RISK_BANDS, type RiskBand } from '../../src/modules/experts/expert.types.js';

function engine(outcome: DecisionOutcome = 'pending') {
  const requests: DecisionRequest[] = [];
  const standings = new Map<string, { outcome: DecisionOutcome; byHuman: boolean }>();
  const withdrawals: string[] = [];
  return {
    requests,
    standings,
    withdrawals,
    decisions: {
      async decide(request: DecisionRequest) {
        requests.push(request);
        const decisionId = `dec_${requests.length}`;
        standings.set(decisionId, { outcome, byHuman: false });
        return { decisionId, outcome, explanation: {} as DecisionResult['explanation'] };
      },
    },
    reads: {
      async standing(_workspaceId: string, decisionId: string) {
        return standings.get(decisionId) ?? null;
      },
      async withdraw(_workspaceId: string, decisionId: string, by: string, reason: string) {
        withdrawals.push(`${decisionId}|${by}|${reason}`);
      },
    },
  };
}

const submission = {
  workspaceId: 'ws_1',
  actionType: 'expert-contract.approve.medium',
  targetType: 'expert-contract-version',
  targetId: 'cv_1',
  objectVersion: 3,
  riskClass: 'medium' as const,
  actorId: 'u_1',
};

describe('T2542 · contract approvals over EPIC-031', () => {
  it('submits a DecisionRequest EPIC-031 accepts', async () => {
    const e = engine();
    const { decisionId } = await decisionApprovals(e.decisions, e.reads).submit(submission);
    expect(decisionId).toBe('dec_1');
    expect(e.requests[0]).toEqual({
      workspaceId: 'ws_1',
      projectId: WORKSPACE_SCOPE,
      actionType: 'expert-contract.approve.medium',
      target: { type: 'expert-contract-version', id: 'cv_1' },
      objectVersion: '3',
      actor: { kind: 'human', id: 'u_1' },
      proposedClass: 'medium',
      requiredGates: [],
      requestedBy: 'u_1',
    });
  });

  it('a submission naming a project decides against that project', async () => {
    const e = engine();
    await decisionApprovals(e.decisions, e.reads).submit({ ...submission, projectId: 'pr_9' });
    expect(e.requests[0]?.projectId).toBe('pr_9');
  });

  it('maps a standing to pending, approved, approved-unattended or refused (T2573)', async () => {
    const e = engine();
    const approvals = decisionApprovals(e.decisions, e.reads);
    const cases: [DecisionOutcome, boolean, string][] = [
      ['pending', false, 'pending'],
      ['approved', true, 'approved'],
      ['exception', true, 'approved'],
      ['approved', false, 'approved-unattended'],
      ['auto-executed', false, 'approved-unattended'],
      ['refused', false, 'refused'],
      ['refused', true, 'refused'],
    ];
    for (const [outcome, byHuman, expected] of cases) {
      e.standings.set('d', { outcome, byHuman });
      expect(await approvals.resolutionOf('ws_1', 'd')).toBe(expected);
    }
  });

  it('withdraws through EPIC-031, naming who and why (T2577)', async () => {
    const e = engine();
    await decisionApprovals(e.decisions, e.reads).withdraw({
      workspaceId: 'ws_1',
      decisionId: 'dec_1',
      actorId: 'u_2',
      reason: 'reassigned',
    });
    expect(e.withdrawals).toEqual(['dec_1|u_2|reassigned']);
  });

  it('a decision EPIC-031 does not know is a fault, never read as pending', async () => {
    const e = engine();
    await expect(decisionApprovals(e.decisions, e.reads).resolutionOf('ws_1', 'nope')).rejects.toThrow(/nope/);
  });

  it('the local RiskBand is EPIC-031’s, member for member (R-047-6)', () => {
    expect([...RISK_BANDS]).toEqual([...DECISION_BANDS]);
    expectTypeOf<RiskBand>().toEqualTypeOf<DecisionBand>();
  });
});
