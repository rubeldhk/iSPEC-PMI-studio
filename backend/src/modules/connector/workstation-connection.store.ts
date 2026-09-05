/**
 * `T1449` (EPIC-043, `R-043-8`, data-model.md §1) — one workstation connection
 * per credential. Interface, in-memory (tests) and Prisma under `DATABASE_URL`;
 * asserted by `tests/architecture/durable-stores.spec.ts`. Never deleted.
 */

export interface WorkstationConnectionRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly credentialId: string;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly extensionVersion: string | null;
  readonly toolkitVersion: string | null;
  readonly contractVersion: string;
  readonly serverVersion: string | null;
  // EPIC-042 T1489 (R-042-5): what the workstation last reported about its constitution file.
  readonly constitutionDigest: string | null;
  readonly constitutionState: string | null;
  readonly constitutionReportedAt: Date | null;
}

export interface TouchInput {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly credentialId: string;
  readonly at: Date;
  readonly extensionVersion?: string | undefined;
  readonly toolkitVersion?: string | undefined;
  readonly contractVersion: string;
  readonly serverVersion?: string | undefined;
  /** Present when the caller reported its file: the digest (or null for absent) and the state classified from it. */
  readonly constitution?: { readonly digest: string | null; readonly state: string } | undefined;
}

export interface WorkstationConnectionStore {
  /** Create on first call, update after — one row per credential. */
  touch(input: TouchInput): Promise<WorkstationConnectionRecord>;
  findByCredential(credentialId: string): Promise<WorkstationConnectionRecord | null>;
  listForProject(workspaceId: string, projectId: string): Promise<WorkstationConnectionRecord[]>;
}

export class InMemoryWorkstationConnectionStore implements WorkstationConnectionStore {
  private readonly rows = new Map<string, WorkstationConnectionRecord>();

  async touch(input: TouchInput): Promise<WorkstationConnectionRecord> {
    const existing = this.rows.get(input.credentialId);
    const row: WorkstationConnectionRecord = Object.freeze({
      id: existing?.id ?? input.id,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      credentialId: input.credentialId,
      firstSeenAt: existing?.firstSeenAt ?? input.at,
      lastSeenAt: input.at,
      extensionVersion: input.extensionVersion ?? existing?.extensionVersion ?? null,
      toolkitVersion: input.toolkitVersion ?? existing?.toolkitVersion ?? null,
      contractVersion: input.contractVersion,
      serverVersion: input.serverVersion ?? existing?.serverVersion ?? null,
      constitutionDigest: input.constitution ? input.constitution.digest : (existing?.constitutionDigest ?? null),
      constitutionState: input.constitution ? input.constitution.state : (existing?.constitutionState ?? null),
      constitutionReportedAt: input.constitution ? input.at : (existing?.constitutionReportedAt ?? null),
    });
    this.rows.set(input.credentialId, row);
    return row;
  }

  async findByCredential(credentialId: string): Promise<WorkstationConnectionRecord | null> {
    return this.rows.get(credentialId) ?? null;
  }

  async listForProject(workspaceId: string, projectId: string): Promise<WorkstationConnectionRecord[]> {
    return [...this.rows.values()]
      .filter((r) => r.workspaceId === workspaceId && r.projectId === projectId)
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
  }
}

/** The subset of `PrismaClient['workstationConnection']` the store uses. */
export interface WorkstationConnectionDelegate {
  upsert(args: { where: { credentialId: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<WorkstationConnectionRecord>;
  findUnique(args: { where: { credentialId: string } }): Promise<WorkstationConnectionRecord | null>;
  findMany(args: { where: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }): Promise<WorkstationConnectionRecord[]>;
}

export class PrismaWorkstationConnectionStore implements WorkstationConnectionStore {
  constructor(private readonly connections: WorkstationConnectionDelegate) {}

  async touch(input: TouchInput): Promise<WorkstationConnectionRecord> {
    const versions = {
      ...(input.extensionVersion !== undefined ? { extensionVersion: input.extensionVersion } : {}),
      ...(input.toolkitVersion !== undefined ? { toolkitVersion: input.toolkitVersion } : {}),
      ...(input.serverVersion !== undefined ? { serverVersion: input.serverVersion } : {}),
      contractVersion: input.contractVersion,
      ...(input.constitution ? { constitutionDigest: input.constitution.digest, constitutionState: input.constitution.state, constitutionReportedAt: input.at } : {}),
    };
    return this.connections.upsert({
      where: { credentialId: input.credentialId },
      create: {
        id: input.id,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        credentialId: input.credentialId,
        firstSeenAt: input.at,
        lastSeenAt: input.at,
        extensionVersion: input.extensionVersion ?? null,
        toolkitVersion: input.toolkitVersion ?? null,
        serverVersion: input.serverVersion ?? null,
        contractVersion: input.contractVersion,
        constitutionDigest: input.constitution?.digest ?? null,
        constitutionState: input.constitution?.state ?? null,
        constitutionReportedAt: input.constitution ? input.at : null,
      },
      update: { lastSeenAt: input.at, ...versions },
    });
  }

  async findByCredential(credentialId: string): Promise<WorkstationConnectionRecord | null> {
    return this.connections.findUnique({ where: { credentialId } });
  }

  async listForProject(workspaceId: string, projectId: string): Promise<WorkstationConnectionRecord[]> {
    return this.connections.findMany({ where: { workspaceId, projectId }, orderBy: { lastSeenAt: 'desc' } });
  }
}
