/**
 * `T1926` (EPIC-047) — the callable surface, per `contracts/experts-api.md`.
 *
 * A transport only: every capability lives in a service and is reachable
 * without HTTP (`PP-007`). What the session decides — the workspace and the
 * acting user — is taken from the session, never from the body: an Expert
 * registered "by" somebody else would carry their authority in its history.
 */
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query, Req } from '@nestjs/common';
import { UnauthenticatedError, ValidationFailedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { AssignmentService, type AssignInput } from './assignment.service.js';
import { Authoring } from './authoring.js';
import { DispatchService, type DispatchRequest } from './dispatch.service.js';
import { RegistryService } from './registry.service.js';
import { SessionsService } from './sessions.service.js';

interface Acting {
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: string;
}

function requireAuth(ctx: WorkspaceContext | undefined | null): Acting {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  // The role a dispatched package records as having filtered it (FR-CTX-031);
  // a stated placeholder rather than '' when the session carries none.
  return { workspaceId: ctx.workspaceId, userId: ctx.userId, role: (ctx as { role?: string }).role ?? 'unspecified' };
}

const list = (body: unknown, name: string): unknown => {
  const v = field(body, name);
  return v === undefined ? [] : v;
};

function versionNumber(raw: unknown, name: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new ValidationFailedError(`${name} must be a version number ≥ 1`);
  return n;
}

const field = (body: unknown, name: string): unknown => (body as Record<string, unknown> | null)?.[name];

@Controller()
export class ExpertsController {
  constructor(
    // @Inject by class: esbuild/tsx emits no `design:paramtypes` (DEF-001-005).
    @Inject(RegistryService) private readonly registry: RegistryService,
    @Inject(DispatchService) private readonly dispatcher: DispatchService,
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(Authoring) private readonly authoring: Authoring,
    @Inject(AssignmentService) private readonly assignments: AssignmentService,
  ) {}

  /**
   * `R-047-3`, `FR-EXP-073` — one run, its limits, its events. Declared before
   * `experts/:id` so `sessions` is never read as an Expert id.
   */
  @Get('experts/sessions/:executionId')
  async session(@Req() ctx: WorkspaceContext | undefined, @Param('executionId') executionId: string): Promise<unknown> {
    const { workspaceId, userId } = requireAuth(ctx);
    await this.authoring.requireReader(workspaceId, userId);
    return this.sessions.view(workspaceId, executionId);
  }

  /** `FR-EXP-033` — declared before `experts/:id`. 404 when unset: no policy, no delegation. */
  @Get('experts/delegation-policy')
  async getPolicy(@Req() ctx: WorkspaceContext | undefined): Promise<unknown> {
    const { workspaceId, userId } = requireAuth(ctx);
    await this.authoring.requireReader(workspaceId, userId);
    return this.sessions.policy(workspaceId);
  }

  /** `FR-EXP-009`, `FR-EXP-033`, analysis finding C1 — replaced whole, by an author. */
  @Put('experts/delegation-policy')
  @HttpCode(200)
  async putPolicy(@Req() ctx: WorkspaceContext | undefined, @Body() body: unknown): Promise<unknown> {
    const { workspaceId, userId } = requireAuth(ctx);
    await this.authoring.requireAuthor(workspaceId, userId);
    return this.sessions.putPolicy(workspaceId, userId, body);
  }

  /** `FR-EXP-001`, `FR-EXP-010`, `FR-EXP-011` — register with version 1 as a draft. */
  @Post('experts')
  register(@Req() ctx: WorkspaceContext | undefined, @Body() body: unknown): Promise<unknown> {
    const { workspaceId, userId } = requireAuth(ctx);
    return this.registry.register(workspaceId, userId, {
      key: field(body, 'key'),
      name: field(body, 'name'),
      contract: field(body, 'contract'),
    });
  }

  /** `FR-EXP-071` — the roster. */
  @Get('experts')
  list(@Req() ctx: WorkspaceContext | undefined): Promise<unknown> {
    const { workspaceId, userId } = requireAuth(ctx);
    return this.registry.list(workspaceId, userId);
  }

  @Get('experts/:id')
  get(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<unknown> {
    const { workspaceId, userId } = requireAuth(ctx);
    return this.registry.get(workspaceId, userId, id);
  }

  /** `FR-EXP-004` — a whole new contract; approved versions are never edited. */
  @Post('experts/:id/contract-versions')
  newVersion(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const { workspaceId, userId } = requireAuth(ctx);
    return this.registry.newVersion(workspaceId, userId, id, field(body, 'contract'));
  }

  /** `FR-EXP-072`. */
  @Get('experts/:id/contract-versions/compare')
  compare(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Query('from') from: unknown,
    @Query('to') to: unknown,
  ): Promise<unknown> {
    const { workspaceId, userId } = requireAuth(ctx);
    return this.registry.compare(workspaceId, userId, id, versionNumber(from, 'from'), versionNumber(to, 'to'));
  }

  /** `FR-EXP-005` — to `EPIC-031`. `503` naming `ContractApprovals` while it is unbound. */
  @Post('experts/:id/contract-versions/:version/submit')
  submit(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Param('version') version: string,
  ): Promise<unknown> {
    const { workspaceId, userId } = requireAuth(ctx);
    return this.registry.submit(workspaceId, userId, id, versionNumber(version, 'version'));
  }

  /** `FR-EXP-006` — idempotent; history is kept. */
  @Post('experts/:id/retire')
  retire(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<unknown> {
    const { workspaceId, userId } = requireAuth(ctx);
    return this.registry.retire(workspaceId, userId, id);
  }

  /**
   * `FR-EXP-012`…`FR-EXP-024`, `FR-EXP-060`…`FR-EXP-063` — the gate before a run.
   * The requester reads the registry; their own authority bounds the run.
   */
  @Post('experts/:id/dispatch')
  async dispatch(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const actor = requireAuth(ctx);
    await this.authoring.requireReader(actor.workspaceId, actor.userId);
    const request: DispatchRequest = {
      expertId: id,
      command: String(field(body, 'command') ?? ''),
      objective: String(field(body, 'objective') ?? ''),
      projectId: String(field(body, 'projectId') ?? ''),
      capabilities: list(body, 'capabilities') as string[],
      tools: list(body, 'tools') as string[],
      actions: list(body, 'actions') as string[],
      targets: list(body, 'targets') as DispatchRequest['targets'],
      unattended: field(body, 'unattended') === true,
      // Passed through whatever its shape: the service refuses a malformed one `400` (`T2015`).
      ...(field(body, 'limits') !== undefined && field(body, 'limits') !== null
        ? { limits: field(body, 'limits') as DispatchRequest['limits'] }
        : {}),
      ...(typeof field(body, 'delegatedFromExecutionId') === 'string'
        ? { delegatedFromExecutionId: field(body, 'delegatedFromExecutionId') as string }
        : {}),
    };
    return this.dispatcher.dispatch(actor, request);
  }

  /** `FR-EXP-073`, analysis finding C3 — recent runs, newest first. */
  @Get('experts/:id/sessions')
  async recent(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Query('limit') limit: unknown,
  ): Promise<unknown> {
    const { workspaceId, userId } = requireAuth(ctx);
    await this.authoring.requireReader(workspaceId, userId);
    const n = limit === undefined ? 20 : Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 100) throw new ValidationFailedError('limit must be between 1 and 100');
    return this.sessions.recent(workspaceId, id, n);
  }

  /** `FR-EXP-050`…`FR-EXP-055` — assigns; never dispatches (`FR-EXP-053`). */
  @Post('tasks/:taskId/assignment')
  assign(@Req() ctx: WorkspaceContext | undefined, @Param('taskId') taskId: string, @Body() body: unknown): Promise<unknown> {
    const { workspaceId, userId } = requireAuth(ctx);
    const input: AssignInput = {
      assigneeKind: field(body, 'assigneeKind') as AssignInput['assigneeKind'],
      assigneeId: String(field(body, 'assigneeId') ?? ''),
      ...(Array.isArray(field(body, 'capabilities')) ? { capabilities: field(body, 'capabilities') as string[] } : {}),
      ...(typeof field(body, 'riskClass') === 'string' ? { riskClass: field(body, 'riskClass') as AssignInput['riskClass'] } : {}),
    };
    return this.assignments.assign(workspaceId, userId, taskId, input);
  }

  /** `FR-EXP-055` — every assignment the task has had, current first. */
  @Get('tasks/:taskId/assignments')
  assignmentsOf(@Req() ctx: WorkspaceContext | undefined, @Param('taskId') taskId: string): Promise<unknown> {
    const { workspaceId, userId } = requireAuth(ctx);
    return this.assignments.history(workspaceId, userId, taskId);
  }
}
