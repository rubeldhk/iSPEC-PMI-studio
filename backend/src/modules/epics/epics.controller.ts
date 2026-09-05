/**
 * `T1571` (EPIC-044, `contracts/epics-api.md` §1) — the session routes: Epics,
 * assignment, the two stage reads. Members read; the owner (or an `edit` grant
 * holder) writes. Every list, board and stage read first reconciles pending
 * decomposition decisions (`R-044-6`), so a first run's children appear on the
 * first read after the decision is recorded. PC-1: a transport over the two
 * services.
 */
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { UnauthenticatedError, ValidationFailedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import type { AssignableRequirement, AssignableSpecification } from './assignment.ports.js';
import { EpicStageService, type BoardRead, type EpicStage } from './epic-stage.service.js';
import { EpicService, type EpicDetail, type EpicList } from './epic.service.js';
import type { EpicRecord, EpicStatus } from './epic.store.js';

function requireAuth(ctx: WorkspaceContext | undefined | null): WorkspaceContext {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return ctx;
}

const STATUSES: readonly EpicStatus[] = ['active', 'split', 'closed'];

function statusFilter(status: string | undefined): { status?: EpicStatus } {
  if (status === undefined) return {};
  if (!(STATUSES as readonly string[]).includes(status)) throw new ValidationFailedError('Unknown status.', { fields: [{ field: 'status', message: `one of ${STATUSES.join(', ')}` }] });
  return { status: status as EpicStatus };
}

function epicIdBody(body: { epicId?: unknown } | undefined): string | null {
  const value = body?.epicId;
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length === 0) throw new ValidationFailedError('epicId must be an Epic id or null.', { fields: [{ field: 'epicId', message: 'an Epic id or null' }] });
  return value;
}

@Controller()
export class EpicsController {
  constructor(
    @Inject(EpicService) private readonly epics: EpicService,
    @Inject(EpicStageService) private readonly stages: EpicStageService,
  ) {}

  @Get('projects/:id/epics')
  async list(@Req() raw: WorkspaceContext | undefined, @Param('id') id: string, @Query('status') status: string | undefined): Promise<EpicList> {
    const ctx = { ...requireAuth(raw), projectId: id };
    await this.epics.reconcileDecisions(ctx);
    return this.epics.list(ctx, statusFilter(status));
  }

  @Post('projects/:id/epics')
  async create(@Req() raw: WorkspaceContext | undefined, @Param('id') id: string, @Body() body: { title?: unknown; description?: unknown } | undefined): Promise<EpicRecord> {
    const ctx = { ...requireAuth(raw), projectId: id };
    return this.epics.create(ctx, { title: body?.title as string, ...(typeof body?.description === 'string' ? { description: body.description } : {}) });
  }

  @Get('projects/:id/epics/stages')
  async board(@Req() raw: WorkspaceContext | undefined, @Param('id') id: string): Promise<BoardRead> {
    const ctx = { ...requireAuth(raw), projectId: id };
    await this.epics.reconcileDecisions(ctx);
    await this.epics.deps.gate.requireMember(ctx.workspaceId, ctx.projectId);
    return this.stages.board(ctx);
  }

  @Get('epics/:eid')
  async get(@Req() raw: WorkspaceContext | undefined, @Param('eid') eid: string, @Query('projectId') projectId?: string): Promise<EpicDetail> {
    const auth = requireAuth(raw);
    const epic = await this.epics.locate(auth.workspaceId, eid);
    const ctx = { ...auth, projectId: projectId ?? epic.projectId };
    await this.epics.reconcileDecisions(ctx);
    return this.epics.get(ctx, eid);
  }

  @Patch('epics/:eid')
  async edit(@Req() raw: WorkspaceContext | undefined, @Param('eid') eid: string, @Body() body: { title?: unknown; description?: unknown } | undefined): Promise<EpicRecord> {
    const auth = requireAuth(raw);
    const epic = await this.epics.locate(auth.workspaceId, eid);
    return this.epics.edit({ ...auth, projectId: epic.projectId }, eid, {
      ...(body?.title !== undefined ? { title: body.title as string } : {}),
      ...(typeof body?.description === 'string' ? { description: body.description } : {}),
    });
  }

  @Post('epics/:eid/close')
  @HttpCode(200)
  async close(@Req() raw: WorkspaceContext | undefined, @Param('eid') eid: string): Promise<EpicRecord> {
    const auth = requireAuth(raw);
    const epic = await this.epics.locate(auth.workspaceId, eid);
    return this.epics.close({ ...auth, projectId: epic.projectId }, eid);
  }

  @Get('epics/:eid/stage')
  async stage(@Req() raw: WorkspaceContext | undefined, @Param('eid') eid: string): Promise<EpicStage> {
    const auth = requireAuth(raw);
    const epic = await this.epics.locate(auth.workspaceId, eid);
    const ctx = { ...auth, projectId: epic.projectId };
    await this.epics.reconcileDecisions(ctx);
    return this.stages.stage(ctx, eid);
  }

  @Put('requirements/:rid/epic')
  async assignRequirement(@Req() raw: WorkspaceContext | undefined, @Param('rid') rid: string, @Body() body: { epicId?: unknown } | undefined): Promise<AssignableRequirement> {
    const auth = requireAuth(raw);
    const requirement = await this.epics.deps.requirements.find(auth.workspaceId, rid);
    const projectId = requirement?.projectId ?? '';
    return this.epics.assignRequirement({ ...auth, projectId }, rid, epicIdBody(body));
  }

  @Put('specifications/:sid/epic')
  async assignSpecification(@Req() raw: WorkspaceContext | undefined, @Param('sid') sid: string, @Body() body: { epicId?: unknown } | undefined): Promise<AssignableSpecification> {
    const auth = requireAuth(raw);
    const specification = await this.epics.deps.specifications.find(auth.workspaceId, sid);
    const projectId = specification?.projectId ?? '';
    return this.epics.assignSpecification({ ...auth, projectId }, sid, epicIdBody(body));
  }
}
