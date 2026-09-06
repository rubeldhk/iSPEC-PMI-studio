/**
 * `T1623` (EPIC-045, data-model.md §1–§3, §8) — the artifact store.
 *
 * Two unique indexes carry the whole idempotence story, so both are tested
 * against BOTH implementations of the store: the in-memory one throws the
 * same `P2002`-shaped error the driver throws, and the Prisma one reads the
 * existing row back on it. That symmetry is the `DEF-044-003` lesson — a unit
 * suite whose in-memory store silently tolerates what the database refuses
 * proves nothing about the race.
 *
 * `createVersion` is also driven CONCURRENTLY here, before any service exists.
 * Written to FAIL before `T1624`.
 */
import { describe, expect, it } from 'vitest';
import {
  InMemoryArtifactStore,
  PrismaArtifactStore,
  type ArtifactStore,
  type NewArtifactVersion,
} from '../../../src/modules/artifacts/artifact.store.js';

const WS = 'ws-1';
const PROJECT = 'proj-1';

function version(overrides: Partial<NewArtifactVersion> = {}): NewArtifactVersion {
  return {
    workspaceId: WS,
    projectId: PROJECT,
    path: 'specs/003-reports/spec.md',
    kind: 'spec',
    digest: 'a'.repeat(64),
    sizeBytes: 11,
    content: '# Reports\n',
    firstExecutionId: 'exec-1',
    ...overrides,
  };
}

/**
 * A Prisma delegate over a Map that behaves like the database: the unique index
 * is enforced, and a violation is `P2002` with the index's fields in
 * `meta.target`. Nothing else about Prisma matters to this store.
 */
function prismaBacked(): { store: ArtifactStore; versionRows: () => unknown[]; syncRows: () => unknown[] } {
  const versions: Record<string, unknown>[] = [];
  const syncs: Record<string, unknown>[] = [];
  const files: Record<string, unknown>[] = [];

  const p2002 = (target: string[]): Error => Object.assign(new Error(`Unique constraint failed on the fields: (${target.join(',')})`), { code: 'P2002', meta: { target } });

  const db = {
    artifactVersion: {
      async create({ data }: { data: Record<string, unknown> }): Promise<Record<string, unknown>> {
        if (versions.some((r) => r['projectId'] === data['projectId'] && r['path'] === data['path'] && r['digest'] === data['digest'])) {
          throw p2002(['projectId', 'path', 'digest']);
        }
        const row = { ...data, firstSyncedAt: new Date() };
        versions.push(row);
        return row;
      },
      async findFirst({ where }: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
        return versions.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null;
      },
      async findMany({ where }: { where: Record<string, unknown> }): Promise<Record<string, unknown>[]> {
        return versions.filter((r) => Object.entries(where).every(([k, v]) => (Array.isArray((v as { in?: unknown[] })?.in) ? ((v as { in: unknown[] }).in.includes(r[k])) : r[k] === v)));
      },
    },
    artifactSync: {
      async create({ data }: { data: Record<string, unknown> }): Promise<Record<string, unknown>> {
        if (syncs.some((r) => r['workspaceId'] === data['workspaceId'] && r['idempotencyKey'] === data['idempotencyKey'])) {
          throw p2002(['workspaceId', 'idempotencyKey']);
        }
        const row = { ...data, syncedAt: new Date() };
        syncs.push(row);
        return row;
      },
      async findFirst({ where }: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
        return syncs.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null;
      },
      async findMany({ where }: { where: Record<string, unknown> }): Promise<Record<string, unknown>[]> {
        return syncs.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v));
      },
    },
    artifactSyncFile: {
      async createMany({ data }: { data: Record<string, unknown>[] }): Promise<{ count: number }> {
        files.push(...data);
        return { count: data.length };
      },
      async findMany({ where }: { where: Record<string, unknown> }): Promise<Record<string, unknown>[]> {
        return files.filter((r) => Object.entries(where).every(([k, v]) => (Array.isArray((v as { in?: unknown[] })?.in) ? (v as { in: unknown[] }).in.includes(r[k]) : r[k] === v)));
      },
    },
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      return fn(db);
    },
  };

  return { store: new PrismaArtifactStore(db as never), versionRows: () => versions, syncRows: () => syncs };
}

const IMPLEMENTATIONS: readonly [string, () => ArtifactStore][] = [
  ['InMemoryArtifactStore', (): ArtifactStore => new InMemoryArtifactStore()],
  ['PrismaArtifactStore', (): ArtifactStore => prismaBacked().store],
];

describe.each(IMPLEMENTATIONS)('T1623 · %s · content once per digest (data-model §1)', (_name, make) => {
  it('creates a version and reports it created', async () => {
    const store = make();
    const result = await store.createVersion(version());
    expect(result.created).toBe(true);
    expect(result.row.digest).toBe('a'.repeat(64));
    expect(result.row.content).toBe('# Reports\n');
    expect(result.row.id, 'the store allocates the id').toBeTruthy();
  });

  it('returns the existing row with created: false for the same (projectId, path, digest)', async () => {
    const store = make();
    const first = await store.createVersion(version());
    const second = await store.createVersion(version({ firstExecutionId: 'exec-2' }));
    expect(second.created).toBe(false);
    expect(second.row.id).toBe(first.row.id);
    // The FIRST execution keeps the credit — a reuse does not rewrite provenance.
    expect(second.row.firstExecutionId).toBe('exec-1');
  });

  it('returns the existing row with created: false when the two calls run CONCURRENTLY (FR-ART-006, SC-ART-002)', async () => {
    // The race, driven before any service exists (the DEF-044-003 lesson).
    const store = make();
    const results = await Promise.all([store.createVersion(version()), store.createVersion(version({ firstExecutionId: 'exec-2' })), store.createVersion(version({ firstExecutionId: 'exec-3' }))]);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(new Set(results.map((r) => r.row.id)).size, 'three calls, one version').toBe(1);
  });

  it('treats a different digest at the same path as a second version, and a different path as its own', async () => {
    const store = make();
    const a = await store.createVersion(version());
    const b = await store.createVersion(version({ digest: 'b'.repeat(64), content: '# Reports v2\n' }));
    const c = await store.createVersion(version({ path: 'specs/003-reports/plan.md', kind: 'plan' }));
    expect(b.created).toBe(true);
    expect(c.created).toBe(true);
    expect(new Set([a.row.id, b.row.id, c.row.id]).size).toBe(3);
  });

  it('scopes by project: the same content in another project is another version', async () => {
    const store = make();
    await store.createVersion(version());
    const other = await store.createVersion(version({ projectId: 'proj-2' }));
    expect(other.created).toBe(true);
  });

  it('exposes no method that updates or deletes a version (FR-ART-001, data-model §8)', async () => {
    const store = make();
    const surface = [...Object.getOwnPropertyNames(Object.getPrototypeOf(store) as object), ...Object.keys(store)];
    for (const forbidden of ['update', 'updateVersion', 'delete', 'deleteVersion', 'remove', 'upsert']) {
      expect(surface, `the store exposes ${forbidden}`).not.toContain(forbidden);
    }
  });
});

describe.each(IMPLEMENTATIONS)('T1623 · %s · one sync per idempotency key (data-model §2)', (_name, make) => {
  const sync = {
    workspaceId: WS,
    projectId: PROJECT,
    executionId: 'exec-1',
    epicId: 'epic-1',
    credentialId: 'cred-1',
    idempotencyKey: 'artifacts:exec-1:deadbeef',
    createdCount: 1,
    reusedCount: 0,
    refusedCount: 0,
  };
  const manifest = [{ path: 'specs/003-reports/spec.md', digest: 'a'.repeat(64), outcome: 'created' as const, versionId: 'v1', refusalCode: null, refusalDetail: null }];

  it('records a sync with its manifest', async () => {
    const store = make();
    const result = await store.recordSync(sync, manifest);
    expect(result.replayed).toBe(false);
    expect(result.row.idempotencyKey).toBe('artifacts:exec-1:deadbeef');
    const files = await store.manifestFor(result.row.id);
    expect(files).toHaveLength(1);
    expect(files[0]?.outcome).toBe('created');
  });

  it('refuses a second sync with the same (workspaceId, idempotencyKey) by returning the stored one', async () => {
    const store = make();
    const first = await store.recordSync(sync, manifest);
    const replay = await store.recordSync({ ...sync, executionId: 'exec-9', createdCount: 99 }, []);
    expect(replay.replayed).toBe(true);
    expect(replay.row.id).toBe(first.row.id);
    // The stored answer, not the replayed request's numbers (R-045-8).
    expect(replay.row.createdCount).toBe(1);
    expect(await store.manifestFor(first.row.id)).toHaveLength(1);
  });

  it('lets another workspace use the same key', async () => {
    const store = make();
    await store.recordSync(sync, manifest);
    const other = await store.recordSync({ ...sync, workspaceId: 'ws-2' }, manifest);
    expect(other.replayed).toBe(false);
  });

  it('finds a sync by its key without writing anything', async () => {
    const store = make();
    expect(await store.findSyncByKey(WS, 'artifacts:exec-1:deadbeef')).toBeNull();
    const created = await store.recordSync(sync, manifest);
    expect((await store.findSyncByKey(WS, 'artifacts:exec-1:deadbeef'))?.id).toBe(created.row.id);
  });

  it('records a sync whose files were all refused — a refusal is still a record (data-model §8)', async () => {
    const store = make();
    const result = await store.recordSync(
      { ...sync, epicId: null, createdCount: 0, refusedCount: 1, idempotencyKey: 'artifacts:exec-2:bad' },
      [{ path: 'specs/003-reports/notes.txt', digest: 'c'.repeat(64), outcome: 'refused', versionId: null, refusalCode: 'path_not_in_artifact_set', refusalDetail: 'notes.txt is not one of the artifact set' }],
    );
    expect(result.row.epicId).toBeNull();
    const files = await store.manifestFor(result.row.id);
    expect(files[0]?.outcome).toBe('refused');
    expect(files[0]?.versionId).toBeNull();
    expect(files[0]?.refusalCode).toBe('path_not_in_artifact_set');
  });
});

describe('T1623 · the in-memory store enforces exactly what the database enforces', () => {
  it('throws a P2002-shaped error on the version index, as the driver does', async () => {
    // Not a behaviour the service uses — a behaviour the SERVICE'S tests rely
    // on being identical to the database's, which is why it is asserted here.
    const store = new InMemoryArtifactStore();
    await store.createVersion(version());
    await expect(store.insertVersion(version({ firstExecutionId: 'exec-2' }))).rejects.toMatchObject({ code: 'P2002', meta: { target: expect.arrayContaining(['digest']) } });
  });

  it('throws a P2002-shaped error on the sync key index, as the driver does', async () => {
    const store = new InMemoryArtifactStore();
    const row = { workspaceId: WS, projectId: PROJECT, executionId: 'e', epicId: null, credentialId: 'c', idempotencyKey: 'k', createdCount: 0, reusedCount: 0, refusedCount: 0 };
    await store.recordSync(row, []);
    await expect(store.insertSync(row, [])).rejects.toMatchObject({ code: 'P2002', meta: { target: expect.arrayContaining(['idempotencyKey']) } });
  });
});
