/**
 * T1084 (EPIC-030 Phase C2A) — separation of duties.
 *
 * `FR-GEL-067`. **Nothing implemented this before**: a repository-wide search
 * for `separation of duties`, `selfApprov` or `self-approv` returned zero
 * matches. Rev 3 assigned it to this Epic and it was never scheduled.
 *
 * ## The two rules are not the same rule
 *
 * An **AI agent or connector** may never approve its own proposal. That is
 * absolute, under every tenant policy, and no configuration may relax it — an
 * agent that can approve its own work has no supervision at all.
 *
 * A **human** proposer approving their own is an organisational question, not a
 * machine constant. Rev 2 proposed the blanket rule `approverId !== proposerId`
 * and the project owner rejected it: it would make a single-approver team
 * unworkable. The default here is the safe one — a distinct approver — and
 * policy may relax it for humans only.
 *
 * ## Identity comes from the frozen snapshot
 *
 * Display metadata is mutable. If separation of duties read a name or a role
 * label, renaming an account after the fact would silently change who was
 * allowed to approve what. The snapshot id is what the decision reads.
 */
import { describe, expect, it } from 'vitest';
import {
  evaluateSeparationOfDuties,
  type SeparationPolicy,
} from '../../../src/modules/loop/separation-of-duties';
import type { AdjudicationProposal, ApprovalAttempt } from '@pmi/loop-contract';

const BASE: AdjudicationProposal = {
  proposalId: 'p1',
  executionId: 'e1',
  workspaceId: 'w1',
  specificationId: 's1',
  expectedCurrentStatus: 'draft',
  requestedStatus: 'review',
  targetVersion: 3,
  proposerId: 'u1',
  proposerType: 'human',
  proposerIdentitySnapshotId: 'snap-proposer',
  originatingConnector: 'fixture',
  evidenceRefs: [],
  reason: 'ready for review',
  correlationId: 'c1',
  causationId: 'e1',
  idempotencyKey: 'k1',
  proposedAt: '2026-08-25T00:00:00.000Z',
};

function approvalBy(
  id: string,
  type: ApprovalAttempt['approverType'],
  snapshot: string,
): ApprovalAttempt {
  return {
    proposalId: 'p1',
    approverId: id,
    approverType: type,
    approverIdentitySnapshotId: snapshot,
    basis: 'reviewed',
    attemptedAt: '2026-08-25T01:00:00.000Z',
  };
}

const PERMISSIVE: SeparationPolicy = { humanSelfApprovalPermitted: true };
const STRICT: SeparationPolicy = { humanSelfApprovalPermitted: false };

describe('T1084 · an AI agent can never approve its own proposal', () => {
  const byAgent: AdjudicationProposal = {
    ...BASE,
    proposerType: 'agent',
    proposerId: 'agent-1',
    proposerIdentitySnapshotId: 'snap-agent',
  };

  it('refuses agent self-approval under the STRICT policy', () => {
    const verdict = evaluateSeparationOfDuties(
      byAgent,
      approvalBy('agent-1', 'agent', 'snap-agent'),
      STRICT,
    );
    expect(verdict.permitted).toBe(false);
    expect(verdict.permitted === false && verdict.reason).toMatch(/own proposal/i);
  });

  it('refuses agent self-approval under the PERMISSIVE policy too — no policy relaxes this', () => {
    // The load-bearing assertion. If a tenant setting could permit this, an
    // agent could approve its own work by configuration.
    const verdict = evaluateSeparationOfDuties(
      byAgent,
      approvalBy('agent-1', 'agent', 'snap-agent'),
      PERMISSIVE,
    );
    expect(verdict.permitted).toBe(false);
  });

  it('refuses a service principal approving its own proposal', () => {
    const byService: AdjudicationProposal = {
      ...BASE,
      proposerType: 'service',
      proposerId: 'svc-1',
      proposerIdentitySnapshotId: 'snap-svc',
    };
    expect(
      evaluateSeparationOfDuties(byService, approvalBy('svc-1', 'service', 'snap-svc'), PERMISSIVE)
        .permitted,
    ).toBe(false);
  });

  it('permits a HUMAN approving an agent-proposed transition', () => {
    expect(
      evaluateSeparationOfDuties(byAgent, approvalBy('u2', 'human', 'snap-u2'), STRICT).permitted,
    ).toBe(true);
  });
});

describe('T1084 · human self-approval is policy, not a constant', () => {
  it('refuses by DEFAULT — a distinct approver is required', () => {
    const verdict = evaluateSeparationOfDuties(
      BASE,
      approvalBy('u1', 'human', 'snap-proposer'),
      STRICT,
    );
    expect(verdict.permitted).toBe(false);
    expect(verdict.permitted === false && verdict.reason).toMatch(/distinct approver/i);
  });

  it('permits where tenant policy explicitly allows it', () => {
    // Rev 2's blanket `approverId !== proposerId` was rejected because it makes
    // a single-approver team unworkable. This is the rejection, asserted.
    expect(
      evaluateSeparationOfDuties(BASE, approvalBy('u1', 'human', 'snap-proposer'), PERMISSIVE)
        .permitted,
    ).toBe(true);
  });

  it('permits a different human under either policy', () => {
    for (const policy of [STRICT, PERMISSIVE]) {
      expect(
        evaluateSeparationOfDuties(BASE, approvalBy('u2', 'human', 'snap-u2'), policy).permitted,
      ).toBe(true);
    }
  });
});

describe('T1084 · identity is read from the frozen snapshot', () => {
  it('refuses when the SNAPSHOT matches even though the actor id differs', () => {
    // The same principal re-registered under a new id must not become a
    // distinct approver. Reading the mutable id alone would permit exactly that.
    const verdict = evaluateSeparationOfDuties(
      BASE,
      approvalBy('u1-renamed', 'human', 'snap-proposer'),
      STRICT,
    );
    expect(verdict.permitted).toBe(false);
    expect(verdict.permitted === false && verdict.reason).toMatch(/same identity/i);
  });

  it('permits when both id and snapshot differ', () => {
    expect(
      evaluateSeparationOfDuties(BASE, approvalBy('u2', 'human', 'snap-u2'), STRICT).permitted,
    ).toBe(true);
  });
});
