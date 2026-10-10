/**
 * EPIC-048 `T2385` (`FR-LRN-070`, `-071`; amendment `A-031-2`) — the learning
 * candidate's view, registered in `EPIC-031`'s Decision Inbox renderer
 * registry for object type `learning-candidate`.
 *
 * The registry hands a renderer the entry and nothing else, so the view reads
 * the candidate through the shell's client. It adds detail inside the entry;
 * which entries appear, their order and the Inbox's own actions stay
 * `EPIC-031`'s. No area and no route of its own (`FR-LRN-070`).
 *
 * Registered once, on import, by the shell's area bindings (`area-views.tsx`).
 */
import type { ReactElement } from 'react';
import { inboxRenderers, type InboxRendererRegistry } from '../decision-inbox-renderers';
import type { InboxEntry } from '../../services/api';
import { useShell } from '../../shell/shell-context';
import { LearningCandidateDetail } from './LearningCandidateDetail';

export const LEARNING_CANDIDATE_OBJECT_TYPE = 'learning-candidate';

export function LearningCandidateInboxDetail({ entry }: { entry: InboxEntry }): ReactElement {
  const { api } = useShell();
  return <LearningCandidateDetail api={api} candidateId={entry.objectRef.id} />;
}

/** Idempotent: a second import does not trip the registry's one-owner rule. */
export function registerLearningInboxDetail(registry: InboxRendererRegistry = inboxRenderers): void {
  if (registry.rendererFor(LEARNING_CANDIDATE_OBJECT_TYPE) === LearningCandidateInboxDetail) return;
  registry.register(LEARNING_CANDIDATE_OBJECT_TYPE, LearningCandidateInboxDetail);
}

registerLearningInboxDetail();
