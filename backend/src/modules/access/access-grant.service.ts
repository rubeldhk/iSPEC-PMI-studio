/**
 * T377 + T380 — grant, revoke, the audited trail, and the last-editor
 * guarantee (FR-ACC-021, FR-ACC-022, FR-ACC-026, FR-ACC-027, SC-008, SC-013).
 *
 * Every grant and every revocation is written to the audit record with the
 * actor, the change and the time IN THE SAME OPERATION as the change itself —
 * the store's create/revoke take the audit record as a parameter, so a store
 * cannot apply one without the other (the Prisma store wraps both in one
 * transaction; the in-memory store applies both synchronously).
 *
 * The last-editor invariant is enforced INSIDE the revoke operation, not by a
 * pre-check — otherwise concurrent revocations race past it (data-model).
 *
 * Revocation is a timestamp, never a delete: the audit trail survives.
 */
import { ConflictError, NotFoundError, ValidationFailedError } from '../../core/errors.js';

const OPAQUE = 'Not found.';

export type AccessLevel = 'read' | 'edit';
export const ACCESS_LEVELS: readonly AccessLevel[] = ['read', 'edit'];

export interface ArtifactRef {
  artifactType: string;
  artifactId: string;
}

export interface AccessGrantRecord extends ArtifactRef {
  id: string;
  workspaceId: string;
  userId: string;
  level: AccessLevel;
  grantedById: string;
  grantedAt: Date;
  revokedAt: Date | null;
  revokedById: string | null;
}

/** FR-ACC-026 — actor, change, time. One row per grant or revoke. */
export interface AccessAuditRecord extends ArtifactRef {
  workspaceId: string;
  actorId: string;
  change: 'grant' | 'revoke';
  grantId: string | null;
  subjectUserId: string;
  level: AccessLevel;
  occurredAt: Date;
}

export interface GrantStore {
  /** Grant + audit as one unit — never one without the other (SC-013). */
  create(grant: Omit<AccessGrantRecord, 'id'>, audit: Omit<AccessAuditRecord, 'grantId'>): Promise<AccessGrantRecord>;
  /**
   * Revoke + last-editor check + audit as one unit. Throws ConflictError when
   * the revocation would leave the artifact with no active `edit` grant
   * (FR-ACC-027) — checked INSIDE the operation, not before it.
   */
  revoke(
    workspaceId: string,
    grantId: string,
    revokedById: string,
    at: Date,
  ): Promise<AccessGrantRecord>;
  find(workspaceId: string, grantId: string): Promise<AccessGrantRecord | null>;
  /** Active (unrevoked) grants on one artifact. */
  activeForArtifact(workspaceId: string, artifact: ArtifactRef): Promise<AccessGrantRecord[]>;
  auditTrailFor(workspaceId: string, artifact: ArtifactRef): Promise<AccessAuditRecord[]>;
}

export interface GrantInput {
  userId: string;
  level?: string;
  grantedById: string;
}

export class AccessGrantService {
  constructor(private readonly grants: GrantStore) {}

  /** FR-ACC-021 — grant read or edit, audited with actor, change, time. */
  async grant(
    workspaceId: string,
    artifact: ArtifactRef,
    input: GrantInput,
    at?: Date,
  ): Promise<AccessGrantRecord> {
    if (!input.level || !ACCESS_LEVELS.includes(input.level as AccessLevel)) {
      throw new ValidationFailedError('A grant requires a level.', {
        fields: [{ field: 'level', reason: `Must be one of: ${ACCESS_LEVELS.join(', ')}.` }],
      });
    }
    if (!input.userId) {
      throw new ValidationFailedError('A grant requires a user.', {
        fields: [{ field: 'userId', reason: 'Required.' }],
      });
    }
    const when = at ?? new Date();
    return this.grants.create(
      {
        workspaceId,
        artifactType: artifact.artifactType,
        artifactId: artifact.artifactId,
        userId: input.userId,
        level: input.level as AccessLevel,
        grantedById: input.grantedById,
        grantedAt: when,
        revokedAt: null,
        revokedById: null,
      },
      {
        workspaceId,
        artifactType: artifact.artifactType,
        artifactId: artifact.artifactId,
        actorId: input.grantedById,
        change: 'grant',
        subjectUserId: input.userId,
        level: input.level as AccessLevel,
        occurredAt: when,
      },
    );
  }

  /** FR-ACC-022/027 — revoke; the invariant lives in the store operation. */
  async revoke(
    workspaceId: string,
    grantId: string,
    revokedById: string,
    at?: Date,
  ): Promise<AccessGrantRecord> {
    const existing = await this.grants.find(workspaceId, grantId);
    if (!existing) throw new NotFoundError(OPAQUE);
    if (existing.revokedAt !== null) {
      throw new ConflictError('This grant is already revoked.');
    }
    return this.grants.revoke(workspaceId, grantId, revokedById, at ?? new Date());
  }

  async activeGrants(workspaceId: string, artifact: ArtifactRef): Promise<AccessGrantRecord[]> {
    return this.grants.activeForArtifact(workspaceId, artifact);
  }

  async auditTrail(workspaceId: string, artifact: ArtifactRef): Promise<AccessAuditRecord[]> {
    return this.grants.auditTrailFor(workspaceId, artifact);
  }
}

// ------------------------------------------------------------- in-memory

export class InMemoryGrantStore implements GrantStore {
  private readonly rows = new Map<string, AccessGrantRecord>();
  private readonly audit: AccessAuditRecord[] = [];
  private seq = 0;

  async create(
    grant: Omit<AccessGrantRecord, 'id'>,
    audit: Omit<AccessAuditRecord, 'grantId'>,
  ): Promise<AccessGrantRecord> {
    const row: AccessGrantRecord = { id: `grant_${++this.seq}`, ...grant };
    // One unit: the row and its audit record land together or not at all.
    this.rows.set(row.id, row);
    this.audit.push({ ...audit, grantId: row.id });
    return { ...row };
  }

  async revoke(
    workspaceId: string,
    grantId: string,
    revokedById: string,
    at: Date,
  ): Promise<AccessGrantRecord> {
    const row = this.rows.get(grantId);
    if (!row || row.workspaceId !== workspaceId) throw new NotFoundError(OPAQUE);
    // FR-ACC-027 — INSIDE the operation: would this leave no editor?
    if (row.level === 'edit' && row.revokedAt === null) {
      const remainingEditors = [...this.rows.values()].filter(
        (g) =>
          g.workspaceId === workspaceId &&
          g.artifactType === row.artifactType &&
          g.artifactId === row.artifactId &&
          g.level === 'edit' &&
          g.revokedAt === null &&
          g.id !== grantId,
      );
      if (remainingEditors.length === 0) {
        throw new ConflictError(
          'Revoking this grant would leave the artifact with no user holding edit access (FR-ACC-027).',
        );
      }
    }
    const next: AccessGrantRecord = { ...row, revokedAt: at, revokedById };
    this.rows.set(grantId, next);
    this.audit.push({
      workspaceId,
      artifactType: row.artifactType,
      artifactId: row.artifactId,
      actorId: revokedById,
      change: 'revoke',
      grantId,
      subjectUserId: row.userId,
      level: row.level,
      occurredAt: at,
    });
    return { ...next };
  }

  async find(workspaceId: string, grantId: string): Promise<AccessGrantRecord | null> {
    const row = this.rows.get(grantId);
    return row && row.workspaceId === workspaceId ? { ...row } : null;
  }

  async activeForArtifact(workspaceId: string, artifact: ArtifactRef): Promise<AccessGrantRecord[]> {
    return [...this.rows.values()]
      .filter(
        (g) =>
          g.workspaceId === workspaceId &&
          g.artifactType === artifact.artifactType &&
          g.artifactId === artifact.artifactId &&
          g.revokedAt === null,
      )
      .map((g) => ({ ...g }));
  }

  async auditTrailFor(workspaceId: string, artifact: ArtifactRef): Promise<AccessAuditRecord[]> {
    return this.audit
      .filter(
        (a) =>
          a.workspaceId === workspaceId &&
          a.artifactType === artifact.artifactType &&
          a.artifactId === artifact.artifactId,
      )
      .map((a) => ({ ...a }));
  }

  /** SnapshotGrantSource — the initiator's active grants (FR-ACC-028). */
  async activeForUser(workspaceId: string, userId: string): Promise<AccessGrantRecord[]> {
    return [...this.rows.values()]
      .filter((g) => g.workspaceId === workspaceId && g.userId === userId && g.revokedAt === null)
      .map((g) => ({ ...g }));
  }

  /** SnapshotGrantSource — every artifact currently carrying any active grant. */
  async restrictedArtifacts(workspaceId: string): Promise<ArtifactRef[]> {
    const seen = new Map<string, ArtifactRef>();
    for (const g of this.rows.values()) {
      if (g.workspaceId === workspaceId && g.revokedAt === null) {
        seen.set(`${g.artifactType}:${g.artifactId}`, {
          artifactType: g.artifactType,
          artifactId: g.artifactId,
        });
      }
    }
    return [...seen.values()];
  }
}
