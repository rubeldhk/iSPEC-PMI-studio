/**
 * `T1325` (EPIC-041) — tasks on PostgreSQL.
 *
 * `FR-LPW-041`, `R-041-7`. The `tasks` table has existed since EPIC-012's
 * migration and the composed application never wrote to it: `tasks.module.ts`
 * bound `TASK_STORE` to `InMemoryTaskStore` unconditionally, so every restart
 * lost every task (PMI-DOC-004B §2.1). This is the store the module now selects
 * when `DATABASE_URL` is set.
 *
 * Framework-free (PC-1). There is deliberately no delete: a store with no
 * destructive operation cannot regress into one. `replaceForSpecification` is
 * the one sanctioned replacement path (T103), and it is transactional.
 *
 * Integration test: `backend/tests/integration/task-store.spec.ts` (T1324).
 */
import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../core/errors.js';
import type { TaskRecord, TaskStatus, TaskStore } from './generate-tasks.service.js';

type TaskDelegate = PrismaClient['task'];
type TaskRow = Awaited<ReturnType<TaskDelegate['findMany']>>[number];

const toRecord = (row: TaskRow): TaskRecord => ({
  id: row.id,
  workspaceId: row.workspaceId,
  specificationId: row.specificationId,
  description: row.description,
  status: row.status as TaskStatus,
  engineName: row.engineName,
  engineVersion: row.engineVersion,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export class PrismaTaskStore implements TaskStore {
  constructor(private readonly task: TaskDelegate) {}

  async createMany(rows: Omit<TaskRecord, 'createdAt' | 'updatedAt'>[]): Promise<TaskRecord[]> {
    if (rows.length === 0) return [];
    await this.task.createMany({ data: rows });
    const created = await this.task.findMany({ where: { id: { in: rows.map((r) => r.id) } } });
    // In the caller's order, not the database's.
    const byId = new Map(created.map((r) => [r.id, toRecord(r)]));
    return rows.map((r) => byId.get(r.id)!);
  }

  async listForSpecification(workspaceId: string, specificationId: string): Promise<TaskRecord[]> {
    const rows = await this.task.findMany({
      where: { workspaceId, specificationId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toRecord);
  }

  /** Unscoped by design — the guard pattern (EPIC-004 F2). */
  async findById(id: string): Promise<TaskRecord | null> {
    const row = await this.task.findUnique({ where: { id } });
    return row === null ? null : toRecord(row);
  }

  async updateStatus(workspaceId: string, id: string, status: TaskStatus): Promise<TaskRecord> {
    // Scoped update: another workspace's task is absent, not forbidden.
    const result = await this.task.updateMany({ where: { id, workspaceId }, data: { status } });
    if (result.count === 0) throw new NotFoundError('Not found.');
    const row = await this.task.findUnique({ where: { id } });
    if (row === null) throw new NotFoundError('Not found.');
    return toRecord(row);
  }

  async listForSpecifications(workspaceId: string, specificationIds: string[]): Promise<TaskRecord[]> {
    if (specificationIds.length === 0) return [];
    const rows = await this.task.findMany({
      where: { workspaceId, specificationId: { in: specificationIds } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toRecord);
  }

  /** Regeneration only (T103): the one sanctioned replacement path. */
  async replaceForSpecification(
    workspaceId: string,
    specificationId: string,
    rows: Omit<TaskRecord, 'createdAt' | 'updatedAt'>[],
  ): Promise<TaskRecord[]> {
    // Delete-then-create inside one statement pair; a crash between them
    // would leave the specification with no tasks rather than two sets, and
    // the caller has already warned before replacing anything (Quickstart V8).
    await this.task.deleteMany({ where: { workspaceId, specificationId } });
    return this.createMany(rows);
  }
}
