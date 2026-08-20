/**
 * T070 — `/projects/{id}/requirements` and `/requirements/*` per
 * contracts/platform-api.md (Requirements · US2).
 *
 * PC-1: a transport. Collection routes are project-nested; item routes are
 * flat — exactly the contract's two tables, one controller.
 */
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import type { RequirementRetireService } from './requirement-retire.service.js';
import type { RequirementVersionRecord } from './requirement-version.service.js';
import type { RequirementRecord, RequirementsService } from './requirements.service.js';
import type {
  CreateRequirementInput,
  EditRequirementInput,
  ListFilters,
} from './requirement.validation.js';

function requireAuth(ctx: WorkspaceContext | undefined | null): WorkspaceContext {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return ctx;
}

/** Scope comes from the session and the route — never from a body (T014). */
function stripScope<T extends Record<string, unknown>>(body: T): T {
  const { workspaceId: _ws, projectId: _p, id: _id, status: _status, ...safe } = body;
  return safe as T;
}

@Controller()
export class RequirementsController {
  constructor(
    private readonly requirements: RequirementsService,
    private readonly retirer: RequirementRetireService,
  ) {}

  @Get('projects/:projectId/requirements')
  async list(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('projectId') projectId: string,
    @Query() filters: ListFilters,
  ): Promise<RequirementRecord[]> {
    return this.requirements.list(requireAuth(ctx).workspaceId, projectId, filters);
  }

  @Post('projects/:projectId/requirements')
  async create(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('projectId') projectId: string,
    @Body() body: CreateRequirementInput,
  ): Promise<RequirementRecord> {
    const acting = requireAuth(ctx);
    return this.requirements.create(
      { workspaceId: acting.workspaceId, userId: acting.userId },
      projectId,
      stripScope(body as Record<string, unknown>) as CreateRequirementInput,
    );
  }

  @Get('requirements/:id')
  async get(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<RequirementRecord> {
    return this.requirements.get(requireAuth(ctx).workspaceId, id);
  }

  @Patch('requirements/:id')
  async patch(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: EditRequirementInput,
  ): Promise<RequirementRecord> {
    const acting = requireAuth(ctx);
    return this.requirements.edit(
      { workspaceId: acting.workspaceId, userId: acting.userId },
      id,
      stripScope(body as Record<string, unknown>) as EditRequirementInput,
    );
  }

  @Post('requirements/:id/retire')
  @HttpCode(200)
  async retire(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<RequirementRecord> {
    return this.retirer.retire(requireAuth(ctx).workspaceId, id);
  }

  @Get('requirements/:id/versions')
  async versions(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<RequirementVersionRecord[]> {
    return this.requirements.versions(requireAuth(ctx).workspaceId, id);
  }
}
