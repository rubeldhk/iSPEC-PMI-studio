/**
 * T806 — every stale answer's governing question reappears as a NEW question
 * in the re-run's review session, and the stale answer is NOT applied, while
 * answers not identified as stale still are (FR-RUN-019a, SC-016).
 */
import { describe, expect, it } from 'vitest';
import { WS, INITIATOR, harness, submittedRun } from './helpers.js';

describe('T806 · stale answers are asked again, not applied', () => {
  it('re-raises the stale question into the NEW session and does not apply the answer', async () => {
    const h = harness();
    const recorded = new Date('2026-08-21T09:00:00Z');
    const { run, questions } = await submittedRun(h, 2, recorded);
    h.changes.markChanged(questions[0]!.id, new Date('2026-08-21T10:00:00Z'));

    const result = await h.rerun.rerun(WS, run.id, INITIATOR);

    // SC-016 — ZERO stale answers applied.
    expect(result.applied.map((a) => a.questionId)).toEqual([questions[1]!.id]);
    // The stale question reappears as a NEW question on the new run…
    expect(result.reRaised).toHaveLength(1);
    expect(result.reRaised[0]!.runId).toBe(result.run.id);
    expect(result.reRaised[0]!.id).not.toBe(questions[0]!.id);
    // …in the re-run's review session.
    expect(result.newSession).not.toBeNull();
    const view = await h.reviewSessions.view(WS, result.newSession!.id);
    expect(view.questions.map((q) => q.question.id)).toEqual([result.reRaised[0]!.id]);
  });

  it('the re-raised question keeps the original context and names the possibly-stale answer', async () => {
    const h = harness();
    const recorded = new Date('2026-08-21T09:00:00Z');
    const { run, questions } = await submittedRun(h, 1, recorded);
    h.changes.markChanged(questions[0]!.id, new Date('2026-08-21T10:00:00Z'));

    const result = await h.rerun.rerun(WS, run.id, INITIATOR);
    const fresh = result.reRaised[0]!;
    expect(fresh.context).toContain(questions[0]!.context);
    expect(fresh.context).toContain('may be stale');
    expect(fresh.optionsConsidered).toEqual(questions[0]!.optionsConsidered);
  });

  it('answers not identified as stale still apply and clear their markings', async () => {
    const h = harness();
    const recorded = new Date('2026-08-21T09:00:00Z');
    const { run, questions } = await submittedRun(h, 3, recorded);
    const spec = { artifactType: 'specification', artifactId: 's1' };
    await h.provisional.mark(WS, spec, questions[1]!.id, recorded);
    h.changes.markChanged(questions[0]!.id, new Date('2026-08-21T10:00:00Z'));

    const result = await h.rerun.rerun(WS, run.id, INITIATOR);
    expect(result.applied.map((a) => a.questionId).sort()).toEqual(
      [questions[1]!.id, questions[2]!.id].sort(),
    );
    expect(await h.provisional.isProvisional(WS, spec)).toBe(false);
  });
});
