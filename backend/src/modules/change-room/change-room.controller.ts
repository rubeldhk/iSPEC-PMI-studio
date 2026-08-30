/**
 * `T996i` (EPIC-034) — where `RULE-02`'s refusal actually leads.
 *
 * The Requirement Room refuses an in-place edit of a baselined requirement and
 * hands back an affordance naming `POST /rooms/change/requests` (`BR-0042`,
 * `FR-RQR-051`). Until this file existed that route was a string in an error
 * body pointing at nothing — a refusal with nowhere to go, which is how
 * in-place editing gets argued back in.
 *
 * PC-1: a transport. Every capability lives in `ChangeIntakeService` and is
 * callable without HTTP.
 *
 * The `GET` is here rather than deferred because `SC-CHR-001` requires the
 * change to be *visible* as traceable change control. `openAgainst` is what
 * makes it visible, and a capability built and reachable from nowhere is the
 * defect this repository has now recorded six times (`DEF-005-001`, `T1178`).
 */
import { Body, Controller, Get, Inject, Post, Query, Req } from '@nestjs/common';
import { UnauthenticatedError, ValidationFailedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { ChangeIntakeService, type RaiseChangeInput } from './intake.service.js';

interface ActingPrincipal {
  readonly workspaceId: string;
  readonly userId: string;
}

/**
 * A product endpoint with no session is 401 — the same local helper the other
 * product controllers carry. Distinct from the opaque 404 that hides
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
 * Both are overwritten from the resolved session below, so stripping them here
 * changes no outcome — it is the same rule stated at the boundary where a
 * reader looks first. `DEF-033-001` began as a body that looked authoritative
 * because nothing visibly took it away.
 */
function strip(body: unknown): Record<string, unknown> {
  const { workspaceId: _ws, requester: _requester, ...safe } = (body ?? {}) as Record<
    string,
    unknown
  >;
  return safe;
}

@Controller()
export class ChangeRoomController {
  constructor(
    // @Inject by token: esbuild/tsx emits no `design:paramtypes` (DEF-001-005).
    @Inject(ChangeIntakeService) private readonly intake: ChangeIntakeService,
  ) {}

  /**
   * `FR-CHR-010`, `FR-CHR-020` — raise a change against a baseline.
   *
   * The route `InPlaceEditRefusedError` advertises, verbatim.
   */
  @Post('rooms/change/requests')
  raise(
    @Req() ctx: WorkspaceContext | undefined,
    @Body() body: unknown,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    return this.intake.raise({
      ...(strip(body) as Omit<RaiseChangeInput, 'workspaceId' | 'requester'>),
      workspaceId: principal.workspaceId,
      requester: principal.userId,
    });
  }

  /**
   * `FR-CHR-011`, `SC-CHR-001` — what is in flight against a baseline.
   *
   * The baseline is required rather than optional. A listing of every change in
   * the workspace would answer a question nobody asked and quietly become the
   * thing callers page through instead of the gate.
   */
  @Get('rooms/change/requests')
  openAgainst(
    @Req() ctx: WorkspaceContext | undefined,
    @Query('baselineId') baselineId: string | undefined,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    if (!baselineId) {
      throw new ValidationFailedError('baselineId is required (FR-CHR-011)');
    }
    return this.intake.openAgainst(principal.workspaceId, baselineId);
  }
}
