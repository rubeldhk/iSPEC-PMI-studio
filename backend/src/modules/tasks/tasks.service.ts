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
  /**
   * `EPIC-046` `T1780`. The board has four columns, and a project figure that
   * reports three of them is a different figure — a blocked task would silently
   * read as *not started* to anyone adding the numbers up.
   */
  blocked: number;
  /** Whole percent of done tasks; 0 for an empty project, never NaN. */
  percentComplete: number;
}

/**
 * `EPIC-046` `T1780` (`FR-KAN-056`, `SC-KAN-009`) — the ONE derivation.
 *
 * This service used to count for itself, through the project's specifications.
 * `EPIC-046` widened what a task is — a synced task's home is its Epic and its
 * specification is optional (`Q1`) — so that query stopped seeing whole Epics,
 * and the percentage on `/tasks` drifted from the one on `/plan`. Both were
 * rendered. Nothing said so.
 *
 * The fix is not a second query that agrees. It is **one function**, reached
 * through this port: `TaskProgressService.forProject`, whose counting is the
 * pure `computeProgress` every other surface calls. What the port abstracts is
 * *which rows*; how they are counted is not negotiable and not duplicated.
 *
 * It is **required**, deliberately. An optional port with a local fallback is
 * exactly the second derivation this exists to remove — it would agree in the
 * unit suite and disagree in production, which is the worst of both.
 */
export interface ProjectProgressSource {
  forProject(workspaceId: string, projectId: string): Promise<ProjectProgress>;
}

/**
 * `EPIC-046` `T1746` (`FR-KAN-017`, `Q3`) — whether a task was parsed from a
 * `tasks.md`.
 *
 * Proposal gating applies to **synced** tasks only. The reason a move must be
 * a proposal is that a file elsewhere is authoritative; a task generated for a
 * specification has no such file, and gating it would stop a working path to
 * protect nothing. So this port answers one question, and `EPIC-012`'s direct
 * update keeps working for everything it answers *no* about.
 */
export interface SyncedTaskGuard {
  isSynced(workspaceId: string, taskId: string): Promise<boolean>;
}

export interface TasksServiceOptions {
  onRefused?: (record: RefusalRecord) => void;
  /** Absent means nothing is synced — the database-less and pre-EPIC-046 posture. */
  syncedTasks?: SyncedTaskGuard | undefined;
  /** The one derivation (`T1780`). Required by `progressForProject`. */
  progress?: ProjectProgressSource | undefined;
}

export class TasksService {
  private readonly onRefused: ((record: RefusalRecord) => void) | undefined;
  private readonly syncedTasks: SyncedTaskGuard | undefined;
  private readonly progress: ProjectProgressSource | undefined;

  constructor(
    private readonly store: TaskStore,
    private readonly specifications: SpecificationIdSource,
    options: TasksServiceOptions = {},
  ) {
    this.onRefused = options.onRefused;
    this.syncedTasks = options.syncedTasks;
    this.progress = options.progress;
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
    // EPIC-046 T1746 (FR-KAN-017). A task parsed from a `tasks.md` is moved
    // through a PROPOSAL, because the file is authoritative for what is done
    // and this route would overwrite the mirror without recording who or why.
    // A task with no file behind it is unaffected: `Q3` scoped the gate to
    // synced tasks precisely so this path keeps working.
    if (await this.syncedTasks?.isSynced(workspaceId, id)) {
      throw new ValidationFailedError(
        'This task was parsed from a tasks.md and is moved through a status proposal, not edited here.',
        {
          code: 'task_is_proposal_gated',
          fields: [{ field: 'status', reason: 'propose the move at POST /v1/tasks/{taskId}/status-proposals' }],
        },
      );
    }
    return this.store.updateStatus(workspaceId, id, status);
  }

  /** US4 scenario 3 — aggregate progress across the project. */
  /**
   * The project's progress, from the one derivation (`FR-KAN-056`, `T1780`).
   *
   * It counts nothing here. Reproducing the arithmetic — even correctly —
   * would put a second copy of `SC-KAN-009`'s guarantee in a second file, and
   * the two would drift the first time either changed.
   */
  async progressForProject(workspaceId: string, projectId: string): Promise<ProjectProgress> {
    if (this.progress === undefined) {
      // Loud rather than wrong. A missing port is a wiring fault, and answering
      // with a locally-computed number would hide it behind a plausible figure.
      throw new Error('Project progress requires the task-progress port; TasksModule wires it from TaskSyncModule.');
    }
    return this.progress.forProject(workspaceId, projectId);
  }
}
