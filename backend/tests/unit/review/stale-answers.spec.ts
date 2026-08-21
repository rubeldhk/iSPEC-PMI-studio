/**
 * T368 — a re-run warns which answers may be stale after the underlying work
 * changed (FR-RUN-019).
 */
import { describe, expect, it } from 'vitest';
import { WS, INITIATOR, harness, submittedRun } from './helpers.js';

describe('T368 · stale-answer warning', () => {
  it('warns for an answer whose underlying work changed after it was recorded', async () => {
    const h = harness();
    const recorded = new Date('2026-08-21T09:00:00Z');
    const { run, questions } = await submittedRun(h, 2, recorded);
    h.changes.markChanged(questions[0]!.id, new Date('2026-08-21T10:00:00Z'));

    const warnings = await h.stale.staleFor(WS, run.id);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.questionId).toBe(questions[0]!.id);
    expect(warnings[0]!.warning).toContain('may be stale');
  });

  it('does not warn when the change predates the answer', async () => {
    const h = harness();
    const recorded = new Date('2026-08-21T09:00:00Z');
    const { run, questions } = await submittedRun(h, 1, recorded);
    h.changes.markChanged(questions[0]!.id, new Date('2026-08-21T08:00:00Z'));
    expect(await h.stale.staleFor(WS, run.id)).toHaveLength(0);
  });

  it('the warnings ride the re-run result (FR-RUN-019)', async () => {
    const h = harness();
    const recorded = new Date('2026-08-21T09:00:00Z');
    const { run, questions } = await submittedRun(h, 2, recorded);
    h.changes.markChanged(questions[1]!.id, new Date('2026-08-21T10:00:00Z'));

    const result = await h.rerun.rerun(WS, run.id, INITIATOR);
    expect(result.staleWarnings.map((w) => w.questionId)).toEqual([questions[1]!.id]);
  });
});
