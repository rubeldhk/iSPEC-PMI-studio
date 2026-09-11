/**
 * `T1788` (EPIC-046, `FR-KAN-022`, `contracts/board-contract.md` §3) — the card
 * states that the file superseded a manual status.
 *
 * ## What the second convergence pass found
 *
 * `task-reconcile.ts` computes the `supersededByFile` marker and the sync
 * stores it on the manifest line. And that is where it stopped. No board read
 * carried it, no card rendered it, and `FR-KAN-022`'s actual demand — that the
 * task **name the proposal, the verdict and the superseding digest** — was met
 * by nothing at all.
 *
 * The integration suite proves the half that is easy to prove: the proposal
 * record survives the supersession unamended. The half a person can see was
 * never built. A board that reconciles silently and keeps perfect records is
 * still a board that reconciled silently.
 *
 * ## Why the superseded proposal is the newest APPLIED one
 *
 * Supersession only means anything about a proposal that took effect. A refused
 * or pending proposal was never the card's status, so the file did not override
 * it — it overrode nothing. `foldProposalState` deliberately excludes applied
 * proposals from *outstanding*; this is the other half of the same fold, and the
 * two are exhaustive over a task's proposals.
 *
 * Written to FAIL before the projection exists.
 */
import { describe, expect, it } from 'vitest';
import { latestAppliedProposal } from '../../../src/modules/task-sync/proposal-state.js';

const AT = '2026-09-07T10:00:00.000Z';

function proposal(over: Partial<Parameters<typeof latestAppliedProposal>[0][number]> = {}) {
  return {
    id: 'pr_1',
    taskId: 't_1',
    expectedCurrentStatus: 'not_started' as const,
    requestedStatus: 'in_progress' as const,
    reason: 'Started it this morning',
    proposerId: 'u_ana',
    proposerType: 'user' as const,
    proposedAt: new Date(AT),
    ...over,
  };
}

function verdict(over: Partial<Parameters<typeof latestAppliedProposal>[1][number]> = {}) {
  return { proposalId: 'pr_1', verdict: 'applied' as const, occurredAt: AT, ...over };
}

describe('T1788 · the proposal the file superseded (FR-KAN-022)', () => {
  it('names the proposal, its requested status, its verdict and who made it', () => {
    const found = latestAppliedProposal([proposal()], [verdict()]);
    expect(found.get('t_1')).toMatchObject({
      proposalId: 'pr_1',
      requestedStatus: 'in_progress',
      verdict: 'applied',
      proposerId: 'u_ana',
    });
  });

  it('ignores a proposal that never applied — the file overrode nothing', () => {
    // A refused or pending proposal was never the card's status. Reporting it as
    // superseded would tell a reader the file overruled a person who was never
    // overruled.
    for (const name of ['refused', 'approval_required', 'inconsistent'] as const) {
      expect(latestAppliedProposal([proposal()], [verdict({ verdict: name })]).get('t_1')).toBeUndefined();
    }
  });

  it('ignores a proposal with no recorded verdict at all', () => {
    expect(latestAppliedProposal([proposal()], []).get('t_1')).toBeUndefined();
  });

  it('takes the NEWEST applied proposal when a task has had several', () => {
    const older = proposal({ id: 'pr_1', proposedAt: new Date('2026-09-07T09:00:00.000Z') });
    const newer = proposal({ id: 'pr_2', requestedStatus: 'blocked', proposedAt: new Date('2026-09-07T11:00:00.000Z') });
    const found = latestAppliedProposal(
      [older, newer],
      [verdict({ proposalId: 'pr_1' }), verdict({ proposalId: 'pr_2' })],
    );
    expect(found.get('t_1')).toMatchObject({ proposalId: 'pr_2', requestedStatus: 'blocked' });
  });

  it('does not depend on the order the rows arrive in', () => {
    const a = proposal({ id: 'pr_1', proposedAt: new Date('2026-09-07T09:00:00.000Z') });
    const b = proposal({ id: 'pr_2', proposedAt: new Date('2026-09-07T11:00:00.000Z') });
    const events = [verdict({ proposalId: 'pr_1' }), verdict({ proposalId: 'pr_2' })];
    expect(latestAppliedProposal([a, b], events).get('t_1')?.proposalId).toBe('pr_2');
    expect(latestAppliedProposal([b, a], [...events].reverse()).get('t_1')?.proposalId).toBe('pr_2');
  });

  it('keys by task', () => {
    const mine = proposal({ id: 'pr_1', taskId: 't_1' });
    const yours = proposal({ id: 'pr_2', taskId: 't_2' });
    const found = latestAppliedProposal([mine, yours], [verdict({ proposalId: 'pr_1' }), verdict({ proposalId: 'pr_2' })]);
    expect(found.get('t_1')?.proposalId).toBe('pr_1');
    expect(found.get('t_2')?.proposalId).toBe('pr_2');
  });

  it('is exhaustive with the outstanding fold — a proposal is one or the other, never both', () => {
    // Together the two folds account for every adjudicated proposal, which is
    // what makes *nothing is silently dropped* checkable rather than asserted.
    const applied = latestAppliedProposal([proposal()], [verdict()]);
    expect(applied.has('t_1')).toBe(true);
    const refused = latestAppliedProposal([proposal()], [verdict({ verdict: 'refused' })]);
    expect(refused.has('t_1')).toBe(false);
  });
});
