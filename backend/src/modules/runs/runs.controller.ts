/**
 * T417 — `/projects/{id}/runs` and `/runs/*` per
 * `specs/002-team-review-access-storage/contracts/platform-api-epic-002.md`
 * (Runs · FR-RUN-001 to FR-RUN-008a).
 *
 * PC-1: a transport. Runs are asynchronous like generation — 202 with a run
 * resource, never a result. `reached_stop_point` is returned as a SUCCESS
 * state, and cross-workspace access is ABSENT rather than forbidden.
 */
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { RunModeService } from './run-mode.service.js';
import type { RunRecord } from './run-mode.service.js';

/** The run body the contract specifies. */
export interface RunBody {
  id: string;
  projectId: string;
  mode: string;
  stopRange: string;
  state: string;
  /** FR-RUN-008a — the run reports that it stopped where the user asked. */
  stoppedAtSelectedRange: boolean;
  outcomeReason: string | null;
  /** FR-ACC-028 — the snapshot's exclusions ride along on GET. */
  accessSnapshot: unknown | null;
  startedAt: Date;
  endedAt: Date | null;
}

function requireAuth(ctx: WorkspaceContext | undefined | null): WorkspaceContext {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return ctx;
}

export function toRunBody(run: RunRecord): RunBody {
  return {
    id: run.id,
    projectId: run.projectId,
    mode: run.mode,
    stopRange: run.stopRange,
    state: run.state,
    stoppedAtSelectedRange: run.state === 'reached_stop_point',
    outcomeReason: run.outcomeReason,
    accessSnapshot: run.accessSnapshot,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
  };
}

@Controller()
export class RunsController {
  constructor(@Inject(RunModeService) private readonly runs: RunModeService) {}

  /** 202 — a run is long work accepted, never a synchronous result. */
  @Post('projects/:projectId/runs')
  @HttpCode(202)
  async start(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('projectId') projectId: string,
    @Body() body: { mode?: string; stopRange?: string },
  ): Promise<RunBody> {
    const session = requireAuth(ctx);
    const run = await this.runs.start(session.workspaceId, {
      projectId,
      mode: body?.mode,
      stopRange: body?.stopRange,
      initiatedById: session.userId,
    });
    return toRunBody(run);
  }

  @Get('projects/:projectId/runs')
  async list(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('projectId') projectId: string,
  ): Promise<RunBody[]> {
    const session = requireAuth(ctx);
    const rows = await this.runs.listForProject(session.workspaceId, projectId);
    return rows.map(toRunBody);
  }

  @Get('runs/:id')
  async get(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<RunBody> {
    const session = requireAuth(ctx);
    return toRunBody(await this.runs.get(session.workspaceId, id));
  }

  /** 202 — the request to stop is accepted; questions so far are preserved. */
  @Post('runs/:id/cancel')
  @HttpCode(202)
  async cancel(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<RunBody> {
    const session = requireAuth(ctx);
    return toRunBody(await this.runs.cancel(session.workspaceId, id));
  }

  /** Continues past a `reached_stop_point` run (FR-RUN-008a). */
  @Post('runs/:id/continue')
  @HttpCode(202)
  async continueRun(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<RunBody> {
    const session = requireAuth(ctx);
    return toRunBody(await this.runs.continue(session.workspaceId, id));
  }
}
