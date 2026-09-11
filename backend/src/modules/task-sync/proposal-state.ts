/**
 * `T1782` (EPIC-046, `FR-KAN-014`, `FR-KAN-015`, data-model.md §8) — the
 * proposal state, folded from its events.
 *
 * ## Why this is a fold and not a column
 *
 * `data-model.md` §5 says it plainly: **no verdict column** on
 * `task_status_proposals`, because a mutable verdict field becomes the audit
 * authority the first time somebody reads it instead of the event stream. §8
 * says the proposal state is *folded from the proposal's events, as `EPIC-037`
 * folds an execution*, and this is that fold.
 *
 * `FR-KAN-012` is untouched: `status-transition-proposed` still records the
 * request and never a verdict. The verdict arrives as a **second** event, in the
 * vocabulary `EPIC-037` already defines and `eventForVerdict` already maps every
 * verdict onto.
 *
 * ## What belongs on a card
 *
 * The newest proposal that **did not apply**. An applied proposal is already
 * visible as the card's status and its `movedBy`, and repeating it as
 * *outstanding* would tell a reader something is pending when nothing is.
 *
 * A proposal whose verdict has not been recorded reports **nothing**. Absence is
 * not a verdict: claiming *awaiting approval* for a proposal nobody adjudicated
 * would invent the single fact this projection exists to carry.
 *
 * Pure — no store, no clock, no I/O — so the rule is a table a test can read.
 */
import type { AdjudicationVerdictName } from '@pmi/loop-contract';
import type { ProposerType, TaskStatusValue } from './task-sync.store.js';

/** The minimum of a proposal row this fold needs. */
export interface FoldableProposal {
  readonly id: string;
  readonly taskId: string;
  readonly expectedCurrentStatus: TaskStatusValue;
  readonly requestedStatus: TaskStatusValue;
  readonly reason: string;
  readonly proposerId: string;
  readonly proposerType: ProposerType;
  readonly proposedAt: Date;
}

/** A recorded verdict, read off the execution's event stream. */
export interface ProposalVerdictEvent {
  readonly proposalId: string;
  readonly verdict: AdjudicationVerdictName;
  readonly occurredAt: string;
}

/**
 * The proposal a later parse overrode (`T1788`, `FR-KAN-022`).
 *
 * Deliberately a different shape from `OutstandingProposal`: one is a request
 * still waiting on an answer, the other an answer the file has since overruled.
 * Sharing a type would invite a screen to render them the same way, and they
 * mean opposite things to a reader.
 */
export interface AppliedProposal {
  readonly proposalId: string;
  readonly requestedStatus: TaskStatusValue;
  readonly reason: string;
  readonly proposerId: string;
  readonly proposerType: ProposerType;
  readonly proposedAt: Date;
  readonly verdict: AdjudicationVerdictName;
}

export interface OutstandingProposal {
  readonly proposalId: string;
  readonly expectedCurrentStatus: TaskStatusValue;
  readonly requestedStatus: TaskStatusValue;
  readonly reason: string;
  readonly proposerId: string;
  readonly proposerType: ProposerType;
  readonly proposedAt: Date;
  readonly verdict: AdjudicationVerdictName;
}

/**
 * The outstanding proposal per task.
 *
 * Ordering is by `proposedAt` and then by id, so the answer does not depend on
 * the order the database happened to return rows in — the same rule the
 * progress-event fold applies, and for the same reason.
 */
export function foldProposalState(
  proposals: readonly FoldableProposal[],
  verdicts: readonly ProposalVerdictEvent[],
): Map<string, OutstandingProposal> {
  const byProposal = new Map<string, ProposalVerdictEvent>();
  for (const event of verdicts) {
    const held = byProposal.get(event.proposalId);
    // The LAST verdict recorded for a proposal is its verdict. A replayed
    // adjudication writes the same one; a genuinely later one supersedes.
    if (held === undefined || event.occurredAt >= held.occurredAt) byProposal.set(event.proposalId, event);
  }

  const outstanding = new Map<string, OutstandingProposal>();
  const ordered = [...proposals].sort(
    (a, b) => a.proposedAt.getTime() - b.proposedAt.getTime() || a.id.localeCompare(b.id),
  );
  for (const row of ordered) {
    const event = byProposal.get(row.id);
    // No verdict recorded, or it applied: neither is something to report.
    if (event === undefined || event.verdict === 'applied') continue;
    outstanding.set(row.taskId, {
      proposalId: row.id,
      expectedCurrentStatus: row.expectedCurrentStatus,
      requestedStatus: row.requestedStatus,
      reason: row.reason,
      proposerId: row.proposerId,
      proposerType: row.proposerType,
      proposedAt: row.proposedAt,
      verdict: event.verdict,
    });
  }
  return outstanding;
}

/**
 * The newest **applied** proposal per task (`T1788`, `FR-KAN-022`).
 *
 * The other half of `foldProposalState`, and the two are exhaustive over a
 * task's adjudicated proposals: one returns those that did not apply, this one
 * those that did. Together they account for every verdict, which is what makes
 * *nothing is silently dropped* checkable rather than asserted.
 *
 * Only an applied proposal can be **superseded**. A refused or pending one was
 * never the card's status, so the file did not override it — reporting it as
 * superseded would tell a reader a person was overruled who never was.
 */
export function latestAppliedProposal(
  proposals: readonly FoldableProposal[],
  verdicts: readonly ProposalVerdictEvent[],
): Map<string, AppliedProposal> {
  const byProposal = new Map<string, ProposalVerdictEvent>();
  for (const event of verdicts) {
    const held = byProposal.get(event.proposalId);
    if (held === undefined || event.occurredAt >= held.occurredAt) byProposal.set(event.proposalId, event);
  }

  const applied = new Map<string, AppliedProposal>();
  const ordered = [...proposals].sort(
    (a, b) => a.proposedAt.getTime() - b.proposedAt.getTime() || a.id.localeCompare(b.id),
  );
  for (const row of ordered) {
    const event = byProposal.get(row.id);
    if (event === undefined || event.verdict !== 'applied') continue;
    applied.set(row.taskId, {
      proposalId: row.id,
      requestedStatus: row.requestedStatus,
      reason: row.reason,
      proposerId: row.proposerId,
      proposerType: row.proposerType,
      proposedAt: row.proposedAt,
      verdict: event.verdict,
    });
  }
  return applied;
}
