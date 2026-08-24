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
import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ConflictError, ForbiddenError } from '../../core/errors.js';
import { LoopService, type DeclareObjectInput, type TransitionInput } from './loop.service.js';

/** The transition body, without the id the route already carries. */
export interface TransitionBody {
  readonly toStage: TransitionInput['toStage'];
  readonly expectedVersion: number;
  readonly actor: TransitionInput['actor'];
  readonly actorAuthorities?: readonly string[];
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
  declareObject(@Body() body: DeclareObjectInput): Promise<unknown> {
    return this.loop.declareObject(body);
  }

  @Post('objects/:id/transitions')
  async transition(@Param('id') id: string, @Body() body: TransitionBody): Promise<unknown> {
    const result = await this.loop.transition({ ...body, objectId: id });

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
  history(@Param('id') id: string): Promise<unknown> {
    return this.loop.history(id);
  }

  @Get('objects/:id/progress')
  progress(@Param('id') id: string): Promise<unknown> {
    return this.loop.progressOf(id);
  }

  @Get('objects/:id/exceptions')
  exceptions(@Param('id') id: string): Promise<unknown> {
    return this.loop.exceptions(id);
  }
}
