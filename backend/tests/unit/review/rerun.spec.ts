/**
 * T366 — a re-run applies submitted answers in place of provisional ones and
 * clears their markings (FR-RUN-016, FR-RUN-017).
 */
import { describe, expect, it } from 'vitest';
import { ConflictError } from '../../../src/core/errors.js';
import { WS, INITIATOR, REVIEWER, harness, startUnattended, ask, submittedRun } from './helpers.js';

describe('T366 · re-run with submitted answers', () => {
  it('applies each submitted answer in place of the provisional one', async () => {
    const h = harness();
    const { run, questions } = await submittedRun(h, 2);
    const result = await h.rerun.rerun(WS, run.id, INITIATOR);
    expect(result.applied.map((a) => a.questionId).sort()).toEqual(
      questions.map((q) => q.id).sort(),
    );
    expect(result.applied.every((a) => a.value === 'postgres')).toBe(true);
  });

  it("clears the applied questions' markings (FR-RUN-017)", async () => {
    const h = harness();
    const run = await startUnattended(h);
    const raised = await ask(h, run.id, 2);
    const spec = { artifactType: 'specification', artifactId: 'spec_1' };
    await h.provisional.mark(WS, spec, raised[0]!.id);
    await h.provisional.mark(WS, spec, raised[1]!.id);

    const session = await h.reviewSessions.openForRun(WS, run.id);
    for (const q of raised) {
      await h.answerService.draft(WS, session!.id, { questionId: q.id, authorId: REVIEWER, value: 'v' });
    }
    await h.submission.submit(WS, session!.id, INITIATOR);

    expect(await h.provisional.isProvisional(WS, spec)).toBe(true);
    const result = await h.rerun.rerun(WS, run.id, INITIATOR);
    expect(result.applied.reduce((n, a) => n + a.markingsCleared, 0)).toBe(2);
    expect(await h.provisional.isProvisional(WS, spec)).toBe(false);
  });

  it('refuses a re-run before the session is submitted — answers are just notes until committed', async () => {
    const h = harness();
    const run = await startUnattended(h);
    await ask(h, run.id, 1);
    await h.reviewSessions.openForRun(WS, run.id);
    await expect(h.rerun.rerun(WS, run.id, INITIATOR)).rejects.toThrow(ConflictError);
  });

  it('the resolved winner is the answer applied where a conflict was settled', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q] = await ask(h, run.id, 1);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await h.answerService.draft(WS, session!.id, { questionId: q!.id, authorId: REVIEWER, value: 'loser' });
    await h.answerService.draft(WS, session!.id, { questionId: q!.id, authorId: 'u_other', value: 'winner' });
    const rows = await h.answers.listForQuestion(WS, q!.id);
    await h.conflicts.resolve(WS, session!.id, q!.id, {
      winnerAnswerId: rows.find((r) => r.value === 'winner')!.id,
      resolvedById: INITIATOR,
    });
    await h.submission.submit(WS, session!.id, INITIATOR);

    const result = await h.rerun.rerun(WS, run.id, INITIATOR);
    expect(result.applied[0]!.value).toBe('winner');
  });
});
