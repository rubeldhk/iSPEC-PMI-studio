/**
 * `T1445` (EPIC-043, `FR-PIC-040`–`FR-PIC-043`, `R-043-9`) — the reads a local
 * agent needs to begin, for the credential's project only.
 *
 * The Epic list is **derived from nothing** today: `Requirement` has no
 * grouping field until `EPIC-044` adds `epicId`, so the honest answer is an
 * empty list whose source is stated in the response. `EPIC-044` replaces the
 * source without changing the shape. The same posture for `baselineState`:
 * baselines are specification-level (`EPIC-020`), and no link to a requirement
 * exists, so the field is present and null, with its source stated.
 *
 * Every read is audited naming the connector principal, the project and the
 * operation (`FR-PIC-036`, analysis `C3`).
 */
import { ValidationFailedError } from '../../core/errors.js';

export interface ConnectorReadContext {
  readonly credentialId: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly principalId: string;
}

export interface ProjectContextView {
  readonly projectId: string;
  readonly name: string;
  readonly agentIntegration: string | null;
  readonly scriptType: string | null;
  readonly provisioningState: string;
  readonly rootPath: string | null;
  readonly extensionVersion: string;
  readonly contractVersion: string;
  readonly platformUrl: string;
  readonly epics: { number: number; slug: string; name: string }[];
  readonly epicSource: 'unavailable-until-EPIC-044';
}

export interface RequirementsByEpicView {
  readonly groups: {
    readonly epic: { number: number; slug: string; name: string } | 'unassigned';
    readonly requirements: { id: string; reference: string; description: string; type: string; priority: string; status: string; baselineState: string | null }[];
  }[];
  readonly epicSource: 'unavailable-until-EPIC-044';
  readonly baselineSource: 'unavailable-until-requirements-link-to-baselines';
}

export interface ProjectContextDeps {
  readonly projects: { get(workspaceId: string, id: string): Promise<{ id: string; name: string; agentIntegration: string | null; scriptType: string | null; provisioningState: string; rootPath: string | null }> };
  readonly requirements: {
    list(workspaceId: string, projectId: string, filters: Record<string, unknown>): Promise<{ id: string; reference: string; description: string; type: string; priority: string; status: string }[]>;
  };
  readonly bundleVersion: string;
  readonly contractVersion: string;
  readonly publicUrl: string;
  readonly audit: { record(row: Record<string, unknown>): Promise<void> };
}

export class ProjectContextService {
  constructor(private readonly deps: ProjectContextDeps) {}

  async context(ctx: ConnectorReadContext): Promise<ProjectContextView> {
    const project = await this.deps.projects.get(ctx.workspaceId, ctx.projectId);
    await this.audited(ctx, 'project.context');
    return {
      projectId: project.id,
      name: project.name,
      agentIntegration: project.agentIntegration,
      scriptType: project.scriptType,
      provisioningState: project.provisioningState,
      rootPath: project.rootPath,
      extensionVersion: this.deps.bundleVersion,
      contractVersion: this.deps.contractVersion,
      platformUrl: this.deps.publicUrl,
      epics: [],
      epicSource: 'unavailable-until-EPIC-044',
    };
  }

  async requirementsByEpic(ctx: ConnectorReadContext, groupBy: string | undefined): Promise<RequirementsByEpicView> {
    if (groupBy !== 'epic') {
      throw new ValidationFailedError('Requirements can be grouped by "epic" only.', { fields: { groupBy: 'epic' } });
    }
    await this.deps.projects.get(ctx.workspaceId, ctx.projectId);
    const rows = await this.deps.requirements.list(ctx.workspaceId, ctx.projectId, {});
    await this.audited(ctx, 'requirements.list');
    return {
      groups: [
        {
          epic: 'unassigned',
          requirements: rows
            .filter((r) => r.status !== 'retired')
            .map((r) => ({ id: r.id, reference: r.reference, description: r.description, type: r.type, priority: r.priority, status: r.status, baselineState: null })),
        },
      ],
      epicSource: 'unavailable-until-EPIC-044',
      baselineSource: 'unavailable-until-requirements-link-to-baselines',
    };
  }

  private async audited(ctx: ConnectorReadContext, operation: string): Promise<void> {
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.principalId,
      action: 'update',
      targetType: 'project',
      targetId: ctx.projectId,
      outcome: 'success',
      detail: { kind: 'connector', operation, projectId: ctx.projectId, credentialId: ctx.credentialId },
    });
  }
}
