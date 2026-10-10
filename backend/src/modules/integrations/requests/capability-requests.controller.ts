/**
 * `T2150` (EPIC-039, API contract §5) — `POST /projects/:projectId/capability-requests`.
 *
 * A decided request is always `200` — a refusal is the Hub working, not
 * failing (`R-039-7`). `400` is a malformed body, `404` a project outside the
 * workspace, `503` an unbound seam the request cannot be decided without. A
 * connector credential is refused before the body is used (`FR-HUB-004`). There
 * is no MCP tool for this route (`mcp-server-boundary.spec.ts`).
 */
import { Body, Controller, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { NotFoundError } from '../../../core/errors.js';
import type { Hub } from '../hub.js';
import { HUB } from '../hub.token.js';
import { refuseConnector, requireSession, type HubRequest } from '../session.js';
import type { CapabilityResponse, RequestBody } from './capability-requests.service.js';

@Controller('projects')
export class CapabilityRequestsController {
  constructor(@Inject(HUB) private readonly hub: Hub) {}

  @Post(':projectId/capability-requests')
  @HttpCode(200)
  async request(@Req() req: HubRequest, @Param('projectId') projectId: string, @Body() body: RequestBody | undefined): Promise<CapabilityResponse> {
    refuseConnector(req);
    const actor = requireSession(req);
    if (!(await this.hub.deps.projects.exists(actor.workspaceId, projectId))) throw new NotFoundError('The project does not exist.');
    return this.hub.requests.request(actor, projectId, body ?? {}, { http: true });
  }
}
