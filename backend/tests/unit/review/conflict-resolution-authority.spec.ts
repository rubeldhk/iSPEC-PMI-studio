/**
 * T800 — only the project owner or the run's initiator may resolve a
 * conflict; anyone else is refused with a stated reason; answering and
 * noting stay open to every user with access (FR-RUN-013a).
 */
import { describe, expect, it } from 'vitest';
import { ForbiddenError, toHttpStatus } from '../../../src/core/errors.js';
import { WS, OWNER, INITIATOR, REVIEWER, REVIEWER_2, harness, startUnattended, ask } from './helpers.js';

async function conflicted() {
  const h = harness();
  const run = await startUnattended(h);
  const [q] = await ask(h, run.id, 1);
  const session = await h.reviewSessions.openForRun(WS, run.id);
  await h.answerService.draft(WS, session!.id, { questionId: q!.id, authorId: REVIEWER, value: 'a' });
  await h.answerService.draft(WS, session!.id, { questionId: q!.id, authorId: REVIEWER_2, value: 'b' });
  const rows = await h.answers.listForQuestion(WS, q!.id);
  return { h, session: session!, q: q!, rows };
}

describe('T800 · conflict resolution authority', () => {
  it('the project owner may resolve', async () => {
    const { h, session, q, rows } = await conflicted();
    const resolved = await h.conflicts.resolve(WS, session.id, q.id, {
      winnerAnswerId: rows[0]!.id,
      resolvedById: OWNER,
    });
    expect(resolved.some((a) => a.selectedAsWinner)).toBe(true);
  });

  it("the run's initiator may resolve", async () => {
    const { h, session, q, rows } = await conflicted();
    const resolved = await h.conflicts.resolve(WS, session.id, q.id, {
      winnerAnswerId: rows[1]!.id,
      resolvedById: INITIATOR,
    });
    expect(resolved.find((a) => a.selectedAsWinner)?.id).toBe(rows[1]!.id);
  });

  it('anyone else is refused with a STATED reason, not silence (403)', async () => {
    const { h, session, q, rows } = await conflicted();
    const attempt = h.conflicts.resolve(WS, session.id, q.id, {
      winnerAnswerId: rows[0]!.id,
      resolvedById: REVIEWER,
    });
    await expect(attempt).rejects.toThrow(ForbiddenError);
    const err = (await attempt.catch((e: unknown) => e)) as ForbiddenError;
    expect(err.message).toContain('project owner or the run initiator');
    expect(toHttpStatus(err)).toBe(403);
    // Nothing was resolved by the refusal.
    const rowsAfter = await h.answers.listForQuestion(WS, q.id);
    expect(rowsAfter.every((a) => !a.selectedAsWinner)).toBe(true);
  });

  it('answering and noting stay open to every user with access', async () => {
    const { h, session, q } = await conflicted();
    // A third participant, with no authority at all, can still answer + note.
    const answer = await h.answerService.draft(WS, session.id, {
      questionId: q.id,
      authorId: 'u_third',
      value: 'c',
      note: 'a third view',
    });
    expect(answer.note).toBe('a third view');
  });
});
