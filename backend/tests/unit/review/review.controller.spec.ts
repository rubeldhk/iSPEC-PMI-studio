/**
 * T364a — the review controller: route wiring, 422 on unanswered questions,
 * 409 on unresolved conflict, 403 on submission by neither owner nor
 * initiator, and cross-workspace absence.
 *
 * Written to FAIL before T365 exists (Constitution V).
 */
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ReviewIncompleteError,
  toHttpStatus,
} from '../../../src/core/errors.js';
import { ReviewController } from '../../../src/modules/review/review.controller.js';
import {
  WS,
  OWNER,
  REVIEWER,
  REVIEWER_2,
  harness,
  startUnattended,
  ask,
  type Harness,
} from './helpers.js';

const CTX_OWNER = { workspaceId: WS, userId: OWNER };
const CTX_REVIEWER = { workspaceId: WS, userId: REVIEWER };
const CTX_OTHER_WS = { workspaceId: 'ws_b', userId: 'u_elsewhere' };

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

describe('T364a · route wiring', () => {
  it.each([
    ['forRun', 'runs/:id/review', RequestMethod.GET],
    ['get', 'review/:id', RequestMethod.GET],
    ['draft', 'review/:id/answers/:questionId', RequestMethod.PUT],
    ['submit', 'review/:id/submit', RequestMethod.POST],
    ['resolve', 'review/:id/conflicts/:questionId/resolve', RequestMethod.POST],
  ])('%s → %s', (handler, path, method) => {
    expect(route(handler)).toEqual({ path, method });
  });
});

describe('T364a · refusal mapping', () => {
  it('422 on submission with unanswered questions, naming them', async () => {
    const h = harness();
    const run = await startUnattended(h);
    await ask(h, run.id, 2);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    const attempt = controller(h).submit(CTX_OWNER, session!.id);
    await expect(attempt).rejects.toThrow(ReviewIncompleteError);
    expect(toHttpStatus(await attempt.catch((e: unknown) => e))).toBe(422);
  });

  it('409 on submission with an unresolved conflict', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q] = await ask(h, run.id, 1);
    const c = controller(h);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await c.draft({ workspaceId: WS, userId: REVIEWER }, session!.id, q!.id, { value: 'a' });
    await c.draft({ workspaceId: WS, userId: REVIEWER_2 }, session!.id, q!.id, { value: 'b' });
    const attempt = c.submit(CTX_OWNER, session!.id);
    await expect(attempt).rejects.toThrow(ConflictError);
    expect(toHttpStatus(await attempt.catch((e: unknown) => e))).toBe(409);
  });

  it('403 on submission by neither owner nor initiator', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q] = await ask(h, run.id, 1);
    const c = controller(h);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    await c.draft(CTX_REVIEWER, session!.id, q!.id, { takeSuggested: true });
    const attempt = c.submit(CTX_REVIEWER, session!.id);
    await expect(attempt).rejects.toThrow(ForbiddenError);
    expect(toHttpStatus(await attempt.catch((e: unknown) => e))).toBe(403);
  });

  it('cross-workspace access is ABSENT — 404 on every route', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q] = await ask(h, run.id, 1);
    const c = controller(h);
    const session = await h.reviewSessions.openForRun(WS, run.id);

    await expect(c.forRun(CTX_OTHER_WS, run.id)).rejects.toThrow(NotFoundError);
    await expect(c.get(CTX_OTHER_WS, session!.id)).rejects.toThrow(NotFoundError);
    await expect(
      c.draft(CTX_OTHER_WS, session!.id, q!.id, { value: 'x' }),
    ).rejects.toThrow(NotFoundError);
    await expect(c.submit(CTX_OTHER_WS, session!.id)).rejects.toThrow(NotFoundError);
  });
});

describe('T364a · the happy path bodies', () => {
  it('GET runs/:id/review answers the session with every question', async () => {
    const h = harness();
    const run = await startUnattended(h);
    await ask(h, run.id, 3);
    await h.reviewSessions.openForRun(WS, run.id);
    const body = await controller(h).forRun(CTX_OWNER, run.id);
    expect(body.questions).toHaveLength(3);
    expect(body.state).toBe('open');
  });

  it('PUT draft answers the saved answer with attribution', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q] = await ask(h, run.id, 1);
    const session = await h.reviewSessions.openForRun(WS, run.id);
    const body = await controller(h).draft(CTX_REVIEWER, session!.id, q!.id, {
      takeSuggested: true,
      note: 'fine by me',
    });
    expect(body.authorId).toBe(REVIEWER);
    expect(body.state).toBe('draft');
    expect(body.note).toBe('fine by me');
  });
});
