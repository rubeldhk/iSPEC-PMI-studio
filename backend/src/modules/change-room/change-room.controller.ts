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
import {
  ChangeIntakeService,
  type DefectTransferInput,
  type RaiseChangeInput,
} from './intake.service.js';
import { ClosureService, type CloseChangeInput } from './closure.service.js';
import { DecisionService, type RecordDecisionInput } from './decision.service.js';
import { RebaselineService } from './rebase.service.js';
import { OptionsService } from './options.service.js';

/**
 * `R-034-1` — adopted from `EPIC-020`, **imported rather than restated**.
 *
 * `T995g` caught this as a local `const ADOPTED_IMPACT_DEPTH = 25`. It agreed
 * with `EPIC-020` on the day it was written, which is the only day a duplicated
 * constant ever agrees: the moment `EPIC-020` retunes its traversal, the Room
 * would go on recording a depth nothing traversed at, and the stored
 * `traversalDepth` would describe a run that never happened.
 *
 * Two traversals disagreeing about depth is worse than either being wrong,
 * because both look right.
 */
import { DEFAULT_IMPACT_DEPTH } from '../dependencies/impact.service.js';

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

/**
 * What a caller may supply for a decision and a closure.
 *
 * Everything the session decides is removed from the type, so a body carrying
 * `decidedBy` is not merely overwritten -- it does not typecheck as an input at
 * all. `strip` takes it away at runtime as well; the two say the same thing in
 * the two places a reader looks.
 */
type RecordDecisionRest = Omit<
  RecordDecisionInput,
  'workspaceId' | 'changeRequestId' | 'decidedBy' | 'decidedByKind' | 'now'
>;

type CloseChangeRest = Omit<
  CloseChangeInput,
  'workspaceId' | 'projectId' | 'changeRequestId' | 'closedBy' | 'now'
>;

@Controller()
export class ChangeRoomController {
  constructor(
    // @Inject by token: esbuild/tsx emits no `design:paramtypes` (DEF-001-005).
    @Inject(ChangeIntakeService) private readonly intake: ChangeIntakeService,
    @Inject(CHANGE_ROOM_STORE) private readonly store: ChangeRoomStore,
    @Inject(ImpactComposer) private readonly impact: ImpactComposer,
    @Inject(OptionsService) private readonly options: OptionsService,
    @Inject(DecisionService) private readonly decisions: DecisionService,
    @Inject(RebaselineService) private readonly rebases: RebaselineService,
    @Inject(ClosureService) private readonly closures: ClosureService,
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
      traversalDepth: DEFAULT_IMPACT_DEPTH,
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

  /**
   * `FR-CHR-050`-`FR-CHR-053` - record the decision.
   *
   * A policy refusal surfaces as **403 carrying the `EPIC-031` decision id**
   * (`ChangeDecisionRefusedError`). Not the opaque 404 this repository uses for
   * visibility: the caller can already see the change, and what is refused is
   * the authority to decide it. `UX-0033` requires the refusing policy to be
   * shown, and a refusal naming nothing leaves them guessing which of their
   * roles fell short.
   */
  @Post('rooms/change/requests/:id/decide')
  async decide(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const request = await this.store.findById(principal.workspaceId, id);
    if (!request) throw new NotFoundError('Not found.');

    const safe = strip(body) as Record<string, unknown>;
    return this.decisions.record({
      ...(safe as unknown as RecordDecisionRest),
      workspaceId: principal.workspaceId,
      changeRequestId: request.id,
      // From the session, never the body: `RULE-03` turns on who decided, and
      // `T1149`'s lesson is that a body which looks authoritative is believed.
      decidedBy: principal.userId,
      decidedByKind: 'human',
      now: new Date(),
    });
  }

  /**
   * `FR-CHR-013`, `FR-CHR-054` - move the change onto a newer baseline, as a
   * recorded act.
   */
  @Post('rooms/change/requests/:id/rebase')
  async rebase(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: { toBaselineId?: string; toBaselineVersion?: number },
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const request = await this.store.findById(principal.workspaceId, id);
    if (!request) throw new NotFoundError('Not found.');
    if (!body?.toBaselineId || !Number.isInteger(body.toBaselineVersion)) {
      throw new ValidationFailedError(
        'a rebase names the baseline it moves onto: toBaselineId and toBaselineVersion',
      );
    }
    return this.rebases.recordRebase({
      workspaceId: principal.workspaceId,
      changeRequestId: request.id,
      toBaselineId: body.toBaselineId,
      toBaselineVersion: body.toBaselineVersion as number,
    });
  }

  /**
   * `FR-CHR-060`, `FR-CHR-061` - apply the decided change to the baseline.
   *
   * Applying to a baseline the decision was not taken against surfaces as
   * **409 carrying the rebase affordance** (`RebaseRequiredError`). A refusal
   * that only said no would leave the caller with a change they cannot apply
   * and no route to applying it, which is how silent retargeting gets argued
   * back in - `BR-0042`'s reasoning, one Room over.
   */
  @Post('rooms/change/requests/:id/apply')
  async apply(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: { memberVersionIds?: string[]; rationale?: string; evidenceContractRef?: string },
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const request = await this.store.findById(principal.workspaceId, id);
    if (!request) throw new NotFoundError('Not found.');

    return this.rebases.rebaseline({
      workspaceId: principal.workspaceId,
      projectId: request.projectId,
      changeRequestId: request.id,
      // The version this change targets IS what it was decided against:
      // `recordRebase` is the only thing that moves it, and it records where it
      // came from when it does.
      decidedAgainstVersion: request.targetBaselineVersion,
      memberVersionIds: body?.memberVersionIds ?? [],
      approvedBy: principal.userId,
      rationale: body?.rationale ?? request.reason,
      evidenceContractRef: body?.evidenceContractRef ?? null,
      now: new Date(),
      // `EPIC-007`'s join is not resolvable from here (`FR-RQR-002`), so the
      // delta records additions and removals and pairs nothing. Stated rather
      // than guessed: a wrong pairing would invent a requirement history.
      requirementOf: (): string | null => null,
    });
  }

  /**
   * `FR-CHR-070`-`FR-CHR-073` - close the change.
   *
   * Refused while the Evidence Contract is unmet, naming the unmet items
   * (`FR-CHR-071`), and there is no field in which a declaration of completion
   * could stand in for them (`FR-CHR-072`, `BR-0144`).
   */
  @Post('rooms/change/requests/:id/close')
  async close(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const request = await this.store.findById(principal.workspaceId, id);
    if (!request) throw new NotFoundError('Not found.');

    const safe = strip(body) as Record<string, unknown>;
    return this.closures.close({
      ...(safe as unknown as CloseChangeRest),
      workspaceId: principal.workspaceId,
      projectId: request.projectId,
      changeRequestId: request.id,
      closedBy: principal.userId,
      now: new Date(),
    });
  }

  /**
   * `T994s` - the change request itself.
   *
   * Added with the page that needs it. A Room that cannot read the object it is
   * a Room for would be the seventh instance of built-and-reachable-from-nowhere
   * this repository has recorded, arriving from the other direction: a screen
   * with nothing to render.
   */
  @Get('rooms/change/requests/:id')
  async findOne(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const request = await this.store.findById(principal.workspaceId, id);
    if (!request) throw new NotFoundError('Not found.');
    return request;
  }

  /** `FR-CHR-043` - the decision, or 404 while none has been taken. */
  @Get('rooms/change/requests/:id/decision')
  async decisionFor(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const request = await this.store.findById(principal.workspaceId, id);
    if (!request) throw new NotFoundError('Not found.');

    const decided = await this.decisions.decidedFor(principal.workspaceId, request.id);
    // 404 rather than an empty object: a decision-shaped blank would render as
    // a decision with no decider, which is worse than an absence.
    if (!decided) throw new NotFoundError('No decision has been recorded for this change yet.');
    return decided;
  }

  /** `FR-CHR-070`-`FR-CHR-073` - the closure, or 404 while the change is open. */
  @Get('rooms/change/requests/:id/closure')
  async closureFor(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const request = await this.store.findById(principal.workspaceId, id);
    if (!request) throw new NotFoundError('Not found.');

    const closure = await this.closures.closureFor(principal.workspaceId, request.id);
    if (!closure) throw new NotFoundError('This change is not closed.');
    return closure;
  }

  /**
   * `FR-CHR-012`, `BR-0057`, `R-034-6` - intake from the Defect Room.
   *
   * A refusal answers with `TransferRefusedError`, whose body carries the
   * defect and `returnTo: 'EPIC-035'`. That is the return path: without it a
   * refused transfer leaves the defect saying "transferred" with nothing at the
   * other end, so the Defect Room believes it is somebody else's problem and
   * nobody else has it.
   *
   * The requester comes from the session like every other write here. A
   * transfer arrives through an integration, and an integration naming its own
   * actor is `DEF-033-001` with a different label on it.
   */
  @Post('rooms/change/transfer-intake')
  async transferIntake(
    @Req() ctx: WorkspaceContext | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const safe = strip(body) as Record<string, unknown>;
    return this.intake.fromDefectTransfer({
      ...(safe as unknown as Omit<DefectTransferInput, 'workspaceId' | 'requester'>),
      workspaceId: principal.workspaceId,
      requester: principal.userId,
    });
  }
}
