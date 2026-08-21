/**
 * T238 — the /steering endpoints. PC-1: a transport.
 */
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';

export interface SteeringDocumentBody {
  id: string;
  subject: string;
  scope: { scopeType: string; scopeRef: string };
  content: string;
  version: number;
  status: string;
}

export interface CreateSteeringBody {
  subject: string;
  scopeType: string;
  scopeRef: string;
  content: string;
}

/** The service surface the controller needs — one token, mocked in T237. */
export interface SteeringApi {
  create(
    ctx: { workspaceId: string; userId: string },
    input: CreateSteeringBody,
  ): Promise<SteeringDocumentBody>;
  list(workspaceId: string): Promise<SteeringDocumentBody[]>;
  get(workspaceId: string, id: string): Promise<SteeringDocumentBody>;
  edit(workspaceId: string, id: string, content: string, userId: string): Promise<SteeringDocumentBody>;
  retire(workspaceId: string, id: string, userId: string): Promise<SteeringDocumentBody>;
  history(workspaceId: string, id: string): Promise<SteeringDocumentBody[]>;
}

export const STEERING_API = Symbol('STEERING_API');

function requireAuth(ctx: WorkspaceContext | undefined | null): WorkspaceContext {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return ctx;
}

@Controller()
export class SteeringController {
  constructor(
    // @Inject by token: esbuild/tsx emits no design:paramtypes (DEF-001-005).
    @Inject(STEERING_API) private readonly steering: SteeringApi,
  ) {}

  @Post('steering')
  @HttpCode(201)
  async create(
    @Req() ctx: WorkspaceContext | undefined,
    @Body() body: CreateSteeringBody,
  ): Promise<SteeringDocumentBody> {
    const acting = requireAuth(ctx);
    return this.steering.create({ workspaceId: acting.workspaceId, userId: acting.userId }, body);
  }

  @Get('steering')
  async list(@Req() ctx: WorkspaceContext | undefined): Promise<SteeringDocumentBody[]> {
    return this.steering.list(requireAuth(ctx).workspaceId);
  }

  @Get('steering/:id')
  async get(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<SteeringDocumentBody> {
    return this.steering.get(requireAuth(ctx).workspaceId, id);
  }

  @Patch('steering/:id')
  async edit(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: { content?: string },
  ): Promise<SteeringDocumentBody> {
    const acting = requireAuth(ctx);
    return this.steering.edit(acting.workspaceId, id, body.content ?? '', acting.userId);
  }

  @Post('steering/:id/retire')
  async retire(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<SteeringDocumentBody> {
    const acting = requireAuth(ctx);
    return this.steering.retire(acting.workspaceId, id, acting.userId);
  }

  @Get('steering/:id/versions')
  async history(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<SteeringDocumentBody[]> {
    return this.steering.history(requireAuth(ctx).workspaceId, id);
  }
}
