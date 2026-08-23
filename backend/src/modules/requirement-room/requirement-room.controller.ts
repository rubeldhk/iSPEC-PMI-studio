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
import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import type { ApproveBaselineInput } from './baseline.service.js';
import type { GapIntakeCommand, IntakeCommand } from './intake.service.js';
import { RequirementRoomService } from './requirement-room.service.js';
import type {
  AnalysisQuery,
  ClarificationRequest,
  DecideRequest,
  OptionsRequest,
  ReadinessQuery,
} from './requirement-room.service.js';

@Controller()
export class RequirementRoomController {
  constructor(
    // @Inject by token: esbuild/tsx emits no `design:paramtypes` (DEF-001-005).
    @Inject(RequirementRoomService) private readonly room: RequirementRoomService,
  ) {}

  @Post('rooms/requirement/intake')
  intake(@Body() body: IntakeCommand): Promise<unknown> {
    return this.room.intake(body);
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
  gapIntake(@Body() body: GapIntakeCommand): Promise<unknown> {
    return this.room.gapIntake(body);
  }

  @Post('rooms/requirement/:id/clarifications')
  clarifications(@Param('id') id: string, @Body() body: ClarificationRequest): Promise<unknown> {
    return this.room.clarifications(id, body);
  }

  /** Scope from the query — a GET has no body to carry it. */
  @Get('rooms/requirement/:id/analysis')
  analysis(@Param('id') id: string, @Query() query: AnalysisQuery): Promise<unknown> {
    return this.room.analysis(id, query);
  }

  @Post('rooms/requirement/:id/options')
  options(@Param('id') id: string, @Body() body: OptionsRequest): Promise<unknown> {
    return this.room.options(id, body);
  }

  /**
   * `403` on a policy refusal, carrying the `EPIC-031` decision id and its
   * explanation so `UX-0033` can render the rule that refused (`FR-RQR-043`).
   * `DecisionRefusedError` is a `ForbiddenError`, so `toHttpStatus` produces
   * the status and `toErrorBody` carries the details — no mapping here.
   */
  @Post('rooms/requirement/:id/decide')
  decide(@Param('id') id: string, @Body() body: DecideRequest): Promise<unknown> {
    return this.room.decide(id, body);
  }

  @Post('rooms/requirement/:id/baseline')
  baseline(@Param('id') id: string, @Body() body: ApproveBaselineInput): Promise<unknown> {
    return this.room.baseline(id, body);
  }

  @Post('baselines/:version/handoff')
  handoff(@Param('version') version: string): Promise<unknown> {
    return this.room.handoff(version);
  }

  @Get('rooms/requirement/:id/readiness')
  readiness(@Param('id') id: string, @Query() query: ReadinessQuery): Promise<unknown> {
    return this.room.readiness(id, query);
  }
}
