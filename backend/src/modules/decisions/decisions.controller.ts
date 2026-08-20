/**
 * T143b — the four ADR endpoints per contracts/platform-api.md (FR-034),
 * plus the id-scoped GET the not-found rule needs a probe for.
 *
 * PC-1: a transport.
 */
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import type {
  AdrRecord,
  CreateAdrInput,
  DecisionsService,
  UpdateAdrInput,
} from './decisions.service.js';

function requireAuth(ctx: WorkspaceContext | undefined | null): WorkspaceContext {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return ctx;
}

function stripScope<T extends Record<string, unknown>>(body: T): T {
  const { workspaceId: _ws, projectId: _p, id: _id, ...safe } = body;
  return safe as T;
}

export interface LinkBody {
  specificationIds?: string[];
}

@Controller()
export class DecisionsController {
  constructor(private readonly decisions: DecisionsService) {}

  @Get('projects/:projectId/decisions')
  async list(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('projectId') projectId: string,
  ): Promise<AdrRecord[]> {
    return this.decisions.list(requireAuth(ctx).workspaceId, projectId);
  }

  @Post('projects/:projectId/decisions')
  async create(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('projectId') projectId: string,
    @Body() body: CreateAdrInput,
  ): Promise<AdrRecord> {
    const acting = requireAuth(ctx);
    return this.decisions.create(
      { workspaceId: acting.workspaceId, userId: acting.userId },
      projectId,
      stripScope(body as Record<string, unknown>) as CreateAdrInput,
    );
  }

  @Get('decisions/:id')
  async get(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<AdrRecord> {
    return this.decisions.get(requireAuth(ctx).workspaceId, id);
  }

  @Patch('decisions/:id')
  async patch(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: UpdateAdrInput,
  ): Promise<AdrRecord> {
    return this.decisions.update(
      requireAuth(ctx).workspaceId,
      id,
      stripScope(body as Record<string, unknown>) as UpdateAdrInput,
    );
  }

  @Post('decisions/:id/links')
  @HttpCode(200)
  async link(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: LinkBody,
  ): Promise<{ id: string; specificationIds: string[] }> {
    const specificationIds = await this.decisions.linkSpecifications(
      requireAuth(ctx).workspaceId,
      id,
      body.specificationIds ?? [],
    );
    return { id, specificationIds };
  }
}
