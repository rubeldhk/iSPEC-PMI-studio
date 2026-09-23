/**
 * `T1690` (EPIC-046, data-model.md §2–§5, §12) — the task-sync store. Interface,
 * in-memory (tests and database-less runs) and Prisma under `DATABASE_URL`;
 * asserted by `tests/architecture/durable-stores.spec.ts`.
 *
 * ## The unique index is the arbiter, not a check
 *
 * `recordSync` and `upsertTask` do not ask "does this exist?" and then insert —
 * two syncs running at once would both get *no* and both insert. They **insert**
 * and, on the unique violation, read the existing row back. `DEF-045-002` was
 * exactly this bug one Epic ago: a step that raced, passed every non-concurrent
 * test, and whose loser then replayed past the step forever.
 *
 * The in-memory store enforces **the same two indexes** and throws the same
 * `P2002`-shaped error the driver throws, so the unit suites see the race the
 * integration suites see instead of a store that silently tolerates it.
 *
 * ## Nothing is deleted, and no verdict is written
 *
 * There is no `deleteTask`: a task absent from the latest parse is *flagged*
 * (`markAbsent`, `FR-KAN-025`), because a row that vanishes takes its proposals
 * and its history with it. And there is no `updateProposal`: the proposal row is
 * the immutable request and the verdict is an event (`R-037-5`). Both absences
 * are asserted by `task-sync.store.spec.ts` rather than implied.
 */
import { randomUUID } from 'node:crypto';

export const TASK_STATUSES = ['not_started', 'in_progress', 'done', 'blocked'] as const;
export type TaskStatusValue = (typeof TASK_STATUSES)[number];

/** What moved a task last. `engine` is EPIC-012's generated rows (data-model §2). */
export const STATUS_SOURCES = ['parse', 'event', 'proposal', 'engine'] as const;
export type StatusSource = (typeof STATUS_SOURCES)[number];

export const LINE_OUTCOMES = ['parsed', 'refused', 'duplicate'] as const;
export type LineOutcome = (typeof LINE_OUTCOMES)[number];

export const CHANGE_KINDS = ['added', 'description-changed', 'checkbox-changed', 'unchanged'] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

/** The disagreement a line surfaced (`FR-KAN-020` to `FR-KAN-022`). */
export const MARKERS = ['aheadOfFile', 'supersededByFile'] as const;
export type Marker = (typeof MARKERS)[number];

/** The closed vocabulary of data-model.md §7. Per line, then whole-file. */
export const LINE_REFUSAL_CODES = [
  'malformed_identifier',
  'identifier_not_matched',
  'missing_description',
  'description_too_long',
  'duplicate_identifier',
  'credential_in_description',
] as const;
export const FILE_REFUSAL_CODES = ['file_too_large', 'too_many_task_lines', 'not_utf8_text'] as const;
export const REFUSAL_CODES = [...LINE_REFUSAL_CODES, ...FILE_REFUSAL_CODES] as const;
export type LineRefusalCode = (typeof LINE_REFUSAL_CODES)[number];
export type FileRefusalCode = (typeof FILE_REFUSAL_CODES)[number];
export type RefusalCode = (typeof REFUSAL_CODES)[number];

export const PROPOSER_TYPES = ['user', 'agent', 'service'] as const;
export type ProposerType = (typeof PROPOSER_TYPES)[number];

// ---------------------------------------------------------------- records

export interface TaskSyncRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly epicId: string | null;
  readonly executionId: string;
  readonly actorId: string | null;
  readonly idempotencyKey: string;
  readonly tasksDigest: string;
  readonly linesConsidered: number;
  readonly parsed: number;
  readonly refused: number;
  readonly duplicates: number;
  readonly added: number;
  readonly changed: number;
  readonly unchanged: number;
  readonly disappeared: number;
  readonly outOfBandEdit: boolean;
  readonly syncedAt: Date;
}

export type NewTaskSync = Omit<TaskSyncRecord, 'id' | 'syncedAt'>;

export interface TaskSyncLineRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly syncId: string;
  readonly lineNumber: number;
  readonly rawText: string;
  readonly outcome: LineOutcome;
  readonly refusalCode: RefusalCode | null;
  readonly taskKey: string | null;
  readonly changeKind: ChangeKind | null;
  readonly previousStatus: TaskStatusValue | null;
  readonly newStatus: TaskStatusValue | null;
  readonly marker: Marker | null;
}

/** The store supplies the id, the sync and its workspace. */
export type NewTaskSyncLine = Omit<TaskSyncLineRecord, 'id' | 'syncId' | 'workspaceId'>;

export interface SyncedTaskRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly epicId: string | null;
  readonly specificationId: string | null;
  readonly taskKey: string | null;
  readonly description: string;
  readonly status: TaskStatusValue;
  readonly statusSource: StatusSource;
  readonly engineName: string;
  readonly engineVersion: string;
  readonly sourceLine: number | null;
  readonly sourceDigest: string | null;
  readonly parallel: boolean;
  readonly sourcePaths: readonly string[];
  readonly presentInLatestParse: boolean;
  readonly lastParsedExecutionId: string | null;
  readonly lastMovedAt: Date | null;
  readonly lastMovedBy: string | null;
}

export type NewSyncedTask = Omit<SyncedTaskRecord, 'id'>;

export interface TaskStatusProposalRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly taskId: string;
  readonly expectedCurrentStatus: TaskStatusValue;
  readonly requestedStatus: TaskStatusValue;
  readonly reason: string;
  readonly proposerId: string;
  readonly proposerType: ProposerType;
  readonly executionId: string | null;
  readonly eventId: string | null;
  readonly idempotencyKey: string;
  readonly proposedAt: Date;
}

export type NewTaskStatusProposal = Omit<TaskStatusProposalRecord, 'id' | 'proposedAt'>;

export interface RecordSyncOutcome {
  readonly row: TaskSyncRecord;
  /** true when a sync with this `(workspaceId, idempotencyKey)` already existed; nothing was written. */
  readonly replayed: boolean;
}

export interface UpsertTaskOutcome {
  readonly row: SyncedTaskRecord;
  /** false when the same `(epicId, taskKey)` already existed and was updated. */
  readonly created: boolean;
}

export interface RecordProposalOutcome {
  readonly row: TaskStatusProposalRecord;
  readonly replayed: boolean;
}

export interface StatusChange {
  readonly status: TaskStatusValue;
  readonly statusSource: StatusSource;
  readonly at: Date;
  readonly by: string | null;
}

// ---------------------------------------------------------------- interface

export interface TaskSyncStore {
  /** Insert the sync and its manifest in one transaction, or return the stored sync for a replayed key. */
  recordSync(row: NewTaskSync, lines: readonly NewTaskSyncLine[]): Promise<RecordSyncOutcome>;
  findSyncByKey(workspaceId: string, idempotencyKey: string): Promise<TaskSyncRecord | null>;
  findSync(id: string): Promise<TaskSyncRecord | null>;
  /** The Epic's newest sync — the header of every board read (data-model §8). */
  latestSyncForEpic(workspaceId: string, epicId: string): Promise<TaskSyncRecord | null>;
  /** The Epic's syncs, newest first. */
  syncsForEpic(workspaceId: string, epicId: string): Promise<TaskSyncRecord[]>;
  /** The project's syncs bound to no Epic, newest first (`FR-KAN-032`). */
  unboundSyncs(workspaceId: string, projectId: string): Promise<TaskSyncRecord[]>;
  linesFor(syncId: string): Promise<TaskSyncLineRecord[]>;

  /** Insert, or read back and update the existing row. Safe under concurrency. */
  upsertTask(row: NewSyncedTask): Promise<UpsertTaskOutcome>;
  findTask(id: string): Promise<SyncedTaskRecord | null>;
  findTaskByKey(workspaceId: string, epicId: string, taskKey: string): Promise<SyncedTaskRecord | null>;
  tasksForEpic(workspaceId: string, epicId: string): Promise<SyncedTaskRecord[]>;
  /**
   * Flag every task of the Epic whose key is NOT in `keptKeys`, and clear the
   * flag on those that are. Deletes nothing (`FR-KAN-025`).
   */
  markAbsent(workspaceId: string, epicId: string, keptKeys: readonly string[]): Promise<void>;
  applyStatus(workspaceId: string, taskId: string, change: StatusChange): Promise<SyncedTaskRecord>;

  /**
   * Whether the project owning this Epic asks for a second person on a task
   * move (`projects.taskMoveRequiresApproval`, `R-046-6`).
   *
   * It lives on the store rather than reaching into the projects module,
   * because it is one column behind one join and importing a service to read
   * it would couple this module to another for a boolean.
   */
  moveRequiresApproval(workspaceId: string, epicId: string): Promise<boolean>;
  /** The Epic's project (`T1789`). Null when the Epic is absent or another workspace's. */
  projectForEpic(workspaceId: string, epicId: string): Promise<string | null>;
  recordProposal(row: NewTaskStatusProposal): Promise<RecordProposalOutcome>;
  findProposal(id: string): Promise<TaskStatusProposalRecord | null>;
  proposalsForTask(workspaceId: string, taskId: string): Promise<TaskStatusProposalRecord[]>;
  /**
   * Every proposal of an Epic's tasks (`T1782`). One read rather than one
   * per card: a board of a hundred tasks must not become a hundred queries
   * to answer a question about the few that have proposals.
   */
  proposalsForEpic(workspaceId: string, epicId: string): Promise<TaskStatusProposalRecord[]>;
}

// ---------------------------------------------------------------- helpers

/**
 * Recognises the driver's unique violation in every shape it arrives in.
 * `P2010` + `23505` is the raw-SQL shape `DEF-045-002` found the hard way.
 */
export function isUniqueViolation(err: unknown, field?: string): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: unknown; message?: unknown; meta?: { target?: unknown; code?: unknown; message?: unknown } };
  const unique = e.code === 'P2002' || e.code === '23505' || (e.code === 'P2010' && e.meta?.code === '23505');
  if (!unique) return false;
  if (field === undefined) return true;
  const target = e.meta?.target;
  const named = Array.isArray(target) ? target.join(',') : typeof target === 'string' ? target : '';
  const message = typeof e.meta?.message === 'string' ? e.meta.message : typeof e.message === 'string' ? e.message : '';
  return named.includes(field) || message.includes(field);
}

function uniqueViolation(target: string[]): Error {
  return Object.assign(new Error(`Unique constraint failed on the fields: (${target.join(',')})`), { code: 'P2002', meta: { target } });
}

function newest(a: { syncedAt: Date }, b: { syncedAt: Date }): number {
  return b.syncedAt.getTime() - a.syncedAt.getTime();
}

// ---------------------------------------------------------------- in-memory

export class InMemoryTaskSyncStore implements TaskSyncStore {
  private readonly syncs = new Map<string, TaskSyncRecord>();
  private readonly lines = new Map<string, TaskSyncLineRecord[]>();
  private readonly tasks = new Map<string, SyncedTaskRecord>();
  private readonly proposals = new Map<string, TaskStatusProposalRecord>();
  /** Monotonic, so two syncs written in the same millisecond still order. */
  private tick = 0;

  /**
   * The raw insert, which throws on the unique index exactly as the database
   * does. Exposed so the store's own tests can observe the violation rather
   * than only its handling.
   */
  async insertSync(row: NewTaskSync, lines: readonly NewTaskSyncLine[]): Promise<TaskSyncRecord> {
    if ([...this.syncs.values()].some((r) => r.workspaceId === row.workspaceId && r.idempotencyKey === row.idempotencyKey)) {
      throw uniqueViolation(['workspaceId', 'idempotencyKey']);
    }
    const frozen = Object.freeze({ ...row, id: randomUUID(), syncedAt: new Date(Date.now() + this.tick++) });
    this.syncs.set(frozen.id, frozen);
    this.lines.set(
      frozen.id,
      lines.map((l) => Object.freeze({ ...l, id: randomUUID(), syncId: frozen.id, workspaceId: row.workspaceId })),
    );
    return frozen;
  }

  async recordSync(row: NewTaskSync, lines: readonly NewTaskSyncLine[]): Promise<RecordSyncOutcome> {
    try {
      return { row: await this.insertSync(row, lines), replayed: false };
    } catch (err) {
      if (!isUniqueViolation(err, 'idempotencyKey')) throw err;
      const existing = await this.findSyncByKey(row.workspaceId, row.idempotencyKey);
      // The index fired, so the row is there; a miss would be a store bug, not a race.
      if (!existing) throw err;
      return { row: existing, replayed: true };
    }
  }

  async findSyncByKey(workspaceId: string, idempotencyKey: string): Promise<TaskSyncRecord | null> {
    return [...this.syncs.values()].find((r) => r.workspaceId === workspaceId && r.idempotencyKey === idempotencyKey) ?? null;
  }

  async findSync(id: string): Promise<TaskSyncRecord | null> {
    return this.syncs.get(id) ?? null;
  }

  async latestSyncForEpic(workspaceId: string, epicId: string): Promise<TaskSyncRecord | null> {
    return (await this.syncsForEpic(workspaceId, epicId))[0] ?? null;
  }

  async syncsForEpic(workspaceId: string, epicId: string): Promise<TaskSyncRecord[]> {
    return [...this.syncs.values()].filter((r) => r.workspaceId === workspaceId && r.epicId === epicId).sort(newest);
  }

  async unboundSyncs(workspaceId: string, projectId: string): Promise<TaskSyncRecord[]> {
    return [...this.syncs.values()].filter((r) => r.workspaceId === workspaceId && r.projectId === projectId && r.epicId === null).sort(newest);
  }

  async linesFor(syncId: string): Promise<TaskSyncLineRecord[]> {
    return [...(this.lines.get(syncId) ?? [])].sort((a, b) => a.lineNumber - b.lineNumber);
  }

  async insertTask(row: NewSyncedTask): Promise<SyncedTaskRecord> {
    if (
      row.epicId !== null &&
      row.taskKey !== null &&
      [...this.tasks.values()].some((r) => r.epicId === row.epicId && r.taskKey === row.taskKey)
    ) {
      throw uniqueViolation(['epicId', 'taskKey']);
    }
    const frozen = Object.freeze({ ...row, id: randomUUID(), sourcePaths: Object.freeze([...row.sourcePaths]) });
    this.tasks.set(frozen.id, frozen);
    return frozen;
  }

  async upsertTask(row: NewSyncedTask): Promise<UpsertTaskOutcome> {
    try {
      return { row: await this.insertTask(row), created: true };
    } catch (err) {
      if (!isUniqueViolation(err, 'taskKey')) throw err;
      const existing =
        row.epicId !== null && row.taskKey !== null
          ? [...this.tasks.values()].find((r) => r.epicId === row.epicId && r.taskKey === row.taskKey)
          : undefined;
      if (!existing) throw err;
      // The parse owns the file-derived columns; the STATUS is the caller's,
      // because only `reconcile` may decide it (R-046-4).
      const merged = Object.freeze({
        ...existing,
        description: row.description,
        status: row.status,
        statusSource: row.statusSource,
        sourceLine: row.sourceLine,
        sourceDigest: row.sourceDigest,
        parallel: row.parallel,
        sourcePaths: Object.freeze([...row.sourcePaths]),
        presentInLatestParse: row.presentInLatestParse,
        lastParsedExecutionId: row.lastParsedExecutionId,
        specificationId: row.specificationId ?? existing.specificationId,
        ...(row.lastMovedAt ? { lastMovedAt: row.lastMovedAt, lastMovedBy: row.lastMovedBy } : {}),
      });
      this.tasks.set(existing.id, merged);
      return { row: merged, created: false };
    }
  }

  async findTask(id: string): Promise<SyncedTaskRecord | null> {
    return this.tasks.get(id) ?? null;
  }

  async findTaskByKey(workspaceId: string, epicId: string, taskKey: string): Promise<SyncedTaskRecord | null> {
    return [...this.tasks.values()].find((r) => r.workspaceId === workspaceId && r.epicId === epicId && r.taskKey === taskKey) ?? null;
  }

  async tasksForEpic(workspaceId: string, epicId: string): Promise<SyncedTaskRecord[]> {
    return [...this.tasks.values()]
      .filter((r) => r.workspaceId === workspaceId && r.epicId === epicId)
      .sort((a, b) => (a.sourceLine ?? 0) - (b.sourceLine ?? 0));
  }

  async markAbsent(workspaceId: string, epicId: string, keptKeys: readonly string[]): Promise<void> {
    const kept = new Set(keptKeys);
    for (const [id, row] of this.tasks) {
      if (row.workspaceId !== workspaceId || row.epicId !== epicId) continue;
      const present = row.taskKey !== null && kept.has(row.taskKey);
      if (row.presentInLatestParse !== present) {
        this.tasks.set(id, Object.freeze({ ...row, presentInLatestParse: present }));
      }
    }
  }

  async applyStatus(workspaceId: string, taskId: string, change: StatusChange): Promise<SyncedTaskRecord> {
    const row = this.tasks.get(taskId);
    if (!row || row.workspaceId !== workspaceId) throw new Error(`task ${taskId} not found`);
    const moved = Object.freeze({ ...row, status: change.status, statusSource: change.statusSource, lastMovedAt: change.at, lastMovedBy: change.by });
    this.tasks.set(taskId, moved);
    return moved;
  }

  /** In memory there is no project row; the strict posture is the safe default. */
  moveRequiresApprovalAnswer = false;

  /** Set by a test; the in-memory store has no projects table to read. */
  projectForEpicAnswer: string | null = 'p_a';

  async projectForEpic(): Promise<string | null> {
    return this.projectForEpicAnswer;
  }

  async moveRequiresApproval(): Promise<boolean> {
    return this.moveRequiresApprovalAnswer;
  }

  async recordProposal(row: NewTaskStatusProposal): Promise<RecordProposalOutcome> {
    const existing = [...this.proposals.values()].find(
      (r) => r.workspaceId === row.workspaceId && r.idempotencyKey === row.idempotencyKey,
    );
    if (existing) return { row: existing, replayed: true };
    const frozen = Object.freeze({ ...row, id: randomUUID(), proposedAt: new Date(Date.now() + this.tick++) });
    this.proposals.set(frozen.id, frozen);
    return { row: frozen, replayed: false };
  }

  async findProposal(id: string): Promise<TaskStatusProposalRecord | null> {
    return this.proposals.get(id) ?? null;
  }

  async proposalsForEpic(workspaceId: string, epicId: string): Promise<TaskStatusProposalRecord[]> {
    const taskIds = new Set((await this.tasksForEpic(workspaceId, epicId)).map((t) => t.id));
    return [...this.proposals.values()]
      .filter((p) => p.workspaceId === workspaceId && taskIds.has(p.taskId))
      .sort((a, b) => a.proposedAt.getTime() - b.proposedAt.getTime() || a.id.localeCompare(b.id));
  }

  async proposalsForTask(workspaceId: string, taskId: string): Promise<TaskStatusProposalRecord[]> {
    return [...this.proposals.values()]
      .filter((r) => r.workspaceId === workspaceId && r.taskId === taskId)
      .sort((a, b) => b.proposedAt.getTime() - a.proposedAt.getTime());
  }
}
