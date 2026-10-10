/**
 * `T1977` (EPIC-047) — contract approval through `EPIC-031`'s decision engine.
 *
 * `R-047-5`, `R-047-6`, `FR-EXP-005`. Submitting a contract version asks the
 * engine to decide `expert-contract.approve` on that version, proposing the
 * contract's risk class — a proposal, never an assignment (`FR-DPE-003`).
 * `EPIC-031` offers no callback, so the resolution is read every time it
 * matters: the decision itself if it was concluded outright, otherwise the
 * decision that resolved it, otherwise still pending.
 *
 * Fails closed: a decision this module recorded that `EPIC-031` cannot find is
 * a fault, never *pending*; and an outcome the approval vocabulary has no word
 * for is never read as *approved*.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  RISK_BANDS as CONTRACT_BANDS,
  type DecisionOutcome,
  type DecisionRequest,
  type DecisionResult,
  type RiskBand as ContractRiskBand,
} from '@pmi/decision-contract';
import { RISK_BANDS as LOCAL_BANDS, type RiskBand as LocalRiskBand } from '../../src/modules/experts/expert.types.js';
import {
  WORKSPACE_DECISION_SCOPE,
  decisionApprovals,
  type DecisionReader,
} from '../../src/modules/experts/adapters/decisions.adapter.js';

interface Row {
  readonly id: string;
  readonly workspaceId: string;
  readonly outcome: DecisionOutcome;
  readonly resolvesDecisionId: string | null;
}

function engine(outcome: DecisionOutcome = 'pending') {
  const requests: DecisionRequest[] = [];
  return {
    requests,
    async decide(request: DecisionRequest): Promise<DecisionResult> {
      requests.push(request);
      return { decisionId: `d_${requests.length}`, outcome } as DecisionResult;
    },
  };
}

function reader(rows: Row[]): DecisionReader & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    async get(workspaceId, id) {
      reads.push(`get ${workspaceId}/${id}`);
      return rows.find((r) => r.workspaceId === workspaceId && r.id === id) ?? null;
    },
    async resolutionOf(workspaceId, id) {
      reads.push(`resolutionOf ${workspaceId}/${id}`);
      return rows.find((r) => r.workspaceId === workspaceId && r.resolvesDecisionId === id) ?? null;
    },
  };
}

const row = (id: string, outcome: DecisionOutcome, resolves: string | null = null, workspaceId = 'ws_1'): Row => ({
  id,
  workspaceId,
  outcome,
  resolvesDecisionId: resolves,
});

const submission = {
  workspaceId: 'ws_1',
  actionType: 'expert-contract.approve',
  targetType: 'expert-contract-version',
  targetId: 'cv_7',
  objectVersion: 3,
  riskClass: 'medium' as const,
  actorId: 'u_author',
};

describe('T1977 · submitting a contract version asks EPIC-031 to decide it', () => {
  it('calls decide with the action, the version as target, and the risk class as a proposal', async () => {
    const e = engine();
    const approvals = decisionApprovals(e, reader([]));
    await expect(approvals.submit(submission)).resolves.toEqual({ decisionId: 'd_1' });
    expect(e.requests).toEqual([
      {
        workspaceId: 'ws_1',
        projectId: WORKSPACE_DECISION_SCOPE('ws_1'),
        actionType: 'expert-contract.approve',
        target: { type: 'expert-contract-version', id: 'cv_7' },
        objectVersion: '3',
        actor: { kind: 'human', id: 'u_author' },
        // FR-DPE-015 — who asked, so self-approval is refused unless policy says otherwise.
        requestedBy: 'u_author',
        proposedClass: 'medium',
        requiredGates: [],
      },
    ]);
  });

  it('proposes, never assigns: the request carries no effective class of its own', async () => {
    const e = engine();
    await decisionApprovals(e, reader([])).submit({ ...submission, riskClass: 'low' });
    expect(e.requests[0]).toHaveProperty('proposedClass', 'low');
    expect(e.requests[0]).not.toHaveProperty('effectiveClass');
  });

  it('returns the decision id even when policy refuses outright — the refusal is read back, not lost', async () => {
    const approvals = decisionApprovals(engine('refused'), reader([row('d_1', 'refused')]));
    const { decisionId } = await approvals.submit(submission);
    await expect(approvals.resolutionOf('ws_1', decisionId)).resolves.toBe('refused');
  });

  it('names no project: an Expert belongs to its workspace, and the scope says so without inventing one', () => {
    expect(WORKSPACE_DECISION_SCOPE('ws_1')).toBe('workspace:ws_1');
    expect(WORKSPACE_DECISION_SCOPE('ws_2')).not.toBe(WORKSPACE_DECISION_SCOPE('ws_1'));
  });
});

describe('T1977 · the resolution is read through resolutionOf, every time', () => {
  it('pending, with nothing resolving it, is pending', async () => {
    const r = reader([row('d_1', 'pending')]);
    await expect(decisionApprovals(engine(), r).resolutionOf('ws_1', 'd_1')).resolves.toBe('pending');
    expect(r.reads).toEqual(['get ws_1/d_1', 'resolutionOf ws_1/d_1']);
  });

  it('pending, resolved by an approval, is approved', async () => {
    const r = reader([row('d_1', 'pending'), row('d_2', 'approved', 'd_1')]);
    await expect(decisionApprovals(engine(), r).resolutionOf('ws_1', 'd_1')).resolves.toBe('approved');
  });

  it('pending, resolved by a refusal, is refused', async () => {
    const r = reader([row('d_1', 'pending'), row('d_2', 'refused', 'd_1')]);
    await expect(decisionApprovals(engine(), r).resolutionOf('ws_1', 'd_1')).resolves.toBe('refused');
  });

  it('auto-executed by policy is approved; refused outright is refused', async () => {
    const r = reader([row('d_1', 'auto-executed'), row('d_2', 'refused')]);
    const approvals = decisionApprovals(engine(), r);
    await expect(approvals.resolutionOf('ws_1', 'd_1')).resolves.toBe('approved');
    await expect(approvals.resolutionOf('ws_1', 'd_2')).resolves.toBe('refused');
  });

  it('is not cached: a later resolution is the one read', async () => {
    const rows = [row('d_1', 'pending')];
    const approvals = decisionApprovals(engine(), reader(rows));
    await expect(approvals.resolutionOf('ws_1', 'd_1')).resolves.toBe('pending');
    rows.push(row('d_2', 'approved', 'd_1'));
    await expect(approvals.resolutionOf('ws_1', 'd_1')).resolves.toBe('approved');
  });

  it('reads only inside the workspace it is asked about', async () => {
    const r = reader([row('d_1', 'approved', null, 'ws_2')]);
    await expect(decisionApprovals(engine(), r).resolutionOf('ws_1', 'd_1')).rejects.toThrow(/d_1/);
  });

  it('a decision EPIC-031 cannot find is a fault, never pending', async () => {
    await expect(decisionApprovals(engine(), reader([])).resolutionOf('ws_1', 'd_missing')).rejects.toThrow(
      /d_missing/,
    );
  });

  it('an exception outcome is never read as approved — the approval vocabulary has no word for it', async () => {
    const r = reader([row('d_1', 'refused'), row('d_2', 'exception', 'd_1')]);
    await expect(decisionApprovals(engine(), r).resolutionOf('ws_1', 'd_1')).rejects.toThrow(/exception/);
  });

  it('a read fault propagates; it never reads as pending', async () => {
    const failing: DecisionReader = {
      async get() {
        throw new Error('decision store unreachable');
      },
      async resolutionOf() {
        throw new Error('unreachable');
      },
    };
    await expect(decisionApprovals(engine(), failing).resolutionOf('ws_1', 'd_1')).rejects.toThrow(
      /decision store unreachable/,
    );
  });
});

describe('T1977 · R-047-6 — one risk vocabulary in the programme (architecture)', () => {
  it("the experts' RiskBand is decision-contract's, member for member", () => {
    expect([...LOCAL_BANDS]).toEqual([...CONTRACT_BANDS]);
    expectTypeOf<LocalRiskBand>().toEqualTypeOf<ContractRiskBand>();
  });
});
