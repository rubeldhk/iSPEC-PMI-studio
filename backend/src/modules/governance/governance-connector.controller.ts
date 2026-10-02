/**
 * `T1488`, `T1493` (EPIC-042, `contracts/governance-api.md` §2, `FR-EXT-060`,
 * `FR-EXT-061`, `FR-EXT-064`) — the two reads a connector credential opens:
 * the rendered constitution (with the on-disk digest classified) and the
 * decomposition plan. `{projectId}` MUST be the credential's project — the
 * guard answers `404` for any other and accepts `me` as its alias.
 */
import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import { InvalidConnectorCredentialError } from '../../core/errors.js';
import { ConnectorAuthGuard, type ConnectorRequestContext } from '../connector/connector-auth.guard.js';
import { ConnectorScope } from '../connector/connector-scope.js';
import type { ConnectorReadContext } from '../connector/project-context.service.js';
import { ConstitutionRenderService, type ConstitutionState } from './constitution-render.service.js';
import { DecompositionPlanService, type DecompositionPlan } from './decomposition-plan.service.js';

function readContext(req: { connector?: ConnectorRequestContext }): ConnectorReadContext {
  if (!req.connector) throw new InvalidConnectorCredentialError();
  return {
    credentialId: req.connector.credentialId,
    workspaceId: req.connector.workspaceId,
    projectId: req.connector.projectId,
    principalId: req.connector.principal.principalId,
  };
}

export interface ConnectorConstitutionView {
  readonly version: number;
  readonly digest: string;
  readonly renderedAt: string;
  readonly content: string;
  readonly state: ConstitutionState;
}

export interface ConnectorReadAudit {
  record(row: Record<string, unknown>): Promise<void>;
}

/**
 * The connector's constitution read (`FR-EXT-060`). Not a route of its own:
 * `GET /v1/projects/{id}/constitution` is one path with two callers — a session
 * (the screen) and a credential (the server, `me`) — and a second controller on
 * the same path would shadow the first. `GovernanceController.constitution`
 * dispatches on the bearer header and runs the guard for `constitution.read`
 * before calling this (`R-042-10`).
 */
export async function connectorConstitution(
  deps: { renders: ConstitutionRenderService; audit: ConnectorReadAudit },
  req: { connector?: ConnectorRequestContext },
  onDiskDigest: string | undefined,
): Promise<ConnectorConstitutionView> {
  const ctx = readContext(req);
  const row = await deps.renders.current({ workspaceId: ctx.workspaceId, projectId: ctx.projectId, actorId: ctx.principalId });
  const state: ConstitutionState = onDiskDigest === undefined ? 'current' : await deps.renders.classify(ctx, onDiskDigest === '' ? null : onDiskDigest);
  await deps.audit.record({
    workspaceId: ctx.workspaceId,
    actorId: ctx.principalId,
    action: 'update',
    targetType: 'project',
    targetId: ctx.projectId,
    outcome: 'success',
    detail: { kind: 'connector', operation: 'constitution.read', projectId: ctx.projectId, credentialId: ctx.credentialId, version: row.version, state },
  });
  return { version: row.version, digest: row.digest, renderedAt: row.renderedAt.toISOString(), content: row.content, state };
}

@Controller('projects')
@UseGuards(ConnectorAuthGuard)
export class GovernanceConnectorController {
  constructor(@Inject(DecompositionPlanService) private readonly plans: DecompositionPlanService) {}

  @Get(':projectId/decomposition')
  @ConnectorScope('decomposition.read')
  async decomposition(@Req() req: { connector?: ConnectorRequestContext }): Promise<DecompositionPlan> {
    return this.plans.plan(readContext(req));
  }
}
