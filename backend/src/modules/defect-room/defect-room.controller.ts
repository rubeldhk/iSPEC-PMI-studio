/**
 * `T998f` (EPIC-035) — where triage is actually reachable.
 *
 * PC-1: a transport. Every capability lives in `TriageService` and is callable
 * without HTTP; this file adds no rule of its own beyond taking identity from
 * the session rather than the body.
 *
 * It exists in the same commit as the service because *built, tested, and
 * reachable from nowhere* is the defect this repository has recorded seven
 * times — `DEF-005-001`, `T1178`, and four more found together at `EPIC-034`'s
 * convergence pass, every one with a passing unit test. The question that finds
 * them is **which capabilities have a caller**.
 */
import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { NotFoundError, UnauthenticatedError, ValidationFailedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { DEFECT_ROOM_STORE } from './defect-room.tokens.js';
import type { DefectRoomStore } from './defect-room.store.js';
import { TriageService, type ReevaluateInput, type TriageInput } from './triage.service.js';
import { DefectIntakeService, type IntakeInput } from './intake.service.js';
import {
  DefectAnalyticsService,
  DefectBlockersService,
  ESCAPE_POINTS,
  type EscapePoint,
} from './analytics.service.js';
import { DefectTestService, type RecordTestInput } from './defect-test.service.js';
import {
  ReproductionService,
  type RecordReproductionInput,
} from './reproduction.service.js';
import { VerificationService, type CloseInput } from './verification.service.js';
import {
  EvidenceCheckService,
  type ChoosePathInput,
  type RaiseCheckInput,
} from './evidence-check.service.js';
import {
  DefectRoutingService,
  type DeclineTransferInput,
  type DeliverTransferInput,
  type OfferTransferInput,
  type RecordReturnInput,
  type RouteGapInput,
} from './routing.service.js';

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
 * Identity fields a body may not smuggle in (`T1149`, `DEF-033-001`).
 *
 * All four are overwritten from the resolved session below, so stripping them
 * changes no outcome — it is the same rule stated at the boundary where a
 * reader looks first. `classifiedByKind` is here for a sharper reason than the
 * others: it is what `FR-DFR-023` checks, and a caller that could set it to
 * `human` would confirm defects as an agent through the front door.
 */
function strip(body: unknown): Record<string, unknown> {
  const {
    workspaceId: _ws,
    defectId: _defect,
    classifiedBy: _by,
    classifiedByKind: _kind,
    ...safe
  } = (body ?? {}) as Record<string, unknown>;
  return safe;
}

/**
 * What a caller may supply.
 *
 * Everything the session decides is removed from the type, so a body carrying
 * `classifiedBy` is not merely overwritten — it does not typecheck as an input
 * at all. `strip` takes it away at runtime as well; the two say the same thing
 * in the two places a reader looks.
 */
type TriageRest = Omit<
  TriageInput,
  'workspaceId' | 'defectId' | 'classifiedBy' | 'classifiedByKind'
>;

type ReevaluateRest = Omit<
  ReevaluateInput,
  'workspaceId' | 'defectId' | 'classifiedBy' | 'classifiedByKind'
>;

@Controller()
export class DefectRoomController {
  constructor(
    // @Inject by token: esbuild/tsx emits no `design:paramtypes` (DEF-001-005).
    @Inject(TriageService) private readonly triage: TriageService,
    @Inject(DefectTestService) private readonly tests: DefectTestService,
    @Inject(ReproductionService) private readonly reproductions: ReproductionService,
    @Inject(VerificationService) private readonly verification: VerificationService,
    @Inject(DefectRoutingService) private readonly routing: DefectRoutingService,
    @Inject(EvidenceCheckService) private readonly evidenceChecks: EvidenceCheckService,
    @Inject(DefectIntakeService) private readonly intake: DefectIntakeService,
    @Inject(DefectAnalyticsService) private readonly analytics: DefectAnalyticsService,
    @Inject(DefectBlockersService) private readonly blockers: DefectBlockersService,
    @Inject(DEFECT_ROOM_STORE) private readonly store: DefectRoomStore,
  ) {}

  /**
   * `FR-DFR-020`–`FR-DFR-023` — judge a defect against approved behaviour.
   *
   * `classifiedByKind` is `human` because a session belongs to a person. An
   * agent reaches this Room through `EPIC-028`'s gateway, which carries its own
   * identity — and cannot arrive here claiming to be human, because the field
   * is not readable from the body at all.
   */
  /**
   * `FR-DFR-010`-`FR-DFR-013` — the front door.
   *
   * `POST /rooms/defect/reports` and not `/rooms/defect`, because a report is
   * what arrives: six origins send one, and five of them are not a person
   * deciding a defect exists. What gets created is decided here, from the
   * report.
   *
   * Declared **above** `:id` routes: `reports` would otherwise be read as an
   * id by any route matcher that takes the first match.
   */
  @Post('rooms/defect/reports')
  report(@Req() ctx: WorkspaceContext | undefined, @Body() body: unknown): Promise<unknown> {
    const principal = requireAuth(ctx);
    return this.intake.report({
      ...(strip(body) as Omit<IntakeInput, 'workspaceId' | 'reportedBy'>),
      workspaceId: principal.workspaceId,
      // The session says who filed it. A body-supplied reporter would let one
      // person file in another's name, and `FR-DFR-013` is about knowing where
      // a defect came from.
      reportedBy: principal.userId,
    });
  }

  /**
   * `SC-DFR-006` — what is held for triage, in one request.
   *
   * The measure's word is *visibly*. A held defect findable only by opening
   * every record is indistinguishable from one nobody held, and this is the
   * route that makes the difference real rather than asserted.
   */
  /**
   * `FR-DFR-081`, `FR-DFR-083`, `SC-DFR-008` — where defects come from, and
   * where they got through.
   *
   * Declared above the `:id` routes, like `held` and `exceptions`: `analytics`
   * would otherwise be read as a defect id.
   *
   * The completeness note travels with the response and is not the caller's to
   * assemble. A renderer that had to remember it is a renderer that will not,
   * and the chart it draws would be correct in every number and wrong in the
   * only conclusion anybody takes from it.
   */
  @Get('rooms/defect/analytics')
  analyticsFor(@Req() ctx: WorkspaceContext | undefined): Promise<unknown> {
    const principal = requireAuth(ctx);
    return this.analytics.distribution(principal.workspaceId);
  }

  /**
   * `FR-DFR-080`, `FR-DFR-082` — the escape point, once somebody has determined
   * it.
   *
   * Without this route the column is written null at intake and never again,
   * every distribution reports one bucket, and `SC-DFR-008` measures a question
   * nothing can answer. `recordEscapePoint` refuses a defect with no captured
   * row rather than creating one, so a missing capture stays visible.
   */
  @Post('rooms/defect/:id/escape-point')
  recordEscapePoint(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const { escapePoint } = strip(body) as { escapePoint?: string };
    if (!(ESCAPE_POINTS as readonly string[]).includes(escapePoint ?? '')) {
      throw new ValidationFailedError(
        `escapePoint must be one of: ${ESCAPE_POINTS.join(', ')} (FR-DFR-080)`,
      );
    }
    return this.analytics.recordEscapePoint(
      principal.workspaceId,
      id,
      escapePoint as EscapePoint,
      principal.userId,
    );
  }

  /**
   * `FR-DFR-093`, `UX-0032` — what is blocking, without opening another screen.
   *
   * A `GET`, and it writes nothing: asking what is blocking a defect should not
   * change the defect.
   */
  @Get('rooms/defect/:id/blockers')
  blockersFor(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    return this.blockers.blockersFor(principal.workspaceId, id);
  }

  @Get('rooms/defect/held')
  held(@Req() ctx: WorkspaceContext | undefined): Promise<unknown> {
    const principal = requireAuth(ctx);
    return this.intake.heldForTriage(principal.workspaceId);
  }

  /**
   * `FR-DFR-012` — the way out of the hold.
   *
   * Without it, held-for-triage is a grave rather than a queue: every
   * unlinkable defect stays uncounted forever, and `SC-DFR-006` reads 100%
   * because nothing was ever linked rather than because everything was.
   */
  @Post('rooms/defect/:id/link-epic')
  linkEpic(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const { epicId } = strip(body) as { epicId?: string };
    return this.intake.linkToEpic(principal.workspaceId, id, epicId ?? '', principal.userId);
  }

  @Post('rooms/defect/:id/triage')
  classify(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    return this.triage.triage({
      ...(strip(body) as TriageRest),
      workspaceId: principal.workspaceId,
      defectId: id,
      classifiedBy: principal.userId,
      classifiedByKind: 'human',
    });
  }

  /**
   * `FR-DFR-024`, `FR-DFR-025` — judge it again, against a version that moved.
   *
   * A separate route rather than a flag on the one above, because they are
   * different acts: the first records a judgement, the second records that an
   * earlier judgement no longer stands. Folding them together would let a
   * re-evaluation arrive by accident — and a re-evaluation nobody meant to make
   * is the silent re-target `FR-DFR-024` refuses, wearing a different hat.
   */
  @Post('rooms/defect/:id/reevaluate')
  reevaluate(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    return this.triage.reevaluateAgainstCurrent({
      ...(strip(body) as ReevaluateRest),
      workspaceId: principal.workspaceId,
      defectId: id,
      classifiedBy: principal.userId,
      classifiedByKind: 'human',
    });
  }

  /**
   * `FR-DFR-040`, `FR-DFR-042` — the route every refusal points at.
   *
   * `acceptFix` names it verbatim. Until this handler existed it was a string
   * in an error body pointing at nothing, which is how the rule it enforces
   * gets argued back in.
   */
  @Post('rooms/defect/:id/test')
  recordTest(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const rest = strip(body) as Omit<
      RecordTestInput,
      'workspaceId' | 'defectId' | 'recordedBy' | 'firstObservedFailingAt'
    > & { firstObservedFailingAt?: unknown };

    return this.tests.recordTest({
      ...rest,
      // `FR-DFR-040`: absent means absent. Defaulting to "now" would mint the
      // very observation the requirement asks somebody to have made.
      firstObservedFailingAt: requireInstant(
        rest.firstObservedFailingAt,
        'firstObservedFailingAt is required — it is the instant the test was seen to fail, and ' +
          'the field the whole requirement rests on (FR-DFR-040)',
      ),
      workspaceId: principal.workspaceId,
      defectId: id,
      recordedBy: principal.userId,
    });
  }

  /**
   * `FR-DFR-030` to `FR-DFR-033`, `FR-DFR-043` — capture a reproduction.
   *
   * The evidence in the body is **forwarded** to `EPIC-032` and never stored
   * here. With that store unbound the request refuses, which is the honest
   * answer: this is the one route where a user is encouraged to paste a payload
   * that reproduces a failure (`PP-008`), and a Room-local copy would be filed
   * under "who can see defects" rather than under the artifact's own rules.
   */
  @Post('rooms/defect/:id/reproduction')
  recordReproduction(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const rest = strip(body) as Omit<
      RecordReproductionInput,
      'workspaceId' | 'defectId' | 'recordedBy' | 'observedAt'
    > & { observedAt?: unknown };

    return this.reproductions.record({
      ...rest,
      evidence: rest.evidence ?? [],
      // Unlike the instant above, "when it was observed" defaults to now: the
      // caller is reporting something they are watching, and `FR-DFR-030` asks
      // for the observation rather than for a moment somebody attests to.
      observedAt: rest.observedAt === undefined ? new Date() : requireInstant(
        rest.observedAt,
        'observedAt must be a date (FR-DFR-030)',
      ),
      workspaceId: principal.workspaceId,
      defectId: id,
      recordedBy: principal.userId,
    });
  }

  /** `FR-DFR-043` — the exception, countable rather than merely stated. */
  @Get('rooms/defect/exceptions')
  exceptions(@Req() ctx: WorkspaceContext | undefined): Promise<unknown> {
    const principal = requireAuth(ctx);
    return this.reproductions.exceptions(principal.workspaceId);
  }

  /**
   * `FR-DFR-060`, `FR-DFR-062` — request the applicable runs.
   *
   * Separate from closure because a run that happened should be recorded even
   * when its outcome refuses closure.
   */
  @Post('rooms/defect/:id/verify')
  verify(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    return this.verification.verify(this.closeInput(principal, id, body));
  }

  /** `FR-DFR-060`, `FR-DFR-063`, `FR-DFR-064` — close, or refuse and say why. */
  @Post('rooms/defect/:id/close')
  close(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    return this.verification.close(this.closeInput(principal, id, body));
  }

  /**
   * `FR-DFR-070`, `FR-DFR-072` — offer the transfer, and say why.
   *
   * The offer and the delivery are separate routes because they are separate
   * acts: this one asks a person, and `…/transfer/accept` acts on their answer.
   * Folding them together would make the transfer something the system did.
   */
  @Post('rooms/defect/:id/transfer')
  offerTransfer(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const rest = strip(body) as Omit<
      OfferTransferInput,
      'workspaceId' | 'defectId' | 'offeredBy'
    >;
    return this.routing.offerTransfer({
      ...rest,
      offeredReason: rest.offeredReason ?? '',
      workspaceId: principal.workspaceId,
      defectId: id,
      offeredBy: principal.userId,
    });
  }

  /** `FR-DFR-071` — the answer is yes: hand it to `EPIC-034`. */
  @Post('rooms/defect/:id/transfer/accept')
  acceptTransfer(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const rest = strip(body) as Omit<
      DeliverTransferInput,
      'workspaceId' | 'defectId' | 'requester'
    >;
    return this.routing.deliverTransfer({
      ...rest,
      targetBaselineId: rest.targetBaselineId ?? '',
      workspaceId: principal.workspaceId,
      defectId: id,
      requester: principal.userId,
    });
  }

  /** `FR-DFR-073` — the answer is no, and both halves are kept. */
  @Post('rooms/defect/:id/transfer/decline')
  declineTransfer(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const rest = strip(body) as Omit<
      DeclineTransferInput,
      'workspaceId' | 'defectId' | 'declinedBy'
    >;
    return this.routing.declineTransfer({
      ...rest,
      routingId: rest.routingId ?? '',
      declinedReason: rest.declinedReason ?? '',
      workspaceId: principal.workspaceId,
      defectId: id,
      declinedBy: principal.userId,
    });
  }

  /**
   * `FR-DFR-074` — a refusal raised elsewhere, brought back here.
   *
   * `EPIC-034`'s `TransferRefusedError` carries `returnTo: 'EPIC-035'` and the
   * defect id. This is the address that names.
   */
  @Post('rooms/defect/:id/transfer-return')
  returnTransfer(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const rest = strip(body) as Omit<
      RecordReturnInput,
      'workspaceId' | 'defectId' | 'returnedBy'
    >;
    return this.routing.recordReturn({
      ...rest,
      routingId: rest.routingId ?? '',
      refusalDetail: rest.refusalDetail ?? '',
      workspaceId: principal.workspaceId,
      defectId: id,
      returnedBy: principal.userId,
    });
  }

  /**
   * `FR-DFR-076` — a Requirement Gap, to `EPIC-033`, as new intent.
   *
   * No offer step: a transfer asks whether the item should leave, because
   * declining is a real answer. A gap has nowhere else to go — there is no
   * approved baseline to change, and that absence is what makes it a gap.
   */
  @Post('rooms/defect/:id/route-gap')
  routeGap(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const rest = strip(body) as Omit<RouteGapInput, 'workspaceId' | 'defectId' | 'routedBy'>;
    return this.routing.routeGap({
      ...rest,
      text: rest.text ?? '',
      workspaceId: principal.workspaceId,
      defectId: id,
      routedBy: principal.userId,
    });
  }

  /**
   * `FR-DFR-044` — a passing reproduction run raises the check.
   *
   * A route rather than an internal call, because the run is reported from
   * outside: `TestExecution` has no owner in the programme (`R-035-1`), and a
   * check that could only be raised by a runner nobody has built would make
   * `ADR-0016`'s failure mode unreachable in the one direction that matters.
   *
   * It answers with the three paths and records **no** choice.
   */
  @Post('rooms/defect/:id/evidence-check/raise')
  raiseEvidenceCheck(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const rest = strip(body) as Omit<RaiseCheckInput, 'workspaceId' | 'defectId'>;
    return this.evidenceChecks.raise({
      ...rest,
      // Absent is not `pass`. Defaulting would raise a check for a run nobody
      // reported the outcome of, which is the automatic path with extra steps.
      outcome: rest.outcome ?? ('fail' as const),
      evidenceRef: rest.evidenceRef ?? null,
      workspaceId: principal.workspaceId,
      defectId: id,
    });
  }

  /**
   * `FR-DFR-044`, `FR-DFR-031` — a person takes one of the three paths.
   *
   * `chosenBy` comes from the session, never the body: a path with no chooser
   * is an automatic reclassification wearing a person's clothes, and one whose
   * chooser the caller supplied is the same thing with a name attached.
   */
  @Post('rooms/defect/:id/evidence-check')
  chooseEvidencePath(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const rest = strip(body) as Omit<ChoosePathInput, 'workspaceId' | 'defectId' | 'chosenBy'>;
    return this.evidenceChecks.choose({
      ...rest,
      path: rest.path ?? '',
      reason: rest.reason ?? '',
      workspaceId: principal.workspaceId,
      defectId: id,
      chosenBy: principal.userId,
    });
  }

  /**
   * `FR-DFR-090` — what the Room's object-state and timeline regions read.
   *
   * Declared **after** `GET /rooms/defect/exceptions`, which is a literal path
   * and would otherwise be swallowed by `:id`. Nest matches in declaration
   * order, so the order here is load-bearing rather than stylistic.
   */
  @Get('rooms/defect/:id')
  async readDefect(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const defect = await this.store.findDefect(principal.workspaceId, id);
    // Absent rather than forbidden — a caller learns nothing about a defect it
    // may not see.
    if (!defect) throw new NotFoundError('Not found.');
    return defect;
  }

  /**
   * `FR-DFR-022`, `FR-DFR-077` — the decision region.
   *
   * `null` rather than a 404 when nothing has been classified: "this defect
   * does not exist" and "nobody has judged it yet" are different answers, and
   * the Room shows the second as a state rather than as an error.
   */
  @Get('rooms/defect/:id/classification')
  async readClassification(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const defect = await this.store.findDefect(principal.workspaceId, id);
    if (!defect) throw new NotFoundError('Not found.');
    return this.store.currentClassification(principal.workspaceId, id);
  }

  /**
   * `FR-DFR-030` to `FR-DFR-044` — the evidence region, in one read.
   *
   * Three lists rather than three endpoints, because they answer one question:
   * *what has been established about this defect?* Split across three round
   * trips, a person would see them settle one at a time and read the gaps as
   * absences.
   *
   * References only. No attestation content passes through here — that is
   * `EPIC-032`'s, under the access rules of the artifact it concerns.
   */
  @Get('rooms/defect/:id/evidence')
  async readEvidence(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const defect = await this.store.findDefect(principal.workspaceId, id);
    if (!defect) throw new NotFoundError('Not found.');

    const [tests, reproductions, evidenceChecks] = await Promise.all([
      this.store.testsFor(principal.workspaceId, id),
      this.store.reproductionsFor(principal.workspaceId, id),
      this.store.evidenceChecksFor(principal.workspaceId, id),
    ]);
    return { tests, reproductions, evidenceChecks };
  }

  private closeInput(principal: ActingPrincipal, id: string, body: unknown): CloseInput {
    const rest = strip(body) as Omit<CloseInput, 'workspaceId' | 'defectId' | 'closedBy'>;
    return {
      ...rest,
      // Absent is not empty. An empty set is refused by the service anyway
      // (`FR-DFR-060`), and defaulting here would turn "the caller said
      // nothing" into "the fix touched nothing".
      touchedArtifacts: rest.touchedArtifacts ?? [],
      workspaceId: principal.workspaceId,
      defectId: id,
      closedBy: principal.userId,
    };
  }
}

/**
 * A body carries strings; these fields are instants.
 *
 * Refusing rather than coercing: `new Date(undefined)` is `Invalid Date`, which
 * compares false against every bound and would sail past a `>` check.
 */
function requireInstant(value: unknown, message: string): Date {
  const parsed = typeof value === 'string' || value instanceof Date ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) throw new ValidationFailedError(message);
  return parsed;
}
