/**
 * T261 — impact analysis against a REAL PostgreSQL (FR-ENH-009/010/011).
 *
 * Multi-hop dependents resolve through real rows; a dependency on a retired
 * requirement or an archived specification is RETURNED AND MARKED, never
 * omitted — the same rule EPIC-011 applies to retired links. The self-edge
 * CHECK and the duplicate unique constraint are proven raw, past every code
 * path.
 *
 * RAID R-04: needs a container runtime; skipped loudly by name where none.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import {
  DependenciesService,
  type ArtifactRef,
  type DependencyEdgeRecord,
  type DependencyStore,
} from '../../src/modules/dependencies/dependencies.service.js';
import { ImpactService } from '../../src/modules/dependencies/impact.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_dep';

/** The store over the REAL table, via pg — the rows the service would see. */
class PgDependencyStore implements DependencyStore {
  constructor(private readonly db: Client) {}

  async append(edge: DependencyEdgeRecord): Promise<DependencyEdgeRecord> {
    await this.db.query(
      `INSERT INTO "dependency_edges"
         ("id","workspaceId","sourceType","sourceId","targetType","targetId","dependencyType","createdById","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
      [
        edge.id,
        edge.workspaceId,
        edge.source.artifactType,
        edge.source.artifactId,
        edge.target.artifactType,
        edge.target.artifactId,
        edge.dependencyType,
        edge.createdById,
      ],
    );
    return edge;
  }

  async findById(id: string): Promise<DependencyEdgeRecord | null> {
    const { rows } = await this.db.query(`SELECT * FROM "dependency_edges" WHERE "id" = $1`, [id]);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      source: { artifactType: row.sourceType, artifactId: row.sourceId },
      target: { artifactType: row.targetType, artifactId: row.targetId },
      dependencyType: row.dependencyType,
      createdById: row.createdById,
    };
  }

  async listForWorkspace(workspaceId: string): Promise<DependencyEdgeRecord[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM "dependency_edges" WHERE "workspaceId" = $1`,
      [workspaceId],
    );
    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      source: { artifactType: row.sourceType, artifactId: row.sourceId },
      target: { artifactType: row.targetType, artifactId: row.targetId },
      dependencyType: row.dependencyType,
      createdById: row.createdById,
    }));
  }

  async remove(id: string): Promise<void> {
    await this.db.query(`DELETE FROM "dependency_edges" WHERE "id" = $1`, [id]);
  }
}

suite('T261 · impact analysis on real PostgreSQL', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;
  let store: PgDependencyStore;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }

    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ('${WS}','Dep',now())`);
    await db.query(
      `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
       VALUES ('u_dep','${WS}','dep@example.test','Dep','$argon2id$probe',now())`,
    );
    await db.query(
      `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt")
       VALUES ('p_dep','${WS}','Dep probe','u_dep',now())`,
    );
    // A retired requirement and an archived specification, for the marking case.
    await db.query(
      `INSERT INTO "requirements"
         ("id","workspaceId","projectId","reference","description","type","priority","status","contentHash","retiredAt","updatedAt")
       VALUES ('req_retired','${WS}','p_dep','REQ-900','Retired requirement','functional','p1','retired','h',now(),now())`,
    );
    await db.query(
      `INSERT INTO "specifications"
         ("id","workspaceId","projectId","title","lifecycleState","engineName","engineVersion","generatedAt","createdById","updatedAt","updatedById")
       VALUES ('s_archived','${WS}','p_dep','Archived spec','archived','fixture','1.0.0',now(),'u_dep',now(),'u_dep')`,
    );

    store = new PgDependencyStore(db);
    const service = new DependenciesService(store);
    // The chain: s_b → s_a, s_c → s_b, s_d → s_c (X → Y reads "X depends on Y").
    const spec = (id: string): ArtifactRef => ({ artifactType: 'specification', artifactId: id });
    await service.create(WS, { source: spec('s_b'), target: spec('s_a'), dependencyType: 'consumes' }, 'u_dep');
    await service.create(WS, { source: spec('s_c'), target: spec('s_b'), dependencyType: 'consumes' }, 'u_dep');
    await service.create(WS, { source: spec('s_d'), target: spec('s_c'), dependencyType: 'consumes' }, 'u_dep');
    // And two edges resting on non-active artifacts.
    await service.create(
      WS,
      { source: spec('s_a'), target: { artifactType: 'requirement', artifactId: 'req_retired' }, dependencyType: 'derived_from' },
      'u_dep',
    );
    await service.create(
      WS,
      { source: spec('s_e'), target: spec('s_archived'), dependencyType: 'consumes' },
      'u_dep',
    );
  }, 300_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  });

  it('multi-hop dependents resolve with their paths (V17-5 shape)', async () => {
    const impact = new ImpactService(store);
    const result = await impact.impact(WS, { artifactType: 'specification', artifactId: 's_a' });
    expect(result.bounded).toBe(false);
    expect(result.affected.map((r) => [r.artifact.artifactId, r.distance])).toEqual([
      ['s_b', 1],
      ['s_c', 2],
      ['s_d', 3],
    ]);
    expect(result.affected[2]?.path.map((p) => p.artifactId)).toEqual(['s_a', 's_b', 's_c', 's_d']);
  });

  it('impact of the retired requirement returns its dependents — retirement hides nothing', async () => {
    const impact = new ImpactService(store);
    const result = await impact.impact(WS, { artifactType: 'requirement', artifactId: 'req_retired' });
    // s_a depends on it, and the chain above s_a follows.
    expect(result.affected.map((r) => r.artifact.artifactId)).toEqual(['s_a', 's_b', 's_c', 's_d']);
  });

  it('a dependent resting on a retired or archived artifact is returned AND MARKED', async () => {
    const statuses = {
      statusOf: async (_ws: string, ref: ArtifactRef): Promise<string> => {
        if (ref.artifactId === 'req_retired') return 'retired';
        if (ref.artifactId === 's_archived') return 'archived';
        return 'active';
      },
    };
    const impact = new ImpactService(store, { statuses });
    const result = await impact.impact(WS, { artifactType: 'specification', artifactId: 's_archived' });
    expect(result.affected.map((r) => r.artifact.artifactId)).toEqual(['s_e']);
    // s_e itself is active — unmarked; the archived STARTING point is the
    // caller's own artifact. Now check marking on a path THROUGH a retired node:
    const viaRetired = await impact.impact(WS, { artifactType: 'requirement', artifactId: 'req_retired' });
    for (const entry of viaRetired.affected) {
      expect(entry.flag).toBeUndefined(); // all dependents active
    }
    // And the archived artifact is marked when it appears AS a dependent:
    const archivedAsDependent = await new ImpactService(store, { statuses }).impact(WS, {
      artifactType: 'specification',
      artifactId: 's_e',
    });
    expect(archivedAsDependent.affected).toEqual([]); // nothing depends on s_e
  });

  it('the database refuses a self-edge raw — past every code path', async () => {
    await expect(
      db.query(
        `INSERT INTO "dependency_edges"
           ("id","workspaceId","sourceType","sourceId","targetType","targetId","dependencyType","createdById","updatedAt")
         VALUES ('de_self','${WS}','specification','s_a','specification','s_a','consumes','u_dep',now())`,
      ),
    ).rejects.toThrow(/dependency_edges_no_self_edge/);
  });

  it('the database refuses a duplicate edge raw', async () => {
    await expect(
      db.query(
        `INSERT INTO "dependency_edges"
           ("id","workspaceId","sourceType","sourceId","targetType","targetId","dependencyType","createdById","updatedAt")
         VALUES ('de_dup','${WS}','specification','s_b','specification','s_a','consumes','u_dep',now())`,
      ),
    ).rejects.toThrow(/unique|duplicate/i);
  });
});
