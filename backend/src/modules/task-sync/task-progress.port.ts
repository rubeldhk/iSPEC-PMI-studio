/**
 * `T1731` (EPIC-046, `R-046-7`) — the seam between this Epic's progress and the
 * rows it does not own.
 *
 * `FR-KAN-056` requires **one derivation** for every surface. The counting lives
 * in `task-progress.service.ts`; what lives here is the two ports it reads
 * through, so the dependency direction is visible in a file rather than implied
 * by an import.
 *
 * The direction matters: this module reads Epics and reads `EPIC-012`'s
 * specification-scoped rows, and **neither of them depends back**. A port is how
 * that stays true when somebody later needs a third source.
 */
import type { TaskStatusValue } from './task-sync.store.js';

/**
 * The minimum a row must carry to be counted.
 *
 * `presentInLatestParse` is optional because `EPIC-012`'s generated tasks have
 * no parse behind them and are therefore always counted — an absent flag means
 * *present*, never *excluded* (`FR-KAN-058`).
 */
export interface CountableTask {
  readonly id: string;
  readonly status: TaskStatusValue;
  readonly presentInLatestParse?: boolean;
}

/** The project's Epics. This module reads them; it does not own them. */
export interface EpicIdSource {
  idsForProject(workspaceId: string, projectId: string): Promise<string[]>;
}

/**
 * `EPIC-012`'s specification-scoped rows.
 *
 * They have no Epic and must still be counted in the project figure
 * (`FR-KAN-057`): a project that generated tasks before it ever synced one would
 * otherwise read 0% while holding work. Optional, because a project whose tasks
 * all came from a sync needs no second source and should not require one to be
 * wired before it can report.
 */
export interface LegacyTaskSource {
  listForProject(workspaceId: string, projectId: string): Promise<CountableTask[]>;
}
