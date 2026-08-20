/**
 * T102a — the tasks endpoints per contracts/platform-api.md (Tasks · US4).
 *
 * generate → 202 (always asynchronous, R-001), gated on approval BEFORE a job
 * is created (FR-020) — the gate refusal is a 422 the caller can act on, not
 * a queued job that fails later.
 *
 * PC-1: a transport.
 */
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import type { TaskRecord, TaskStatus } from './generate-tasks.service.js';
import type { ProjectProgress } from './tasks.service.js';

export interface TaskJobBody {
  id: string;
  kind: string;
  state: string;
  failureReason: string | null;
  startedAt: Date | null;
  resultRef: string | null;
}

/** The service surface the controller needs — one token, mocked in T098a. */
export interface TasksApi {
  submitGeneration(
    ctx: { workspaceId: string; userId: string },
    specificationId: string,
  ): Promise<TaskJobBody>;
  listForSpecification(workspaceId: string, specificationId: string): Promise<TaskRecord[]>;
  updateStatus(workspaceId: string, id: string, status: TaskStatus): Promise<TaskRecord>;
  progressForProject(workspaceId: string, projectId: string): Promise<ProjectProgress>;
}

export const TASKS_API = Symbol('TASKS_API');

function requireAuth(ctx: WorkspaceContext | undefined | null): WorkspaceContext {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return ctx;
}

@Controller()
export class TasksController {
  constructor(
    // @Inject by token: esbuild/tsx emits no design:paramtypes (DEF-001-005).
    @Inject(TASKS_API) private readonly tasks: TasksApi,
  ) {}

  @Post('specifications/:id/jobs/generate-tasks')
  @HttpCode(202)
  async generate(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<TaskJobBody> {
    const acting = requireAuth(ctx);
    return this.tasks.submitGeneration(
      { workspaceId: acting.workspaceId, userId: acting.userId },
      id,
    );
  }

  @Get('specifications/:id/tasks')
  async list(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<TaskRecord[]> {
    return this.tasks.listForSpecification(requireAuth(ctx).workspaceId, id);
  }

  @Patch('tasks/:id')
  async patch(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: { status?: TaskStatus },
  ): Promise<TaskRecord> {
    return this.tasks.updateStatus(requireAuth(ctx).workspaceId, id, body.status as TaskStatus);
  }

  @Get('projects/:projectId/progress')
  async progress(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('projectId') projectId: string,
  ): Promise<ProjectProgress> {
    return this.tasks.progressForProject(requireAuth(ctx).workspaceId, projectId);
  }
}
