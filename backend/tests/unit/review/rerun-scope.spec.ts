/**
 * T367 — unchanged answers do not needlessly repeat work, and new questions
 * open a NEW session rather than reopening a submitted one (FR-RUN-018).
 */
import { describe, expect, it } from 'vitest';
import { WS, INITIATOR, REVIEWER, harness, startUnattended, ask } from './helpers.js';

describe('T367 · re-run scope — reuse and the new-session rule', () => {
  it('an answer confirming the provisional guess leaves the work standing', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const raised = await ask(h, run.id, 2); // suggested/provisional = 'postgres'
    const session = await h.reviewSessions.openForRun(WS, run.id);
    // q1 confirms the guess; q2 overrides it.
    await h.answerService.draft(WS, session!.id, { questionId: raised[0]!.id, authorId: REVIEWER, takeSuggested: true });
    await h.answerService.draft(WS, session!.id, { questionId: raised[1]!.id, authorId: REVIEWER, value: 'sqlite' });
    await h.submission.submit(WS, session!.id, INITIATOR);

    const result = await h.rerun.rerun(WS, run.id, INITIATOR);
    expect(result.reusedWork).toEqual([raised[0]!.id]);
    expect(result.regenerated).toEqual([raised[1]!.id]);
  });

  it('a re-run with no stale answers opens NO new session — nothing to review', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const raised = await ask(h, run.id, 1);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await h.answerService.draft(WS, session!.id, { questionId: raised[0]!.id, authorId: REVIEWER, takeSuggested: true });
    await h.submission.submit(WS, session!.id, INITIATOR);

    const result = await h.rerun.rerun(WS, run.id, INITIATOR);
    expect(result.newSession).toBeNull();
  });

  it('new questions on the re-run open a NEW session; the submitted one stays closed', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const raised = await ask(h, run.id, 1);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await h.answerService.draft(WS, session!.id, { questionId: raised[0]!.id, authorId: REVIEWER, takeSuggested: true });
    await h.submission.submit(WS, session!.id, INITIATOR);

    const result = await h.rerun.rerun(WS, run.id, INITIATOR);
    // The engine raises a NEW question during the re-run…
    await ask(h, result.run.id, 1);
    const fresh = await h.reviewSessions.openForRun(WS, result.run.id);

    expect(fresh).not.toBeNull();
    expect(fresh!.id).not.toBe(session!.id);
    expect(fresh!.state).toBe('open');
    expect((await h.reviewSessions.get(WS, session!.id)).state).toBe('submitted');
  });
});
