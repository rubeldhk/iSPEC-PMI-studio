/**
 * `T1486` (EPIC-042, `FR-EXT-041`, `FR-EXT-046`–`FR-EXT-048`, `R-042-7`,
 * `R-042-8`, data-model.md §9) — the decomposition plan for a first run: a
 * projection over `EPIC-043`'s project reads and the stored policy. First-run
 * state is a platform fact — no completed `specify` execution for the project —
 * and the marker on disk is only what lets the hook act (`R-042-8`).
 */
import type { ConnectorReadContext, ProjectContextService } from '../connector/project-context.service.js';
import type { DecompositionPolicyService } from './decomposition-policy.service.js';

export interface PlanRequirement {
  readonly id: string;
  readonly reference: string;
  readonly description: string;
  readonly type: string;
  readonly priority: string;
  readonly status: string;
  readonly baselineState: string | null;
}

export interface PlanEpic {
  readonly number: number;
  readonly slug: string;
  readonly name: string;
  readonly requirements: PlanRequirement[];
}

export interface DecompositionPlan {
  readonly firstRun: boolean;
  readonly nothingToDecompose: boolean;
  readonly policy: { oneSpecPerEpic: boolean; taskCeiling: number; splitRequiresConfirmation: boolean; offlineMode: string; version: number };
  readonly epics: PlanEpic[];
  readonly unassigned: PlanRequirement[];
  readonly epicSource: string;
}

export interface DecompositionPlanDeps {
  readonly context: Pick<ProjectContextService, 'context' | 'requirementsByEpic'>;
  readonly policy: Pick<DecompositionPolicyService, 'get'>;
  readonly executions: { hasCompletedCommand(workspaceId: string, projectId: string, command: string): Promise<boolean> };
  readonly audit: { record(row: Record<string, unknown>): Promise<void> };
}

/** A requirement a first run may decompose: not a draft, not retired, not rejected. */
const EXCLUDED_STATUSES = new Set(['draft', 'retired', 'rejected', 'superseded']);

export class DecompositionPlanService {
  constructor(private readonly deps: DecompositionPlanDeps) {}

  async plan(ctx: ConnectorReadContext): Promise<DecompositionPlan> {
    await this.deps.context.context(ctx);
    const grouped = await this.deps.context.requirementsByEpic(ctx, 'epic');
    const decomposable = (rows: PlanRequirement[]): PlanRequirement[] => rows.filter((r) => !EXCLUDED_STATUSES.has(r.status));
    const epics: PlanEpic[] = [];
    let unassigned: PlanRequirement[] = [];
    for (const group of grouped.groups) {
      const rows = decomposable(group.requirements as PlanRequirement[]);
      if (group.epic === 'unassigned') unassigned = [...unassigned, ...rows];
      else epics.push({ number: group.epic.number, slug: group.epic.slug, name: group.epic.name, requirements: rows });
    }
    const [policy, completedSpecify] = await Promise.all([
      this.deps.policy.get({ workspaceId: ctx.workspaceId, projectId: ctx.projectId }),
      this.deps.executions.hasCompletedCommand(ctx.workspaceId, ctx.projectId, 'specify'),
    ]);
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.principalId,
      action: 'update',
      targetType: 'project',
      targetId: ctx.projectId,
      outcome: 'success',
      detail: { kind: 'connector', operation: 'decomposition.read', projectId: ctx.projectId, credentialId: ctx.credentialId },
    });
    return {
      firstRun: !completedSpecify,
      nothingToDecompose: epics.length === 0 && unassigned.length === 0,
      policy: {
        oneSpecPerEpic: policy.oneSpecPerEpic,
        taskCeiling: policy.taskCeiling,
        splitRequiresConfirmation: policy.splitRequiresConfirmation,
        offlineMode: policy.offlineMode,
        version: policy.version,
      },
      epics,
      unassigned,
      epicSource: grouped.epicSource,
    };
  }
}
