/**
 * T055 — `/projects` per contracts/platform-api.md (Projects · US1).
 * T1350 (EPIC-041) — the provisioning routes, per
 * specs/041-local-project-workspace/contracts/provisioning-api.md.
 *
 * PC-1: this is a transport. It resolves the acting context, strips anything a
 * caller sent that could widen tenancy, and delegates. No business logic.
 */
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
// Value import: the class is the DI TOKEN. A `import type` here erases at
// compile time, and @Inject would reference nothing (DEF-001-005).
import { ProjectsService } from './projects.service.js';
import type { CreateProjectInput, ProjectRecord, UpdateProjectInput } from './projects.service.js';
import { ProvisioningService } from './provisioning.service.js';
import type { ProvisionRequest } from './provisioning.service.js';
import type { ProvisioningRecord } from './provisioning.types.js';

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

/** `GET /projects/:id` and the create/provision responses: the record plus its latest provisioning (FR-LPW-051). */
export interface ProjectView extends ProjectRecord {
  latestProvisioning: ProvisioningRecord | null;
}

export type CreateProjectBody = CreateProjectInput & Partial<ProvisionRequest>;

/** The subset of Express's response this controller sets. */
interface StatusSetter {
  status(code: number): unknown;
}

@Controller('projects')
export class ProjectsController {
  constructor(
    // @Inject by token, not by type: esbuild/tsx emits no design:paramtypes,
    // so a class-typed parameter resolves to UNDEFINED and the first call
    // throws. Guarded by controller-composition.spec.ts (DEF-001-005).
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(ProvisioningService) private readonly provisioner: ProvisioningService,
  ) {}

  @Get()
  async list(@Req() ctx: WorkspaceContext | undefined): Promise<ProjectRecord[]> {
    return this.projects.list(requireAuth(ctx).workspaceId);
  }

  /**
   * `201`. With a `rootPath` the root is checked BEFORE the row exists, so a
   * refused directory creates nothing; then the row; then provisioning
   * (contracts/provisioning-api.md).
   */
  @Post()
  async create(@Req() ctx: WorkspaceContext | undefined, @Body() body: CreateProjectBody): Promise<ProjectView> {
    const acting = requireAuth(ctx);
    const actingCtx = { workspaceId: acting.workspaceId, userId: acting.userId };
    const { rootPath, agentIntegration, scriptType, ...projectInput } = stripScope(body as Record<string, unknown>) as CreateProjectBody;

    if (rootPath === undefined) {
      const created = await this.projects.create(actingCtx, projectInput as CreateProjectInput);
      return { ...created, latestProvisioning: null };
    }

    const request: ProvisionRequest = {
      rootPath,
      ...(agentIntegration !== undefined ? { agentIntegration } : {}),
      ...(scriptType !== undefined ? { scriptType } : {}),
    };
    await this.provisioner.check(actingCtx, request);
    const created = await this.projects.create(actingCtx, projectInput as CreateProjectInput);
    const { project, record } = await this.provisioner.prepare(actingCtx, created.id, request);
    return { ...project, latestProvisioning: record };
  }

  @Get(':id')
  async get(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<ProjectView> {
    const acting = requireAuth(ctx);
    // The tenancy guard first, so a cross-workspace read is refused AND recorded.
    await this.projects.get(acting.workspaceId, id);
    // `FR-LPW-010` — the pending state is derived when read, from the ledger.
    const project = await this.provisioner.refresh(acting.workspaceId, id);
    const [latest] = await this.provisioner.history(acting.workspaceId, id);
    return { ...project, latestProvisioning: latest ?? null };
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
  async archive(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<ProjectRecord> {
    return this.projects.archive(requireAuth(ctx).workspaceId, id);
  }

  /**
   * `202` when a run happened (prepared, or resumed) — the initialise step is
   * asynchronous; `200` for a no-op, which is what makes `SC-LPW-004` visible
   * from the outside.
   */
  @Post(':id/provision')
  async provision(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: Partial<ProvisionRequest>,
    @Res({ passthrough: true }) res: StatusSetter,
  ): Promise<{ project: ProjectView; record: ProvisioningRecord }> {
    const acting = requireAuth(ctx);
    const safe = stripScope((body ?? {}) as Record<string, unknown>) as Partial<ProvisionRequest>;
    const { project, record } = await this.provisioner.prepare(
      { workspaceId: acting.workspaceId, userId: acting.userId },
      id,
      { rootPath: safe.rootPath ?? '', ...(safe.agentIntegration ? { agentIntegration: safe.agentIntegration } : {}), ...(safe.scriptType ? { scriptType: safe.scriptType } : {}) },
    );
    res.status(record.outcome === 'no_change' ? 200 : 202);
    return { project: { ...project, latestProvisioning: record }, record };
  }

  /** The append-only history, newest first (FR-LPW-004). */
  @Get(':id/provisioning')
  async provisioning(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<ProvisioningRecord[]> {
    return this.provisioner.history(requireAuth(ctx).workspaceId, id);
  }
}
