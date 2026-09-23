/**
 * `T1624` (EPIC-045, data-model.md §1–§3, §8) — the artifact store. Interface,
 * in-memory (tests and database-less runs) and Prisma under `DATABASE_URL`;
 * asserted by `tests/architecture/durable-stores.spec.ts`.
 *
 * ## The unique index is the arbiter, not a check
 *
 * `createVersion` does not ask "does this digest exist?" and then insert — two
 * syncs running at once would both get *no* and both insert. It **inserts**,
 * and on the unique violation reads the existing row back. That is the only
 * shape that is correct under concurrency, and it is why `FR-ART-006` is a
 * property of the schema rather than of the service (`DEF-044-003`'s rule).
 *
 * The in-memory store enforces **the same two indexes**, and throws the same
 * `P2002`-shaped error the driver throws — so the unit suites see the race the
 * integration suites see instead of a store that silently tolerates it.
 *
 * ## Nothing updates or deletes
 *
 * `FR-ART-001`. There is no `update`, no `delete` and no `upsert` on this
 * interface: a synced version is a fact about what an execution produced, and
 * a fact that can be edited is not one. The absence is asserted, not implied
 * (`artifact.store.spec.ts`).
 */
import { randomUUID } from 'node:crypto';

export const ARTIFACT_KINDS = ['spec', 'plan', 'tasks', 'research', 'data-model', 'analysis', 'quickstart', 'contract', 'checklist'] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export const SYNC_OUTCOMES = ['created', 'reused', 'refused'] as const;
export type SyncOutcome = (typeof SYNC_OUTCOMES)[number];

/** The closed per-file vocabulary (`contracts/artifacts-api.md` §1). */
export const REFUSAL_CODES = ['digest_mismatch', 'path_not_in_artifact_set', 'path_escapes_epic', 'not_utf8', 'too_large', 'credential_shape', 'too_many_files'] as const;
export type RefusalCode = (typeof REFUSAL_CODES)[number];

export interface ArtifactVersionRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly path: string;
  readonly kind: ArtifactKind;
  readonly digest: string;
  readonly sizeBytes: number;
  readonly content: string;
  readonly firstExecutionId: string;
  readonly firstSyncedAt: Date;
}

/** Everything but the id and the timestamp, which the store allocates. */
export type NewArtifactVersion = Omit<ArtifactVersionRecord, 'id' | 'firstSyncedAt'>;

export interface ArtifactSyncRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly executionId: string;
  readonly epicId: string | null;
  readonly credentialId: string;
  readonly idempotencyKey: string;
  readonly createdCount: number;
  readonly reusedCount: number;
  readonly refusedCount: number;
  readonly syncedAt: Date;
}

export type NewArtifactSync = Omit<ArtifactSyncRecord, 'id' | 'syncedAt'>;

export interface ArtifactSyncFileRecord {
  readonly id: string;
  /** The sync's workspace, carried so the row can be tenant-isolated (`FR-002`). */
  readonly workspaceId: string;
  readonly syncId: string;
  readonly path: string;
  readonly digest: string;
  readonly outcome: SyncOutcome;
  readonly versionId: string | null;
  readonly refusalCode: RefusalCode | null;
  readonly refusalDetail: string | null;
}

/** The store supplies the id, the sync and its workspace. */
export type NewArtifactSyncFile = Omit<ArtifactSyncFileRecord, 'id' | 'syncId' | 'workspaceId'>;

export interface CreateVersionOutcome {
  readonly row: ArtifactVersionRecord;
  /** false when the same `(projectId, path, digest)` already existed. */
  readonly created: boolean;
}

export interface RecordSyncOutcome {
  readonly row: ArtifactSyncRecord;
  /** true when a sync with this `(workspaceId, idempotencyKey)` already existed; nothing was written. */
  readonly replayed: boolean;
}

export interface ArtifactStore {
  /** Insert, or read back the existing row on the unique violation. Safe under concurrency. */
  createVersion(row: NewArtifactVersion): Promise<CreateVersionOutcome>;
  findVersion(id: string): Promise<ArtifactVersionRecord | null>;
  /** The versions of a set of paths for a project — content included; used by the content read only. */
  versionsByIds(ids: readonly string[]): Promise<ArtifactVersionRecord[]>;
  /** Insert the sync and its manifest in one transaction, or return the stored sync for a replayed key. */
  recordSync(row: NewArtifactSync, files: readonly NewArtifactSyncFile[]): Promise<RecordSyncOutcome>;
  findSyncByKey(workspaceId: string, idempotencyKey: string): Promise<ArtifactSyncRecord | null>;
  findSync(id: string): Promise<ArtifactSyncRecord | null>;
  /** The Epic's syncs, newest first. */
  syncsForEpic(workspaceId: string, epicId: string): Promise<ArtifactSyncRecord[]>;
  /** The project's syncs bound to no Epic, newest first (`FR-ART-007`). */
  unboundSyncs(workspaceId: string, projectId: string): Promise<ArtifactSyncRecord[]>;
  syncsForExecution(workspaceId: string, executionId: string): Promise<ArtifactSyncRecord[]>;
  /** Syncs by id, in one statement (review finding 3). */
  syncsByIds(ids: readonly string[]): Promise<ArtifactSyncRecord[]>;
  manifestFor(syncId: string): Promise<ArtifactSyncFileRecord[]>;
  /** Every manifest row that references a version — the content read's `deliveredBy`, in one statement (review finding 3). */
  manifestsForVersion(versionId: string): Promise<ArtifactSyncFileRecord[]>;
  /**
   * The manifests of many syncs at once, **without loading content** — the tree
   * read's one statement (`SC-ART-006`, data-model.md §8).
   */
  manifestsFor(syncIds: readonly string[]): Promise<ArtifactSyncFileRecord[]>;
  /** Version metadata for the tree: everything but `content` (`SC-ART-006`). */
  versionSummariesByIds(ids: readonly string[]): Promise<Omit<ArtifactVersionRecord, 'content'>[]>;
}

/**
 * A unique-index violation, in every shape it reaches this code: the ORM's
 * `P2002` (with `meta.target`), a raw statement's `P2010` wrapping PostgreSQL's
 * `23505` (with the constraint name in `meta.message`), or the driver's bare
 * `23505`. `field` narrows it to one index by column name — which every index
 * name in this schema carries (`DEF-045-002`: the specification tables are
 * written with raw SQL, and their violations arrive as `P2010`, not `P2002`).
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

/** Strips `content` without copying it into a new string. */
function summarise(row: ArtifactVersionRecord): Omit<ArtifactVersionRecord, 'content'> {
  const { content: _content, ...rest } = row;
  return rest;
}

export class InMemoryArtifactStore implements ArtifactStore {
  private readonly versions = new Map<string, ArtifactVersionRecord>();
  private readonly syncs = new Map<string, ArtifactSyncRecord>();
  private readonly files = new Map<string, ArtifactSyncFileRecord[]>();

  /**
   * The raw insert, which throws on the unique index exactly as the database
   * does. Exposed so the store's own tests can observe the violation rather
   * than only its handling.
   */
  async insertVersion(row: NewArtifactVersion): Promise<ArtifactVersionRecord> {
    if ([...this.versions.values()].some((r) => r.projectId === row.projectId && r.path === row.path && r.digest === row.digest)) {
      throw uniqueViolation(['projectId', 'path', 'digest']);
    }
    const frozen = Object.freeze({ ...row, id: randomUUID(), firstSyncedAt: new Date() });
    this.versions.set(frozen.id, frozen);
    return frozen;
  }

  async createVersion(row: NewArtifactVersion): Promise<CreateVersionOutcome> {
    try {
      return { row: await this.insertVersion(row), created: true };
    } catch (err) {
      if (!isUniqueViolation(err, 'digest')) throw err;
      const existing = [...this.versions.values()].find((r) => r.projectId === row.projectId && r.path === row.path && r.digest === row.digest);
      // The index fired, so the row is there; a miss would be a store bug, not a race.
      if (!existing) throw err;
      return { row: existing, created: false };
    }
  }

  async findVersion(id: string): Promise<ArtifactVersionRecord | null> {
    return this.versions.get(id) ?? null;
  }

  async versionsByIds(ids: readonly string[]): Promise<ArtifactVersionRecord[]> {
    return ids.map((id) => this.versions.get(id)).filter((r): r is ArtifactVersionRecord => r !== undefined);
  }

  async versionSummariesByIds(ids: readonly string[]): Promise<Omit<ArtifactVersionRecord, 'content'>[]> {
    // Deliberately NOT `versionsByIds(...).map(summarise)`. The two are
    // different reads — one loads content, one must not — and routing the
    // summary through the content path would hide that distinction from the
    // spy in `artifact-read.service.spec.ts`, which is the only thing standing
    // between the tree read and a megabyte per row (`SC-ART-006`).
    return ids
      .map((id) => this.versions.get(id))
      .filter((r): r is ArtifactVersionRecord => r !== undefined)
      .map(summarise);
  }

  async insertSync(row: NewArtifactSync, files: readonly NewArtifactSyncFile[]): Promise<ArtifactSyncRecord> {
    if ([...this.syncs.values()].some((r) => r.workspaceId === row.workspaceId && r.idempotencyKey === row.idempotencyKey)) {
      throw uniqueViolation(['workspaceId', 'idempotencyKey']);
    }
    const frozen = Object.freeze({ ...row, id: randomUUID(), syncedAt: new Date() });
    this.syncs.set(frozen.id, frozen);
    this.files.set(
      frozen.id,
      files.map((f) => Object.freeze({ ...f, id: randomUUID(), syncId: frozen.id, workspaceId: frozen.workspaceId })),
    );
    return frozen;
  }

  async recordSync(row: NewArtifactSync, files: readonly NewArtifactSyncFile[]): Promise<RecordSyncOutcome> {
    try {
      return { row: await this.insertSync(row, files), replayed: false };
    } catch (err) {
      if (!isUniqueViolation(err, 'idempotencyKey')) throw err;
      const existing = [...this.syncs.values()].find((r) => r.workspaceId === row.workspaceId && r.idempotencyKey === row.idempotencyKey);
      if (!existing) throw err;
      return { row: existing, replayed: true };
    }
  }

  async findSyncByKey(workspaceId: string, idempotencyKey: string): Promise<ArtifactSyncRecord | null> {
    return [...this.syncs.values()].find((r) => r.workspaceId === workspaceId && r.idempotencyKey === idempotencyKey) ?? null;
  }

  async findSync(id: string): Promise<ArtifactSyncRecord | null> {
    return this.syncs.get(id) ?? null;
  }

  async syncsForEpic(workspaceId: string, epicId: string): Promise<ArtifactSyncRecord[]> {
    return [...this.syncs.values()].filter((r) => r.workspaceId === workspaceId && r.epicId === epicId).sort(newest);
  }

  async unboundSyncs(workspaceId: string, projectId: string): Promise<ArtifactSyncRecord[]> {
    return [...this.syncs.values()].filter((r) => r.workspaceId === workspaceId && r.projectId === projectId && r.epicId === null).sort(newest);
  }

  async syncsForExecution(workspaceId: string, executionId: string): Promise<ArtifactSyncRecord[]> {
    return [...this.syncs.values()].filter((r) => r.workspaceId === workspaceId && r.executionId === executionId).sort(newest);
  }

  async syncsByIds(ids: readonly string[]): Promise<ArtifactSyncRecord[]> {
    return ids.map((id) => this.syncs.get(id)).filter((s): s is ArtifactSyncRecord => s !== undefined);
  }

  async manifestFor(syncId: string): Promise<ArtifactSyncFileRecord[]> {
    return [...(this.files.get(syncId) ?? [])];
  }

  async manifestsFor(syncIds: readonly string[]): Promise<ArtifactSyncFileRecord[]> {
    return syncIds.flatMap((id) => this.files.get(id) ?? []);
  }

  async manifestsForVersion(versionId: string): Promise<ArtifactSyncFileRecord[]> {
    return [...this.files.values()].flat().filter((f) => f.versionId === versionId);
  }
}

/** The subset of the Prisma client this store uses. */
export interface ArtifactDb {
  artifactVersion: {
    create(args: { data: Record<string, unknown> }): Promise<ArtifactVersionRecord>;
    findFirst(args: { where: Record<string, unknown> }): Promise<ArtifactVersionRecord | null>;
    findMany(args: { where: Record<string, unknown>; select?: Record<string, boolean> }): Promise<ArtifactVersionRecord[]>;
  };
  artifactSync: {
    create(args: { data: Record<string, unknown> }): Promise<ArtifactSyncRecord>;
    findFirst(args: { where: Record<string, unknown> }): Promise<ArtifactSyncRecord | null>;
    findMany(args: { where: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }): Promise<ArtifactSyncRecord[]>;
  };
  artifactSyncFile: {
    createMany(args: { data: Record<string, unknown>[] }): Promise<{ count: number }>;
    findMany(args: { where: Record<string, unknown> }): Promise<ArtifactSyncFileRecord[]>;
  };
  $transaction<T>(fn: (tx: ArtifactDb) => Promise<T>): Promise<T>;
}

export class PrismaArtifactStore implements ArtifactStore {
  constructor(private readonly db: ArtifactDb) {}

  async createVersion(row: NewArtifactVersion): Promise<CreateVersionOutcome> {
    // Insert first. Reading first and inserting second is the shape that loses
    // the race: both callers read absent, both insert, one gets a driver error
    // the caller did not plan for. Here the violation IS the plan.
    try {
      return { row: await this.db.artifactVersion.create({ data: { id: randomUUID(), ...row } }), created: true };
    } catch (err) {
      if (!isUniqueViolation(err, 'digest')) throw err;
      const existing = await this.db.artifactVersion.findFirst({ where: { projectId: row.projectId, path: row.path, digest: row.digest } });
      if (!existing) throw err;
      return { row: existing, created: false };
    }
  }

  async findVersion(id: string): Promise<ArtifactVersionRecord | null> {
    return this.db.artifactVersion.findFirst({ where: { id } });
  }

  async versionsByIds(ids: readonly string[]): Promise<ArtifactVersionRecord[]> {
    if (ids.length === 0) return [];
    return this.db.artifactVersion.findMany({ where: { id: { in: [...ids] } } });
  }

  async versionSummariesByIds(ids: readonly string[]): Promise<Omit<ArtifactVersionRecord, 'content'>[]> {
    if (ids.length === 0) return [];
    // `content` is deliberately absent from the projection: the tree of an Epic
    // with 50 files × 20 versions must not drag a megabyte per row across the
    // wire to show a size and a digest (`SC-ART-006`, data-model.md §8).
    return this.db.artifactVersion.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, workspaceId: true, projectId: true, path: true, kind: true, digest: true, sizeBytes: true, firstExecutionId: true, firstSyncedAt: true },
    }) as unknown as Promise<Omit<ArtifactVersionRecord, 'content'>[]>;
  }

  async recordSync(row: NewArtifactSync, files: readonly NewArtifactSyncFile[]): Promise<RecordSyncOutcome> {
    try {
      const created = await this.db.$transaction(async (tx) => {
        const sync = await tx.artifactSync.create({ data: { id: randomUUID(), ...row } });
        if (files.length > 0) {
          await tx.artifactSyncFile.createMany({ data: files.map((f) => ({ id: randomUUID(), syncId: sync.id, workspaceId: sync.workspaceId, ...f })) });
        }
        return sync;
      });
      return { row: created, replayed: false };
    } catch (err) {
      if (!isUniqueViolation(err, 'idempotencyKey')) throw err;
      const existing = await this.db.artifactSync.findFirst({ where: { workspaceId: row.workspaceId, idempotencyKey: row.idempotencyKey } });
      if (!existing) throw err;
      return { row: existing, replayed: true };
    }
  }

  async findSyncByKey(workspaceId: string, idempotencyKey: string): Promise<ArtifactSyncRecord | null> {
    return this.db.artifactSync.findFirst({ where: { workspaceId, idempotencyKey } });
  }

  async findSync(id: string): Promise<ArtifactSyncRecord | null> {
    return this.db.artifactSync.findFirst({ where: { id } });
  }

  async syncsForEpic(workspaceId: string, epicId: string): Promise<ArtifactSyncRecord[]> {
    return this.db.artifactSync.findMany({ where: { workspaceId, epicId }, orderBy: { syncedAt: 'desc' } });
  }

  async unboundSyncs(workspaceId: string, projectId: string): Promise<ArtifactSyncRecord[]> {
    return this.db.artifactSync.findMany({ where: { workspaceId, projectId, epicId: null }, orderBy: { syncedAt: 'desc' } });
  }

  async syncsForExecution(workspaceId: string, executionId: string): Promise<ArtifactSyncRecord[]> {
    return this.db.artifactSync.findMany({ where: { workspaceId, executionId }, orderBy: { syncedAt: 'desc' } });
  }

  async syncsByIds(ids: readonly string[]): Promise<ArtifactSyncRecord[]> {
    if (ids.length === 0) return [];
    return this.db.artifactSync.findMany({ where: { id: { in: [...ids] } } });
  }

  async manifestFor(syncId: string): Promise<ArtifactSyncFileRecord[]> {
    return this.db.artifactSyncFile.findMany({ where: { syncId } });
  }

  async manifestsForVersion(versionId: string): Promise<ArtifactSyncFileRecord[]> {
    // The `(versionId)` index makes this one indexed statement (review finding 3).
    return this.db.artifactSyncFile.findMany({ where: { versionId } });
  }

  async manifestsFor(syncIds: readonly string[]): Promise<ArtifactSyncFileRecord[]> {
    if (syncIds.length === 0) return [];
    // One statement for every sync of the Epic, not one per sync (`R-045-7`).
    return this.db.artifactSyncFile.findMany({ where: { syncId: { in: [...syncIds] } } });
  }
}
