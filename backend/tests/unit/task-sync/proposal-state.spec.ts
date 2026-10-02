/**
 * `T1782` (EPIC-046, `FR-KAN-014`, `FR-KAN-015`, data-model.md §8) — the
 * proposal state, folded from its events.
 *
 * ## What `/speckit-converge` found
 *
 * A person moved a card in a project that requires approval, got
 * `approval_required`, closed the dialog — and the board showed **nothing**. No
 * requested status, no requester, no reason, no time, no verdict. The card sat
 * exactly where it had been, indistinguishable from one nobody had touched.
 *
 * That is most of `SC-KAN-005`'s user-facing half missing. The verdict was
 * returned in one HTTP response and never persisted anywhere a projection could
 * find it, so no screen could have shown it however hard it tried.
 *
 * ## Why it is a fold and not a column
 *
 * `data-model.md` §5 is explicit: **no verdict column**, because a mutable
 * verdict field becomes the audit authority the first time somebody reads it
 * instead of the event stream. §8 says the proposal state is *folded from the
 * proposal's events, as `EPIC-037` folds an execution*.
 *
 * So adjudication appends a second event — in `EPIC-037`'s own vocabulary, the
 * one `eventForVerdict` already maps every verdict onto — and this projection
 * folds the pair. `FR-KAN-012` is untouched: `status-transition-proposed` still
 * records the request and never a verdict.
 *
 * ## The newest proposal wins, and only if it is outstanding
 *
 * A task can carry several proposals over its life. What belongs on the card is
 * the newest one **that did not apply**: an applied proposal is already visible
 * as the card's status and its `movedBy`, and repeating it as *outstanding*
 * would tell a reader something is pending when nothing is.
 *
 * Written to FAIL before the projection exists.
 */
import { describe, expect, it } from 'vitest';
import { foldProposalState } from '../../../src/modules/task-sync/proposal-state.js';

const AT = '2026-09-07T10:00:00.000Z';

function proposal(over: Partial<Parameters<typeof foldProposalState>[0][number]> = {}) {
  return {
    id: 'pr_1',
    taskId: 't_1',
    expectedCurrentStatus: 'not_started' as const,
    requestedStatus: 'in_progress' as const,
    reason: 'Started it this morning',
    proposerId: 'u_1',
    proposerType: 'user' as const,
    proposedAt: new Date(AT),
    ...over,
  };
}

function verdict(over: Partial<Parameters<typeof foldProposalState>[1][number]> = {}) {
  return { proposalId: 'pr_1', verdict: 'approval_required' as const, occurredAt: AT, ...over };
}

describe('T1782 · the outstanding proposal (FR-KAN-014)', () => {
  it('states the requested status, the requester, the reason and the time', () => {
    const found = foldProposalState([proposal()], [verdict()]);
    expect(found.get('t_1')).toMatchObject({
      proposalId: 'pr_1',
      requestedStatus: 'in_progress',
      proposerId: 'u_1',
      reason: 'Started it this morning',
      verdict: 'approval_required',
    });
    expect(found.get('t_1')?.proposedAt).toEqual(new Date(AT));
  });

  it.each(['refused', 'inconsistent', 'reconciliation_required', 'validated'] as const)(
    'keeps a %s proposal on the card — it left the card where it was and must say why',
    (name) => {
      const found = foldProposalState([proposal()], [verdict({ verdict: name })]);
      expect(found.get('t_1')?.verdict).toBe(name);
    },
  );

  it('does NOT report an applied proposal as outstanding — the card already shows it', () => {
    // `FR-KAN-014`: an immediate verdict shows as the applied status with the
    // proposal that produced it, which the card's own `movedBy` already is.
    const found = foldProposalState([proposal()], [verdict({ verdict: 'applied' })]);
    expect(found.get('t_1')).toBeUndefined();
  });

  it('reports nothing for a proposal whose verdict has not been recorded', () => {
    // Absence is not a verdict. Claiming *awaiting approval* for a proposal
    // nobody adjudicated would invent the one fact this projection exists to
    // carry.
    expect(foldProposalState([proposal()], []).get('t_1')).toBeUndefined();
  });
});

describe('T1782 · several proposals on one task (FR-KAN-016)', () => {
  it('reports the newest outstanding one', () => {
    const older = proposal({ id: 'pr_1', proposedAt: new Date('2026-09-07T09:00:00.000Z') });
    const newer = proposal({ id: 'pr_2', requestedStatus: 'blocked', reason: 'Waiting on the vendor', proposedAt: new Date('2026-09-07T11:00:00.000Z') });
    const found = foldProposalState(
      [older, newer],
      [verdict({ proposalId: 'pr_1', verdict: 'refused' }), verdict({ proposalId: 'pr_2', verdict: 'approval_required' })],
    );
    expect(found.get('t_1')).toMatchObject({ proposalId: 'pr_2', requestedStatus: 'blocked', verdict: 'approval_required' });
  });

  it('falls back to the newest outstanding one when a later proposal applied', () => {
    // The later one applied and is therefore not outstanding; the earlier
    // refusal is still the thing a reader has not seen an answer to.
    const older = proposal({ id: 'pr_1', proposedAt: new Date('2026-09-07T09:00:00.000Z') });
    const newer = proposal({ id: 'pr_2', proposedAt: new Date('2026-09-07T11:00:00.000Z') });
    const found = foldProposalState(
      [older, newer],
      [verdict({ proposalId: 'pr_1', verdict: 'refused' }), verdict({ proposalId: 'pr_2', verdict: 'applied' })],
    );
    expect(found.get('t_1')?.proposalId).toBe('pr_1');
  });

  it('does not depend on the order the rows or the events arrive in', () => {
    const a = proposal({ id: 'pr_1', proposedAt: new Date('2026-09-07T09:00:00.000Z') });
    const b = proposal({ id: 'pr_2', proposedAt: new Date('2026-09-07T11:00:00.000Z') });
    const events = [verdict({ proposalId: 'pr_2' }), verdict({ proposalId: 'pr_1', verdict: 'refused' })];
    expect(foldProposalState([a, b], events).get('t_1')?.proposalId).toBe('pr_2');
    expect(foldProposalState([b, a], [...events].reverse()).get('t_1')?.proposalId).toBe('pr_2');
  });

  it('keys by task, so two tasks do not borrow each other proposals', () => {
    const mine = proposal({ id: 'pr_1', taskId: 't_1' });
    const yours = proposal({ id: 'pr_2', taskId: 't_2', requestedStatus: 'blocked' });
    const found = foldProposalState([mine, yours], [verdict({ proposalId: 'pr_1' }), verdict({ proposalId: 'pr_2' })]);
    expect(found.get('t_1')?.proposalId).toBe('pr_1');
    expect(found.get('t_2')?.proposalId).toBe('pr_2');
  });
});

describe('T1782 · nothing to report', () => {
  it('returns an empty map for a task with no proposals', () => {
    expect(foldProposalState([], []).size).toBe(0);
  });

  it('ignores a verdict naming a proposal that is not in the set', () => {
    expect(foldProposalState([], [verdict({ proposalId: 'pr_gone' })]).size).toBe(0);
  });
});
