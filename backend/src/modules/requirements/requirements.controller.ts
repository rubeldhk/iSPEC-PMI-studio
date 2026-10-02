/**
 * T070 — `/projects/{id}/requirements` and `/requirements/*` per
 * contracts/platform-api.md (Requirements · US2).
 *
 * PC-1: a transport. Collection routes are project-nested; item routes are
 * flat — exactly the contract's two tables, one controller.
 */
import { Body, Controller, Get, HttpCode, Inject, Optional, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { ConnectorAuthGuard, type ConnectorRequest } from '../connector/connector-auth.guard.js';
import { ConnectorReadsController } from '../connector/connector-reads.controller.js';
import type { EpicStore } from '../epics/epic.store.js';
import { EPIC_STORE } from '../epics/epics.tokens.js';

/** EPIC-044 `T1573` (`FR-EPB-023`): a requirement row names its Epic, or null for *unassigned*. */
export type RequirementListRow = RequirementRecord & { epicId: string | null; epicNumber: number | null; epicTitle: string | null };

/** `DEF-044-001`: a bearer credential on the requirements path is the connector's read, not a session. */
function bearer(req: { headers?: Record<string, string | string[] | undefined> } | undefined): boolean {
  const header = req?.headers?.['authorization'];
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === 'string' && /^Bearer\s+\S+/i.test(value);
}
// Value import: the class is the DI TOKEN. A `import type` here erases at
// compile time, and @Inject would reference nothing (DEF-001-005).
import { RequirementRetireService } from './requirement-retire.service.js';
import type { RequirementVersionRecord } from './requirement-version.service.js';
import { RequirementsService } from './requirements.service.js';
import type { RequirementRecord } from './requirements.service.js';
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
    // @Inject by token, not by type: esbuild/tsx emits no design:paramtypes,
    // so a class-typed parameter resolves to UNDEFINED and the first call
    // throws. Guarded by controller-composition.spec.ts (DEF-001-005).
    @Inject(RequirementsService) private readonly requirements: RequirementsService,
    @Inject(RequirementRetireService) private readonly retirer: RequirementRetireService,
    // EPIC-044 T1573 (FR-EPB-023): rows name their Epic. Optional so the tests that
    // build this controller by hand, and a deployment without the store, still work.
    @Optional() @Inject(EPIC_STORE) private readonly epics?: EpicStore,
    // DEF-044-001: the connector's read shares this path (`pmi.requirements.list` →
    // `GET /v1/projects/me/requirements?groupBy=epic`). Resolved at request time
    // through ModuleRef so RequirementsModule keeps its one-way dependency.
    @Optional() @Inject(ModuleRef) private readonly moduleRef?: ModuleRef,
  ) {}

  @Get('projects/:projectId/requirements')
  async list(
    @Req() ctx: (WorkspaceContext & Partial<ConnectorRequest>) | undefined,
    @Param('projectId') projectId: string,
    @Query() filters: ListFilters & { groupBy?: string },
  ): Promise<RequirementListRow[]> {
    if (bearer(ctx) && this.moduleRef) {
      // One route, two callers (the `R-042-10` pattern): run the connector's guard
      // for its scope, then answer with the connector's own handler.
      const guard = this.moduleRef.get(ConnectorAuthGuard, { strict: false });
      const reads = this.moduleRef.get(ConnectorReadsController, { strict: false });
      await guard.authenticate(ctx as ConnectorRequest, 'requirements.read');
      // The connector's grouped view is a different shape on the same path; the
      // declared type stays the session's (the contract test indexes rows), and
      // the bearer caller reads the connector's contract.
      return (await reads.requirements(ctx as ConnectorRequest, filters.groupBy)) as unknown as RequirementListRow[];
    }
    const { workspaceId } = requireAuth(ctx);
    const rows = await this.requirements.list(workspaceId, projectId, filters);
    const epics = this.epics ? await this.epics.list(workspaceId, projectId) : [];
    const byId = new Map(epics.map((e) => [e.id, e]));
    return rows.map((r) => {
      const epic = r.epicId ? byId.get(r.epicId) : undefined;
      return { ...r, epicId: r.epicId ?? null, epicNumber: epic?.number ?? null, epicTitle: epic?.title ?? null };
    });
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
