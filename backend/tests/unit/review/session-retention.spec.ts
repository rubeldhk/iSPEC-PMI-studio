/**
 * T825 — a submitted session is retained PERMANENTLY with every answer,
 * author, time and note intact, and can be neither edited nor deleted
 * afterwards (FR-RUN-020, SC-006).
 */
import { describe, expect, it } from 'vitest';
import { ConflictError } from '../../../src/core/errors.js';
import type { SessionStore } from '../../../src/modules/review/review-session.service.js';
import { WS, OWNER, REVIEWER, harness, startUnattended, ask } from './helpers.js';

describe('T825 · permanent retention of submitted sessions', () => {
  it('retains every answer with author, time and note intact after submission', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const raised = await ask(h, run.id, 2);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    const when = new Date('2026-08-21T11:00:00Z');
    for (const q of raised) {
      await h.answerService.draft(
        WS,
        session!.id,
        { questionId: q.id, authorId: REVIEWER, value: 'kept', note: 'why I chose it' },
        when,
      );
    }
    await h.submission.submit(WS, session!.id, OWNER);

    const view = await h.reviewSessions.view(WS, session!.id);
    expect(view.session.state).toBe('submitted');
    for (const q of view.questions) {
      expect(q.answers).toHaveLength(1);
      expect(q.answers[0]).toMatchObject({
        value: 'kept',
        authorId: REVIEWER,
        note: 'why I chose it',
        state: 'committed',
      });
      expect(q.answers[0]!.recordedAt).toEqual(when);
    }
  });

  it('cannot be edited afterwards — drafts and re-submission both refuse', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const raised = await ask(h, run.id, 1);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await h.answerService.draft(WS, session!.id, { questionId: raised[0]!.id, authorId: REVIEWER, value: 'v' });
    await h.submission.submit(WS, session!.id, OWNER);

    await expect(
      h.answerService.draft(WS, session!.id, { questionId: raised[0]!.id, authorId: OWNER, value: 'edit' }),
    ).rejects.toThrow(ConflictError);
    await expect(h.submission.submit(WS, session!.id, OWNER)).rejects.toThrow(ConflictError);
  });

  it('cannot be deleted — the store exposes no delete operation at all', () => {
    const h = harness();
    // Structural: the port has no delete member to call. The database trigger
    // in the migration enforces the same rule raw.
    const store: SessionStore = h.sessions;
    expect('delete' in store).toBe(false);
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(store))).not.toContain('delete');
  });

  it('the store submit is one-way: submitted never returns to open', async () => {
    const h = harness();
    const run = await startUnattended(h);
    await ask(h, run.id, 1);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await h.sessions.submit(WS, session!.id, new Date());
    await expect(h.sessions.submit(WS, session!.id, new Date())).rejects.toThrow(ConflictError);
  });
});
