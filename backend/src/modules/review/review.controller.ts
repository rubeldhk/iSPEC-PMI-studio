/**
 * T365 + T805 — the review session surface per
 * `specs/002-team-review-access-storage/contracts/platform-api-epic-002.md`
 * (Review sessions · FR-RUN-006, FR-RUN-009 to FR-RUN-020).
 *
 * The contract's refusal table, wired one row at a time:
 *
 *   unanswered questions → 422 naming them (FR-RUN-014)
 *   unresolved conflict  → 409 naming the conflicting questions (FR-RUN-013)
 *   neither owner nor initiator → 403 WITH a stated reason; drafts survive
 *   session already submitted   → 409 — open a new session (FR-RUN-018)
 *
 * The 403 is deliberate and differs from the artifact rule: the session's
 * existence is not secret to someone who can already see it; what is refused
 * is the AUTHORITY to submit or resolve.
 */
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { AnswerService } from './answer.service.js';
import type { AnswerRecord } from './answer.service.js';
import { ConflictService } from './conflict.service.js';
import { ReviewSessionService } from './review-session.service.js';
import type { SessionView } from './review-session.service.js';
import { SubmissionService } from './submission.service.js';

function requireAuth(ctx: WorkspaceContext | undefined | null): WorkspaceContext {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return ctx;
}

/** An answer as the contract shows it — attribution intact (SC-006). */
export interface AnswerBody {
  id: string;
  questionId: string;
  value: string;
  authorId: string;
  recordedAt: Date;
  note: string | null;
  state: string;
  conflict: boolean;
  selectedAsWinner: boolean;
}

export interface SessionQuestionBody {
  id: string;
  context: string;
  optionsConsidered: string[];
  suggestedAnswer: string;
  /** Marked restricted, never omitted (parent edge case). */
  restricted: boolean;
  answers: AnswerBody[];
}

export interface SessionBody {
  id: string;
  runId: string;
  state: string;
  openedAt: Date;
  submittedAt: Date | null;
  questions: SessionQuestionBody[];
}

function toAnswerBody(answer: AnswerRecord): AnswerBody {
  return {
    id: answer.id,
    questionId: answer.questionId,
    value: answer.value,
    authorId: answer.authorId,
    recordedAt: answer.recordedAt,
    note: answer.note,
    state: answer.state,
    conflict: answer.conflict,
    selectedAsWinner: answer.selectedAsWinner,
  };
}

function toSessionBody(view: SessionView): SessionBody {
  return {
    id: view.session.id,
    runId: view.session.runId,
    state: view.session.state,
    openedAt: view.session.openedAt,
    submittedAt: view.session.submittedAt,
    questions: view.questions.map((q) => ({
      id: q.question.id,
      context: q.question.context,
      optionsConsidered: q.question.optionsConsidered,
      suggestedAnswer: q.question.suggestedAnswer,
      restricted: q.question.restricted,
      answers: q.answers.map(toAnswerBody),
    })),
  };
}

@Controller()
export class ReviewController {
  constructor(
    @Inject(ReviewSessionService) private readonly sessions: ReviewSessionService,
    @Inject(AnswerService) private readonly answers: AnswerService,
    @Inject(SubmissionService) private readonly submission: SubmissionService,
    @Inject(ConflictService) private readonly conflicts: ConflictService,
  ) {}

  /** FR-RUN-009 — every question with context, options, suggested answer. */
  @Get('runs/:id/review')
  async forRun(@Req() ctx: WorkspaceContext | undefined, @Param('id') runId: string): Promise<SessionBody> {
    const session = requireAuth(ctx);
    const record = await this.sessions.getForRun(session.workspaceId, runId);
    return toSessionBody(await this.sessions.view(session.workspaceId, record.id));
  }

  /** FR-RUN-020 — the record, before and after submission. */
  @Get('review/:id')
  async get(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<SessionBody> {
    const session = requireAuth(ctx);
    return toSessionBody(await this.sessions.view(session.workspaceId, id));
  }

  /** FR-RUN-011 — saves a DRAFT; commits nothing. */
  @Put('review/:id/answers/:questionId')
  async draft(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() body: { value?: string; takeSuggested?: boolean; note?: string },
  ): Promise<AnswerBody> {
    const session = requireAuth(ctx);
    const saved = await this.answers.draft(session.workspaceId, id, {
      questionId,
      authorId: session.userId,
      value: body?.value,
      takeSuggested: body?.takeSuggested,
      note: body?.note,
    });
    return toAnswerBody(saved);
  }

  /** FR-RUN-015 — atomic batch commit behind the three gates. */
  @Post('review/:id/submit')
  @HttpCode(200)
  async submit(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<SessionBody> {
    const session = requireAuth(ctx);
    await this.submission.submit(session.workspaceId, id, session.userId);
    return toSessionBody(await this.sessions.view(session.workspaceId, id));
  }

  /** T805 — FR-RUN-013a: 403 when neither the owner nor the initiator. */
  @Post('review/:id/conflicts/:questionId/resolve')
  @HttpCode(200)
  async resolve(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() body: { winnerAnswerId?: string },
  ): Promise<AnswerBody[]> {
    const session = requireAuth(ctx);
    const rows = await this.conflicts.resolve(session.workspaceId, id, questionId, {
      winnerAnswerId: body?.winnerAnswerId ?? '',
      resolvedById: session.userId,
    });
    return rows.map(toAnswerBody);
  }
}
