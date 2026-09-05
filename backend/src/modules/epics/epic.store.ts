/**
 * `T1557` (EPIC-044, data-model.md §1, `R-044-5`) — the Epic record. Interface,
 * in-memory (tests) and Prisma under `DATABASE_URL`; asserted by
 * `tests/architecture/durable-stores.spec.ts`.
 *
 * The number is allocated INSIDE the store: `max(number) + 1` for the project,
 * with the unique `(projectId, number)` index as the guard and one retry on a
 * conflict, so two concurrent creates never share a number and a closed Epic's
 * number is never reused. There is no stage column anywhere in this file:
 * a stage is derived from executions, never stored (`FR-EPB-001`).
 */

import { ConflictError } from '../../core/errors.js';

export type EpicStatus = 'active' | 'split' | 'closed';

export interface EpicRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly number: number;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly status: EpicStatus;
  readonly parentEpicId: string | null;
  readonly splitSuffix: string | null;
  readonly decisionCommentId: string | null;
  readonly lastDecisionCommentId: string | null;
  readonly createdById: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly closedAt: Date | null;
}

/** Everything but the number, which the store allocates. */
export type NewEpic = Omit<EpicRecord, 'number' | 'createdAt' | 'updatedAt'>;

export interface EpicPatch {
  readonly title?: string;
  readonly slug?: string;
  readonly description?: string;
  readonly status?: EpicStatus;
  readonly lastDecisionCommentId?: string | null;
  readonly closedAt?: Date | null;
  readonly updatedAt: Date;
}

export interface EpicFilters {
  readonly status?: EpicStatus;
}

export interface EpicStore {
  /** Allocates the next free number for the project and inserts. */
  create(row: NewEpic): Promise<EpicRecord>;
  find(id: string): Promise<EpicRecord | null>;
  findByNumber(projectId: string, number: number): Promise<EpicRecord | null>;
  /** The children created from a decision comment, if any — idempotence (`R-044-6`). */
  findByDecision(decisionCommentId: string): Promise<EpicRecord[]>;
  update(id: string, patch: EpicPatch): Promise<EpicRecord>;
  /** Number order. */
  list(workspaceId: string, projectId: string, filters?: EpicFilters): Promise<EpicRecord[]>;
}

export function sortEpics(rows: EpicRecord[]): EpicRecord[] {
  return [...rows].sort((a, b) => a.number - b.number);
}

export class InMemoryEpicStore implements EpicStore {
  private readonly rows = new Map<string, EpicRecord>();

  async create(row: NewEpic): Promise<EpicRecord> {
    // DEF-044-003: the same unique index the database enforces, so the unit tests see the
    // race the integration tests see.
    if (row.decisionCommentId && [...this.rows.values()].some((r) => r.decisionCommentId === row.decisionCommentId && r.splitSuffix === row.splitSuffix)) {
      throw uniqueViolation(['decisionCommentId', 'splitSuffix']);
    }
    const number = Math.max(0, ...[...this.rows.values()].filter((r) => r.projectId === row.projectId).map((r) => r.number)) + 1;
    const now = new Date();
    const frozen = Object.freeze({ ...row, number, createdAt: now, updatedAt: now });
    this.rows.set(row.id, frozen);
    return frozen;
  }

  async find(id: string): Promise<EpicRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async findByNumber(projectId: string, number: number): Promise<EpicRecord | null> {
    return [...this.rows.values()].find((r) => r.projectId === projectId && r.number === number) ?? null;
  }

  async findByDecision(decisionCommentId: string): Promise<EpicRecord[]> {
    return sortEpics([...this.rows.values()].filter((r) => r.decisionCommentId === decisionCommentId));
  }

  async update(id: string, patch: EpicPatch): Promise<EpicRecord> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`No epic ${id}`);
    const next = Object.freeze({
      ...existing,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.lastDecisionCommentId !== undefined ? { lastDecisionCommentId: patch.lastDecisionCommentId } : {}),
      ...(patch.closedAt !== undefined ? { closedAt: patch.closedAt } : {}),
      updatedAt: patch.updatedAt,
    });
    this.rows.set(id, next);
    return next;
  }

  async list(workspaceId: string, projectId: string, filters: EpicFilters = {}): Promise<EpicRecord[]> {
    return sortEpics([...this.rows.values()].filter((r) => r.workspaceId === workspaceId && r.projectId === projectId && (filters.status === undefined || r.status === filters.status)));
  }
}

/** The subset of the Prisma delegate the store uses. */
export interface EpicDelegate {
  create(args: { data: Record<string, unknown> }): Promise<EpicRecord>;
  findUnique(args: { where: Record<string, unknown> }): Promise<EpicRecord | null>;
  findMany(args: { where: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }): Promise<EpicRecord[]>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<EpicRecord>;
  aggregate(args: { where: Record<string, unknown>; _max: { number: true } }): Promise<{ _max: { number: number | null } }>;
}

/** A unique-index violation, `P2002`-shaped like the driver's; `field` narrows it to one index. */
export function isUniqueViolation(err: unknown, field?: string): boolean {
  if (typeof err !== 'object' || err === null || (err as { code?: unknown }).code !== 'P2002') return false;
  if (field === undefined) return true;
  const target = (err as { meta?: { target?: unknown } }).meta?.target;
  return Array.isArray(target) ? target.includes(field) : typeof target === 'string' ? target.includes(field) : false;
}

function uniqueViolation(target: string[]): Error {
  return Object.assign(new Error(`Unique constraint failed on the fields: (${target.join(',')})`), { code: 'P2002', meta: { target } });
}

/** How often a create re-reads the max after losing the number race (DEF-044-003). */
const NUMBER_ATTEMPTS = 5;

export class PrismaEpicStore implements EpicStore {
  constructor(private readonly delegate: EpicDelegate) {}

  async create(row: NewEpic): Promise<EpicRecord> {
    // max + 1 with the unique index as the guard: a concurrent create loses the
    // race, reads the new max and takes the next number (R-044-5). Bounded, and
    // refused as a coded conflict rather than a raw driver error when the
    // contention outlasts the attempts. A violation of any OTHER unique index
    // (the decision index) is the caller's to handle and is rethrown at once.
    for (let attempt = 1; ; attempt += 1) {
      const max = await this.delegate.aggregate({ where: { projectId: row.projectId }, _max: { number: true } });
      const number = (max._max.number ?? 0) + 1;
      try {
        return await this.delegate.create({ data: { ...row, number } });
      } catch (err) {
        if (!isUniqueViolation(err, 'number')) throw err;
        if (attempt >= NUMBER_ATTEMPTS) {
          throw new ConflictError('The Epic number could not be allocated under contention; retry the create.', { code: 'epic_number_contended', attempts: attempt });
        }
      }
    }
  }

  async find(id: string): Promise<EpicRecord | null> {
    return this.delegate.findUnique({ where: { id } });
  }

  async findByNumber(projectId: string, number: number): Promise<EpicRecord | null> {
    return this.delegate.findUnique({ where: { projectId_number: { projectId, number } } });
  }

  async findByDecision(decisionCommentId: string): Promise<EpicRecord[]> {
    return this.delegate.findMany({ where: { decisionCommentId }, orderBy: { number: 'asc' } });
  }

  async update(id: string, patch: EpicPatch): Promise<EpicRecord> {
    const { updatedAt: _u, ...data } = patch;
    return this.delegate.update({ where: { id }, data });
  }

  async list(workspaceId: string, projectId: string, filters: EpicFilters = {}): Promise<EpicRecord[]> {
    return this.delegate.findMany({ where: { workspaceId, projectId, ...(filters.status ? { status: filters.status } : {}) }, orderBy: { number: 'asc' } });
  }
}
