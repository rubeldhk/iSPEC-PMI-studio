/**
 * T423 — `/workspaces/{id}/storage-connections` and `/storage-connections/*`
 * per `platform-api-epic-002.md` (Storage connections · FR-PUB-029, FR-PUB-031,
 * FR-PUB-037..039). Closes gap G-02.4.
 *
 * An unreachable provider reports `unavailable`, NEVER `healthy`. The
 * response body is `ConnectionView` — the shape with no token field, so
 * non-exposure is structural (FR-PUB-029b).
 */
import { Body, Controller, Delete, Get, Inject, Param, Post, HttpCode, Req } from '@nestjs/common';
import type { HealthStatus } from '@pmi/storage-contract';
import { NotFoundError, UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { ConnectionService } from './connection.service.js';
import type { ConnectionView } from './connection.service.js';

function requireAuth(ctx: WorkspaceContext | undefined | null): WorkspaceContext {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return ctx;
}

@Controller()
export class ConnectionsController {
  constructor(@Inject(ConnectionService) private readonly connections: ConnectionService) {}

  @Get('workspaces/:id/storage-connections')
  async list(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') workspaceId: string,
  ): Promise<ConnectionView[]> {
    const session = requireAuth(ctx);
    // A foreign workspace is absent, never forbidden.
    if (workspaceId !== session.workspaceId) throw new NotFoundError('Not found.');
    return this.connections.list(session.workspaceId);
  }

  /** `providerType` and `destination` required (FR-PUB-029). */
  @Post('workspaces/:id/storage-connections')
  @HttpCode(201)
  async connect(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') workspaceId: string,
    @Body() body: { providerType?: string; destination?: string; refreshToken?: string; password?: string },
  ): Promise<ConnectionView> {
    const session = requireAuth(ctx);
    if (workspaceId !== session.workspaceId) throw new NotFoundError('Not found.');
    return this.connections.connect(session.workspaceId, {
      providerName: body?.providerType,
      destination: body?.destination,
      authorisedById: session.userId,
      refreshToken: body?.refreshToken,
      password: body?.password,
    });
  }

  /** FR-PUB-031 — healthy | needs_reauthorisation | unavailable. */
  @Get('storage-connections/:id/health')
  async health(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<{ status: HealthStatus }> {
    const session = requireAuth(ctx);
    return { status: await this.connections.health(session.workspaceId, id) };
  }

  /** Disconnect — no platform artifact affected (FR-PUB-037, FR-PUB-038). */
  @Delete('storage-connections/:id')
  async disconnect(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<ConnectionView> {
    const session = requireAuth(ctx);
    return this.connections.disconnect(session.workspaceId, id);
  }
}
