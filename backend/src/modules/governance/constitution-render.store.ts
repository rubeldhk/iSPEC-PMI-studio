/**
 * `T1484` (EPIC-042, data-model.md §3) — append-only constitution renders: what
 * was written, so a file on disk can be matched to the render that produced it,
 * or to none. Interface, in-memory (tests) and Prisma under `DATABASE_URL`.
 */

export interface ConstitutionRenderRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly version: number;
  readonly digest: string;
  readonly content: string;
  readonly inputs: Record<string, unknown>;
  readonly renderedById: string | null;
  readonly renderedAt: Date;
}

export interface ConstitutionRenderStore {
  latest(projectId: string): Promise<ConstitutionRenderRecord | null>;
  findByDigest(projectId: string, digest: string): Promise<ConstitutionRenderRecord | null>;
  append(row: ConstitutionRenderRecord): Promise<ConstitutionRenderRecord>;
  /** Newest first. */
  listForProject(projectId: string): Promise<ConstitutionRenderRecord[]>;
}

export class InMemoryConstitutionRenderStore implements ConstitutionRenderStore {
  private readonly rows: ConstitutionRenderRecord[] = [];

  async latest(projectId: string): Promise<ConstitutionRenderRecord | null> {
    return (await this.listForProject(projectId))[0] ?? null;
  }

  async findByDigest(projectId: string, digest: string): Promise<ConstitutionRenderRecord | null> {
    return this.rows.find((r) => r.projectId === projectId && r.digest === digest) ?? null;
  }

  async append(row: ConstitutionRenderRecord): Promise<ConstitutionRenderRecord> {
    const frozen = Object.freeze({ ...row });
    this.rows.push(frozen);
    return frozen;
  }

  async listForProject(projectId: string): Promise<ConstitutionRenderRecord[]> {
    return this.rows.filter((r) => r.projectId === projectId).sort((a, b) => b.version - a.version);
  }
}

/** The subset of `PrismaClient['constitutionRender']` the store uses. */
export interface ConstitutionRenderDelegate {
  findFirst(args: { where: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }): Promise<ConstitutionRenderRecord | null>;
  create(args: { data: Record<string, unknown> }): Promise<ConstitutionRenderRecord>;
  findMany(args: { where: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }): Promise<ConstitutionRenderRecord[]>;
}

export class PrismaConstitutionRenderStore implements ConstitutionRenderStore {
  constructor(private readonly renders: ConstitutionRenderDelegate) {}

  async latest(projectId: string): Promise<ConstitutionRenderRecord | null> {
    return this.renders.findFirst({ where: { projectId }, orderBy: { version: 'desc' } });
  }

  async findByDigest(projectId: string, digest: string): Promise<ConstitutionRenderRecord | null> {
    return this.renders.findFirst({ where: { projectId, digest } });
  }

  async append(row: ConstitutionRenderRecord): Promise<ConstitutionRenderRecord> {
    return this.renders.create({ data: { ...row } });
  }

  async listForProject(projectId: string): Promise<ConstitutionRenderRecord[]> {
    return this.renders.findMany({ where: { projectId }, orderBy: { version: 'desc' } });
  }
}
