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
import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, Inject, Param, Post, Query, Req } from '@nestjs/common';
import { NotFoundError, UnauthenticatedError, ValidationFailedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { CHANGE_ROOM_STORE } from './change-room.tokens.js';
import type { ChangeRoomStore } from './change-room.store.js';
import { ImpactComposer } from './impact.composer.js';
import { ChangeIntakeService, type RaiseChangeInput } from './intake.service.js';
import { DecisionService } from './decision.service.js';
import { OptionsService } from './options.service.js';

/**
 * `DEFAULT_IMPACT_DEPTH`, adopted from `EPIC-020` (`R-034-1`).
 *
 * Named here so the number enters the Room at exactly one point. This module
 * never chooses it: two traversals that disagree about depth is worse than
 * either being wrong.
 */
const ADOPTED_IMPACT_DEPTH = 25;

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
    @Inject(CHANGE_ROOM_STORE) private readonly store: ChangeRoomStore,
    @Inject(ImpactComposer) private readonly impact: ImpactComposer,
    @Inject(OptionsService) private readonly options: OptionsService,
    @Inject(DecisionService) private readonly decisions: DecisionService,
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

  /**
   * `FR-CHR-030`, `FR-CHR-035` — compute a view and retain it.
   *
   * **A POST, and deliberately not folded into the `GET` below.** Composing a
   * view writes an append-only snapshot; a `GET` that quietly wrote one would
   * make two people opening the same screen produce two records of what was
   * known, and would put a write behind the one verb a reader assumes is safe.
   */
  @Post('rooms/change/requests/:id/impact')
  async computeImpact(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const request = await this.store.findById(principal.workspaceId, id);
    // Absent rather than forbidden — the caller learns nothing about a change
    // it may not see.
    if (!request) throw new NotFoundError('Not found.');

    const view = await this.impact.compose({
      workspaceId: principal.workspaceId,
      changeRequestId: request.id,
      // The change is against a baseline, so the baseline is what the blast
      // radius is traced from (`FR-CHR-010`).
      changedArtifactId: request.targetBaselineId,
      traversalDepth: ADOPTED_IMPACT_DEPTH,
      now: new Date(),
      id: randomUUID(),
    });
    return this.store.saveImpactView(view);
  }

  /**
   * `FR-CHR-030` — the blast radius, before the decision.
   *
   * Returns the most recent snapshot. Earlier ones are retained and reachable
   * by id (`FR-CHR-035`); this route answers *what does it look like now*, and
   * a decision reads the one it was taken against.
   */
  @Get('rooms/change/requests/:id/impact')
  async impactFor(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const request = await this.store.findById(principal.workspaceId, id);
    if (!request) throw new NotFoundError('Not found.');

    const view = await this.store.latestImpactViewFor(principal.workspaceId, request.id);
    if (!view) {
      // Not an empty view. Eight areas with nothing in them would report a
      // clean blast radius nobody computed — the exact confusion `FR-CHR-032`
      // exists to prevent, arriving one level up.
      throw new NotFoundError('No impact view has been computed for this change request yet.');
    }
    return view;
  }

  /**
   * `FR-CHR-040`–`FR-CHR-042` — two or more ways to satisfy this change.
   *
   * A POST because it invokes a provider, which costs time and money and is not
   * something a page refresh should do.
   *
   * **The degraded response is a 200, not an error.** `EPIC-028`'s gateway
   * degrades rather than refusing, and a 502 here would tell a caller the
   * request failed when what actually happened is that no options were
   * produced — a fact they can act on, provided they are told. The body says
   * `available: false` with a reason, and `options` is `null` rather than a
   * pair somebody invented to fill the field.
   */
  @Post('rooms/change/requests/:id/options')
  async generateOptions(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const request = await this.store.findById(principal.workspaceId, id);
    if (!request) throw new NotFoundError('Not found.');

    return this.options.generate({
      workspaceId: principal.workspaceId,
      changeRequestId: request.id,
      correlationId: randomUUID(),
    });
  }

  /**
   * `FR-CHR-063` — the approved baseline delta, readable as a delta.
   *
   * Three lines a reader can take in, rather than two full member lists to
   * compare by eye. Read from storage rather than recomputed: by the time
   * anyone asks, both baselines it spans may be superseded, and a delta derived
   * from whatever is current would describe a move that never happened
   * (`R-034-4`).
   */
  @Get('rooms/change/requests/:id/delta')
  async deltaFor(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const request = await this.store.findById(principal.workspaceId, id);
    if (!request) throw new NotFoundError('Not found.');

    const decided = await this.decisions.decidedFor(principal.workspaceId, request.id);
    if (!decided) {
      // Not an empty delta. `{added: [], removed: []}` would report that the
      // change altered nothing, which is a claim about a decision nobody has
      // taken.
      throw new NotFoundError('No decision has been recorded for this change request yet.');
    }
    const delta = await this.store.findDeltaForDecision(principal.workspaceId, decided.id);
    if (!delta) {
      throw new NotFoundError('This change has been decided but not yet re-baselined.');
    }
    return delta;
  }
}
