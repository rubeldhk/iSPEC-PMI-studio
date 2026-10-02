/**
 * T935, T945, T953, T959 — the loop's five real entry points, per
 * `contracts/loop-contract.md` §4.
 *
 * PC-1: a transport. Every capability lives in `LoopService` and is callable
 * without HTTP.
 *
 * **The status codes carry meaning the body would otherwise have to explain**,
 * and the contract fixes them: `403` for missing authority, `409` for a lost
 * optimistic race — *both with the recorded transition id, so the caller can
 * read the refusal rather than infer it*. Mapping them onto one status would
 * make *"you may not"* and *"you were second"* the same event to every client.
 */
import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { ConflictError, ForbiddenError, UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import {
  LoopService,
  type DeclareObjectInput,
  type LoopPrincipal,
  type TransitionInput,
} from './loop.service.js';

/**
 * A product endpoint with no session is 401 — the same local helper the other
 * product controllers carry.
 */
function requireAuth(ctx: WorkspaceContext | undefined | null): LoopPrincipal {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return { workspaceId: ctx.workspaceId, userId: ctx.userId };
}

/**
 * Identity and authority a body may not smuggle in (`T1157`).
 *
 * The service overwrites each from the resolved session, so this changes no
 * outcome. It is a second statement of the rule at the boundary a reader looks
 * at first — and `actorAuthorities` in particular deserves to be visibly taken
 * away, because it was accepted here for long enough to be in `DEF-030-003`.
 */
function strip<T>(body: unknown): T {
  const {
    workspaceId: _ws,
    actorId: _actorId,
    actor: _actor,
    actorAuthorities: _authorities,
    ...safe
  } = (body ?? {}) as Record<string, unknown>;
  return safe as T;
}

/**
 * The transition body, without the id the route already carries.
 *
 * `actor` and `actorAuthorities` are **gone** (`DEF-030-003`). They were the
 * whole defect: the caller declared who it was and what it was allowed to do,
 * and `evaluateAuthority` decided on the second. Both are resolved now.
 */
export interface TransitionBody {
  readonly toStage: TransitionInput['toStage'];
  readonly expectedVersion: number;
  readonly trigger?: { readonly ruleId: string; readonly eventId: string };
}

@Controller('loop')
export class LoopController {
  constructor(
    // @Inject by token: esbuild/tsx emits no `design:paramtypes`, so a
    // class-typed parameter resolves to undefined at runtime (DEF-001-005).
    @Inject(LoopService) private readonly loop: LoopService,
  ) {}

  @Post('objects')
  declareObject(
    @Req() ctx: WorkspaceContext | undefined,
    @Body() body: DeclareObjectInput,
  ): Promise<unknown> {
    return this.loop.declareObject(requireAuth(ctx), strip<DeclareObjectInput>(body));
  }

  @Post('objects/:id/transitions')
  async transition(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: TransitionBody,
  ): Promise<unknown> {
    const result = await this.loop.transition(requireAuth(ctx), {
      ...strip<TransitionBody>(body),
      objectId: id,
    });

    // A governed refusal is a RESULT from the service (FR-GEL-014) and a status
    // at the transport. Translating here rather than in the service keeps the
    // refusal readable by an MCP caller that has no status codes at all.
    if (result.outcome === 'conflict') {
      throw new ConflictError(result.detail ?? 'the object moved', {
        transitionId: result.transitionId,
        version: result.version,
      });
    }
    if (result.outcome === 'refused' || result.outcome === 'violation') {
      throw new ForbiddenError(result.detail ?? 'refused', { transitionId: result.transitionId });
    }
    // `accepted` and `exception` both moved through the loop's rules and both
    // are returned: an exception is an AUTHORISED departure, and turning it into
    // an error would hide the one outcome BR-0060 most wants visible.
    return result;
  }

  @Get('objects/:id/history')
  history(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<unknown> {
    return this.loop.history(requireAuth(ctx), id);
  }

  @Get('objects/:id/progress')
  progress(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<unknown> {
    return this.loop.progressOf(requireAuth(ctx), id);
  }

  @Get('objects/:id/exceptions')
  exceptions(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<unknown> {
    return this.loop.exceptions(requireAuth(ctx), id);
  }
}
