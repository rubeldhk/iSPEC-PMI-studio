/**
 * T1098–T1101 (EPIC-030 C2A closure) — the production adapters delegate, and
 * decide nothing.
 *
 * The composition test proves the adapters are *wired*. These prove they are
 * *thin*: each one hands the question to the owning Epic and reports the answer.
 * An adapter that quietly answered for its Epic would pass the composition test
 * and reintroduce exactly what "consume, never re-implement" forbids.
 */
import { describe, expect, it } from 'vitest';
import {
  AccessIntakeAuthorization,
  ConfiguredAuthorityPolicy,
  EpicNineLifecycleValidation,
  EpicNineTransitionAdapter,
  GrantBackedAuthorities,
  UnconfiguredGateOutcomes,
} from '../../../src/modules/loop/adjudication.adapters';
import { ProposalAdjudicatorService } from '../../../src/modules/loop/adjudicator.service';
import { LifecycleApplicationAdapter } from '../../../src/modules/loop/lifecycle-application.adapter';
import type { AdjudicationProposal } from '@pmi/loop-contract';

const PROPOSAL: AdjudicationProposal = {
  proposalId: 'p1',
  executionId: 'e1',
  workspaceId: 'w1',
  specificationId: 's1',
  expectedCurrentStatus: 'draft',
  requestedStatus: 'review',
  targetVersion: 1,
  proposerId: 'u1',
  proposerType: 'human',
  proposerIdentitySnapshotId: 'snap-1',
  originatingConnector: 'adapter-test',
  evidenceRefs: [],
  reason: 'ready',
  correlationId: 'c1',
  causationId: 'e1',
  idempotencyKey: 'k1',
  proposedAt: '2026-08-25T12:00:00.000Z',
};

describe('T1098 · EPIC-009 answers validity; this Epic holds no transition table', () => {
  it('reads the current status from EPIC-009 rather than from anywhere local', async () => {
    const asked: string[] = [];
    const port = new EpicNineLifecycleValidation(
      {
        get: async (workspaceId, id) => {
          asked.push(`${workspaceId}/${id}`);
          return { lifecycleState: 'approved' };
        },
      },
      () => [],
    );
    expect(await port.currentStatus('w1', 's1')).toBe('approved');
    expect(asked, 'EPIC-009 was not asked').toEqual(['w1/s1']);
  });

  it('answers isPermitted from EPIC-009s own function, not a local table', async () => {
    // The injected function IS the table. Swapping it changes the answer, which
    // is what proves nothing here shadows it.
    const port = new EpicNineLifecycleValidation({ get: async () => ({ lifecycleState: 'draft' }) }, (
      state,
    ) => (state === 'draft' ? ['review'] : []));
    expect(await port.isPermitted('draft', 'review')).toBe(true);
    expect(await port.isPermitted('draft', 'approved')).toBe(false);
    expect(await port.isPermitted('approved', 'review')).toBe(false);
  });

  it('holds no opinion of its own — an empty table permits nothing', async () => {
    const port = new EpicNineLifecycleValidation(
      { get: async () => ({ lifecycleState: 'draft' }) },
      () => [],
    );
    for (const to of ['review', 'approved', 'archived', 'draft']) {
      expect(await port.isPermitted('draft', to), `${to} was permitted with an empty table`).toBe(
        false,
      );
    }
  });
});

describe('T1099 · EPIC-009 applies; the id it returns is not a transition id', () => {
  it('reports a null transition identity rather than passing off the specification id', async () => {
    // EPIC-009 returns the SPECIFICATION record. Forwarding its id as
    // `appliedTransitionId` would put a false link in the audit chain.
    const adapter = new EpicNineTransitionAdapter({
      transition: async () => ({ id: 'spec-123', lifecycleState: 'review' }),
    });
    const out = await adapter.transition({ workspaceId: 'w1', userId: 'u1' }, 's1', 'review');
    expect(out.lifecycleState).toBe('review');
    expect(out.id, 'the specification id was passed off as a transition id').toBeNull();
  });

  it('resolves to reconciliation, never applied, when the transition is unidentified', async () => {
    const settled: string[] = [];
    const application = new LifecycleApplicationAdapter(
      new EpicNineTransitionAdapter({
        transition: async () => ({ id: 'spec-123', lifecycleState: 'review' }),
      }),
      {
        open: async () => 'intent-1',
        settle: async (_id, _ws, outcome) => {
          settled.push(outcome);
        },
      },
    );
    const out = await application.apply({
      workspaceId: 'w1',
      specificationId: 's1',
      expectedCurrentStatus: 'draft',
      requestedStatus: 'review',
      actorId: 'u1',
    });
    expect(out.outcome).toBe('unknown');
    expect(out.outcome === 'unknown' && out.cause).toBe('application_transition_unidentified');
    expect(settled).toEqual(['unknown']);
  });
});

describe('T1100 · EPIC-021 supplies nothing, so gates REFUSE rather than pass', () => {
  it('reports unavailable, which is not the same as failed', async () => {
    const gates = new UnconfiguredGateOutcomes();
    const out = await gates.outcomesFor();
    expect(out.unavailable).toBe(true);
    expect(out.passed, 'an unavailable gate reported itself satisfied').toBe(false);
    expect(out.blocking).toMatch(/EPIC-021/);
  });

  it('produces refused/validation/gate_outcomes_unavailable end to end', async () => {
    const svc = new ProposalAdjudicatorService(
      { currentStatus: async () => 'draft', isPermitted: async () => true },
      new UnconfiguredGateOutcomes(),
      {
        requiredAuthorities: async () => [],
        actorAuthorities: async () => [],
        autoApplyPermitted: async () => true,
      },
      { apply: async () => ({ outcome: 'confirmed', transitionId: 't1' }) },
      { humanSelfApprovalPermitted: false },
      { record: async () => 'rec-1', findByIdempotency: async () => null },
      { requireEditable: async () => undefined },
    );
    const v = await svc.adjudicate(PROPOSAL);
    expect(v.verdict).toBe('refused');
    if (v.verdict !== 'refused') throw new Error('not refused');
    // The stage is what EPIC-037 maps to an event; the code is why.
    expect(v.refusalStage).toBe('validation');
    expect(v.refusalReasonCode).toBe('gate_outcomes_unavailable');
  });

  it('never lets an unavailable gate reach application', async () => {
    const applied: string[] = [];
    const svc = new ProposalAdjudicatorService(
      { currentStatus: async () => 'draft', isPermitted: async () => true },
      new UnconfiguredGateOutcomes(),
      {
        requiredAuthorities: async () => [],
        actorAuthorities: async () => [],
        autoApplyPermitted: async () => true,
      },
      {
        apply: async () => {
          applied.push('called');
          return { outcome: 'confirmed', transitionId: 't1' };
        },
      },
      { humanSelfApprovalPermitted: false },
      { record: async () => 'rec-1', findByIdempotency: async () => null },
      { requireEditable: async () => undefined },
    );
    await svc.adjudicate(PROPOSAL);
    expect(applied, 'EPIC-009 was asked to apply behind an unreadable gate').toEqual([]);
  });
});

describe('T1101 · EPIC-024 is consulted, with the artifact it owns', () => {
  it('hands EPIC-024 the tenant, the actor and the specification as an artifact ref', async () => {
    const calls: unknown[] = [];
    const port = new AccessIntakeAuthorization({
      requireEditable: async (workspaceId, userId, artifact, action) => {
        calls.push({ workspaceId, userId, artifact, action });
      },
    });
    await port.requireEditable('w1', 'u1', 's1');
    expect(calls).toEqual([
      {
        workspaceId: 'w1',
        userId: 'u1',
        artifact: { artifactType: 'specification', artifactId: 's1' },
        action: 'propose-transition',
      },
    ]);
  });

  it('lets EPIC-024s refusal propagate — it is not softened into a verdict', async () => {
    // A verdict would write adjudication evidence for a caller with no
    // standing, and tell them whether the specification exists.
    const port = new AccessIntakeAuthorization({
      requireEditable: async () => {
        throw Object.assign(new Error('forbidden'), { name: 'ForbiddenError' });
      },
    });
    await expect(port.requireEditable('w1', 'u1', 's1')).rejects.toThrow(/forbidden/i);
  });
});

describe('T1101 · authority policy is configuration, and defaults safely', () => {
  it('auto-applies nothing for a transition no rule names', async () => {
    // The dangerous default would be the other way: forgetting to write a rule
    // would then mean authorising automatic application.
    const policy = new ConfiguredAuthorityPolicy([], new GrantBackedAuthorities({}));
    expect(await policy.autoApplyPermitted('draft', 'review')).toBe(false);
    expect(await policy.requiredAuthorities('draft', 'review')).toEqual([]);
  });

  it('reads required authorities and auto-apply from the declared rule', async () => {
    const policy = new ConfiguredAuthorityPolicy(
      [{ from: 'draft', to: 'review', requires: ['approve:review'], autoApply: true }],
      new GrantBackedAuthorities({}),
    );
    expect(await policy.requiredAuthorities('draft', 'review')).toEqual(['approve:review']);
    expect(await policy.autoApplyPermitted('draft', 'review')).toBe(true);
    expect(await policy.autoApplyPermitted('review', 'approved')).toBe(false);
  });

  it('holds no authority for an actor until a grant source says so', async () => {
    expect(await new GrantBackedAuthorities({}).authoritiesFor('w1', 'u1')).toEqual([]);
    const backed = new GrantBackedAuthorities({
      authoritiesFor: async () => ['approve:review'],
    });
    expect(await backed.authoritiesFor('w1', 'u1')).toEqual(['approve:review']);
  });
});
