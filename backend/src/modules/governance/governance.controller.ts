/**
 * `T1488` (EPIC-042, `contracts/governance-api.md` §1) — the session routes the
 * Constraints screen calls: entries, the policy, the current render. Members
 * read; the owner (or an `edit` grant holder) writes. PC-1: a transport over
 * the three services and the owner gate.
 */
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { UnauthenticatedError, ValidationFailedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { ConnectorAuthGuard, type ConnectorRequest } from '../connector/connector-auth.guard.js';
import { ConstitutionRenderService } from './constitution-render.service.js';
import { connectorConstitution, type ConnectorConstitutionView, type ConnectorReadAudit } from './governance-connector.controller.js';
import type { ConstitutionRenderRecord } from './constitution-render.store.js';
import { DecompositionPolicyService } from './decomposition-policy.service.js';
import type { DecompositionPolicyRecord } from './decomposition-policy.store.js';
import { OwnerGate } from './owner-gate.js';
import { ProjectConstraintService } from './project-constraint.service.js';
import type { ConstraintKind, ConstraintStatus, ProjectConstraintRecord } from './project-constraint.store.js';

function requireAuth(ctx: WorkspaceContext | undefined | null): WorkspaceContext {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return ctx;
}

export interface PolicyView {
  readonly oneSpecPerEpic: boolean;
  readonly taskCeiling: number;
  readonly splitRequiresConfirmation: boolean;
  readonly offlineMode: string;
  readonly version: number;
}

export interface ConstitutionView {
  readonly version: number;
  readonly digest: string;
  readonly renderedAt: string;
  readonly content: string;
  readonly inputs: Record<string, unknown>;
}

export function policyView(row: DecompositionPolicyRecord): PolicyView {
  return { oneSpecPerEpic: row.oneSpecPerEpic, taskCeiling: row.taskCeiling, splitRequiresConfirmation: row.splitRequiresConfirmation, offlineMode: row.offlineMode, version: row.version };
}

export function constitutionView(row: ConstitutionRenderRecord): ConstitutionView {
  return { version: row.version, digest: row.digest, renderedAt: row.renderedAt.toISOString(), content: row.content, inputs: row.inputs };
}

@Controller('projects')
export class GovernanceController {
  constructor(
    @Inject(ProjectConstraintService) private readonly constraints: ProjectConstraintService,
    @Inject(DecompositionPolicyService) private readonly policy: DecompositionPolicyService,
    @Inject(ConstitutionRenderService) private readonly renders: ConstitutionRenderService,
    @Inject(OwnerGate) private readonly gate: OwnerGate,
    @Inject(ConnectorAuthGuard) private readonly guard: ConnectorAuthGuard,
    @Inject('GOVERNANCE_CONNECTOR_AUDIT') private readonly connectorAudit: ConnectorReadAudit,
  ) {}

  @Get(':id/constraints')
  async list(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string, @Query('kind') kind?: string, @Query('status') status?: string): Promise<ProjectConstraintRecord[]> {
    const auth = requireAuth(ctx);
    await this.gate.requireMember(auth.workspaceId, id);
    if (kind !== undefined && !['principle', 'constraint', 'non_goal'].includes(kind)) {
      throw new ValidationFailedError('Unknown kind.', { fields: [{ field: 'kind', message: 'principle, constraint or non_goal' }] });
    }
    if (status !== undefined && !['active', 'retired'].includes(status)) {
      throw new ValidationFailedError('Unknown status.', { fields: [{ field: 'status', message: 'active or retired' }] });
    }
    return this.constraints.list({ workspaceId: auth.workspaceId, projectId: id }, { ...(kind !== undefined ? { kind: kind as ConstraintKind } : {}), ...(status !== undefined ? { status: status as ConstraintStatus } : {}) });
  }

  @Post(':id/constraints')
  async create(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string, @Body() body: Record<string, unknown> | undefined): Promise<ProjectConstraintRecord> {
    const auth = requireAuth(ctx);
    await this.gate.requireOwner(auth, id, 'create a constraint');
    const b = body ?? {};
    const row = await this.constraints.create({ ...auth, projectId: id }, { kind: b['kind'] as ConstraintKind, title: b['title'] as string, body: (b['body'] as string) ?? '', ...(typeof b['order'] === 'number' ? { order: b['order'] } : {}) });
    await this.rerender(auth, id);
    return row;
  }

  @Patch(':id/constraints/:cid')
  async edit(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string, @Param('cid') cid: string, @Body() body: Record<string, unknown> | undefined): Promise<ProjectConstraintRecord> {
    const auth = requireAuth(ctx);
    await this.gate.requireOwner(auth, id, 'edit a constraint');
    const b = body ?? {};
    const row = await this.constraints.edit({ ...auth, projectId: id }, cid, {
      ...(b['title'] !== undefined ? { title: b['title'] as string } : {}),
      ...(b['body'] !== undefined ? { body: b['body'] as string } : {}),
      ...(b['order'] !== undefined ? { order: b['order'] as number } : {}),
    });
    await this.rerender(auth, id);
    return row;
  }

  @Post(':id/constraints/:cid/retire')
  @HttpCode(200)
  async retire(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string, @Param('cid') cid: string): Promise<ProjectConstraintRecord> {
    const auth = requireAuth(ctx);
    await this.gate.requireOwner(auth, id, 'retire a constraint');
    const row = await this.constraints.retire({ ...auth, projectId: id }, cid);
    await this.rerender(auth, id);
    return row;
  }

  @Get(':id/policy')
  async getPolicy(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<PolicyView> {
    const auth = requireAuth(ctx);
    await this.gate.requireMember(auth.workspaceId, id);
    return policyView(await this.policy.get({ workspaceId: auth.workspaceId, projectId: id }));
  }

  @Put(':id/policy')
  async putPolicy(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string, @Body() body: Record<string, unknown> | undefined): Promise<PolicyView> {
    const auth = requireAuth(ctx);
    await this.gate.requireOwner(auth, id, 'change the policy');
    const row = await this.policy.put({ ...auth, projectId: id }, body ?? {});
    await this.rerender(auth, id);
    return policyView(row);
  }

  /**
   * Every write re-renders (FR-EXT-024, R-042-5): the latest render is what a
   * workstation's digest is classified against on pmi.health, so a change an
   * owner made must exist as a render before the next report, not on the next
   * read of the screen.
   */
  private async rerender(auth: WorkspaceContext, projectId: string): Promise<void> {
    await this.renders.current({ workspaceId: auth.workspaceId, projectId, userId: auth.userId });
  }

  /**
   * One path, two callers: a session (the screen) and a connector credential
   * (`pmi.constitution.get`, `me`). A bearer header selects the connector
   * path, which runs the guard for `constitution.read` first (`R-042-10`).
   */
  @Get(':id/constitution')
  async constitution(
    @Req() req: (WorkspaceContext & ConnectorRequest) | undefined,
    @Param('id') id: string,
    @Query('onDiskDigest') onDiskDigest?: string,
  ): Promise<ConstitutionView | ConnectorConstitutionView> {
    if (bearer(req)) {
      // The guard checks `params.projectId` (`me` or the credential's own project); this route names it `id`.
      const connectorReq = req as ConnectorRequest & { params: Record<string, string> };
      connectorReq.params = { ...(connectorReq.params ?? {}), projectId: id };
      await this.guard.authenticate(connectorReq, 'constitution.read');
      return connectorConstitution({ renders: this.renders, audit: this.connectorAudit }, req as ConnectorRequest, onDiskDigest);
    }
    const auth = requireAuth(req);
    await this.gate.requireMember(auth.workspaceId, id);
    return constitutionView(await this.renders.current({ workspaceId: auth.workspaceId, projectId: id, userId: auth.userId }));
  }
}

function bearer(req: { headers?: Record<string, string | string[] | undefined> } | undefined): boolean {
  const header = req?.headers?.['authorization'];
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === 'string' && /^Bearer\s+\S+/i.test(value);
}
