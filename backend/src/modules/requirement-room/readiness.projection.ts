/**
 * T339h — `BaselineReadiness`. `FR-RQR-073`, `UX-0032`, data-model §8.
 * Unit test: `T339g`.
 *
 * *"What is blocking progress — missing evidence, pending approval, policy
 * block — MUST be visible without opening another screen."*
 *
 * **A projection, not a table.** Readiness is computed from the candidates, the
 * clarifications, the Evidence Contract and the decision, every time it is
 * asked for. Nothing is stored, so there is **no invalidation path**: no row
 * that says *ready* while the thing it was derived from has moved on. That is
 * the same reasoning `EPIC-031` applied to its Inbox and `EPIC-030` to its loop
 * progress, and the same reasoning `blocksBaseline` follows one level down —
 * the column records that a question is a *blocking kind*, and whether it still
 * blocks is read from the answer.
 *
 * **"Cannot tell" is never "ready".** An Evidence Contract that has not been
 * evaluated blocks exactly as an unsatisfied one does. The reader is told which
 * of the two it is, because they are different problems with different fixes —
 * but neither is progress. Treating an unevaluated Contract as clear would
 * render a ready baseline whose evidence nobody had looked at, which is
 * `BR-0144` inverted by omission.
 *
 * **Every blocker names its subject.** `UX-0032` wants this readable without
 * opening another screen; a list of kinds with no subjects sends the reader to
 * another screen to find out *which* requirement, *which* question, *which*
 * evidence item.
 *
 * Framework-free (PC-1), and pure — one argument in, one value out.
 */
import type { CandidateRow, ClarificationRow } from './requirement-room.store.js';

export const BLOCKER_KINDS = Object.freeze([
  'open-clarification',
  'missing-acceptance-criteria',
  'pending-decision',
  'unmet-evidence',
] as const);

export type BlockerKind = (typeof BLOCKER_KINDS)[number];

export interface Blocker {
  readonly kind: BlockerKind;
  /** The candidate, clarification or contract this is about. */
  readonly subject: string;
  /** Enough to render inline — see the note on `UX-0032` above. */
  readonly detail: string;
}

/** What `EPIC-032` said, or `null` when it has not been asked. */
export interface EvidenceStatus {
  readonly satisfied: boolean;
  readonly unmet: readonly string[];
}

export interface ReadinessInput {
  readonly candidates: readonly CandidateRow[];
  readonly clarifications: readonly ClarificationRow[];
  /** `null` ⇒ not evaluated. Blocks — see above. */
  readonly evidence: EvidenceStatus | null;
  /** `null` ⇒ nothing decided yet. */
  readonly decision: { readonly decisionId: string } | null;
}

export interface BaselineReadiness {
  readonly ready: boolean;
  /** All of them, every time. Sorted, so the list does not reshuffle. */
  readonly blockers: readonly Blocker[];
}

const EVIDENCE_SUBJECT = 'evidence-contract';
const DECISION_SUBJECT = 'decision';

export function projectReadiness(input: ReadinessInput): BaselineReadiness {
  const blockers: Blocker[] = [];

  for (const clarification of input.clarifications) {
    // The same derivation `ClarificationService.blockers` uses: a blocking KIND
    // of question, still unanswered.
    if (!clarification.blocksBaseline || clarification.answer !== null) continue;
    blockers.push({
      kind: 'open-clarification',
      subject: clarification.id,
      detail: `unanswered: "${clarification.question}"`,
    });
  }

  for (const candidate of input.candidates) {
    if (!candidate.intendedForImplementation) continue;
    if ((candidate.acceptanceCriteria ?? []).length > 0) continue;
    blockers.push({
      kind: 'missing-acceptance-criteria',
      subject: candidate.id,
      detail: `no acceptance criteria stated for "${candidate.normalizedText}"`,
    });
  }

  if (input.evidence === null) {
    blockers.push({
      kind: 'unmet-evidence',
      subject: EVIDENCE_SUBJECT,
      detail:
        'the Evidence Contract has not been evaluated — EPIC-032 supplies it, and an ' +
        'unevaluated Contract is not a satisfied one (BR-0144)',
    });
  } else if (!input.evidence.satisfied) {
    blockers.push({
      kind: 'unmet-evidence',
      subject: EVIDENCE_SUBJECT,
      detail: `Evidence Contract unmet: ${input.evidence.unmet.join(', ') || 'unreported'}`,
    });
  }

  if (input.decision === null) {
    blockers.push({
      kind: 'pending-decision',
      subject: DECISION_SUBJECT,
      detail: 'no authorized human decision has been recorded for this set (FR-RQR-040)',
    });
  }

  // Stable order: the same set of blockers reads the same way every time, so a
  // reader can tell "the same four things" from "four different things".
  blockers.sort((a, b) => {
    const left = `${a.kind}:${a.subject}`;
    const right = `${b.kind}:${b.subject}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });

  return { ready: blockers.length === 0, blockers };
}
