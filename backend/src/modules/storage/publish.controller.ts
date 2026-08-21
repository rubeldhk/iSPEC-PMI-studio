/**
 * T426 — `/projects/{id}/publishes` per `platform-api-epic-002.md`
 * (Publishing · FR-PUB-032 to FR-PUB-036, FR-PUB-040). Closes gap G-02.4.
 *
 * 202 for publish — asynchronous, like generation. The POST body is
 * deliberately EMPTY: FR-PUB-032 narrows publishing to the whole project,
 * so there is no artifact-subset parameter to accept, and one arriving is
 * ignored because nothing reads it. The preview is computed BEFORE any
 * write; a second concurrent publish is 409 — prevented, not queued.
 */
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { PublishService } from './publish.service.js';
import type { PublishRecordRow } from './publish.service.js';
import { RepublishService } from './republish.service.js';
import type { RepublishPreview } from './republish.service.js';

function requireAuth(ctx: WorkspaceContext | undefined | null): WorkspaceContext {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return ctx;
}

/** The record as the contract shows it — the failure carries its taxonomy reason. */
export interface PublishBody {
  id: string;
  projectId: string;
  connectionId: string;
  initiatedById: string;
  state: string;
  failureReason: string | null;
  failureMessage: string | null;
  artifactsIncluded: PublishRecordRow['artifactsIncluded'];
  artifactsExcluded: PublishRecordRow['artifactsExcluded'];
  destinationLocations: string[];
  publishedAt: Date;
}

export function toPublishBody(record: PublishRecordRow): PublishBody {
  return {
    id: record.id,
    projectId: record.projectId,
    connectionId: record.connectionId,
    initiatedById: record.initiatedById,
    state: record.state,
    failureReason: record.failureReason,
    failureMessage: record.failureMessage,
    artifactsIncluded: record.artifactsIncluded,
    artifactsExcluded: record.artifactsExcluded,
    destinationLocations: record.destinationLocations,
    publishedAt: record.publishedAt,
  };
}

@Controller()
export class PublishController {
  constructor(
    @Inject(PublishService) private readonly publishes: PublishService,
    @Inject(RepublishService) private readonly republish: RepublishService,
  ) {}

  /** 202 — asynchronous, like generation. No artifact-subset parameter. */
  @Post('projects/:projectId/publishes')
  @HttpCode(202)
  async publish(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('projectId') projectId: string,
    @Body() _body: unknown,
  ): Promise<PublishBody> {
    const session = requireAuth(ctx);
    const record = await this.publishes.publish(session.workspaceId, projectId, session.userId);
    return toPublishBody(record);
  }

  /** History, retained across provider switches (FR-PUB-038, SC-010). */
  @Get('projects/:projectId/publishes')
  async list(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('projectId') projectId: string,
  ): Promise<PublishBody[]> {
    const session = requireAuth(ctx);
    const rows = await this.publishes.listRecords(session.workspaceId, projectId);
    return rows.map(toPublishBody);
  }

  /** FR-PUB-036 — added / replaced / unchanged, computed before any write. */
  @Get('projects/:projectId/publishes/preview')
  async preview(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('projectId') projectId: string,
  ): Promise<RepublishPreview> {
    const session = requireAuth(ctx);
    return this.republish.preview(session.workspaceId, projectId);
  }

  /** Included, excluded-with-reason, destinations (FR-PUB-033, FR-PUB-034). */
  @Get('publishes/:id')
  async get(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<PublishBody> {
    const session = requireAuth(ctx);
    return toPublishBody(await this.publishes.getRecord(session.workspaceId, id));
  }
}
