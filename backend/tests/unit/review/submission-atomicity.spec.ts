/**
 * T824 — submission commits every answer as ONE unit — all or none — and the
 * session is closed to further edits once committed, so a partial submission
 * cannot exist (FR-RUN-015).
 */
import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../../../src/core/errors.js';
import { SubmissionService } from '../../../src/modules/review/submission.service.js';
import { WS, OWNER, REVIEWER, harness, startUnattended, ask } from './helpers.js';

describe('T824 · atomic batch submission', () => {
  it('commits every draft in one unit and closes the session', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const raised = await ask(h, run.id, 5);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    for (const q of raised) {
      await h.answerService.draft(WS, session!.id, { questionId: q.id, authorId: REVIEWER, value: 'v' });
    }
    const { session: submitted, committed } = await h.submission.submit(WS, session!.id, OWNER);
    expect(submitted.state).toBe('submitted');
    expect(committed).toHaveLength(5);
    for (const q of raised) {
      const rows = await h.answers.listForQuestion(WS, q.id);
      expect(rows.every((a) => a.state === 'committed')).toBe(true);
    }
  });

  it('all or none: a commit that cannot complete commits NOTHING', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const raised = await ask(h, run.id, 3);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    for (const q of raised) {
      await h.answerService.draft(WS, session!.id, { questionId: q.id, authorId: REVIEWER, value: 'v' });
    }
    // A store whose commit validates one bad id: the whole batch must refuse
    // before ANY answer flips — the in-memory store validates-then-mutates,
    // exactly as the transactional store does.
    const sabotaged = new SubmissionService(
      h.runs,
      h.questions,
      {
        find: (ws, id) => h.sessions.find(ws, id),
        findForRun: (ws, runId) => h.sessions.findForRun(ws, runId),
        create: (s) => h.sessions.create(s),
        submit: (ws, id, at) => h.sessions.submit(ws, id, at),
      },
      {
        upsertDraft: (a) => h.answers.upsertDraft(a),
        listForQuestion: (ws, q) => h.answers.listForQuestion(ws, q),
        update: (ws, id, patch) => h.answers.update(ws, id, patch),
        commitAll: (ws, ids, at) => h.answers.commitAll(ws, [...ids, 'ans_missing'], at),
      },
      h.owners,
    );

    await expect(sabotaged.submit(WS, session!.id, OWNER)).rejects.toThrow(NotFoundError);

    // NOTHING committed, session still open — no partial submission exists.
    for (const q of raised) {
      const rows = await h.answers.listForQuestion(WS, q.id);
      expect(rows.every((a) => a.state === 'draft')).toBe(true);
    }
    expect((await h.reviewSessions.get(WS, session!.id)).state).toBe('open');
  });

  it('a committed session refuses further edits (FR-RUN-015)', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const raised = await ask(h, run.id, 1);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await h.answerService.draft(WS, session!.id, { questionId: raised[0]!.id, authorId: REVIEWER, value: 'v' });
    await h.submission.submit(WS, session!.id, OWNER);

    await expect(
      h.answerService.draft(WS, session!.id, { questionId: raised[0]!.id, authorId: REVIEWER, value: 'late' }),
    ).rejects.toThrow(ConflictError);
    await expect(h.submission.submit(WS, session!.id, OWNER)).rejects.toThrow(ConflictError);
  });
});
