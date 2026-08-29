/**
 * T337y — the Requirement Room's eight real entry points, per
 * `contracts/room-contract.md` §5.
 *
 * PC-1: a transport. Every capability lives in the service and is callable
 * without HTTP.
 *
 * These exist at `T337y` so Constitution XI Tier 1 has something real to reach;
 * their handlers refuse until the tasks named in the service implement them.
 */
import { Body, Controller, Get, Inject, Param, Post, Query, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import type { ApproveBaselineInput } from './baseline.service.js';
import type { GapIntakeCommand, IntakeCommand } from './intake.service.js';
import { RequirementRoomService } from './requirement-room.service.js';
import type {
  ActingPrincipal,
  AnalysisQuery,
  ClarificationRequest,
  DecideRequest,
  HandoffRequest,
  OptionsRequest,
  ReadinessQuery,
} from './requirement-room.service.js';

/**
 * A product endpoint with no session is 401 — the same local helper the other
 * thirteen product controllers carry. Distinct from the opaque 404 that hides
 * cross-workspace existence: that rule is about resources, this is about the
 * caller.
 */
function requireAuth(ctx: WorkspaceContext | undefined | null): ActingPrincipal {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return { workspaceId: ctx.workspaceId, userId: ctx.userId };
}

/**
 * Identity fields a body may not smuggle in (`T1149`).
 *
 * The service overwrites each of these from the resolved session, so stripping
 * them here changes no outcome — it is a second statement of the same rule, at
 * the boundary where a reader looks first. `DEF-033-001` began as a body that
 * looked authoritative because nothing visibly took it away.
 */
function strip<T>(body: unknown): T {
  const {
    workspaceId: _ws,
    approvedBy: _approved,
    actor: _actor,
    askedBy: _asked,
    selectedBy: _selected,
    ...safe
  } = (body ?? {}) as Record<string, unknown>;
  return safe as T;
}

@Controller()
export class RequirementRoomController {
  constructor(
    // @Inject by token: esbuild/tsx emits no `design:paramtypes` (DEF-001-005).
    @Inject(RequirementRoomService) private readonly room: RequirementRoomService,
  ) {}

  /**
   * `T1167` — where a Room begins.
   *
   * Deliberately **not** under `/rooms/requirement/:id/`: there is no id yet,
   * which is the whole point. `intake` joins an existing Room; this one opens.
   */
  /**
   * `T1171` — the workspace's Rooms, for the index at `/requirement-room`.
   *
   * `GET` on the same path `POST` opens one at: a collection and its creation.
   */
  @Get('rooms/requirement')
  listRooms(@Req() ctx: WorkspaceContext | undefined): Promise<unknown> {
    return this.room.listRooms(requireAuth(ctx));
  }

  @Post('rooms/requirement')
  openRoom(
    @Req() ctx: WorkspaceContext | undefined,
    @Body() body: { projectId: string; text: string; sourceRef?: string },
  ): Promise<unknown> {
    return this.room.openRoom(
      requireAuth(ctx),
      strip<{ projectId: string; text: string; sourceRef?: string }>(body),
    );
  }

  @Post('rooms/requirement/intake')
  intake(
    @Req() ctx: WorkspaceContext | undefined,
    @Body() body: IntakeCommand,
  ): Promise<unknown> {
    return this.room.intake(requireAuth(ctx), strip<IntakeCommand>(body));
  }

  /**
   * T338v — `EPIC-035` `FR-DFR-076`, contract §5.
   *
   * The destination a Requirement Gap had none of when `EPIC-035` was planned.
   * Deliberately **not** under `/rooms/requirement/:id/`: a routed gap is new
   * intent and has no Room object of its own yet, exactly as a first intake
   * does not.
   */
  @Post('rooms/requirement/gap-intake')
  gapIntake(
    @Req() ctx: WorkspaceContext | undefined,
    @Body() body: GapIntakeCommand,
  ): Promise<unknown> {
    return this.room.gapIntake(requireAuth(ctx), strip<GapIntakeCommand>(body));
  }

  /** `T1184` — what intake made of a person's intent. */
  @Get('rooms/requirement/:id/candidates')
  candidates(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<unknown> {
    return this.room.candidates(requireAuth(ctx), id);
  }

  /**
   * `T1184` — `FR-RQR-030`.
   *
   * `POST` rather than `PATCH`, matching every other write on this controller.
   * The Room's history is its decisions and baselines, not a diff of a row.
   */
  @Post('rooms/requirement/:id/candidates/:candidateId/criteria')
  setCriteria(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Param('candidateId') candidateId: string,
    @Body() body: { acceptanceCriteria?: readonly string[] | null; intendedForImplementation?: boolean },
  ): Promise<unknown> {
    return this.room.setCriteria(requireAuth(ctx), id, candidateId, body ?? {});
  }

  /** `T1184` — the questions raised, answered or not. */
  @Get('rooms/requirement/:id/clarifications')
  listClarifications(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.room.listClarifications(requireAuth(ctx), id);
  }

  /** `T1184` — `FR-RQR-012`, `FR-RQR-013`. Answered in place; retained. */
  @Post('rooms/requirement/:id/clarifications/:clarificationId/answer')
  answerClarification(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Param('clarificationId') clarificationId: string,
    @Body() body: { answer?: string },
  ): Promise<unknown> {
    return this.room.answerClarification(requireAuth(ctx), id, clarificationId, body ?? {});
  }

  @Post('rooms/requirement/:id/clarifications')
  clarifications(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: ClarificationRequest,
  ): Promise<unknown> {
    return this.room.clarifications(requireAuth(ctx), id, strip<ClarificationRequest>(body));
  }

  /** Scope from the query — a GET has no body to carry it. */
  @Get('rooms/requirement/:id/analysis')
  analysis(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Query() query: AnalysisQuery,
  ): Promise<unknown> {
    return this.room.analysis(requireAuth(ctx), id, strip<AnalysisQuery>(query));
  }

  @Post('rooms/requirement/:id/options')
  options(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: OptionsRequest,
  ): Promise<unknown> {
    return this.room.options(requireAuth(ctx), id, strip<OptionsRequest>(body));
  }

  /**
   * `403` on a policy refusal, carrying the `EPIC-031` decision id and its
   * explanation so `UX-0033` can render the rule that refused (`FR-RQR-043`).
   * `DecisionRefusedError` is a `ForbiddenError`, so `toHttpStatus` produces
   * the status and `toErrorBody` carries the details — no mapping here.
   */
  @Post('rooms/requirement/:id/decide')
  decide(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: DecideRequest,
  ): Promise<unknown> {
    return this.room.decide(requireAuth(ctx), id, strip<DecideRequest>(body));
  }

  @Post('rooms/requirement/:id/baseline')
  baseline(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: ApproveBaselineInput,
  ): Promise<unknown> {
    return this.room.baseline(requireAuth(ctx), id, strip<ApproveBaselineInput>(body));
  }

  /** Addressed by VERSION — the thing `FR-RQR-061` requires be recorded. */
  @Post('baselines/:version/handoff')
  handoff(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('version') version: string,
    @Body() body: HandoffRequest,
  ): Promise<unknown> {
    return this.room.handoff(requireAuth(ctx), version, strip<HandoffRequest>(body));
  }

  @Get('rooms/requirement/:id/readiness')
  readiness(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Query() query: ReadinessQuery,
  ): Promise<unknown> {
    return this.room.readiness(requireAuth(ctx), id, strip<ReadinessQuery>(query));
  }
}
