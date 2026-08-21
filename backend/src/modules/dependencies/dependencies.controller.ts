/**
 * T262 — dependency and impact endpoints. PC-1: a transport.
 *
 * SC-ENH-002: `impact` answers in ONE request — every affected specification
 * with its path — so no caller opens a specification to learn it is affected.
 */
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import type { DependencyEdgeRecord } from './dependencies.service.js';
import type { FlaggedImpactResult } from './impact.service.js';

export interface CreateEdgeBody {
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  dependencyType: string;
}

export interface DependenciesApi {
  create(
    ctx: { workspaceId: string; userId: string },
    body: CreateEdgeBody,
  ): Promise<DependencyEdgeRecord>;
  listForArtifact(
    workspaceId: string,
    ref: { artifactType: string; artifactId: string },
  ): Promise<{ outgoing: DependencyEdgeRecord[]; incoming: DependencyEdgeRecord[] }>;
  delete(workspaceId: string, id: string): Promise<void>;
  impact(
    workspaceId: string,
    ref: { artifactType: string; artifactId: string },
  ): Promise<FlaggedImpactResult>;
}

export const DEPENDENCIES_API = Symbol('DEPENDENCIES_API');

function requireAuth(ctx: WorkspaceContext | undefined | null): WorkspaceContext {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return ctx;
}

@Controller()
export class DependenciesController {
  constructor(
    // @Inject by token: esbuild/tsx emits no design:paramtypes (DEF-001-005).
    @Inject(DEPENDENCIES_API) private readonly dependencies: DependenciesApi,
  ) {}

  @Post('dependencies')
  @HttpCode(201)
  async create(
    @Req() ctx: WorkspaceContext | undefined,
    @Body() body: CreateEdgeBody,
  ): Promise<DependencyEdgeRecord> {
    const acting = requireAuth(ctx);
    return this.dependencies.create(
      { workspaceId: acting.workspaceId, userId: acting.userId },
      body,
    );
  }

  @Get('artifacts/:type/:id/dependencies')
  async list(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('type') type: string,
    @Param('id') id: string,
  ): Promise<{ outgoing: DependencyEdgeRecord[]; incoming: DependencyEdgeRecord[] }> {
    return this.dependencies.listForArtifact(requireAuth(ctx).workspaceId, {
      artifactType: type,
      artifactId: id,
    });
  }

  @Delete('dependencies/:id')
  async remove(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<{ deleted: true }> {
    await this.dependencies.delete(requireAuth(ctx).workspaceId, id);
    return { deleted: true };
  }

  @Get('artifacts/:type/:id/impact')
  async impact(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('type') type: string,
    @Param('id') id: string,
  ): Promise<FlaggedImpactResult> {
    return this.dependencies.impact(requireAuth(ctx).workspaceId, {
      artifactType: type,
      artifactId: id,
    });
  }
}
