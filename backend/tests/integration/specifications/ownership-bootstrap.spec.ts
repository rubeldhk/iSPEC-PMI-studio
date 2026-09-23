/**
 * T1128 (EPIC-009, C2E) — a specification and its owner are created together.
 *
 * `X19` closed from both ends. Deny-by-default (EPIC-024) makes an artifact
 * with no grants unreachable; this makes "no grants" unreachable for anything
 * created through production persistence. Either half alone is broken: the
 * first without the second would make every new specification inaccessible,
 * and the second without the first would leave the open-until-granted hole.
 *
 * Against a real PostgreSQL, because the claim is about a **transaction** —
 * that the artifact and its authorisation share one commit, and that a fault
 * takes both down. A fake `$transaction` that merely calls its callback would
 * assert nothing about atomicity.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { POSTGRES_IMAGE } from '../../helpers/postgres-image.js';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import {
  OwnershipRefusedError,
  PrismaSpecificationStore,
  type GenerationCommit,
  type SpecificationDelegates,
} from '../../../src/modules/specifications/specifications-read.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../../prisma/migrations');

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_own';
const OTHER_WS = 'ws_other';
const HUMAN = 'u_human';
const OUTSIDER = 'u_outsider';
const AGENT = 'agent_writer';

/**
 * Schema and tenancy fixtures, applied with `pg`.
 *
 * Not Prisma: `$executeRawUnsafe` sends one prepared statement and a migration
 * file is many, which fails with "cannot insert multiple commands into a
 * prepared statement". Every other container suite here uses `pg` for exactly
 * this reason.
 */
async function seedSchema(url: string, label: string): Promise<void> {
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    for (const [id, name] of [
      [WS, label],
      [OTHER_WS, 'other tenant'],
    ]) {
      await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$2,now())`, [
        id,
        name,
      ]);
    }
    // The outsider is a **real** human, just not one of this tenant's — which
    // is what makes the cross-workspace case meaningful rather than a test
    // about a missing row.
    for (const [id, ws, email] of [
      [HUMAN, WS, `human-${label}@own.test`],
      [OUTSIDER, OTHER_WS, `outsider-${label}@own.test`],
    ]) {
      await db.query(
        `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
         VALUES ($1,$2,$3,$3,'x',now())`,
        [id, ws, email],
      );
    }
    await db.query(
      `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt")
       VALUES ('proj_own',$1,'own',$2,now())`,
      [WS, HUMAN],
    );
  } finally {
    await db.end();
  }
}

function storeOver(prisma: PrismaClient): PrismaSpecificationStore {
  return new PrismaSpecificationStore(prisma as unknown as SpecificationDelegates, (fn) =>
    prisma.$transaction((tx) => fn(tx as unknown as SpecificationDelegates)),
  );
}

interface CommitOptions {
  specId: string;
  versionId?: string;
  owner?: string;
  actor?: string;
  actorType?: 'human' | 'agent' | 'service';
}

function buildCommit(o: CommitOptions): GenerationCommit {
  const owner = o.owner ?? HUMAN;
  return {
    specification: {
      id: o.specId,
      workspaceId: WS,
      projectId: 'proj_own',
      title: o.specId,
      lifecycleState: 'draft',
      currentVersionId: null,
      engineName: 'fixture',
      engineVersion: '1',
      generatedAt: new Date(),
      isOutOfDate: false,
      createdById: HUMAN,
      updatedById: HUMAN,
    },
    version: {
      id: o.versionId ?? `ver_${o.specId}`,
      workspaceId: WS,
      specificationId: o.specId,
      versionNumber: 1,
      contentRaw: '# probe',
      contentParsed: {},
      lifecycleStateAtCreation: 'draft',
      authoredById: HUMAN,
    },
    links: [],
    job: { id: `job_${o.specId}`, state: 'succeeded', resultRef: o.specId },
    ownership: {
      initiatingActorId: o.actor ?? HUMAN,
      initiatingActorType: o.actorType ?? 'human',
      ownerUserId: owner,
      ownerSnapshotId: `snap-${owner}`,
      correlationId: `corr-${o.specId}`,
      causationId: `job_${o.specId}`,
      idempotencyKey: `job_${o.specId}`,
    },
  } as GenerationCommit;
}

suite('T1128 · a specification and its owner grant commit together', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let store: PrismaSpecificationStore;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    const url = container.getConnectionUri();
    await seedSchema(url, 'own');
    prisma = new PrismaClient({ datasources: { db: { url } } });
    store = storeOver(prisma);
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  async function grantsFor(specId: string): Promise<{ userId: string; level: string }[]> {
    return prisma.$queryRawUnsafe(
      `SELECT "userId","level" FROM "access_grants"
       WHERE "artifactType"='specification' AND "artifactId"=$1 AND "revokedAt" IS NULL`,
      specId,
    );
  }

  it('creates the artifact AND its owner grant', async () => {
    await store.commitGeneration(buildCommit({ specId: 'spec_ok', versionId: 'ver_ok' }));
    expect(await grantsFor('spec_ok')).toEqual([{ userId: HUMAN, level: 'edit' }]);
  });

  it('the grant is durable — a fresh client still sees it', async () => {
    const fresh = new PrismaClient({ datasources: { db: { url: container.getConnectionUri() } } });
    try {
      const rows: { userId: string }[] = await fresh.$queryRawUnsafe(
        `SELECT "userId" FROM "access_grants" WHERE "artifactId"='spec_ok' AND "revokedAt" IS NULL`,
      );
      expect(rows.map((r) => r.userId)).toEqual([HUMAN]);
    } finally {
      await fresh.$disconnect();
    }
  });

  it('ROLLS BACK both halves when the commit faults after the artifact is written', async () => {
    // Reusing an existing version id fails the version insert, which happens
    // AFTER the specification row is created — so this exercises a genuine
    // partial write rather than a refusal before anything was attempted.
    await expect(
      store.commitGeneration(buildCommit({ specId: 'spec_rb', versionId: 'ver_ok' })),
    ).rejects.toThrow();

    const specs: unknown[] = await prisma.$queryRawUnsafe(
      `SELECT "id" FROM "specifications" WHERE "id"='spec_rb'`,
    );
    expect(specs, 'the specification survived a rolled-back commit').toHaveLength(0);
    expect(await grantsFor('spec_rb'), 'an orphan grant survived').toHaveLength(0);
  });

  it('a retry of an already-created specification adds no second grant', async () => {
    await expect(
      store.commitGeneration(buildCommit({ specId: 'spec_ok', versionId: 'ver_dup' })),
    ).rejects.toThrow();
    expect(await grantsFor('spec_ok')).toHaveLength(1);
  });
});

suite('T1128 · who may own what an agent creates', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let store: PrismaSpecificationStore;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    const url = container.getConnectionUri();
    await seedSchema(url, 'agent');
    prisma = new PrismaClient({ datasources: { db: { url } } });
    store = storeOver(prisma);
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  const byAgent = (specId: string, owner: string): GenerationCommit =>
    buildCommit({ specId, owner, actor: AGENT, actorType: 'agent' });

  it('refuses an agent that names ITSELF as owner — a sponsor is mandatory', async () => {
    await expect(store.commitGeneration(byAgent('spec_solo', AGENT))).rejects.toThrow(
      OwnershipRefusedError,
    );
    const rows: unknown[] = await prisma.$queryRawUnsafe(
      `SELECT "id" FROM "specifications" WHERE "id"='spec_solo'`,
    );
    expect(rows, 'a refused creation left an artifact behind').toHaveLength(0);
  });

  it('refuses a sponsor from another workspace', async () => {
    // Tenancy is checked against the stored user record, not against the
    // request — naming a real human from elsewhere buys nothing.
    await expect(store.commitGeneration(byAgent('spec_foreign', OUTSIDER))).rejects.toThrow(
      OwnershipRefusedError,
    );
  });

  it('refuses a sponsor who does not exist', async () => {
    await expect(store.commitGeneration(byAgent('spec_ghost', 'u_nobody'))).rejects.toThrow(
      OwnershipRefusedError,
    );
  });

  it('ACCEPTS an agent with a human sponsor, and the human owns it', async () => {
    await store.commitGeneration(byAgent('spec_sponsored', HUMAN));
    const rows: { userId: string }[] = await prisma.$queryRawUnsafe(
      `SELECT "userId" FROM "access_grants"
       WHERE "artifactId"='spec_sponsored' AND "revokedAt" IS NULL`,
    );
    // The human, and not the agent: the agent initiated it and owns nothing.
    expect(rows.map((r) => r.userId)).toEqual([HUMAN]);
  });
});
