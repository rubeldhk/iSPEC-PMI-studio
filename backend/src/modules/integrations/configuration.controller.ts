/**
 * `T2150` (EPIC-039, API contract §3) — a project's capability configuration.
 * Members read; the owner (or an `edit` grant on the project) writes.
 */
import { Body, Controller, Get, Inject, Param, Put, Req } from '@nestjs/common';
import { NotFoundError } from '../../core/errors.js';
import type { ConfigurationView, PutResult } from './configuration.service.js';
import type { Hub } from './hub.js';
import { HUB } from './hub.token.js';
import { requireSession, type HubRequest } from './session.js';

@Controller('projects')
export class ConfigurationController {
  constructor(@Inject(HUB) private readonly hub: Hub) {}

  @Get(':projectId/integrations/configuration')
  async list(@Req() req: HubRequest, @Param('projectId') projectId: string): Promise<ConfigurationView[]> {
    const actor = requireSession(req);
    if (!(await this.hub.deps.projects.exists(actor.workspaceId, projectId))) throw new NotFoundError('The project does not exist.');
    return this.hub.configuration.list(actor.workspaceId, projectId);
  }

  @Put(':projectId/integrations/configuration/:capability')
  async put(@Req() req: HubRequest, @Param('projectId') projectId: string, @Param('capability') capability: string, @Body() body: Record<string, unknown> | undefined): Promise<PutResult> {
    const actor = requireSession(req);
    return this.hub.configuration.put(actor, projectId, capability, body ?? {});
  }
}
