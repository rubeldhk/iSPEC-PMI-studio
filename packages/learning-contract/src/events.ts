/**
 * `T2310` (EPIC-048) — the `learning-candidate-recorded` payload (`R-048-17`,
 * `FR-LRN-060`).
 *
 * One **content** event type on the source execution. The payload carries the
 * outcome and the candidate id, **never the statement**: the candidate holds the
 * text, and an execution history is read far more widely than a candidate is.
 */

export const LEARNING_EVENT_TYPE = 'learning-candidate-recorded' as const;

export const LEARNING_EVENT_KINDS = Object.freeze([
  'submitted',
  'late-submitted',
  'corroborated',
  'refused',
  'bound-exceeded',
  'memory-policy-refused',
] as const);
export type LearningEventKind = (typeof LEARNING_EVENT_KINDS)[number];

export interface LearningCandidateRecorded {
  readonly kind: LearningEventKind;
  readonly candidateId?: string;
  readonly reason?: string;
}

/**
 * Build the payload, keeping exactly `kind`, `candidateId` and `reason`.
 *
 * Anything else handed in — a statement, a subject — is dropped rather than
 * forwarded, so a caller that passes the whole candidate cannot leak its text
 * into the execution history.
 */
export function learningEventPayload(input: LearningCandidateRecorded): LearningCandidateRecorded {
  if (!(LEARNING_EVENT_KINDS as readonly string[]).includes(input.kind)) {
    throw new Error(`"${String(input.kind)}" is not a learning event kind (${LEARNING_EVENT_KINDS.join(', ')}).`);
  }
  return {
    kind: input.kind,
    ...(input.candidateId !== undefined ? { candidateId: input.candidateId } : {}),
    ...(input.reason !== undefined ? { reason: input.reason } : {}),
  };
}
