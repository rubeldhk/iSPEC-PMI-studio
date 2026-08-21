/**
 * T355 — submission is refused with unanswered questions, NAMING them, so
 * zero sessions submit incomplete (FR-RUN-014, SC-005).
 */
import { describe, expect, it } from 'vitest';
import { ReviewIncompleteError } from '../../../src/core/errors.js';
import { WS, OWNER, REVIEWER, harness, startUnattended, ask } from './helpers.js';

describe('T355 · the completeness gate', () => {
  it('refuses submission naming every unanswered question', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q1, q2, q3] = await ask(h, run.id, 3);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await h.answerService.draft(WS, session!.id, { questionId: q1!.id, authorId: REVIEWER, value: 'a' });

    const attempt = h.submission.submit(WS, session!.id, OWNER);
    await expect(attempt).rejects.toThrow(ReviewIncompleteError);
    const err = (await attempt.catch((e: unknown) => e)) as ReviewIncompleteError;
    const named = (err.details as { unansweredQuestionIds: string[] }).unansweredQuestionIds;
    expect(named.sort()).toEqual([q2!.id, q3!.id].sort());
  });

  it('the refused session stays open and its drafts survive', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q1] = await ask(h, run.id, 2);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await h.answerService.draft(WS, session!.id, { questionId: q1!.id, authorId: REVIEWER, value: 'a' });
    await h.submission.submit(WS, session!.id, OWNER).catch(() => undefined);

    expect((await h.reviewSessions.get(WS, session!.id)).state).toBe('open');
    const rows = await h.answers.listForQuestion(WS, q1!.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.state).toBe('draft');
  });

  it('submits once every question is answered', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const raised = await ask(h, run.id, 2);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    for (const q of raised) {
      await h.answerService.draft(WS, session!.id, { questionId: q.id, authorId: REVIEWER, value: 'x' });
    }
    const { session: submitted } = await h.submission.submit(WS, session!.id, OWNER);
    expect(submitted.state).toBe('submitted');
  });
});
