/**
 * `T1445`, `T1449` (EPIC-043, `contracts/reads-api.md`) — the reads and the
 * health route a connector credential opens, and the session route the screen
 * reads the workstation connections from.
 *
 * `{projectId}` in every guarded route MUST be the credential's project — the
 * guard answers `404` for any other, and accepts `me` as its alias, which is
 * what the `pmi-studio` server sends because it never knows a project id.
 * PC-1: transports over `ProjectContextService` and `WorkstationConnectionService`.
 */
import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { InvalidConnectorCredentialError, UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { ConnectorAuthGuard, type ConnectorRequestContext } from './connector-auth.guard.js';
import { ConnectorScope } from './connector-scope.js';
import { ProjectContextService, type ConnectorReadContext, type ProjectContextView, type RequirementsByEpicView } from './project-context.service.js';
import { WorkstationConnectionService, type HealthView, type WorkstationConnectionView } from './workstation-connection.service.js';

function readContext(req: { connector?: ConnectorRequestContext }): ConnectorReadContext {
  if (!req.connector) throw new InvalidConnectorCredentialError();
  return {
    credentialId: req.connector.credentialId,
    workspaceId: req.connector.workspaceId,
    projectId: req.connector.projectId,
    principalId: req.connector.principal.principalId,
  };
}

@Controller('projects')
@UseGuards(ConnectorAuthGuard)
export class ConnectorReadsController {
  constructor(
    @Inject(ProjectContextService) private readonly context: ProjectContextService,
    @Inject(WorkstationConnectionService) private readonly connections: WorkstationConnectionService,
  ) {}

  @Get(':projectId/context')
  @ConnectorScope('project.read')
  async projectContext(@Req() req: { connector?: ConnectorRequestContext }): Promise<ProjectContextView> {
    return this.context.context(readContext(req));
  }

  @Get(':projectId/requirements')
  @ConnectorScope('requirements.read')
  async requirements(@Req() req: { connector?: ConnectorRequestContext }, @Query('groupBy') groupBy?: string): Promise<RequirementsByEpicView> {
    return this.context.requirementsByEpic(readContext(req), groupBy);
  }

  @Post(':projectId/health')
  @ConnectorScope('health.write')
  async health(
    @Req() req: { connector?: ConnectorRequestContext },
    @Body() body: { extensionVersion?: string; toolkitVersion?: string; serverVersion?: string; constitutionDigest?: string | null } | undefined,
  ): Promise<HealthView> {
    const safe = body ?? {};
    return this.connections.touch(readContext(req), {
      ...(typeof safe.extensionVersion === 'string' ? { extensionVersion: safe.extensionVersion } : {}),
      ...(typeof safe.toolkitVersion === 'string' ? { toolkitVersion: safe.toolkitVersion } : {}),
      ...(typeof safe.serverVersion === 'string' ? { serverVersion: safe.serverVersion } : {}),
      // EPIC-042 T1489 (R-042-5): what the workstation's constitution file is, classified here.
      ...(safe.constitutionDigest === null || typeof safe.constitutionDigest === 'string' ? { constitutionDigest: safe.constitutionDigest } : {}),
    });
  }
}

/** The session-scoped read for the Local workspace panel (`FR-PIC-053`). */
@Controller('projects')
export class WorkstationConnectionsController {
  constructor(@Inject(WorkstationConnectionService) private readonly connections: WorkstationConnectionService) {}

  @Get(':id/workstation-connections')
  async list(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<WorkstationConnectionView[]> {
    if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
    return this.connections.listForProject(ctx.workspaceId, id);
  }
}
