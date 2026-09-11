/**
 * `T1731` (EPIC-046, `FR-KAN-055` to `FR-KAN-058`) — progress, derived once.
 *
 * ## Why EPIC-012's aggregate could not simply be reused
 *
 * `TasksService.progressForProject` finds tasks **through specifications**. `Q1`
 * made a synced task's specification optional — its home is its Epic — so that
 * query misses every task of an Epic whose `spec.md` has not synced, and the
 * percentage is then wrong in a way nobody looking at it can see.
 *
 * The source therefore widens to *the Epics of the project* **plus** the
 * specification-scoped rows `EPIC-012` owns, and the **derivation stays single**:
 * `computeProgress` is the one function that counts, and every surface calls it
 * (`FR-KAN-056`). Two functions that agree today are two functions that can
 * disagree tomorrow, which is the whole reason the requirement exists.
 *
 * ## Deduplication is not defensive, it is the overlap
 *
 * A synced task whose Epic has a specification-by-sync (`EPIC-045`) is reachable
 * from **both** sides. Counting it twice would understate the percentage of
 * every project that has one, so the rows are keyed by id before counting.
 *
 * ## The denominator excludes what the file no longer contains
 *
 * `FR-KAN-058`. A task absent from the latest parse is kept and marked, but
 * counting it would leave a finished Epic reading below 100% forever. The
 * exclusion is stated wherever progress is shown, because a denominator that
 * silently drops rows is worse than one that explains itself.
 */
import type { CountableTask, EpicIdSource, LegacyTaskSource } from './task-progress.port.js';
import type { TaskStatusValue, TaskSyncStore } from './task-sync.store.js';

export type { CountableTask, EpicIdSource, LegacyTaskSource } from './task-progress.port.js';

export interface Progress {
  readonly total: number;
  readonly done: number;
  readonly inProgress: number;
  readonly notStarted: number;
  readonly blocked: number;
  /** Whole percent of done tasks; 0 for an empty set, never NaN. */
  readonly percentComplete: number;
}

/** The one derivation (`FR-KAN-056`). Pure: no store, no clock, no I/O. */
export function computeProgress(rows: readonly CountableTask[]): Progress {
  const counted = new Map<string, CountableTask>();
  for (const row of rows) {
    if (row.presentInLatestParse === false) continue;
    counted.set(row.id, row);
  }
  const all = [...counted.values()];
  const of = (status: TaskStatusValue): number => all.filter((r) => r.status === status).length;
  const done = of('done');
  return {
    total: all.length,
    done,
    inProgress: of('in_progress'),
    notStarted: of('not_started'),
    blocked: of('blocked'),
    percentComplete: all.length === 0 ? 0 : Math.round((done / all.length) * 100),
  };
}

export interface TaskProgressDeps {
  readonly store: TaskSyncStore;
  readonly epics: EpicIdSource;
  readonly legacy?: LegacyTaskSource | undefined;
}

export class TaskProgressService {
  constructor(private readonly deps: TaskProgressDeps) {}

  async forEpic(workspaceId: string, epicId: string): Promise<Progress> {
    return computeProgress(await this.deps.store.tasksForEpic(workspaceId, epicId));
  }

  async forProject(workspaceId: string, projectId: string): Promise<Progress> {
    const epicIds = await this.deps.epics.idsForProject(workspaceId, projectId);
    const byEpic = await Promise.all(epicIds.map((id) => this.deps.store.tasksForEpic(workspaceId, id)));
    const legacy = (await this.deps.legacy?.listForProject(workspaceId, projectId)) ?? [];
    // One list, one count — `computeProgress` keys by id, so the overlap between
    // an Epic's tasks and its specification's tasks is counted once.
    return computeProgress([...byEpic.flat(), ...legacy]);
  }
}
