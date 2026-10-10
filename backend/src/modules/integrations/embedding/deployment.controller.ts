/**
 * `T2201` (EPIC-039, API contract §4a, analysis I1) — the deployment-scope
 * binding, **read only**: `GET /integrations/deployment/capabilities`.
 *
 * Read on the caller's workspace `integration-registry`; `404` without it.
 * There is deliberately no `PUT`/`DELETE` here and no deployment credential
 * route: the `Embed` binding is deployment configuration read at boot
 * (`FR-HUB-084`), and an unknown route answers `404`.
 */
import { Controller, Get, Inject, Req } from '@nestjs/common';
import type { Hub } from '../hub.js';
import { HUB } from '../hub.token.js';
import { requireSession, type HubRequest } from '../session.js';
import type { DeploymentCapabilitiesView } from './deployment-binding.service.js';

@Controller('integrations/deployment')
export class DeploymentController {
  constructor(@Inject(HUB) private readonly hub: Hub) {}

  @Get('capabilities')
  async capabilities(@Req() req: HubRequest): Promise<DeploymentCapabilitiesView> {
    const actor = requireSession(req);
    return this.hub.deployment.view(actor.workspaceId, actor.userId);
  }
}
