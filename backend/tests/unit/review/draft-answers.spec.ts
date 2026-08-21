/**
 * T353 — draft answers save without committing; a reviewer may take the
 * suggested answer or write their own AND attach a note to either
 * (FR-RUN-010); who answered and when is recorded, so every submitted answer
 * is permanently attributable to a person and a time (SC-006).
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../../src/core/errors.js';
import { WS, REVIEWER, REVIEWER_2, harness, startUnattended, ask } from './helpers.js';

async function setup() {
  const h = harness();
  const run = await startUnattended(h);
  const [q] = await ask(h, run.id, 1);
  const session = await h.reviewSessions.openForRun(WS, run.id);
  return { h, run, q: q!, session: session! };
}

describe('T353 · draft answers with attribution and notes', () => {
  it('saves a draft without committing the session', async () => {
    const { h, q, session } = await setup();
    const answer = await h.answerService.draft(WS, session.id, {
      questionId: q.id,
      authorId: REVIEWER,
      value: 'sqlite',
    });
    expect(answer.state).toBe('draft');
    expect((await h.reviewSessions.get(WS, session.id)).state).toBe('open');
  });

  it('takes the suggested answer, with a note (FR-RUN-010)', async () => {
    const { h, q, session } = await setup();
    const answer = await h.answerService.draft(WS, session.id, {
      questionId: q.id,
      authorId: REVIEWER,
      takeSuggested: true,
      note: 'Suggestion looks right for our scale.',
    });
    expect(answer.value).toBe(q.suggestedAnswer);
    expect(answer.note).toBe('Suggestion looks right for our scale.');
  });

  it('writes their own answer, also with a note (FR-RUN-010)', async () => {
    const { h, q, session } = await setup();
    const answer = await h.answerService.draft(WS, session.id, {
      questionId: q.id,
      authorId: REVIEWER,
      value: 'sqlite',
      note: 'Postgres is overkill here.',
    });
    expect(answer.value).toBe('sqlite');
    expect(answer.note).toBe('Postgres is overkill here.');
  });

  it('records who answered and when — permanent attribution (SC-006)', async () => {
    const { h, q, session } = await setup();
    const when = new Date('2026-08-21T09:30:00Z');
    const answer = await h.answerService.draft(
      WS,
      session.id,
      { questionId: q.id, authorId: REVIEWER, value: 'sqlite' },
      when,
    );
    expect(answer.authorId).toBe(REVIEWER);
    expect(answer.recordedAt).toEqual(when);
  });

  it('a reviewer revising replaces their OWN draft; a colleague gets their own row', async () => {
    const { h, q, session } = await setup();
    await h.answerService.draft(WS, session.id, { questionId: q.id, authorId: REVIEWER, value: 'a' });
    await h.answerService.draft(WS, session.id, { questionId: q.id, authorId: REVIEWER, value: 'b' });
    await h.answerService.draft(WS, session.id, { questionId: q.id, authorId: REVIEWER_2, value: 'b' });
    const rows = await h.answers.listForQuestion(WS, q.id);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.authorId === REVIEWER)?.value).toBe('b');
  });

  it('refuses an empty answer with the field named', async () => {
    const { h, q, session } = await setup();
    await expect(
      h.answerService.draft(WS, session.id, { questionId: q.id, authorId: REVIEWER, value: ' ' }),
    ).rejects.toThrow(ValidationFailedError);
  });
});
