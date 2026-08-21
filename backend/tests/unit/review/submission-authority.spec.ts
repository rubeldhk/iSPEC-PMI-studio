/**
 * T356 — only the project owner or the run's initiator may submit
 * (FR-RUN-015a). Answering stays open to everyone with access — the
 * restriction is on COMMITTING the batch, not participating.
 */
import { describe, expect, it } from 'vitest';
import { ForbiddenError, toHttpStatus } from '../../../src/core/errors.js';
import { WS, OWNER, INITIATOR, REVIEWER, harness, startUnattended, ask } from './helpers.js';

async function readySession() {
  const h = harness();
  const run = await startUnattended(h);
  const raised = await ask(h, run.id, 1);
  const session = await h.reviewSessions.openForRun(WS, run.id);
  await h.answerService.draft(WS, session!.id, {
    questionId: raised[0]!.id,
    authorId: REVIEWER,
    value: 'x',
  });
  return { h, session: session!, question: raised[0]! };
}

describe('T356 · submission authority', () => {
  it('the project owner may submit', async () => {
    const { h, session } = await readySession();
    const { session: submitted } = await h.submission.submit(WS, session.id, OWNER);
    expect(submitted.state).toBe('submitted');
  });

  it("the run's initiator may submit", async () => {
    const { h, session } = await readySession();
    const { session: submitted } = await h.submission.submit(WS, session.id, INITIATOR);
    expect(submitted.state).toBe('submitted');
  });

  it('anyone else is refused with a stated reason — 403, and drafts survive', async () => {
    const { h, session, question } = await readySession();
    const attempt = h.submission.submit(WS, session.id, REVIEWER);
    await expect(attempt).rejects.toThrow(ForbiddenError);
    expect(toHttpStatus(await attempt.catch((e: unknown) => e))).toBe(403);

    // The refusal changed nothing: session open, draft intact.
    expect((await h.reviewSessions.get(WS, session.id)).state).toBe('open');
    const rows = await h.answers.listForQuestion(WS, question.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.state).toBe('draft');
  });

  it('answering itself was never restricted — the reviewer participated freely', async () => {
    const { h, session, question } = await readySession();
    // REVIEWER (neither owner nor initiator) can still revise their draft.
    const revised = await h.answerService.draft(WS, session.id, {
      questionId: question.id,
      authorId: REVIEWER,
      value: 'revised',
    });
    expect(revised.value).toBe('revised');
  });
});
