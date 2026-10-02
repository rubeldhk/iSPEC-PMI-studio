/**
 * `T1432` (EPIC-043, `FR-PIC-035`) — the session-scoped timeline read for the
 * project screen. A product endpoint like every other: session cookie,
 * workspace membership, the project in the workspace; the opaque `404` for
 * anything else. PC-1: a transport over `ExecutionTimelineService`.
 *
 * No route here applies or approves a transition (`FR-PIC-054`).
 */
import { Controller, Get, Inject, Param, Query, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { ExecutionTimelineService, type TimelineEvent, type TimelinePage } from './execution-timeline.service.js';

function requireAuth(ctx: WorkspaceContext | undefined | null): WorkspaceContext {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return ctx;
}

@Controller('projects')
export class ExecutionTimelineController {
  constructor(@Inject(ExecutionTimelineService) private readonly timeline: ExecutionTimelineService) {}

  @Get(':id/executions')
  async list(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Query('surface') surface?: string,
    @Query('state') state?: string,
    @Query('initiator') initiator?: string,
    @Query('after') after?: string,
    @Query('limit') limit?: string,
  ): Promise<TimelinePage> {
    const parsedLimit = limit === undefined ? undefined : Number.parseInt(limit, 10);
    return this.timeline.list(requireAuth(ctx).workspaceId, id, {
      ...(surface !== undefined ? { surface } : {}),
      ...(state !== undefined ? { state } : {}),
      ...(initiator !== undefined ? { initiator } : {}),
      ...(after !== undefined ? { after } : {}),
      ...(parsedLimit !== undefined && Number.isFinite(parsedLimit) ? { limit: parsedLimit } : {}),
    });
  }

  @Get(':id/executions/:executionId/events')
  async events(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Param('executionId') executionId: string,
  ): Promise<TimelineEvent[]> {
    return this.timeline.events(requireAuth(ctx).workspaceId, id, executionId);
  }
}
