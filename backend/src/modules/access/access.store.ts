/**
 * EPIC-024 — the Prisma-backed access store (T377/T378/T380 persistence).
 *
 * The properties the in-memory store merely promises are STRUCTURAL here:
 *
 *   - grant/revoke and their audit rows land in ONE transaction (FR-ACC-026);
 *   - the last-editor invariant is checked INSIDE the revoke transaction,
 *     behind a `FOR UPDATE` lock on the artifact's edit grants, so two
 *     concurrent revocations serialize instead of racing past the check
 *     (FR-ACC-027, SC-008 — G-02.5's "mocking would produce a false pass");
 *   - a refusal and its AccessAttemptRecord are one transaction (SC-007).
 */
import { ConflictError, NotFoundError } from '../../core/errors.js';
import type {
  AccessAuditRecord,
  AccessGrantRecord,
  ArtifactRef,
  GrantStore,
} from './access-grant.service.js';
import type { AccessAttempt, AttemptStore } from './access-enforcement.service.js';
import type { SnapshotGrantSource } from './access-snapshot.service.js';

const OPAQUE = 'Not found.';

interface GrantRow {
  id: string;
  workspaceId: string;
  artifactType: string;
  artifactId: string;
  userId: string;
  level: string;
  grantedById: string;
  grantedAt: Date;
  revokedAt: Date | null;
  revokedById: string | null;
}

interface AttemptRow {
  id: string;
  workspaceId: string;
  userId: string;
  artifactType: string;
  artifactId: string;
  action: string;
  reason: string;
  attemptedAt: Date;
}

export interface AccessTx {
  accessGrant: {
    create(args: { data: Record<string, unknown> }): Promise<GrantRow>;
    findUnique(args: { where: { id: string } }): Promise<GrantRow | null>;
    findMany(args: { where: Record<string, unknown> }): Promise<GrantRow[]>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<GrantRow>;
  };
  accessAttemptRecord: {
    create(args: { data: Record<string, unknown> }): Promise<AttemptRow>;
    findMany(args: { where: Record<string, unknown> }): Promise<AttemptRow[]>;
  };
  auditEntry: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    findMany(args: { where: Record<string, unknown> }): Promise<{ detail: unknown }[]>;
  };
  $queryRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
}

export interface AccessDb extends AccessTx {
  $transaction<T>(fn: (tx: AccessTx) => Promise<T>): Promise<T>;
}

function toRecord(row: GrantRow): AccessGrantRecord {
  return { ...row, level: row.level as AccessGrantRecord['level'] };
}

export class PrismaAccessStore implements GrantStore, SnapshotGrantSource, AttemptStore {
  constructor(private readonly db: AccessDb) {}

  async create(
    grant: Omit<AccessGrantRecord, 'id'>,
    audit: Omit<AccessAuditRecord, 'grantId'>,
  ): Promise<AccessGrantRecord> {
    return this.db.$transaction(async (tx) => {
      const row = await tx.accessGrant.create({ data: { ...grant } });
      await tx.auditEntry.create({
        data: {
          workspaceId: audit.workspaceId,
          actorId: audit.actorId,
          action: 'create',
          targetType: 'access_grant',
          targetId: row.id,
          outcome: 'success',
          detail: { ...audit, grantId: row.id, occurredAt: audit.occurredAt.toISOString() },
          occurredAt: audit.occurredAt,
        },
      });
      return toRecord(row);
    });
  }

  async revoke(
    workspaceId: string,
    grantId: string,
    revokedById: string,
    at: Date,
  ): Promise<AccessGrantRecord> {
    return this.db.$transaction(async (tx) => {
      const row = await tx.accessGrant.findUnique({ where: { id: grantId } });
      if (!row || row.workspaceId !== workspaceId) throw new NotFoundError(OPAQUE);
      if (row.revokedAt !== null) throw new ConflictError('This grant is already revoked.');

      if (row.level === 'edit') {
        // Serialise concurrent revocations on this artifact: both transactions
        // queue on the same row locks, so the second SEES the first's revoke.
        await tx.$queryRawUnsafe(
          'SELECT "id" FROM "access_grants" WHERE "artifactType" = $1 AND "artifactId" = $2 ' +
            'AND "level" = \'edit\' AND "revokedAt" IS NULL FOR UPDATE',
          row.artifactType,
          row.artifactId,
        );
        const editors = await tx.accessGrant.findMany({
          where: {
            workspaceId,
            artifactType: row.artifactType,
            artifactId: row.artifactId,
            level: 'edit',
            revokedAt: null,
          },
        });
        if (editors.filter((e) => e.id !== grantId).length === 0) {
          throw new ConflictError(
            'Revoking this grant would leave the artifact with no user holding edit access (FR-ACC-027).',
          );
        }
      }

      const updated = await tx.accessGrant.update({
        where: { id: grantId },
        data: { revokedAt: at, revokedById },
      });
      await tx.auditEntry.create({
        data: {
          workspaceId,
          actorId: revokedById,
          action: 'update',
          targetType: 'access_grant',
          targetId: grantId,
          outcome: 'success',
          detail: {
            change: 'revoke',
            grantId,
            artifactType: row.artifactType,
            artifactId: row.artifactId,
            subjectUserId: row.userId,
            level: row.level,
            occurredAt: at.toISOString(),
          },
          occurredAt: at,
        },
      });
      return toRecord(updated);
    });
  }

  async find(workspaceId: string, grantId: string): Promise<AccessGrantRecord | null> {
    const row = await this.db.accessGrant.findUnique({ where: { id: grantId } });
    return row && row.workspaceId === workspaceId ? toRecord(row) : null;
  }

  async activeForArtifact(workspaceId: string, artifact: ArtifactRef): Promise<AccessGrantRecord[]> {
    const rows = await this.db.accessGrant.findMany({
      where: {
        workspaceId,
        artifactType: artifact.artifactType,
        artifactId: artifact.artifactId,
        revokedAt: null,
      },
    });
    return rows.map(toRecord);
  }

  async auditTrailFor(workspaceId: string, artifact: ArtifactRef): Promise<AccessAuditRecord[]> {
    const rows = await this.db.auditEntry.findMany({
      where: { workspaceId, targetType: 'access_grant' },
    });
    return rows
      .map((r) => r.detail as AccessAuditRecord & { occurredAt: string })
      .filter(
        (d) => d.artifactType === artifact.artifactType && d.artifactId === artifact.artifactId,
      )
      .map((d) => ({ ...d, occurredAt: new Date(d.occurredAt) }));
  }

  async activeForUser(workspaceId: string, userId: string): Promise<AccessGrantRecord[]> {
    const rows = await this.db.accessGrant.findMany({
      where: { workspaceId, userId, revokedAt: null },
    });
    return rows.map(toRecord);
  }

  async restrictedArtifacts(workspaceId: string): Promise<ArtifactRef[]> {
    const rows = await this.db.accessGrant.findMany({ where: { workspaceId, revokedAt: null } });
    const seen = new Map<string, ArtifactRef>();
    for (const g of rows) {
      seen.set(`${g.artifactType}:${g.artifactId}`, {
        artifactType: g.artifactType,
        artifactId: g.artifactId,
      });
    }
    return [...seen.values()];
  }

  async record(attempt: Omit<AccessAttempt, 'id'>): Promise<AccessAttempt> {
    const row = await this.db.accessAttemptRecord.create({ data: { ...attempt } });
    return row;
  }

  async listForArtifact(workspaceId: string, artifact: ArtifactRef): Promise<AccessAttempt[]> {
    return this.db.accessAttemptRecord.findMany({
      where: {
        workspaceId,
        artifactType: artifact.artifactType,
        artifactId: artifact.artifactId,
      },
    });
  }
}
