/**
 * `T2178` (EPIC-039, API contract §4) — per-project credentials.
 *
 * `PUT` answers `204` and echoes nothing; `GET` is status only — its response
 * type has no value field (`FR-HUB-043`). This GET is the read `SC-HUB-004`'s
 * mutation proof targets.
 */
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Put, Req } from '@nestjs/common';
import { NotFoundError } from '../../../core/errors.js';
import type { Hub } from '../hub.js';
import { HUB } from '../hub.token.js';
import { requireSession, type HubRequest } from '../session.js';
import type { CredentialStatusView } from './credential.service.js';

@Controller('projects')
export class CredentialsController {
  constructor(@Inject(HUB) private readonly hub: Hub) {}

  @Get(':projectId/integrations/credentials')
  async status(@Req() req: HubRequest, @Param('projectId') projectId: string): Promise<CredentialStatusView[]> {
    const actor = requireSession(req);
    if (!(await this.hub.deps.projects.exists(actor.workspaceId, projectId))) throw new NotFoundError('The project does not exist.');
    return this.hub.credentials.status(actor.workspaceId, projectId);
  }

  @Put(':projectId/integrations/credentials/:entryId')
  @HttpCode(204)
  async set(@Req() req: HubRequest, @Param('projectId') projectId: string, @Param('entryId') entryId: string, @Body() body: { kind?: unknown; value?: unknown } | undefined): Promise<void> {
    await this.hub.credentials.set(requireSession(req), projectId, entryId, body ?? {});
  }

  @Delete(':projectId/integrations/credentials/:entryId')
  @HttpCode(204)
  async remove(@Req() req: HubRequest, @Param('projectId') projectId: string, @Param('entryId') entryId: string): Promise<void> {
    await this.hub.credentials.remove(requireSession(req), projectId, entryId);
  }
}
