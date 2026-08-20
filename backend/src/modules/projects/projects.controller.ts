/**
 * T055 — `/projects` per contracts/platform-api.md (Projects · US1).
 *
 * PC-1: this is a transport. It resolves the acting context, strips anything a
 * caller sent that could widen tenancy, and delegates. No business logic.
 */
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
// Value import: the class is the DI TOKEN. A `import type` here erases at
// compile time, and @Inject would reference nothing (DEF-001-005).
import { ProjectsService } from './projects.service.js';
import type {
  CreateProjectInput,
  ProjectRecord,
  UpdateProjectInput,
} from './projects.service.js';

/**
 * A product endpoint with no session is 401 (contract: "No valid session") —
 * distinct from the opaque 404 that hides cross-workspace existence. The 404
 * rule is about resources; this is about the caller.
 */
function requireAuth(ctx: WorkspaceContext | undefined | null): WorkspaceContext {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return ctx;
}

/** Fields a request body may not smuggle in (the scope always wins — T014). */
function stripScope<T extends Record<string, unknown>>(body: T): T {
  const { workspaceId: _ws, ownerUserId: _owner, id: _id, ...safe } = body;
  return safe as T;
}

@Controller('projects')
export class ProjectsController {
  constructor(
    // @Inject by token, not by type: esbuild/tsx emits no design:paramtypes,
    // so a class-typed parameter resolves to UNDEFINED and the first call
    // throws. Guarded by controller-composition.spec.ts (DEF-001-005).
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}

  @Get()
  async list(@Req() ctx: WorkspaceContext | undefined): Promise<ProjectRecord[]> {
    return this.projects.list(requireAuth(ctx).workspaceId);
  }

  @Post()
  async create(
    @Req() ctx: WorkspaceContext | undefined,
    @Body() body: CreateProjectInput,
  ): Promise<ProjectRecord> {
    const acting = requireAuth(ctx);
    return this.projects.create(
      { workspaceId: acting.workspaceId, userId: acting.userId },
      stripScope(body as Record<string, unknown>) as CreateProjectInput,
    );
  }

  @Get(':id')
  async get(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<ProjectRecord> {
    return this.projects.get(requireAuth(ctx).workspaceId, id);
  }

  @Patch(':id')
  async patch(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: UpdateProjectInput,
  ): Promise<ProjectRecord> {
    return this.projects.update(
      requireAuth(ctx).workspaceId,
      id,
      stripScope(body as Record<string, unknown>) as UpdateProjectInput,
    );
  }

  @Post(':id/archive')
  @HttpCode(200)
  async archive(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<ProjectRecord> {
    return this.projects.archive(requireAuth(ctx).workspaceId, id);
  }
}
