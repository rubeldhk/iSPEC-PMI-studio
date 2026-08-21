/**
 * T822 — every question a run raises lands in EXACTLY ONE review session:
 * none lost, none duplicated across a run's sessions, and a re-run's new
 * questions never re-enter a submitted one (SC-002, FR-RUN-018).
 */
import { describe, expect, it } from 'vitest';
import { WS, INITIATOR, harness, startUnattended, ask, submittedRun } from './helpers.js';

describe('T822 · session completeness — SC-002', () => {
  it('none lost: every question the run raised appears in its session', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const raised = await ask(h, run.id, 7);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    const view = await h.reviewSessions.view(WS, session!.id);
    expect(view.questions).toHaveLength(raised.length);
  });

  it('none duplicated: re-opening the session never duplicates a question', async () => {
    const h = harness();
    const run = await startUnattended(h);
    await ask(h, run.id, 3);
    await h.reviewSessions.openForRun(WS, run.id);
    const again = await h.reviewSessions.openForRun(WS, run.id);
    const view = await h.reviewSessions.view(WS, again!.id);
    const ids = view.questions.map((q) => q.question.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(3);
  });

  it("a re-run's re-raised questions land in a NEW session, never the submitted one", async () => {
    const h = harness();
    const { run, session, questions } = await submittedRun(h, 2);
    // The underlying work behind q1 changes → its answer is stale → re-raised.
    h.changes.markChanged(questions[0]!.id, new Date(Date.now() + 60_000));

    const result = await h.rerun.rerun(WS, run.id, INITIATOR);

    expect(result.newSession).not.toBeNull();
    expect(result.newSession!.id).not.toBe(session.id);
    // The submitted session is untouched and still submitted.
    const old = await h.reviewSessions.get(WS, session.id);
    expect(old.state).toBe('submitted');
    // The re-raised question belongs to the NEW run and only there.
    const newView = await h.reviewSessions.view(WS, result.newSession!.id);
    expect(newView.questions).toHaveLength(1);
    const oldView = await h.reviewSessions.view(WS, session.id);
    expect(oldView.questions).toHaveLength(2);
  });

  it('a question belongs to exactly one run and that run has at most one session', async () => {
    const h = harness();
    const runA = await startUnattended(h);
    const runB = await startUnattended(h);
    const raisedA = await ask(h, runA.id, 2);
    await ask(h, runB.id, 2);
    const sessionA = await h.reviewSessions.openForRun(WS, runA.id);
    const sessionB = await h.reviewSessions.openForRun(WS, runB.id);
    const viewA = await h.reviewSessions.view(WS, sessionA!.id);
    const viewB = await h.reviewSessions.view(WS, sessionB!.id);
    for (const q of raisedA) {
      expect(viewA.questions.some((v) => v.question.id === q.id)).toBe(true);
      expect(viewB.questions.some((v) => v.question.id === q.id)).toBe(false);
    }
  });
});
