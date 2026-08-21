/**
 * T354 — conflicting answers are surfaced and block submission until
 * resolved, so ZERO sessions submit with an unresolved conflict (FR-RUN-013,
 * SC-005). Both answers SURVIVE — last-write does not win (R-002-6).
 */
import { describe, expect, it } from 'vitest';
import { ConflictError } from '../../../src/core/errors.js';
import { answersConflict } from '../../../src/modules/review/conflict.service.js';
import { WS, OWNER, REVIEWER, REVIEWER_2, harness, startUnattended, ask } from './helpers.js';

async function conflictedSession() {
  const h = harness();
  const run = await startUnattended(h);
  const [q] = await ask(h, run.id, 1);
  const session = await h.reviewSessions.openForRun(WS, run.id);
  await h.answerService.draft(WS, session!.id, { questionId: q!.id, authorId: REVIEWER, value: 'postgres' });
  await h.answerService.draft(WS, session!.id, { questionId: q!.id, authorId: REVIEWER_2, value: 'sqlite' });
  return { h, run, q: q!, session: session! };
}

describe('T354 · conflict detection and gating', () => {
  it('two different answers from two people is a conflict, surfaced on both', async () => {
    const { h, q } = await conflictedSession();
    const rows = await h.answers.listForQuestion(WS, q.id);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.conflict)).toBe(true);
  });

  it('one person revising their own mind is NOT a conflict', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q] = await ask(h, run.id, 1);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await h.answerService.draft(WS, session!.id, { questionId: q!.id, authorId: REVIEWER, value: 'a' });
    await h.answerService.draft(WS, session!.id, { questionId: q!.id, authorId: REVIEWER, value: 'b' });
    const rows = await h.answers.listForQuestion(WS, q!.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.conflict).toBe(false);
  });

  it('agreement is not a conflict', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q] = await ask(h, run.id, 1);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await h.answerService.draft(WS, session!.id, { questionId: q!.id, authorId: REVIEWER, value: 'same' });
    await h.answerService.draft(WS, session!.id, { questionId: q!.id, authorId: REVIEWER_2, value: 'same' });
    expect(answersConflict(await h.answers.listForQuestion(WS, q!.id))).toBe(false);
  });

  it('an unresolved conflict BLOCKS submission, naming the questions (SC-005)', async () => {
    const { h, q, session } = await conflictedSession();
    const attempt = h.submission.submit(WS, session.id, OWNER);
    await expect(attempt).rejects.toThrow(ConflictError);
    const err = (await attempt.catch((e: unknown) => e)) as ConflictError;
    expect((err.details as { conflictingQuestionIds: string[] }).conflictingQuestionIds).toEqual([q.id]);
  });

  it('both answers survive the conflict — neither is merged nor discarded', async () => {
    const { h, q } = await conflictedSession();
    const rows = await h.answers.listForQuestion(WS, q.id);
    expect(rows.map((r) => r.value).sort()).toEqual(['postgres', 'sqlite']);
    expect(rows.map((r) => r.authorId).sort()).toEqual([REVIEWER, REVIEWER_2].sort());
  });

  it('a resolved conflict no longer blocks submission', async () => {
    const { h, q, session } = await conflictedSession();
    const rows = await h.answers.listForQuestion(WS, q.id);
    await h.conflicts.resolve(WS, session.id, q.id, {
      winnerAnswerId: rows[0]!.id,
      resolvedById: OWNER,
    });
    const { session: submitted } = await h.submission.submit(WS, session.id, OWNER);
    expect(submitted.state).toBe('submitted');
  });
});
