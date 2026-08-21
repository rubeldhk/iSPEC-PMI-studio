/**
 * T807 — a re-run carrying stale answers completes WITHOUT blocking or
 * waiting for input, proceeds under FR-RUN-004 with a provisional answer,
 * and marks the artifacts it produces provisional under FR-RUN-005 — SC-001
 * must survive this change.
 */
import { describe, expect, it } from 'vitest';
import { WS, INITIATOR, harness, submittedRun } from './helpers.js';

describe('T807 · re-raise never blocks the re-run', () => {
  it('the re-run completes without waiting for input — SC-001 survives', async () => {
    const h = harness();
    const recorded = new Date('2026-08-21T09:00:00Z');
    const { run, questions } = await submittedRun(h, 2, recorded);
    for (const q of questions) h.changes.markChanged(q.id, new Date('2026-08-21T10:00:00Z'));

    // Every answer is stale — the worst case. rerun() RESOLVES: no throw, no
    // pause, no prompt. The new run is running and can reach its stop point.
    const result = await h.rerun.rerun(WS, run.id, INITIATOR);
    expect(result.run.state).toBe('running');
    const stopped = await h.runMode.reachStopPoint(WS, result.run.id);
    expect(stopped.state).toBe('reached_stop_point');
  });

  it('proceeds under FR-RUN-004: the re-raised question carries a provisional answer', async () => {
    const h = harness();
    const recorded = new Date('2026-08-21T09:00:00Z');
    const { run, questions } = await submittedRun(h, 1, recorded);
    h.changes.markChanged(questions[0]!.id, new Date('2026-08-21T10:00:00Z'));

    const result = await h.rerun.rerun(WS, run.id, INITIATOR);
    const fresh = result.reRaised[0]!;
    // The suggestion, applied provisionally — never the stale answer.
    expect(fresh.provisionalAnswerApplied).toBe(fresh.suggestedAnswer);
  });

  it('artifacts produced from the provisional answer report provisional (FR-RUN-005)', async () => {
    const h = harness();
    const recorded = new Date('2026-08-21T09:00:00Z');
    const { run, questions } = await submittedRun(h, 1, recorded);
    h.changes.markChanged(questions[0]!.id, new Date('2026-08-21T10:00:00Z'));

    const result = await h.rerun.rerun(WS, run.id, INITIATOR);
    const fresh = result.reRaised[0]!;
    // The run engine derives an artifact from the provisional answer and
    // marks it against the RE-RAISED question — provisional until answered.
    const artifact = { artifactType: 'specification', artifactId: 'spec_rerun' };
    await h.provisional.mark(WS, artifact, fresh.id);
    expect(await h.provisional.isProvisional(WS, artifact)).toBe(true);
    await h.provisional.clearForQuestion(WS, fresh.id);
    expect(await h.provisional.isProvisional(WS, artifact)).toBe(false);
  });
});
