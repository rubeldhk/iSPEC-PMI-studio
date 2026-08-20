/**
 * T102 — task status updates and project progress aggregation (US4).
 *
 * Three states, any order, no transition guard — deliberately (spec
 * Assumptions: richer workflow states arrive with the Phase 2 workflow
 * engine). Reopening a done task is legitimate today.
 *
 * Progress aggregates across every specification of the project; the
 * specification ids come through a narrow port, the same shape coverage uses
 * (EPIC-011), so no module dependency grows here.
 *
 * Framework-free (PC-1). Wired in `tasks.module.ts`.
 */
import { ValidationFailedError } from '../../core/errors.js';
import { assertSameWorkspace, type RefusalRecord } from '../../core/workspace.guard.js';
import type { TaskRecord, TaskStatus, TaskStore } from './generate-tasks.service.js';

export const TASK_STATUSES = ['not_started', 'in_progress', 'done'] as const;

export interface SpecificationIdSource {
  listSpecificationIds(workspaceId: string, projectId: string): Promise<string[]>;
}

export interface ProjectProgress {
  total: number;
  done: number;
  inProgress: number;
  notStarted: number;
  /** Whole percent of done tasks; 0 for an empty project, never NaN. */
  percentComplete: number;
}

export interface TasksServiceOptions {
  onRefused?: (record: RefusalRecord) => void;
}

export class TasksService {
  private readonly onRefused: ((record: RefusalRecord) => void) | undefined;

  constructor(
    private readonly store: TaskStore,
    private readonly specifications: SpecificationIdSource,
    options: TasksServiceOptions = {},
  ) {
    this.onRefused = options.onRefused;
  }

  async listForSpecification(workspaceId: string, specificationId: string): Promise<TaskRecord[]> {
    return this.store.listForSpecification(workspaceId, specificationId);
  }

  async updateStatus(workspaceId: string, id: string, status: TaskStatus): Promise<TaskRecord> {
    if (!(TASK_STATUSES as readonly string[]).includes(status)) {
      throw new ValidationFailedError('Task cannot be saved.', {
        fields: [{ field: 'status', reason: `must be one of: ${TASK_STATUSES.join(', ')}` }],
      });
    }
    // The tenancy guard (T016, per EPIC-004 convergence F2).
    const existing = await this.store.findById(id);
    assertSameWorkspace(workspaceId, existing, {
      targetType: 'task',
      ...(this.onRefused ? { onRefused: this.onRefused } : {}),
    });
    return this.store.updateStatus(workspaceId, id, status);
  }

  /** US4 scenario 3 — aggregate progress across the project. */
  async progressForProject(workspaceId: string, projectId: string): Promise<ProjectProgress> {
    const specIds = await this.specifications.listSpecificationIds(workspaceId, projectId);
    const tasks =
      specIds.length > 0 ? await this.store.listForSpecifications(workspaceId, specIds) : [];

    const done = tasks.filter((t) => t.status === 'done').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    return {
      total: tasks.length,
      done,
      inProgress,
      notStarted: tasks.length - done - inProgress,
      percentComplete: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
    };
  }
}
