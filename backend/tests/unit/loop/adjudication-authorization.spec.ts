/**
 * T1095 (EPIC-030 Phase C2A) — EPIC-024 authorisation, reused at intake.
 *
 * `FR-GEL-066`. The authorisation constraint on this phase was explicit:
 * *"Reuse EPIC-024 authorization where applicable. Do not create an independent
 * authorization model."* So the adjudicator holds a **port**, and these tests
 * assert the two properties that make the port load-bearing rather than
 * decorative:
 *
 * 1. It is consulted on **every** call, before any decision.
 * 2. A refusal leaves **nothing behind** — no adjudication record, no lifecycle
 *    application, and no answer about whether the specification exists.
 */
import { describe, expect, it } from 'vitest';
import {
  ProposalAdjudicatorService,
  type AdjudicationRecordPort,
  type IntakeAuthorizationPort,
} from '../../../src/modules/loop/adjudicator.service';
import type { AdjudicationProposal } from '@pmi/loop-contract';

const PROPOSAL: AdjudicationProposal = {
  proposalId: 'p1',
  executionId: 'e1',
  workspaceId: 'w1',
  specificationId: 's1',
  expectedCurrentStatus: 'draft',
  requestedStatus: 'review',
  targetVersion: 3,
  proposerId: 'u1',
  proposerType: 'human',
  proposerIdentitySnapshotId: 'snap-1',
  originatingConnector: 'fixture',
  evidenceRefs: [],
  reason: 'ready',
  correlationId: 'c1',
  causationId: 'e1',
  idempotencyKey: 'k1',
  proposedAt: '2026-08-25T00:00:00.000Z',
};

class SpyRecords implements AdjudicationRecordPort {
  readonly written: string[] = [];
  readonly lookups: string[] = [];
  async record(input: { verdict: string }): Promise<string> {
    this.written.push(input.verdict);
    return `rec-${this.written.length}`;
  }
  async findByIdempotency(w: string, p: string, k: string): Promise<null> {
    this.lookups.push(`${w}|${p}|${k}`);
    return null;
  }
}

/** Only w1/u1 may act — anything else is out of scope, as EPIC-024 would say. */
class ScopedAuthorization implements IntakeAuthorizationPort {
  readonly asked: string[] = [];
  async requireEditable(workspaceId: string, actorId: string, specificationId: string) {
    this.asked.push(`${workspaceId}|${actorId}|${specificationId}`);
    if (workspaceId !== 'w1' || actorId !== 'u1') {
      throw Object.assign(new Error('forbidden'), { name: 'ForbiddenError' });
    }
  }
}

function build(auth: IntakeAuthorizationPort, records: SpyRecords) {
  const applied: string[] = [];
  const svc = new ProposalAdjudicatorService(
    { currentStatus: async () => 'draft', isPermitted: async () => true },
    { outcomesFor: async () => ({ passed: true, blocking: undefined }) },
    {
      requiredAuthorities: async () => [],
      actorAuthorities: async () => [],
      autoApplyPermitted: async () => true,
    },
    {
      apply: async () => {
        applied.push('applied');
        return { outcome: 'confirmed', transitionId: 't1' };
      },
    },
    { humanSelfApprovalPermitted: false },
    records,
    auth,
  );
  return { svc, applied };
}

describe('T1095 · authorisation is consulted, not assumed', () => {
  it('asks EPIC-024 on the happy path, with the workspace, actor and specification', async () => {
    const auth = new ScopedAuthorization();
    const { svc } = build(auth, new SpyRecords());
    await svc.adjudicate(PROPOSAL);
    expect(auth.asked).toEqual(['w1|u1|s1']);
  });
});

describe('T1095 · a refusal leaves nothing behind', () => {
  it('refuses a proposal from another workspace', async () => {
    const { svc } = build(new ScopedAuthorization(), new SpyRecords());
    await expect(svc.adjudicate({ ...PROPOSAL, workspaceId: 'w2' })).rejects.toThrow(/forbidden/i);
  });

  it('refuses a proposal from an actor outside the workspace', async () => {
    const { svc } = build(new ScopedAuthorization(), new SpyRecords());
    await expect(svc.adjudicate({ ...PROPOSAL, proposerId: 'intruder' })).rejects.toThrow(
      /forbidden/i,
    );
  });

  it('writes NO adjudication record and applies NO transition when refused', async () => {
    // An unauthorised caller must not be able to write into the audit record.
    const records = new SpyRecords();
    const { svc, applied } = build(new ScopedAuthorization(), records);
    await expect(svc.adjudicate({ ...PROPOSAL, workspaceId: 'w2' })).rejects.toThrow();
    expect(records.written, 'an unauthorised caller wrote adjudication evidence').toEqual([]);
    expect(applied).toEqual([]);
  });

  it('does not even reach the idempotency lookup', async () => {
    // Ordering matters: were the lookup first, an unauthorised caller could read
    // a previous verdict back out of it and learn the specification exists.
    const records = new SpyRecords();
    const { svc } = build(new ScopedAuthorization(), records);
    await expect(svc.adjudicate({ ...PROPOSAL, workspaceId: 'w2' })).rejects.toThrow();
    expect(records.lookups, 'authorisation was checked after the idempotency read').toEqual([]);
  });
});

describe('T1095 · no independent authorisation model is introduced here', () => {
  it('holds no role table of its own — the port is the only source', async () => {
    // If this service ever grew its own rules, a port that permits everything
    // would stop being sufficient to make a proposal succeed.
    const permissive: IntakeAuthorizationPort = { requireEditable: async () => undefined };
    const { svc } = build(permissive, new SpyRecords());
    const v = await svc.adjudicate({ ...PROPOSAL, workspaceId: 'any', proposerId: 'anyone' });
    expect(v.verdict).toBe('applied');
  });
});
