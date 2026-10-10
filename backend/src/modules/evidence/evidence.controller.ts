/**
 * `T857g`, `T858g`, `T860d`, `T860g`, `T861e` — the evidence store's real entry
 * points (`contracts/evidence-contract.md` §5).
 *
 * PC-1: a transport. Every capability lives in `EvidenceService` and is
 * callable without HTTP.
 *
 * | Route | Requirement |
 * |---|---|
 * | `POST /evidence` | contribute a typed attestation — `FR-EVS-001`, `FR-EVS-040` |
 * | `POST /evidence/bindings` | attach a Contract at work creation — `FR-EVS-021` |
 * | `GET /evidence/:workRef/status` | the Room Evidence region projection — `FR-EVS-027` |
 * | `GET /evidence/:workRef/unmet` | unmet items in one query — `FR-EVS-022` |
 * | `POST /evidence/:workRef/complete` | the completion gate — `FR-EVS-030` |
 * | `GET /evidence/rollup` | aggregate across a scope — `FR-EVS-006`, `SC-EVS-008` |
 *
 * `POST /evidence/bindings` is a sixth route the contract did not list: the
 * contract names the binding (data-model §4) but no way to create one over
 * HTTP, which would leave `FR-EVS-021` reachable from no real entry point.
 * Recorded as `DEF-032-002`.
 *
 * `:workRef` is `type:id`. A refused completion is `409` carrying its unmet
 * list; unreadable or unbound work is `404`, never `403` — a resource the
 * caller cannot see is indistinguishable from one that does not exist (`FR-002`).
 */
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { EvidenceService, workRefFromPath, type Principal } from './evidence.service.js';

function requireAuth(ctx: WorkspaceContext | undefined | null): Principal {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return { workspaceId: ctx.workspaceId, userId: ctx.userId };
}

/** Identity fields a body may not smuggle in; the session is the only source. */
function strip(body: unknown): Record<string, unknown> {
  const { workspaceId: _ws, declaredBy: _by, ...safe } = (body ?? {}) as Record<string, unknown>;
  return safe;
}

@Controller('evidence')
export class EvidenceController {
  constructor(@Inject(EvidenceService) private readonly evidence: EvidenceService) {}

  @Post()
  @HttpCode(201)
  contribute(@Req() ctx: WorkspaceContext | undefined, @Body() body: unknown) {
    return this.evidence.contribute(requireAuth(ctx), strip(body));
  }

  @Post('bindings')
  @HttpCode(201)
  bind(@Req() ctx: WorkspaceContext | undefined, @Body() body: unknown) {
    return this.evidence.bind(requireAuth(ctx), strip(body));
  }

  @Get('rollup')
  rollup(@Req() ctx: WorkspaceContext | undefined, @Query('projectId') projectId?: string) {
    return this.evidence.rollup(requireAuth(ctx), projectId || undefined);
  }

  @Get(':workRef/status')
  status(@Req() ctx: WorkspaceContext | undefined, @Param('workRef') workRef: string) {
    const principal = requireAuth(ctx);
    return this.evidence.status(principal, workRefFromPath(workRef));
  }

  @Get(':workRef/unmet')
  unmet(@Req() ctx: WorkspaceContext | undefined, @Param('workRef') workRef: string) {
    const principal = requireAuth(ctx);
    return this.evidence.unmet(principal, workRefFromPath(workRef));
  }

  @Post(':workRef/complete')
  @HttpCode(200)
  complete(@Req() ctx: WorkspaceContext | undefined, @Param('workRef') workRef: string) {
    const principal = requireAuth(ctx);
    return this.evidence.complete(principal, workRefFromPath(workRef));
  }
}
