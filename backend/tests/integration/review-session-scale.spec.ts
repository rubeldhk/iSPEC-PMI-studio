/**
 * T810 — SC-017: a review session of 200 questions opens, accepts answers
 * across multiple participants, detects a conflict, and submits without
 * failure or degradation.
 *
 * PP-018 carried "review sessions at scale untested" through three
 * validations because no number existed to test against; the parent's
 * session of 2026-08-19 set 200. This exercises the REAL service graph —
 * assembly, drafting, conflict detection, resolution, atomic submission —
 * end to end at that ceiling.
 */
import { describe, expect, it } from 'vitest';
import {
  WS,
  OWNER,
  REVIEWER,
  REVIEWER_2,
  harness,
  startUnattended,
  ask,
} from '../unit/review/helpers.js';

const QUESTIONS = 200;
// Generous even for CI: SC-003 allows 60 minutes for a HUMAN to review 20;
// the machinery for 200 must be interactive-fast, not minutes.
const BUDGET_MS = 30_000;

describe('T810 · SC-017 — a 200-question review session', () => {
  it('opens, accepts multi-participant answers, detects a conflict, and submits', async () => {
    const started = performance.now();
    const h = harness();
    const run = await startUnattended(h);
    const raised = await ask(h, run.id, QUESTIONS);
    expect(raised).toHaveLength(QUESTIONS);

    const session = await h.reviewSessions.openForRun(WS, run.id);
    expect(session).not.toBeNull();

    // Every question in exactly one session (SC-002 at scale).
    const view = await h.reviewSessions.view(WS, session!.id);
    expect(view.questions).toHaveLength(QUESTIONS);

    // Multiple participants answer: reviewer 1 takes odd, reviewer 2 even.
    for (const [i, q] of raised.entries()) {
      await h.answerService.draft(WS, session!.id, {
        questionId: q.id,
        authorId: i % 2 === 0 ? REVIEWER : REVIEWER_2,
        takeSuggested: true,
      });
    }

    // A disagreement on ONE question is detected and blocks submission.
    // Index 58 was drafted by REVIEWER (even index), so REVIEWER_2's differing
    // answer is a second AUTHOR disagreeing — a conflict, not a revision.
    const contested = raised[58]!;
    await h.answerService.draft(WS, session!.id, {
      questionId: contested.id,
      authorId: REVIEWER_2,
      value: 'a different call',
    });
    await expect(h.submission.submit(WS, session!.id, OWNER)).rejects.toMatchObject({
      code: 'conflict',
    });

    // …the owner settles it, and submission commits all 201 answers as one unit.
    const rows = await h.answers.listForQuestion(WS, contested.id);
    await h.conflicts.resolve(WS, session!.id, contested.id, {
      winnerAnswerId: rows.find((r) => r.value === 'a different call')!.id,
      resolvedById: OWNER,
    });
    const { session: submitted, committed } = await h.submission.submit(WS, session!.id, OWNER);
    expect(submitted.state).toBe('submitted');
    expect(committed).toHaveLength(QUESTIONS + 1);

    // The permanent record holds every answer with attribution (SC-006).
    const record = await h.reviewSessions.view(WS, session!.id);
    expect(record.questions.every((q) => q.answers.length >= 1)).toBe(true);

    // Without degradation: the whole 200-question lifecycle stays interactive.
    expect(performance.now() - started).toBeLessThan(BUDGET_MS);
  });
});
