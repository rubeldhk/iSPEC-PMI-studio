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

  /**
   * `EPIC-046` `T1789` (`BR-0003`) — may this reader write to the project?
   *
   * The same rule `requireOwner` enforces, asked as a question. A board that
   * shows a move control to someone who may not move teaches them their
   * permission by making them fail, which is what
   * `contracts/board-contract.md` §4 forbids.
   *
   * It does **not** throw and does **not** audit. `requireOwner` records a
   * refusal because a refusal happened; this is asked on every board load, and
   * one audit row per page view would bury the refusals that matter. A project
   * outside the workspace answers `false` rather than raising, so a permission
   * question cannot turn a board read into a `404`.
   */
  async mayMove(ctx: { workspaceId: string; userId: string }, projectId: string): Promise<boolean> {
    const project = await this.deps.projects.get(ctx.workspaceId, projectId).catch(() => null);
    if (!project) return false;
    if (project.ownerUserId === ctx.userId) return true;
    if (this.deps.grants === null) return false;
    const active = await this.deps.grants.activeGrants(ctx.workspaceId, { artifactType: 'project', artifactId: project.id });
    return active.some((g) => g.userId === ctx.userId && g.level === 'edit');
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
