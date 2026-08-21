/**
 * T352 — a review session groups every question from one run (FR-RUN-006,
 * FR-RUN-009).
 */
import { describe, expect, it } from 'vitest';
import { WS, harness, startUnattended, ask } from './helpers.js';

describe('T352 · review session assembly', () => {
  it('groups every question from one run into its session', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const raised = await ask(h, run.id, 3);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    expect(session).not.toBeNull();

    const view = await h.reviewSessions.view(WS, session!.id);
    expect(view.questions.map((q) => q.question.id).sort()).toEqual(
      raised.map((q) => q.id).sort(),
    );
  });

  it('carries context, options and suggested answer for each question', async () => {
    const h = harness();
    const run = await startUnattended(h);
    await ask(h, run.id, 1);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    const view = await h.reviewSessions.view(WS, session!.id);
    const q = view.questions[0]!.question;
    expect(q.context).not.toBe('');
    expect(q.optionsConsidered.length).toBeGreaterThan(0);
    expect(q.suggestedAnswer).not.toBe('');
  });

  it('a run raising ZERO questions creates NO session', async () => {
    const h = harness();
    const run = await startUnattended(h);
    expect(await h.reviewSessions.openForRun(WS, run.id)).toBeNull();
  });

  it('one session per run: opening twice returns the same session', async () => {
    const h = harness();
    const run = await startUnattended(h);
    await ask(h, run.id, 2);
    const first = await h.reviewSessions.openForRun(WS, run.id);
    const second = await h.reviewSessions.openForRun(WS, run.id);
    expect(second!.id).toBe(first!.id);
  });
});
