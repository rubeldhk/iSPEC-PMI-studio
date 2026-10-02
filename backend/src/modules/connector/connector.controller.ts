/**
 * `T1362` (EPIC-041) — the credential routes and the one diagnostic route
 * behind the guard (specs/041-local-project-workspace/contracts/provisioning-api.md).
 *
 * PC-1: transports. They resolve the acting context, strip anything a caller
 * sent that could widen tenancy, and delegate.
 *
 * - `POST /projects/:id/connector-credentials` — `201`, the value exactly once.
 * - `GET  /projects/:id/connector-credentials` — never `value` or `tokenHash`.
 * - `POST /connector-credentials/:id/revoke` — `201` when it changed, `200` when
 *   already revoked.
 * - `GET  /connector/whoami` (and `/connector/projects/:projectId/whoami`, the
 *   project-addressed form Scenario 9 drives) — behind `ConnectorAuthGuard`,
 *   returns the project id the credential opens and nothing else.
 */
import { Body, Controller, Get, Inject, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { ConnectorAuthGuard, type ConnectorRequestContext } from './connector-auth.guard.js';
import { ConnectorCredentialService, type PublicCredential } from './connector-credential.service.js';
import { ConnectorScope } from './connector-scope.js';

function requireAuth(ctx: WorkspaceContext | undefined | null): { workspaceId: string; userId: string } {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return { workspaceId: ctx.workspaceId, userId: ctx.userId };
}

interface StatusSetter {
  status(code: number): unknown;
}

export type MintedCredentialBody = PublicCredential & { value: string };

function parseRevoked(value: string | undefined): boolean | undefined {
  if (value === undefined || value === '') return undefined;
  return value === 'true' || value === '1';
}

@Controller('projects')
export class ProjectConnectorCredentialsController {
  constructor(@Inject(ConnectorCredentialService) private readonly credentials: ConnectorCredentialService) {}

  @Post(':id/connector-credentials')
  async mint(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') projectId: string,
    @Body() body: { label: string },
  ): Promise<MintedCredentialBody> {
    const acting = requireAuth(ctx);
    const minted = await this.credentials.mint(acting, projectId, { label: body?.label ?? '' });
    return { ...minted.record, value: minted.value };
  }

  @Get(':id/connector-credentials')
  async list(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') projectId: string,
    @Query('revoked') revoked: string | undefined,
    @Query('label') label: string | undefined,
  ): Promise<PublicCredential[]> {
    const acting = requireAuth(ctx);
    const revokedFilter = parseRevoked(revoked);
    return this.credentials.list(acting.workspaceId, projectId, {
      ...(revokedFilter !== undefined ? { revoked: revokedFilter } : {}),
      ...(label !== undefined && label !== '' ? { label } : {}),
    });
  }
}

@Controller('connector-credentials')
export class ConnectorCredentialsController {
  constructor(@Inject(ConnectorCredentialService) private readonly credentials: ConnectorCredentialService) {}

  @Post(':id/revoke')
  async revoke(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') credentialId: string,
    @Res({ passthrough: true }) res: StatusSetter,
  ): Promise<PublicCredential> {
    const acting = requireAuth(ctx);
    const { record, changed } = await this.credentials.revoke(acting, credentialId);
    res.status(changed ? 201 : 200);
    return record;
  }
}

/** The routes a connector credential opens. In this Epic: one diagnostic. */
@Controller('connector')
@UseGuards(ConnectorAuthGuard)
export class ConnectorController {
  @Get('whoami')
  @ConnectorScope('connector.whoami')
  whoami(@Req() req: { connector?: ConnectorRequestContext }): { projectId: string } {
    if (!req.connector) throw new UnauthenticatedError(ConnectorAuthGuard.REFUSAL_MESSAGE);
    return { projectId: req.connector.projectId };
  }

  /** The project-addressed form: the guard answers 404 when the id is not the credential's. */
  @Get('projects/:projectId/whoami')
  @ConnectorScope('connector.whoami')
  whoamiForProject(@Req() req: { connector?: ConnectorRequestContext }): { projectId: string } {
    return this.whoami(req);
  }
}
