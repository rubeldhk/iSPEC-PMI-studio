/**
 * `T2302`, `T2335` (EPIC-048) — the session routes of governed learning.
 *
 * PC-1: a transport. Every capability lives in a service; this file decides only
 * what a caller may say and what the session decides for them. Identity fields
 * in a body (`workspaceId`, `actor`, `requestedBy`, `reviewerId`, `approvedBy`,
 * `sourcePrincipalId`) are stripped and taken from the session — `EPIC-031`'s
 * `strip()` convention.
 *
 * **There is no route here that creates, edits or deletes knowledge**
 * (`SC-LRN-001`); `T2332` asserts it over every controller in the application.
 */
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req, Res } from '@nestjs/common';
import { UnauthenticatedError, ValidationFailedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { CandidateViewService, type CandidateViewBody } from './candidate.view.js';
import { KnowledgeService } from './knowledge.service.js';
import type { BrowseFilter } from './learning.store.js';
import { ReviewService, type ReviewResult } from './review.service.js';
import { SubmissionService, type SubmissionBody } from './submission.service.js';

export interface ActingUser {
  readonly workspaceId: string;
  readonly userId: string;
}

/** A product endpoint with no session is 401 — the local helper the siblings carry. */
export function requireSession(ctx: WorkspaceContext | undefined | null): ActingUser {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return { workspaceId: ctx.workspaceId, userId: ctx.userId };
}

/** Identity a body may not carry; overwritten from the session or credential anyway. */
export const IDENTITY_FIELDS = Object.freeze(['workspaceId', 'actor', 'requestedBy', 'reviewerId', 'approvedBy', 'sourcePrincipalId', 'sourceKind', 'userId']);

export function strip(body: unknown): Record<string, unknown> {
  const safe: Record<string, unknown> = { ...((body ?? {}) as Record<string, unknown>) };
  for (const field of IDENTITY_FIELDS) delete safe[field];
  return safe;
}

/** The slice of an Express response this file uses — the status of a 200 replay. */
interface StatusResponse {
  status(code: number): unknown;
}

@Controller()
export class LearningController {
  constructor(
    // @Inject by token: esbuild/tsx emits no design:paramtypes (DEF-001-005).
    @Inject(SubmissionService) private readonly submissions: SubmissionService,
    @Inject(CandidateViewService) private readonly candidates: CandidateViewService,
    @Inject(ReviewService) private readonly reviews: ReviewService,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
  ) {}

  /**
   * `FR-LRN-027`…`029` (T2363) — a person decides. **Session only**: this route is
   * not behind the connector guard, and a bearer credential here is no session
   * (`401`). The reviewer is the session's user; the body names only the decision
   * and, for an approval, the terms.
   */
  @Post('learning/candidates/:id/review')
  @HttpCode(200)
  review(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string, @Body() body: unknown): Promise<ReviewResult> {
    const user = requireSession(ctx);
    return this.reviews.review(user.workspaceId, user.userId, id, strip(body));
  }

  /** `FR-LRN-030` (T2361) — the submitter withdraws their own open candidate. */
  @Post('learning/candidates/:id/withdraw')
  @HttpCode(200)
  withdraw(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<{ state: 'withdrawn' }> {
    const user = requireSession(ctx);
    return this.reviews.withdraw(user.workspaceId, user.userId, id);
  }

  /** `FR-LRN-006` — a person submits as themselves. `201` recorded, `200` replay or corroboration. */
  @Post('learning/candidates')
  async submit(
    @Req() ctx: WorkspaceContext | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: StatusResponse,
  ): Promise<SubmissionBody> {
    const user = requireSession(ctx);
    const safe = strip(body);
    const projectId = safe['projectId'];
    if (typeof projectId !== 'string' || projectId.trim() === '') {
      throw new ValidationFailedError('projectId — the project the candidate comes from — is required.', { missing: ['source'], field: 'projectId' });
    }
    delete safe['projectId'];
    const outcome = await this.submissions.submit({ actor: { kind: 'person', workspaceId: user.workspaceId, userId: user.userId }, projectId, body: safe });
    res.status(outcome.status);
    return outcome.body;
  }

  /**
   * `FR-LRN-071` (T2345) — one candidate, everything a reviewer needs. Evidence is
   * filtered for **this** reader (`FR-LRN-016`); another workspace's candidate is 404.
   */
  @Get('learning/candidates/:id')
  candidate(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<CandidateViewBody> {
    const user = requireSession(ctx);
    return this.candidates.view(user.workspaceId, user, id);
  }

  /**
   * `FR-LRN-073` (T2371) — browse approved knowledge, 50 a page:
   * `?projectId=&scope=&category=&status=&cursor=`. Read-only: supersession,
   * deprecation and widening are **submissions**, never edits, so there is no
   * `PUT`, `PATCH` or `DELETE` here (`FR-LRN-031`, `FR-LRN-042`).
   */
  @Get('learning/knowledge')
  browse(@Req() ctx: WorkspaceContext | undefined, @Query() query: Record<string, string | undefined>): Promise<unknown> {
    const user = requireSession(ctx);
    const filter: BrowseFilter = {
      ...(query['projectId'] ? { projectId: query['projectId'] } : {}),
      ...(query['scope'] ? { scopeKind: query['scope'] as BrowseFilter['scopeKind'] } : {}),
      ...(query['category'] ? { category: query['category'] } : {}),
      ...(query['status'] ? { status: query['status'] as BrowseFilter['status'] } : {}),
      ...(query['cursor'] ? { cursor: query['cursor'] } : {}),
      ...(query['limit'] && Number.isInteger(Number(query['limit'])) ? { limit: Number(query['limit']) } : {}),
    };
    return this.knowledge.browse(user.workspaceId, filter);
  }

  /** `SC-LRN-006` — one entry: its current version and where it came from. */
  @Get('learning/knowledge/:entryId')
  entry(@Req() ctx: WorkspaceContext | undefined, @Param('entryId') entryId: string): Promise<unknown> {
    const user = requireSession(ctx);
    return this.knowledge.entry(user.workspaceId, entryId);
  }

  /** `FR-LRN-035` — every version, candidate, decision, status change and flag, in order. */
  @Get('learning/knowledge/:entryId/history')
  history(@Req() ctx: WorkspaceContext | undefined, @Param('entryId') entryId: string): Promise<unknown> {
    const user = requireSession(ctx);
    return this.knowledge.history(user.workspaceId, entryId);
  }
}
