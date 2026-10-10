/**
 * `T744`, `T751`, `T756`, `T763`, `T770` — the decision engine's real entry
 * points (`contracts/decision-contract.md` §7). PC-1: a transport.
 *
 * | Route | Requirement |
 * |---|---|
 * | `POST /decisions` | the Decide seam — `409` when refused, carrying the decision |
 * | `POST /decisions/:id/approve` | `FR-DPE-014`, `FR-DPE-015` — `403` without authority |
 * | `POST /decisions/:id/exceptions` | `FR-DPE-013` |
 * | `GET /decisions/:id/explanation` | `FR-DPE-040`, `FR-DPE-043` |
 * | `GET /decision-metrics` | `FR-DPE-033` — not `/decisions/metrics`, see below |
 * | `GET /inbox` | `FR-DPE-020`–`FR-DPE-026` |
 * | `GET /decision-objects/:type/:id/decisions` | `FR-DPE-024` — not in the contract; `T796a` |
 * | `GET`/`POST /decision-policies` | `FR-DPE-011` — not in the contract; `DEF-031-003` |
 *
 * **`/decisions` is shared with `EPIC-016`.** Its ADR store already answers
 * `GET /decisions/:id`, registered first, so `GET /decisions/metrics` was read as
 * an ADR id and answered `404`. The sub-path routes (`/approve`, `/exceptions`,
 * `/explanation`) do not collide; `metrics` moved to `/decision-metrics`.
 * Recorded in `DEF-031-003` with the recommendation to move this engine under
 * `/policy-decisions` — a `/decisions/:id` that means an ADR and a
 * `/decisions/:id/explanation` that means a policy decision is a namespace two
 * Epics are sharing by accident.
 */
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { DecisionService, type Principal } from './decision.service.js';

function requireAuth(ctx: WorkspaceContext | undefined | null): Principal {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return { workspaceId: ctx.workspaceId, userId: ctx.userId };
}

/** Identity fields a body may not smuggle in; the session is the only source. */
function strip(body: unknown): Record<string, unknown> {
  const {
    workspaceId: _ws,
    actor: _actor,
    requestedBy: _by,
    authorizedBy: _auth,
    approvedBy: _approved,
    version: _version,
    ...safe
  } = (body ?? {}) as Record<string, unknown>;
  return safe;
}

@Controller()
export class DecisionController {
  constructor(@Inject(DecisionService) private readonly decisions: DecisionService) {}

  @Post('decisions')
  @HttpCode(201)
  decide(@Req() ctx: WorkspaceContext | undefined, @Body() body: unknown) {
    return this.decisions.decide(requireAuth(ctx), strip(body));
  }

  @Get('decision-metrics')
  metrics(@Req() ctx: WorkspaceContext | undefined) {
    return this.decisions.metrics(requireAuth(ctx));
  }

  @Post('decisions/:id/approve')
  @HttpCode(200)
  approve(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string) {
    return this.decisions.approve(requireAuth(ctx), id);
  }

  @Post('decisions/:id/exceptions')
  @HttpCode(201)
  exception(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string, @Body() body: unknown) {
    return this.decisions.recordException(requireAuth(ctx), id, strip(body));
  }

  @Get('decisions/:id/explanation')
  explanation(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string) {
    return this.decisions.explanation(requireAuth(ctx), id);
  }

  @Get('inbox')
  inbox(@Req() ctx: WorkspaceContext | undefined) {
    return this.decisions.inbox(requireAuth(ctx));
  }

  /**
   * `T796a` — the decisions on one object, so a decision stays retrievable from
   * the object after it leaves the Inbox (`FR-DPE-024`). Under its own prefix
   * for the reason `decision-metrics` is: `/decisions/*` is `EPIC-016`'s.
   */
  @Get('decision-objects/:type/:id/decisions')
  forObject(@Req() ctx: WorkspaceContext | undefined, @Param('type') type: string, @Param('id') id: string) {
    return this.decisions.forObject(requireAuth(ctx), type, id);
  }

  @Get('decision-policies/current')
  currentPolicy(@Req() ctx: WorkspaceContext | undefined) {
    return this.decisions.currentPolicy(requireAuth(ctx));
  }

  @Post('decision-policies')
  @HttpCode(201)
  issuePolicy(@Req() ctx: WorkspaceContext | undefined, @Body() body: unknown) {
    return this.decisions.issuePolicy(requireAuth(ctx), strip(body));
  }
}
