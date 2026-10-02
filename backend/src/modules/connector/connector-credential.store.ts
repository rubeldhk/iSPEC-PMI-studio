/**
 * `T1356` (EPIC-041) — the connector credential store (`data-model.md` §3).
 *
 * The record carries a prefix and a digest, never a value. There is no
 * `expiresAt`: the only thing that ends a credential is `revokedAt`, set once
 * and never cleared (`FR-LPW-023`, `FR-LPW-028`). No method deletes.
 * `lastUsedAt` is written at most once per minute so a busy connector does
 * not cost a write per call.
 */
import { NotFoundError } from '../../core/errors.js';

export interface ConnectorCredentialRecord {
  readonly id: string;
  readonly workspaceId: string;
  /** Scope is one project (`FR-LPW-020`, `FR-LPW-025`). */
  readonly projectId: string;
  /** The `Principal` of kind `connector` this credential authenticates (`R-041-3`). */
  readonly principalId: string;
  readonly tokenPrefix: string;
  /** `sha256(value)`, hex. The value is never stored (`FR-LPW-021`). */
  readonly tokenHash: string;
  readonly label: string;
  readonly createdById: string;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly revokedById: string | null;
  /**
   * EPIC-043 T1411 (R-043-3): the identity snapshot captured at mint. Null on a
   * credential minted before EPIC-043 until its first guarded call completes it.
   */
  readonly snapshotId?: string | null;
}

export interface CredentialListFilter {
  readonly revoked?: boolean;
  readonly label?: string;
}

export const LAST_USED_WRITE_INTERVAL_MS = 60_000;

export interface ConnectorCredentialStore {
  create(record: ConnectorCredentialRecord): Promise<ConnectorCredentialRecord>;
  /** Unscoped by design: a presented token names no workspace. The digest decides. */
  findByPrefix(tokenPrefix: string): Promise<ConnectorCredentialRecord[]>;
  find(workspaceId: string, id: string): Promise<ConnectorCredentialRecord | null>;
  listForProject(workspaceId: string, projectId: string, filter?: CredentialListFilter): Promise<ConnectorCredentialRecord[]>;
  /** Writes when `lastUsedAt` is null or older than the interval. Returns whether it wrote. */
  touchLastUsed(id: string, at: Date): Promise<boolean>;
  /** Sets `revokedAt` once. A second call returns the record unchanged. */
  revoke(workspaceId: string, id: string, revokedById: string, at: Date): Promise<ConnectorCredentialRecord>;
  /** EPIC-043 T1411 — record (or clear, in tests) the identity snapshot the credential carries. */
  setSnapshot(id: string, snapshotId: string | null): Promise<ConnectorCredentialRecord>;
}

const OPAQUE = 'Not found.';

function matches(r: ConnectorCredentialRecord, filter: CredentialListFilter): boolean {
  if (filter.revoked === true && r.revokedAt === null) return false;
  if (filter.revoked === false && r.revokedAt !== null) return false;
  if (filter.label !== undefined && r.label !== filter.label) return false;
  return true;
}

function shouldTouch(lastUsedAt: Date | null, at: Date): boolean {
  return lastUsedAt === null || at.getTime() - lastUsedAt.getTime() >= LAST_USED_WRITE_INTERVAL_MS;
}

export class InMemoryConnectorCredentialStore implements ConnectorCredentialStore {
  private readonly rows = new Map<string, ConnectorCredentialRecord>();

  async create(record: ConnectorCredentialRecord): Promise<ConnectorCredentialRecord> {
    const row = Object.freeze({ ...record });
    this.rows.set(row.id, row);
    return row;
  }

  async findByPrefix(tokenPrefix: string): Promise<ConnectorCredentialRecord[]> {
    return [...this.rows.values()].filter((r) => r.tokenPrefix === tokenPrefix);
  }

  async find(workspaceId: string, id: string): Promise<ConnectorCredentialRecord | null> {
    const row = this.rows.get(id);
    return row !== undefined && row.workspaceId === workspaceId ? row : null;
  }

  async listForProject(workspaceId: string, projectId: string, filter: CredentialListFilter = {}): Promise<ConnectorCredentialRecord[]> {
    return [...this.rows.values()]
      .filter((r) => r.workspaceId === workspaceId && r.projectId === projectId && matches(r, filter))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async touchLastUsed(id: string, at: Date): Promise<boolean> {
    const row = this.rows.get(id);
    if (row === undefined || !shouldTouch(row.lastUsedAt, at)) return false;
    this.rows.set(id, Object.freeze({ ...row, lastUsedAt: at }));
    return true;
  }

  async revoke(workspaceId: string, id: string, revokedById: string, at: Date): Promise<ConnectorCredentialRecord> {
    const row = await this.find(workspaceId, id);
    if (row === null) throw new NotFoundError(OPAQUE);
    if (row.revokedAt !== null) return row;
    const revoked = Object.freeze({ ...row, revokedAt: at, revokedById });
    this.rows.set(id, revoked);
    return revoked;
  }

  async setSnapshot(id: string, snapshotId: string | null): Promise<ConnectorCredentialRecord> {
    const row = this.rows.get(id);
    if (row === undefined) throw new NotFoundError(OPAQUE);
    const updated = Object.freeze({ ...row, snapshotId });
    this.rows.set(id, updated);
    return updated;
  }
}

/** The subset of `PrismaClient['connectorCredential']` the store uses. */
export interface ConnectorCredentialDelegate {
  create(args: { data: ConnectorCredentialRecord }): Promise<ConnectorCredentialRecord>;
  findMany(args: { where: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }): Promise<ConnectorCredentialRecord[]>;
  findFirst(args: { where: Record<string, unknown> }): Promise<ConnectorCredentialRecord | null>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<ConnectorCredentialRecord>;
}

export class PrismaConnectorCredentialStore implements ConnectorCredentialStore {
  constructor(private readonly credentials: ConnectorCredentialDelegate) {}

  async create(record: ConnectorCredentialRecord): Promise<ConnectorCredentialRecord> {
    return this.credentials.create({ data: record });
  }

  async findByPrefix(tokenPrefix: string): Promise<ConnectorCredentialRecord[]> {
    return this.credentials.findMany({ where: { tokenPrefix } });
  }

  async find(workspaceId: string, id: string): Promise<ConnectorCredentialRecord | null> {
    return this.credentials.findFirst({ where: { id, workspaceId } });
  }

  async listForProject(workspaceId: string, projectId: string, filter: CredentialListFilter = {}): Promise<ConnectorCredentialRecord[]> {
    return this.credentials.findMany({
      where: {
        workspaceId,
        projectId,
        ...(filter.revoked === true ? { revokedAt: { not: null } } : {}),
        ...(filter.revoked === false ? { revokedAt: null } : {}),
        ...(filter.label !== undefined ? { label: filter.label } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async touchLastUsed(id: string, at: Date): Promise<boolean> {
    const row = await this.credentials.findFirst({ where: { id } });
    if (row === null || !shouldTouch(row.lastUsedAt, at)) return false;
    await this.credentials.update({ where: { id }, data: { lastUsedAt: at } });
    return true;
  }

  async revoke(workspaceId: string, id: string, revokedById: string, at: Date): Promise<ConnectorCredentialRecord> {
    const row = await this.find(workspaceId, id);
    if (row === null) throw new NotFoundError(OPAQUE);
    if (row.revokedAt !== null) return row;
    return this.credentials.update({ where: { id }, data: { revokedAt: at, revokedById } });
  }

  async setSnapshot(id: string, snapshotId: string | null): Promise<ConnectorCredentialRecord> {
    return this.credentials.update({ where: { id }, data: { snapshotId } });
  }
}
