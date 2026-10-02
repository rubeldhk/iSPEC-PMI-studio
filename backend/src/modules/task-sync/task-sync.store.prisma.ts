/**
 * `T1690` (EPIC-046) — the durable task-sync store.
 *
 * Raw SQL rather than the generated client, in the shape `EPIC-037`'s stores
 * use, because three of these operations are things the client does not model
 * well: insert-and-read-back on a unique violation (twice), a **partial** unique
 * index, and a two-way flag update in one statement.
 *
 * The in-memory twin in `task-sync.store.ts` enforces the same indexes and
 * throws the same `P2002` shape, so a race the database would catch is caught by
 * the unit suites too — `DEF-045-002`'s lesson, one Epic old.
 */
import {
  isUniqueViolation,
  type NewSyncedTask,
  type NewTaskStatusProposal,
  type NewTaskSync,
  type NewTaskSyncLine,
  type RecordProposalOutcome,
  type RecordSyncOutcome,
  type StatusChange,
  type SyncedTaskRecord,
  type TaskStatusProposalRecord,
  type TaskSyncLineRecord,
  type TaskSyncRecord,
  type TaskSyncStore,
  type UpsertTaskOutcome,
} from './task-sync.store.js';

/** The narrow slice of the client this store needs. */
export interface TaskSyncDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $transaction<T>(fn: (tx: TaskSyncDb) => Promise<T>): Promise<T>;
}

function one<T>(rows: T[]): T | null {
  return rows[0] ?? null;
}

const SYNC_COLUMNS =
  '"id","workspaceId","projectId","epicId","executionId","actorId","idempotencyKey","tasksDigest",' +
  '"linesConsidered","parsed","refused","duplicates","added","changed","unchanged","disappeared","outOfBandEdit","syncedAt"';

const TASK_COLUMNS =
  '"id","workspaceId","epicId","specificationId","taskKey","description","status"::text AS "status",' +
  '"statusSource","engineName","engineVersion","sourceLine","sourceDigest","parallel","sourcePaths",' +
  '"presentInLatestParse","lastParsedExecutionId","lastMovedAt","lastMovedBy"';

const LINE_COLUMNS =
  '"id","workspaceId","syncId","lineNumber","rawText","outcome","refusalCode","taskKey","changeKind","previousStatus","newStatus","marker"';

const PROPOSAL_COLUMNS =
  '"id","workspaceId","taskId","expectedCurrentStatus","requestedStatus","reason","proposerId","proposerType",' +
  '"executionId","eventId","idempotencyKey","proposedAt"';

export class PrismaTaskSyncStore implements TaskSyncStore {
  constructor(private readonly db: TaskSyncDb) {}

  async recordSync(row: NewTaskSync, lines: readonly NewTaskSyncLine[]): Promise<RecordSyncOutcome> {
    try {
      return await this.db.$transaction(async (tx) => {
        const inserted = await tx.$queryRawUnsafe<TaskSyncRecord[]>(
          'INSERT INTO "task_syncs" ("id","workspaceId","projectId","epicId","executionId","actorId","idempotencyKey","tasksDigest",' +
            '"linesConsidered","parsed","refused","duplicates","added","changed","unchanged","disappeared","outOfBandEdit") ' +
            'VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ' +
            `RETURNING ${SYNC_COLUMNS}`,
          row.workspaceId, row.projectId, row.epicId, row.executionId, row.actorId, row.idempotencyKey, row.tasksDigest,
          row.linesConsidered, row.parsed, row.refused, row.duplicates,
          row.added, row.changed, row.unchanged, row.disappeared, row.outOfBandEdit,
        );
        const sync = inserted[0] as TaskSyncRecord;
        for (const l of lines) {
          await tx.$executeRawUnsafe(
            'INSERT INTO "task_sync_lines" ("id","workspaceId","syncId","lineNumber","rawText","outcome","refusalCode",' +
              '"taskKey","changeKind","previousStatus","newStatus","marker") ' +
              'VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
            row.workspaceId, sync.id, l.lineNumber, l.rawText, l.outcome, l.refusalCode, l.taskKey,
            l.changeKind, l.previousStatus, l.newStatus, l.marker,
          );
        }
        return { row: sync, replayed: false };
      });
    } catch (err) {
      if (!isUniqueViolation(err, 'idempotencyKey')) throw err;
      const existing = await this.findSyncByKey(row.workspaceId, row.idempotencyKey);
      // The index fired, so the row is there; a miss would be a store bug, not a race.
      if (!existing) throw err;
      return { row: existing, replayed: true };
    }
  }

  async findSyncByKey(workspaceId: string, idempotencyKey: string): Promise<TaskSyncRecord | null> {
    return one(
      await this.db.$queryRawUnsafe<TaskSyncRecord[]>(
        `SELECT ${SYNC_COLUMNS} FROM "task_syncs" WHERE "workspaceId" = $1 AND "idempotencyKey" = $2`,
        workspaceId, idempotencyKey,
      ),
    );
  }

  async findSync(id: string): Promise<TaskSyncRecord | null> {
    return one(await this.db.$queryRawUnsafe<TaskSyncRecord[]>(`SELECT ${SYNC_COLUMNS} FROM "task_syncs" WHERE "id" = $1`, id));
  }

  async latestSyncForEpic(workspaceId: string, epicId: string): Promise<TaskSyncRecord | null> {
    return one(
      await this.db.$queryRawUnsafe<TaskSyncRecord[]>(
        `SELECT ${SYNC_COLUMNS} FROM "task_syncs" WHERE "workspaceId" = $1 AND "epicId" = $2 ORDER BY "syncedAt" DESC LIMIT 1`,
        workspaceId, epicId,
      ),
    );
  }

  async syncsForEpic(workspaceId: string, epicId: string): Promise<TaskSyncRecord[]> {
    return this.db.$queryRawUnsafe<TaskSyncRecord[]>(
      `SELECT ${SYNC_COLUMNS} FROM "task_syncs" WHERE "workspaceId" = $1 AND "epicId" = $2 ORDER BY "syncedAt" DESC`,
      workspaceId, epicId,
    );
  }

  async unboundSyncs(workspaceId: string, projectId: string): Promise<TaskSyncRecord[]> {
    return this.db.$queryRawUnsafe<TaskSyncRecord[]>(
      `SELECT ${SYNC_COLUMNS} FROM "task_syncs" WHERE "workspaceId" = $1 AND "projectId" = $2 AND "epicId" IS NULL ORDER BY "syncedAt" DESC`,
      workspaceId, projectId,
    );
  }

  async linesFor(syncId: string): Promise<TaskSyncLineRecord[]> {
    return this.db.$queryRawUnsafe<TaskSyncLineRecord[]>(
      `SELECT ${LINE_COLUMNS} FROM "task_sync_lines" WHERE "syncId" = $1 ORDER BY "lineNumber"`,
      syncId,
    );
  }

  async upsertTask(row: NewSyncedTask): Promise<UpsertTaskOutcome> {
    try {
      const inserted = await this.db.$queryRawUnsafe<SyncedTaskRecord[]>(
        'INSERT INTO "tasks" ("id","workspaceId","epicId","specificationId","taskKey","description","status","statusSource",' +
          '"engineName","engineVersion","sourceLine","sourceDigest","parallel","sourcePaths","presentInLatestParse",' +
          '"lastParsedExecutionId","lastMovedAt","lastMovedBy","updatedAt") ' +
          'VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6::"TaskStatus",$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW()) ' +
          `RETURNING ${TASK_COLUMNS}`,
        row.workspaceId, row.epicId, row.specificationId, row.taskKey, row.description, row.status, row.statusSource,
        row.engineName, row.engineVersion, row.sourceLine, row.sourceDigest, row.parallel, [...row.sourcePaths],
        row.presentInLatestParse, row.lastParsedExecutionId, row.lastMovedAt, row.lastMovedBy,
      );
      return { row: inserted[0] as SyncedTaskRecord, created: true };
    } catch (err) {
      if (!isUniqueViolation(err, 'taskKey')) throw err;
      // The parse owns the file-derived columns; the STATUS is the caller's,
      // because only `reconcile` may decide it (R-046-4).
      const updated = await this.db.$queryRawUnsafe<SyncedTaskRecord[]>(
        'UPDATE "tasks" SET "description" = $3, "status" = $4::"TaskStatus", "statusSource" = $5, "sourceLine" = $6, ' +
          '"sourceDigest" = $7, "parallel" = $8, "sourcePaths" = $9, "presentInLatestParse" = $10, ' +
          '"lastParsedExecutionId" = $11, "specificationId" = COALESCE($12, "specificationId"), "updatedAt" = NOW() ' +
          'WHERE "epicId" = $1 AND "taskKey" = $2 ' +
          `RETURNING ${TASK_COLUMNS}`,
        row.epicId, row.taskKey, row.description, row.status, row.statusSource, row.sourceLine,
        row.sourceDigest, row.parallel, [...row.sourcePaths], row.presentInLatestParse, row.lastParsedExecutionId, row.specificationId,
      );
      const existing = updated[0];
      if (!existing) throw err;
      return { row: existing, created: false };
    }
  }

  async findTask(id: string): Promise<SyncedTaskRecord | null> {
    return one(await this.db.$queryRawUnsafe<SyncedTaskRecord[]>(`SELECT ${TASK_COLUMNS} FROM "tasks" WHERE "id" = $1`, id));
  }

  async findTaskByKey(workspaceId: string, epicId: string, taskKey: string): Promise<SyncedTaskRecord | null> {
    return one(
      await this.db.$queryRawUnsafe<SyncedTaskRecord[]>(
        `SELECT ${TASK_COLUMNS} FROM "tasks" WHERE "workspaceId" = $1 AND "epicId" = $2 AND "taskKey" = $3`,
        workspaceId, epicId, taskKey,
      ),
    );
  }

  async tasksForEpic(workspaceId: string, epicId: string): Promise<SyncedTaskRecord[]> {
    return this.db.$queryRawUnsafe<SyncedTaskRecord[]>(
      `SELECT ${TASK_COLUMNS} FROM "tasks" WHERE "workspaceId" = $1 AND "epicId" = $2 ORDER BY "sourceLine" NULLS LAST, "taskKey"`,
      workspaceId, epicId,
    );
  }

  /** Sets the flag both ways in one statement. Deletes nothing (`FR-KAN-025`). */
  async markAbsent(workspaceId: string, epicId: string, keptKeys: readonly string[]): Promise<void> {
    await this.db.$executeRawUnsafe(
      'UPDATE "tasks" SET "presentInLatestParse" = ("taskKey" = ANY($3)), "updatedAt" = NOW() ' +
        'WHERE "workspaceId" = $1 AND "epicId" = $2 AND "presentInLatestParse" <> ("taskKey" = ANY($3))',
      workspaceId, epicId, [...keptKeys],
    );
  }

  async applyStatus(workspaceId: string, taskId: string, change: StatusChange): Promise<SyncedTaskRecord> {
    const rows = await this.db.$queryRawUnsafe<SyncedTaskRecord[]>(
      'UPDATE "tasks" SET "status" = $3::"TaskStatus", "statusSource" = $4, "lastMovedAt" = $5, "lastMovedBy" = $6, "updatedAt" = NOW() ' +
        `WHERE "workspaceId" = $1 AND "id" = $2 RETURNING ${TASK_COLUMNS}`,
      workspaceId, taskId, change.status, change.statusSource, change.at, change.by,
    );
    const row = rows[0];
    if (!row) throw new Error(`task ${taskId} not found`);
    return row;
  }

  async moveRequiresApproval(workspaceId: string, epicId: string): Promise<boolean> {
    const rows = await this.db.$queryRawUnsafe<{ taskMoveRequiresApproval: boolean }[]>(
      'SELECT p."taskMoveRequiresApproval" FROM "projects" p ' +
        'JOIN "epics" e ON e."projectId" = p."id" ' +
        'WHERE e."id" = $1 AND e."workspaceId" = $2',
      epicId,
      workspaceId,
    );
    // An Epic whose project cannot be read takes the STRICTER posture: a move
    // that cannot prove it may apply immediately waits for a person.
    return rows[0]?.taskMoveRequiresApproval ?? true;
  }

  async recordProposal(row: NewTaskStatusProposal): Promise<RecordProposalOutcome> {
    try {
      const inserted = await this.db.$queryRawUnsafe<TaskStatusProposalRecord[]>(
        'INSERT INTO "task_status_proposals" ("id","workspaceId","taskId","expectedCurrentStatus","requestedStatus","reason",' +
          '"proposerId","proposerType","executionId","eventId","idempotencyKey") ' +
          'VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ' +
          `RETURNING ${PROPOSAL_COLUMNS}`,
        row.workspaceId, row.taskId, row.expectedCurrentStatus, row.requestedStatus, row.reason,
        row.proposerId, row.proposerType, row.executionId, row.eventId, row.idempotencyKey,
      );
      return { row: inserted[0] as TaskStatusProposalRecord, replayed: false };
    } catch (err) {
      if (!isUniqueViolation(err, 'idempotencyKey')) throw err;
      const existing = one(
        await this.db.$queryRawUnsafe<TaskStatusProposalRecord[]>(
          `SELECT ${PROPOSAL_COLUMNS} FROM "task_status_proposals" WHERE "workspaceId" = $1 AND "idempotencyKey" = $2`,
          row.workspaceId, row.idempotencyKey,
        ),
      );
      if (!existing) throw err;
      return { row: existing, replayed: true };
    }
  }

  async findProposal(id: string): Promise<TaskStatusProposalRecord | null> {
    return one(await this.db.$queryRawUnsafe<TaskStatusProposalRecord[]>(`SELECT ${PROPOSAL_COLUMNS} FROM "task_status_proposals" WHERE "id" = $1`, id));
  }

  async projectForEpic(workspaceId: string, epicId: string): Promise<string | null> {
    const rows = await this.db.$queryRawUnsafe<{ projectId: string }[]>(
      `SELECT "projectId" FROM "epics" WHERE "id" = $1 AND "workspaceId" = $2`,
      epicId,
      workspaceId,
    );
    return rows[0]?.projectId ?? null;
  }

  async proposalsForEpic(workspaceId: string, epicId: string): Promise<TaskStatusProposalRecord[]> {
    // One read for the whole board (`T1782`): a hundred cards must not become a
    // hundred queries to answer a question about the few that have proposals.
    return this.db.$queryRawUnsafe<TaskStatusProposalRecord[]>(
      `SELECT ${PROPOSAL_COLUMNS.split(',').map((c) => `p.${c}`).join(',')} FROM "task_status_proposals" p
         JOIN "tasks" t ON t."id" = p."taskId"
        WHERE p."workspaceId" = $1 AND t."epicId" = $2
        ORDER BY p."proposedAt" ASC, p."id" ASC`,
      workspaceId,
      epicId,
    );
  }

  async proposalsForTask(workspaceId: string, taskId: string): Promise<TaskStatusProposalRecord[]> {
    return this.db.$queryRawUnsafe<TaskStatusProposalRecord[]>(
      `SELECT ${PROPOSAL_COLUMNS} FROM "task_status_proposals" WHERE "workspaceId" = $1 AND "taskId" = $2 ORDER BY "proposedAt" DESC`,
      workspaceId, taskId,
    );
  }
}
