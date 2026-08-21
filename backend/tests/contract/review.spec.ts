/**
 * T364 + T804 — contract tests for the review session endpoints against
 * `specs/002-team-review-access-storage/contracts/platform-api-epic-002.md`
 * (Review sessions · FR-RUN-006, FR-RUN-009 to FR-RUN-020).
 *
 * The contract's refusal table, asserted row by row:
 *   unanswered questions        → 422, naming them
 *   unresolved conflict         → 409, naming the conflicting questions
 *   neither owner nor initiator → 403 with a stated reason; drafts survive
 *   session already submitted   → 409
 * plus T804's conflict-resolution endpoint: 403 for anyone who is neither
 * the project owner nor the run's initiator.
 */
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  ConflictError,
  ForbiddenError,
  ReviewIncompleteError,
  toErrorBody,
  toHttpStatus,
} from '../../src/core/errors.js';
import { ReviewController } from '../../src/modules/review/review.controller.js';
import {
  WS,
  OWNER,
  REVIEWER,
  REVIEWER_2,
  harness,
  startUnattended,
  ask,
  type Harness,
} from '../unit/review/helpers.js';

const CTX_OWNER = { workspaceId: WS, userId: OWNER };
const CTX_REVIEWER = { workspaceId: WS, userId: REVIEWER };

function controller(h: Harness): ReviewController {
  return new ReviewController(h.reviewSessions, h.answerService, h.submission, h.conflicts);
}

function route(handler: string): { path: string; method: RequestMethod } {
  const fn = ReviewController.prototype[handler as keyof ReviewController] as object;
  return {
    path: Reflect.getMetadata('path', fn) as string,
    method: Reflect.getMetadata('method', fn) as RequestMethod,
  };
}

describe('contract · review route surface', () => {
  it.each([
    ['forRun', 'runs/:id/review', RequestMethod.GET],
    ['draft', 'review/:id/answers/:questionId', RequestMethod.PUT],
    ['submit', 'review/:id/submit', RequestMethod.POST],
    ['get', 'review/:id', RequestMethod.GET],
    ['resolve', 'review/:id/conflicts/:questionId/resolve', RequestMethod.POST],
  ])('%s → %s', (handler, path, method) => {
    expect(route(handler)).toEqual({ path, method });
  });
});

describe('contract · GET /runs/{id}/review (FR-RUN-009)', () => {
  it('every question carries context, options, and the suggested answer', async () => {
    const h = harness();
    const run = await startUnattended(h);
    await ask(h, run.id, 2);
    await h.reviewSessions.openForRun(WS, run.id);
    const body = await controller(h).forRun(CTX_OWNER, run.id);
    for (const q of body.questions) {
      expect(q.context).not.toBe('');
      expect(q.optionsConsidered.length).toBeGreaterThan(0);
      expect(q.suggestedAnswer).not.toBe('');
    }
  });

  it('a question the caller cannot access is marked restricted, NOT omitted', async () => {
    const h = harness();
    const run = await startUnattended(h);
    await ask(h, run.id, 1);
    await h.recorder.record(WS, run.id, {
      context: 'Concerns an artifact this reviewer cannot see.',
      optionsConsidered: ['a', 'b'],
      suggestedAnswer: 'a',
      restricted: true,
    });
    await h.reviewSessions.openForRun(WS, run.id);
    const body = await controller(h).forRun(CTX_OWNER, run.id);
    expect(body.questions).toHaveLength(2);
    expect(body.questions.filter((q) => q.restricted)).toHaveLength(1);
  });
});

describe('contract · the refusal table', () => {
  it('unanswered questions → 422, naming them (FR-RUN-014)', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q1] = await ask(h, run.id, 2);
    const c = controller(h);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await c.draft(CTX_REVIEWER, session!.id, q1!.id, { takeSuggested: true });

    const attempt = c.submit(CTX_OWNER, session!.id);
    await expect(attempt).rejects.toThrow(ReviewIncompleteError);
    const err = await attempt.catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(422);
    const body = toErrorBody(err);
    expect(
      (body.error.details as { unansweredQuestionIds: string[] }).unansweredQuestionIds,
    ).toHaveLength(1);
  });

  it('unresolved conflict → 409, naming the conflicting questions (FR-RUN-013)', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q] = await ask(h, run.id, 1);
    const c = controller(h);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await c.draft({ workspaceId: WS, userId: REVIEWER }, session!.id, q!.id, { value: 'a' });
    await c.draft({ workspaceId: WS, userId: REVIEWER_2 }, session!.id, q!.id, { value: 'b' });

    const attempt = c.submit(CTX_OWNER, session!.id);
    const err = await attempt.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(toHttpStatus(err)).toBe(409);
    expect(
      (toErrorBody(err).error.details as { conflictingQuestionIds: string[] })
        .conflictingQuestionIds,
    ).toEqual([q!.id]);
  });

  it('neither owner nor initiator → 403 with a stated reason; drafts survive (FR-RUN-015a)', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q] = await ask(h, run.id, 1);
    const c = controller(h);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await c.draft(CTX_REVIEWER, session!.id, q!.id, { takeSuggested: true });

    const attempt = c.submit(CTX_REVIEWER, session!.id);
    const err = await attempt.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(toHttpStatus(err)).toBe(403);
    expect(toErrorBody(err).error.message).toContain('project owner or the run initiator');
    // Drafts survive the refusal.
    expect(await h.answers.listForQuestion(WS, q!.id)).toHaveLength(1);
  });

  it('session already submitted → 409 — a new session must be opened (FR-RUN-018)', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q] = await ask(h, run.id, 1);
    const c = controller(h);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await c.draft(CTX_REVIEWER, session!.id, q!.id, { takeSuggested: true });
    await c.submit(CTX_OWNER, session!.id);

    const attempt = c.submit(CTX_OWNER, session!.id);
    const err = await attempt.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(toHttpStatus(err)).toBe(409);
  });
});

describe('contract · GET /review/{id} after submission (FR-RUN-020)', () => {
  it('answers each answer with author, time and note', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q] = await ask(h, run.id, 1);
    const c = controller(h);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await c.draft(CTX_REVIEWER, session!.id, q!.id, { value: 'kept', note: 'reasoning' });
    await c.submit(CTX_OWNER, session!.id);

    const body = await c.get(CTX_OWNER, session!.id);
    expect(body.state).toBe('submitted');
    expect(body.submittedAt).not.toBeNull();
    const answer = body.questions[0]!.answers[0]!;
    expect(answer.authorId).toBe(REVIEWER);
    expect(answer.note).toBe('reasoning');
    expect(answer.recordedAt).toBeInstanceOf(Date);
  });
});

describe('T804 · contract · conflict resolution endpoint', () => {
  async function conflicted() {
    const h = harness();
    const run = await startUnattended(h);
    const [q] = await ask(h, run.id, 1);
    const c = controller(h);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await c.draft({ workspaceId: WS, userId: REVIEWER }, session!.id, q!.id, { value: 'a' });
    await c.draft({ workspaceId: WS, userId: REVIEWER_2 }, session!.id, q!.id, { value: 'b' });
    const rows = await h.answers.listForQuestion(WS, q!.id);
    return { h, c, session: session!, q: q!, rows };
  }

  it('403 when the caller is neither the project owner nor the run initiator', async () => {
    const { c, session, q, rows } = await conflicted();
    const attempt = c.resolve(CTX_REVIEWER, session.id, q.id, { winnerAnswerId: rows[0]!.id });
    const err = await attempt.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(toHttpStatus(err)).toBe(403);
  });

  it('the owner resolves; every competing answer is returned, none deleted', async () => {
    const { c, session, q, rows } = await conflicted();
    const body = await c.resolve(CTX_OWNER, session.id, q.id, { winnerAnswerId: rows[0]!.id });
    expect(body).toHaveLength(2);
    expect(body.filter((a) => a.selectedAsWinner)).toHaveLength(1);
  });
});
