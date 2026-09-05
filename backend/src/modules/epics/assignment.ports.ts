/**
 * `T1565` / `T1569` (EPIC-044, `FR-EPB-023`, `FR-EPB-025`, `R-044-6`) — the
 * ports the Epic service reaches other modules through: the requirement and
 * specification rows it assigns, and the decomposition-decision comments it
 * reconciles. In-memory for tests; Prisma in `epics.module.ts`.
 */

export interface AssignableRequirement {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly reference: string;
  readonly status: string;
  readonly epicId: string | null;
}

export interface RequirementAssignmentPort {
  find(workspaceId: string, id: string): Promise<AssignableRequirement | null>;
  findByReference(workspaceId: string, projectId: string, reference: string): Promise<AssignableRequirement | null>;
  listForProject(workspaceId: string, projectId: string): Promise<AssignableRequirement[]>;
  setEpic(workspaceId: string, id: string, epicId: string | null): Promise<void>;
}

export interface AssignableSpecification {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly epicId: string | null;
}

export interface SpecificationAssignmentPort {
  find(workspaceId: string, id: string): Promise<AssignableSpecification | null>;
  listForProject(workspaceId: string, projectId: string): Promise<AssignableSpecification[]>;
  setEpic(workspaceId: string, id: string, epicId: string | null): Promise<void>;
}

export interface DecisionComment {
  readonly commentId: string;
  readonly executionId: string;
  readonly body: string;
  readonly createdAt: Date;
}

/** The `decomposition-decision` comments on a project's executions, oldest first. */
export interface DecisionCommentReader {
  decisionsForProject(workspaceId: string, projectId: string): Promise<DecisionComment[]>;
}

export class InMemoryRequirementAssignments implements RequirementAssignmentPort {
  private readonly rows: Map<string, AssignableRequirement>;

  constructor(seed: AssignableRequirement[] = []) {
    this.rows = new Map(seed.map((r) => [r.id, r]));
  }

  async find(workspaceId: string, id: string): Promise<AssignableRequirement | null> {
    const row = this.rows.get(id);
    return row && row.workspaceId === workspaceId ? row : null;
  }

  async findByReference(workspaceId: string, projectId: string, reference: string): Promise<AssignableRequirement | null> {
    return [...this.rows.values()].find((r) => r.workspaceId === workspaceId && r.projectId === projectId && r.reference === reference) ?? null;
  }

  async listForProject(workspaceId: string, projectId: string): Promise<AssignableRequirement[]> {
    return [...this.rows.values()].filter((r) => r.workspaceId === workspaceId && r.projectId === projectId);
  }

  async setEpic(_workspaceId: string, id: string, epicId: string | null): Promise<void> {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, epicId });
  }
}

export class InMemorySpecificationAssignments implements SpecificationAssignmentPort {
  private readonly rows: Map<string, AssignableSpecification>;

  constructor(seed: AssignableSpecification[] = []) {
    this.rows = new Map(seed.map((r) => [r.id, r]));
  }

  async find(workspaceId: string, id: string): Promise<AssignableSpecification | null> {
    const row = this.rows.get(id);
    return row && row.workspaceId === workspaceId ? row : null;
  }

  async listForProject(workspaceId: string, projectId: string): Promise<AssignableSpecification[]> {
    return [...this.rows.values()].filter((r) => r.workspaceId === workspaceId && r.projectId === projectId);
  }

  async setEpic(_workspaceId: string, id: string, epicId: string | null): Promise<void> {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, epicId });
  }
}

/** The subset of a Prisma delegate the two Prisma ports use. */
export interface AssignmentDelegate<T> {
  findUnique(args: { where: { id: string } }): Promise<T | null>;
  findFirst(args: { where: Record<string, unknown> }): Promise<T | null>;
  findMany(args: { where: Record<string, unknown>; select?: Record<string, boolean> }): Promise<T[]>;
  update(args: { where: { id: string }; data: { epicId: string | null } }): Promise<T>;
}

export class PrismaRequirementAssignments implements RequirementAssignmentPort {
  constructor(private readonly delegate: AssignmentDelegate<AssignableRequirement>) {}

  async find(workspaceId: string, id: string): Promise<AssignableRequirement | null> {
    const row = await this.delegate.findUnique({ where: { id } });
    return row && row.workspaceId === workspaceId ? row : null;
  }

  async findByReference(workspaceId: string, projectId: string, reference: string): Promise<AssignableRequirement | null> {
    return this.delegate.findFirst({ where: { workspaceId, projectId, reference } });
  }

  async listForProject(workspaceId: string, projectId: string): Promise<AssignableRequirement[]> {
    return this.delegate.findMany({ where: { workspaceId, projectId } });
  }

  async setEpic(_workspaceId: string, id: string, epicId: string | null): Promise<void> {
    await this.delegate.update({ where: { id }, data: { epicId } });
  }
}

export class PrismaSpecificationAssignments implements SpecificationAssignmentPort {
  constructor(private readonly delegate: AssignmentDelegate<AssignableSpecification>) {}

  async find(workspaceId: string, id: string): Promise<AssignableSpecification | null> {
    const row = await this.delegate.findUnique({ where: { id } });
    return row && row.workspaceId === workspaceId ? row : null;
  }

  async listForProject(workspaceId: string, projectId: string): Promise<AssignableSpecification[]> {
    return this.delegate.findMany({ where: { workspaceId, projectId } });
  }

  async setEpic(_workspaceId: string, id: string, epicId: string | null): Promise<void> {
    await this.delegate.update({ where: { id }, data: { epicId } });
  }
}

export interface RawDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

/**
 * The decision comments a project's executions carry — read straight from the
 * registry's tables, so the executions module is consumed, not changed (`R-044-6`).
 */
export class PrismaDecisionCommentReader implements DecisionCommentReader {
  constructor(private readonly db: RawDb) {}

  async decisionsForProject(workspaceId: string, projectId: string): Promise<DecisionComment[]> {
    const rows = await this.db.$queryRawUnsafe<{ id: string; executionId: string; body: string; createdAt: Date }[]>(
      `SELECT c."id", c."executionId", c."body", c."createdAt"
         FROM "execution_comments" c
         JOIN "executions" e ON e."id" = c."executionId"
        WHERE e."workspaceId" = $1 AND e."projectId" = $2 AND c."commentType" = 'decomposition-decision'
          AND c."redactionState" = 'visible'
        ORDER BY c."createdAt" ASC, c."id" ASC`,
      workspaceId,
      projectId,
    );
    return rows.map((r) => ({ commentId: r.id, executionId: r.executionId, body: r.body, createdAt: new Date(r.createdAt) }));
  }
}
