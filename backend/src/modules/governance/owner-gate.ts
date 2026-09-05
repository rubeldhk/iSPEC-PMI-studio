/**
 * EPIC-042 `T1488` (`contracts/governance-api.md` §1, §6) — who may write
 * constraints and the policy: the project's owner, or a holder of an `edit`
 * grant on the project (`EPIC-024`), the same rule `EPIC-041` applies to
 * minting a credential (`FR-LPW-027`). Anyone in the workspace may read.
 */
import { ForbiddenError, NotFoundError } from '../../core/errors.js';

export interface OwnerGateDeps {
  readonly projects: { get(workspaceId: string, id: string): Promise<{ id: string; ownerUserId: string }> };
  readonly grants: { activeGrants(workspaceId: string, artifact: { artifactType: string; artifactId: string }): Promise<{ userId: string; level: string }[]> } | null;
  readonly audit: { record(row: Record<string, unknown>): Promise<void> };
}

export class OwnerGate {
  constructor(private readonly deps: OwnerGateDeps) {}

  /** Throws the opaque 404 for a project outside the workspace, so nothing is revealed. */
  async requireMember(workspaceId: string, projectId: string): Promise<void> {
    const project = await this.deps.projects.get(workspaceId, projectId).catch(() => null);
    if (!project) throw new NotFoundError('The project does not exist.');
  }

  async requireOwner(ctx: { workspaceId: string; userId: string }, projectId: string, operation: string): Promise<void> {
    const project = await this.deps.projects.get(ctx.workspaceId, projectId).catch(() => null);
    if (!project) throw new NotFoundError('The project does not exist.');
    if (project.ownerUserId === ctx.userId) return;
    if (this.deps.grants !== null) {
      const active = await this.deps.grants.activeGrants(ctx.workspaceId, { artifactType: 'project', artifactId: project.id });
      if (active.some((g) => g.userId === ctx.userId && g.level === 'edit')) return;
    }
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: 'access_refused',
      targetType: 'project',
      targetId: project.id,
      outcome: 'refused',
      detail: { operation, reason: 'owner_grant_required', projectId: project.id },
    });
    throw new ForbiddenError(`Only the project's owner may ${operation}.`, { code: 'owner_grant_required' });
  }
}
