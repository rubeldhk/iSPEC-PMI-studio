/**
 * `T2186` (EPIC-039, API contract §6) — evidence intake: enqueue (`202`) and
 * read. Session routes; a connector credential is refused before the body is
 * used (`FR-HUB-004`); a project outside the workspace is `404`.
 */
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { NotFoundError } from '../../../core/errors.js';
import type { Hub } from '../hub.js';
import { HUB } from '../hub.token.js';
import { requireSession, type HubRequest } from '../session.js';
import type { IntakeView } from './evidence-intake.service.js';

@Controller('projects')
export class EvidenceIntakeController {
  constructor(@Inject(HUB) private readonly hub: Hub) {}

  @Post(':projectId/integrations/evidence-intake')
  @HttpCode(202)
  async enqueue(@Req() req: HubRequest, @Param('projectId') projectId: string, @Body() body: Record<string, unknown> | undefined): Promise<{ intakeId: string }> {
    const actor = requireSession(req);
    if (!(await this.hub.deps.projects.exists(actor.workspaceId, projectId))) throw new NotFoundError('The project does not exist.');
    return this.hub.intake.enqueue(actor, projectId, body ?? {});
  }

  @Get(':projectId/integrations/evidence-intake/:intakeId')
  async view(@Req() req: HubRequest, @Param('projectId') projectId: string, @Param('intakeId') intakeId: string): Promise<IntakeView> {
    const actor = requireSession(req);
    if (!(await this.hub.deps.projects.exists(actor.workspaceId, projectId))) throw new NotFoundError('The project does not exist.');
    return this.hub.intake.view(actor, projectId, intakeId);
  }
}
