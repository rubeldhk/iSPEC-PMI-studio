/**
 * T1090 (EPIC-030 Phase C2A) — optimistic concurrency and idempotent retry.
 *
 * `FR-GEL-070`, `FR-GEL-071`.
 *
 * Two different protections that are easy to confuse:
 *
 * - **Optimistic concurrency** stops a *stale* proposal from being applied. The
 *   proposal carries what it believed the status was; if the world has moved,
 *   the verdict is `inconsistent` and nothing is applied.
 * - **Idempotency** stops a *repeated* proposal from being adjudicated twice.
 *   A retry after a lost response must return the original verdict — not
 *   re-decide, and certainly not apply a second transition.
 */
import { describe, expect, it } from 'vitest';
import {
  ProposalAdjudicatorService,
  type AdjudicationEvidenceInput,
  type AdjudicationRecordPort,
} from '../../../src/modules/loop/adjudicator.service';
import {
  rowFromEvidence,
  verdictFromRow,
} from '../../../src/modules/loop/adjudication-evidence';
import type { AdjudicationProposal, AdjudicationVerdict } from '@pmi/loop-contract';

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
  evidenceRefs: [],
  reason: 'ready',
  correlationId: 'c1',
  causationId: 'e1',
  idempotencyKey: 'k1',
  proposedAt: '2026-08-25T00:00:00.000Z',
};

/** A record store that behaves the way the real one must: keyed, and sticky. */
class KeyedRecords implements AdjudicationRecordPort {
  readonly written: { key: string; verdict: string }[] = [];
  private readonly byKey = new Map<string, AdjudicationVerdict>();

  // Goes through the SAME serialisation the Prisma adapter uses, so a retry
  // here exercises the real row -> verdict path rather than a shortcut that
  // could agree with the test and disagree with the database.
  async record(input: AdjudicationEvidenceInput): Promise<string> {
    const key = `${input.proposal.workspaceId}|${input.proposal.proposalId}|${input.proposal.idempotencyKey}`;
    this.written.push({ key, verdict: input.verdict });
    const id = `rec-${this.written.length}`;
    this.byKey.set(key, verdictFromRow(rowFromEvidence(input, id)));
    return id;
  }

  async findByIdempotency(
    workspaceId: string,
    proposalId: string,
    idempotencyKey: string,
  ): Promise<AdjudicationVerdict | null> {
    return this.byKey.get(`${workspaceId}|${proposalId}|${idempotencyKey}`) ?? null;
  }
}

function build(observed: string, records: KeyedRecords): {
  svc: ProposalAdjudicatorService;
  applications: string[];
} {
  const applications: string[] = [];
  const svc = new ProposalAdjudicatorService(
    { currentStatus: async () => observed, isPermitted: async () => true },
    { outcomesFor: async () => ({ disposition: 'passed' as const, blocking: undefined }) },
    {
      requiredAuthorities: async () => [],
      actorAuthorities: async () => [],
      autoApplyPermitted: async () => true,
    },
    {
      apply: async () => {
        applications.push('applied');
        return { outcome: 'confirmed', transitionId: `t${applications.length}` };
      },
    },
    { humanSelfApprovalPermitted: false },
    records,
    { requireEditable: async () => undefined },
  );
  return { svc, applications };
}

describe('T1090 · optimistic concurrency against the expected state', () => {
  it('returns inconsistent for a stale proposal and applies nothing', async () => {
    const { svc, applications } = build('approved', new KeyedRecords());
    const v = await svc.adjudicate(PROPOSAL);
    expect(v.verdict).toBe('inconsistent');
    expect(applications).toEqual([]);
  });

  it('two proposals against the same stale state both refuse to apply', async () => {
    // Neither may silently overwrite the other; both observe the same drift.
    const records = new KeyedRecords();
    const a = build('approved', records);
    const b = build('approved', records);
    const [v1, v2] = await Promise.all([
      a.svc.adjudicate({ ...PROPOSAL, proposalId: 'pA', idempotencyKey: 'kA' }),
      b.svc.adjudicate({ ...PROPOSAL, proposalId: 'pB', idempotencyKey: 'kB' }),
    ]);
    expect([v1.verdict, v2.verdict]).toEqual(['inconsistent', 'inconsistent']);
    expect([...a.applications, ...b.applications]).toEqual([]);
  });
});

describe('T1090 · idempotent retry', () => {
  it('returns the ORIGINAL verdict and applies nothing a second time', async () => {
    const records = new KeyedRecords();
    const { svc, applications } = build('draft', records);

    const first = await svc.adjudicate(PROPOSAL);
    expect(first.verdict).toBe('applied');
    expect(applications).toEqual(['applied']);

    const retry = await svc.adjudicate(PROPOSAL);
    expect(retry.verdict).toBe('applied');
    expect(retry.adjudicationRecordId, 'the retry produced a NEW record').toBe(
      first.adjudicationRecordId,
    );
    expect(applications, 'the retry applied a second transition').toEqual(['applied']);
  });

  it('writes exactly one adjudication record across three attempts', async () => {
    const records = new KeyedRecords();
    const { svc } = build('draft', records);
    await svc.adjudicate(PROPOSAL);
    await svc.adjudicate(PROPOSAL);
    await svc.adjudicate(PROPOSAL);
    expect(records.written).toHaveLength(1);
  });

  it('treats a DIFFERENT idempotency key as a different decision', async () => {
    // Idempotency protects against retries, not against a deliberate re-ask.
    const records = new KeyedRecords();
    const { svc, applications } = build('draft', records);
    await svc.adjudicate(PROPOSAL);
    await svc.adjudicate({ ...PROPOSAL, idempotencyKey: 'k2' });
    expect(applications).toHaveLength(2);
    expect(records.written).toHaveLength(2);
  });

  it('a retry of a REFUSED proposal stays refused and never becomes applied', async () => {
    const records = new KeyedRecords();
    const svc = new ProposalAdjudicatorService(
      { currentStatus: async () => 'draft', isPermitted: async () => false },
      { outcomesFor: async () => ({ disposition: 'passed' as const, blocking: undefined }) },
      {
        requiredAuthorities: async () => [],
        actorAuthorities: async () => [],
        autoApplyPermitted: async () => true,
      },
      { apply: async () => ({ outcome: 'confirmed', transitionId: 't1' }) },
      { humanSelfApprovalPermitted: false },
      records,
      { requireEditable: async () => undefined },
    );
    expect((await svc.adjudicate(PROPOSAL)).verdict).toBe('refused');
    expect((await svc.adjudicate(PROPOSAL)).verdict).toBe('refused');
    expect(records.written).toHaveLength(1);
  });
});
