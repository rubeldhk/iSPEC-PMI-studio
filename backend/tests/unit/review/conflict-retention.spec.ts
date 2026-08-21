/**
 * T801 — every competing answer remains retrievable with its author and time
 * after resolution; selecting a winner does not delete the answers not
 * chosen (SC-015).
 */
import { describe, expect, it } from 'vitest';
import { WS, OWNER, REVIEWER, REVIEWER_2, harness, startUnattended, ask } from './helpers.js';

describe('T801 · competing answers survive resolution', () => {
  it('the loser is retained with its author and time — never deleted', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q] = await ask(h, run.id, 1);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    const whenA = new Date('2026-08-21T09:00:00Z');
    const whenB = new Date('2026-08-21T09:05:00Z');
    await h.answerService.draft(WS, session!.id, { questionId: q!.id, authorId: REVIEWER, value: 'a' }, whenA);
    await h.answerService.draft(WS, session!.id, { questionId: q!.id, authorId: REVIEWER_2, value: 'b' }, whenB);
    const rows = await h.answers.listForQuestion(WS, q!.id);
    const winner = rows.find((r) => r.authorId === REVIEWER)!;

    const resolved = await h.conflicts.resolve(WS, session!.id, q!.id, {
      winnerAnswerId: winner.id,
      resolvedById: OWNER,
    });

    expect(resolved).toHaveLength(2);
    const loser = resolved.find((r) => r.authorId === REVIEWER_2)!;
    expect(loser.value).toBe('b');
    expect(loser.recordedAt).toEqual(whenB);
    expect(loser.selectedAsWinner).toBe(false);
    // The record shows WHO settled the disagreement, and when.
    expect(loser.conflictResolvedById).toBe(OWNER);
    expect(loser.conflictResolvedAt).not.toBeNull();
  });

  it('resolution survives submission — the disagreement stays in the permanent record', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q] = await ask(h, run.id, 1);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await h.answerService.draft(WS, session!.id, { questionId: q!.id, authorId: REVIEWER, value: 'a' });
    await h.answerService.draft(WS, session!.id, { questionId: q!.id, authorId: REVIEWER_2, value: 'b' });
    const rows = await h.answers.listForQuestion(WS, q!.id);
    await h.conflicts.resolve(WS, session!.id, q!.id, {
      winnerAnswerId: rows[0]!.id,
      resolvedById: OWNER,
    });
    await h.submission.submit(WS, session!.id, OWNER);

    const view = await h.reviewSessions.view(WS, session!.id);
    const kept = view.questions[0]!.answers;
    expect(kept).toHaveLength(2);
    expect(kept.filter((a) => a.selectedAsWinner)).toHaveLength(1);
    expect(kept.map((a) => a.authorId).sort()).toEqual([REVIEWER, REVIEWER_2].sort());
  });
});
