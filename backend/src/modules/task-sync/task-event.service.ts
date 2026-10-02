/**
 * `T1724` (EPIC-046, `FR-KAN-040` to `FR-KAN-047`) — movement from execution
 * events. Milestone `M4`'s whole mechanism, and it is small on purpose.
 *
 * ## What a `progress-reported` event means
 *
 * The agent's progress hook appends one per task **newly `[X]`** since
 * registration, so the event means *this task got ticked* and the only status
 * it can produce is `done`. Which toolkit's hook it was is not recorded here
 * and not consulted: the platform reads events (`FR-017`, `ADR-0001`).
 *
 * `FR-KAN-041` keeps `in_progress` and `blocked` reachable only through an
 * applied proposal: the file has two states, and a platform that guessed a third
 * would be inventing exactly the fact this Epic exists to stop inventing.
 *
 * ## Why this is a projection over events, not a queue
 *
 * The events are already durable — `EPIC-037` stores them. So there is no
 * inbox, no cursor and no retry table here: `applyFor` reads the Epic's reports
 * and brings the rows into line with them. That makes it **replay-safe by
 * construction** (`FR-KAN-047`), which matters because a sync calls it right
 * after rewriting the rows it is about to reconcile.
 *
 * It is also why `FR-KAN-042`'s *retained and matched later* needs no storage:
 * an unmatched report is simply one whose identifier no row carries **yet**. The
 * next parse that introduces the identifier makes the same reports match.
 *
 * ## The earliest report wins
 *
 * Two runs can both report the same task. Attributing the move to whichever the
 * database happened to return first would make the board's history depend on
 * read order, so the earliest occurrence is the one recorded.
 */
import type { SyncedTaskRecord, TaskSyncStore } from './task-sync.store.js';

export interface ProgressReport {
  readonly executionId: string;
  readonly taskId: string;
  readonly occurredAt: string;
  /**
   * The principal that emitted the event — the registry records who, not just
   * what (`EPIC-037`). It is the actor of the audit row for any move this
   * report causes: a move attributed to nobody is indistinguishable from a
   * move nobody made (`FR-KAN-072`).
   */
  readonly emittedBy: string;
}

export interface ProgressEventReader {
  /** Every `progress-reported` event of the Epic's executions, in any order. */
  progressReportsFor(workspaceId: string, epicId: string): Promise<ProgressReport[]>;
}

/**
 * The audit trail (`FR-KAN-072`, data-model.md §11). Optional so the event
 * suite can drive the projection without one; the module always supplies it.
 */
export interface EventAuditPort {
  record(row: {
    workspaceId: string;
    actorId: string | null;
    action: 'create' | 'update';
    targetType: string;
    targetId: string;
    outcome: 'success';
    detail: Record<string, unknown>;
  }): Promise<void>;
}

export interface TaskEventDeps {
  readonly store: TaskSyncStore;
  readonly events: ProgressEventReader;
  readonly audit?: EventAuditPort | undefined;
}

export interface ApplyOutcome {
  /** Identifiers this call moved to Done. Empty on a replay. */
  readonly applied: readonly string[];
  /** Reports naming an identifier no row carries yet (`FR-KAN-042`). */
  readonly unmatched: readonly ProgressReport[];
}

/** The earliest report per identifier — attribution must not depend on read order. */
function earliestByTask(reports: readonly ProgressReport[]): Map<string, ProgressReport> {
  const first = new Map<string, ProgressReport>();
  for (const report of reports) {
    const held = first.get(report.taskId);
    if (held === undefined || report.occurredAt < held.occurredAt) first.set(report.taskId, report);
  }
  return first;
}

export class TaskEventService {
  constructor(private readonly deps: TaskEventDeps) {}

  /**
   * Brings the Epic's rows into line with its progress reports.
   *
   * Called after a sync (the rows have just been rewritten) and whenever a new
   * event arrives. Both paths are the same operation, which is why neither
   * needs to know what the other did.
   */
  async applyFor(workspaceId: string, epicId: string): Promise<ApplyOutcome> {
    const [reports, rows] = await Promise.all([
      this.deps.events.progressReportsFor(workspaceId, epicId),
      this.deps.store.tasksForEpic(workspaceId, epicId),
    ]);
    const byKey = new Map<string, SyncedTaskRecord>(
      rows.filter((r) => r.taskKey !== null).map((r) => [r.taskKey as string, r]),
    );

    const applied: string[] = [];
    const unmatched: ProgressReport[] = [];

    for (const [taskId, report] of earliestByTask(reports)) {
      const row = byKey.get(taskId);
      if (row === undefined) {
        // Nothing is created from an event, ever. The hook's `tickedTasks` is
        // deliberately more permissive than the platform's identifier pattern,
        // so this is an ordinary outcome and not an error.
        unmatched.push(report);
        continue;
      }
      // Idempotent: a task already Done is not moved again, so a replay neither
      // changes the row nor drifts its attribution to a later event.
      if (row.status === 'done' && row.statusSource === 'event') continue;
      await this.deps.store.applyStatus(workspaceId, row.id, {
        status: 'done',
        statusSource: 'event',
        at: new Date(report.occurredAt),
        by: null,
      });
      // The cause is the EXECUTION whose event moved it, not this call: the
      // same report replayed moves nothing and records nothing, so the trail
      // holds one row per move rather than one per reconciliation.
      await this.deps.audit?.record({
        workspaceId,
        actorId: report.emittedBy,
        action: 'update',
        targetType: 'task',
        targetId: row.id,
        outcome: 'success',
        detail: { taskKey: taskId, from: row.status, to: 'done', source: 'event', causeId: report.executionId },
      });
      applied.push(taskId);
    }

    return { applied, unmatched };
  }

  /** The unmatched reports alone — the board's disagreement list (`FR-KAN-024`). */
  async unmatched(workspaceId: string, epicId: string): Promise<readonly ProgressReport[]> {
    const [reports, rows] = await Promise.all([
      this.deps.events.progressReportsFor(workspaceId, epicId),
      this.deps.store.tasksForEpic(workspaceId, epicId),
    ]);
    const keys = new Set(rows.map((r) => r.taskKey).filter((k): k is string => k !== null));
    return [...earliestByTask(reports).values()].filter((r) => !keys.has(r.taskId));
  }
}
