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
import { UnauthenticatedError, ValidationFailedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { TriageService, type ReevaluateInput, type TriageInput } from './triage.service.js';
import { DefectTestService, type RecordTestInput } from './defect-test.service.js';
import {
  ReproductionService,
  type RecordReproductionInput,
} from './reproduction.service.js';
import { VerificationService, type CloseInput } from './verification.service.js';

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
  ) {}

  /**
   * `FR-DFR-020`–`FR-DFR-023` — judge a defect against approved behaviour.
   *
   * `classifiedByKind` is `human` because a session belongs to a person. An
   * agent reaches this Room through `EPIC-028`'s gateway, which carries its own
   * identity — and cannot arrive here claiming to be human, because the field
   * is not readable from the body at all.
   */
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
