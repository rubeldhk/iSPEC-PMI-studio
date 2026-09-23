/**
 * T1086 (EPIC-030 Phase C2A) — the six verdicts and what each one means.
 *
 * `FR-GEL-065`–`FR-GEL-070`.
 *
 * ## The distinction the whole adjudication turns on
 *
 * **`validated` is not `applied`.** A proposal can be entirely valid — the
 * transition permitted, the authority held, every gate satisfied — and still
 * not be applied, because policy routes application separately. Rev 2 collapsed
 * these and the project owner corrected it: *"A successful validation must not
 * imply that a transition was applied unless policy authorizes application."*
 *
 * **`applied` is not claimed until EPIC-009 confirms.** This Epic does not
 * execute the transition; it asks EPIC-009 to, and EPIC-009 may confirm, refuse
 * or fail to answer. An unknown answer is `reconciliation_required` — never
 * `applied` (which would be a lie) and never `refused` (which would be a
 * different lie, since the transition may well have happened).
 */
import { describe, expect, it } from 'vitest';
import { ProposalAdjudicatorService } from '../../../src/modules/loop/adjudicator.service';
import type {
  AdjudicationProposal,
  ApprovalAttempt,
  LifecycleApplicationOutcome,
} from '@pmi/loop-contract';

const PROPOSAL: AdjudicationProposal = {
  proposalId: 'p1',
  executionId: 'e1',
  workspaceId: 'w1',
  specificationId: 's1',
  expectedCurrentStatus: 'draft',
  requestedStatus: 'review',
  targetVersion: 3,
  proposerId: 'u1',
  proposerType: 'agent',
  proposerIdentitySnapshotId: 'snap-agent',
  originatingConnector: 'fixture',
  evidenceRefs: ['ev-1'],
  reason: 'clarification complete',
  correlationId: 'c1',
  causationId: 'e1',
  idempotencyKey: 'k1',
  proposedAt: '2026-08-25T00:00:00.000Z',
};

interface Options {
  observed?: string;
  permitted?: boolean;
  authorities?: readonly string[];
  required?: readonly string[];
  gatesPassed?: boolean;
  autoApply?: boolean;
  application?: LifecycleApplicationOutcome;
}

function service(o: Options = {}): ProposalAdjudicatorService {
  const applied: string[] = [];
  const svc = new ProposalAdjudicatorService(
    {
      currentStatus: async () => o.observed ?? 'draft',
      isPermitted: async () => o.permitted ?? true,
    },
    {
      outcomesFor: async () => ({
        disposition: o.gatesPassed === false ? ('failed' as const) : ('passed' as const),
        blocking: undefined,
      }),
    },
    {
      requiredAuthorities: async () => o.required ?? [],
      actorAuthorities: async () => o.authorities ?? [],
      autoApplyPermitted: async () => o.autoApply ?? true,
    },
    {
      apply: async () => {
        applied.push('called');
        return o.application ?? { outcome: 'confirmed', transitionId: 't1' };
      },
    },
    { humanSelfApprovalPermitted: false },
    { record: async () => 'rec-1', findByIdempotency: async () => null },
    { requireEditable: async () => undefined },
  );
  (svc as any).__applied = applied;
  return svc;
}

const appliedCalls = (svc: ProposalAdjudicatorService): string[] =>
  (svc as any).__applied as string[];

describe('T1086 · applied — only after EPIC-009 confirms', () => {
  it('applies a valid, authorised, gate-passing, auto-apply proposal', async () => {
    const svc = service();
    const v = await svc.adjudicate(PROPOSAL);
    expect(v.verdict).toBe('applied');
    expect(v.appliedTransitionId).toBe('t1');
  });

  it('NEVER returns applied when EPIC-009 refuses', async () => {
    const svc = service({ application: { outcome: 'refused', reason: 'lifecycle refused' } });
    const v = await svc.adjudicate(PROPOSAL);
    expect(v.verdict).toBe('refused');
    expect(v.appliedTransitionId).toBeUndefined();
  });

  it('returns reconciliation_required when the application outcome is UNKNOWN', async () => {
    // The load-bearing case. A timeout means the transition may or may not have
    // happened; claiming either is a lie about the authoritative record.
    const svc = service({
      application: {
        outcome: 'unknown',
        cause: 'application_outcome_unknown',
        reason: 'timeout',
      },
    });
    const v = await svc.adjudicate(PROPOSAL);
    expect(v.verdict).toBe('reconciliation_required');
    expect(v.appliedTransitionId).toBeUndefined();
  });
});

describe('T1086 · validated — valid, and deliberately not applied', () => {
  it('returns validated, and does NOT call EPIC-009, when policy withholds auto-apply', async () => {
    const svc = service({ autoApply: false });
    const v = await svc.adjudicate(PROPOSAL);
    expect(v.verdict).toBe('validated');
    expect(v.appliedTransitionId).toBeUndefined();
    expect(appliedCalls(svc), 'a validated proposal must not reach EPIC-009').toEqual([]);
  });
});

describe('T1086 · approval_required and refused — nothing is applied', () => {
  it('requires approval when the actor lacks the authority', async () => {
    const svc = service({ required: ['approve:review'], authorities: [] });
    const v = await svc.adjudicate(PROPOSAL);
    // Narrowing, not casting: the union means `requiredApproverRole` is only
    // reachable once the verdict is known, which is the point of the change.
    expect(v.verdict).toBe('approval_required');
    if (v.verdict !== 'approval_required') throw new Error('not approval_required');
    expect(v.requiredApproverRole).toBe('approve:review');
    expect(appliedCalls(svc)).toEqual([]);
  });

  it('refuses when a gate did not pass', async () => {
    const svc = service({ gatesPassed: false });
    const v = await svc.adjudicate(PROPOSAL);
    expect(v.verdict).toBe('refused');
    expect(appliedCalls(svc)).toEqual([]);
  });

  it('refuses when the lifecycle does not permit the transition', async () => {
    // Validity is EPIC-009's answer, not a table held here (`FR-GEL-065`).
    const svc = service({ permitted: false });
    const v = await svc.adjudicate(PROPOSAL);
    expect(v.verdict).toBe('refused');
    expect(appliedCalls(svc)).toEqual([]);
  });

  it('refuses an AI agent approving its own proposal, and applies nothing', async () => {
    const svc = service({ required: ['approve:review'], authorities: [] });
    const selfApproval: ApprovalAttempt = {
      proposalId: 'p1',
      approverId: 'u1',
      approverType: 'agent',
      approverIdentitySnapshotId: 'snap-agent',
      basis: 'self',
      attemptedAt: '2026-08-25T01:00:00.000Z',
    };
    const v = await svc.adjudicate(PROPOSAL, selfApproval);
    expect(v.verdict).toBe('refused');
    expect(v.reason).toMatch(/own proposal/i);
    expect(appliedCalls(svc)).toEqual([]);
  });
});

describe('T1086 · inconsistent — observed state contradicts the expectation', () => {
  it('returns inconsistent when the observed status differs, and applies nothing', async () => {
    const svc = service({ observed: 'approved' });
    const v = await svc.adjudicate(PROPOSAL);
    expect(v.verdict).toBe('inconsistent');
    expect(v.reason).toMatch(/expected/i);
    expect(appliedCalls(svc), 'a stale proposal must never reach EPIC-009').toEqual([]);
  });

  it('checks consistency BEFORE authority, so a stale proposal is not merely unauthorised', async () => {
    // Reporting a stale proposal as `approval_required` would send a human to
    // approve a transition that no longer makes sense.
    const svc = service({ observed: 'approved', required: ['approve:review'], authorities: [] });
    expect((await svc.adjudicate(PROPOSAL)).verdict).toBe('inconsistent');
  });
});

describe('T1086 · every verdict carries a reason an auditor can read', () => {
  it('never returns an empty reason', async () => {
    for (const o of [
      {},
      { autoApply: false },
      { gatesPassed: false },
      { observed: 'approved' },
      { required: ['x'], authorities: [] },
      {
        application: {
          outcome: 'unknown' as const,
          cause: 'application_outcome_unknown' as const,
          reason: 'timeout',
        },
      },
    ]) {
      const v = await service(o).adjudicate(PROPOSAL);
      expect(v.reason.length, `${v.verdict} has an empty reason`).toBeGreaterThan(0);
    }
  });
});
