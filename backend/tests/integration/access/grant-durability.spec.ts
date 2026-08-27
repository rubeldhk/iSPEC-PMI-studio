/**
 * T1119 (EPIC-024 C2D) — grants are durable, and a restart cannot broaden access.
 *
 * ## The harm `X13` named
 *
 * EPIC-024's rule is "unrestricted until granted": an artifact with **no**
 * grants is editable by anyone in the workspace, and only once a grant exists
 * does it exclude. That is defensible on its own. It became dangerous when
 * combined with an in-memory grant store, because the two together mean a
 * **restart turns a governed artifact back into an ungoverned one** — access
 * silently widens, and nothing records that it happened.
 *
 * `PrismaAccessStore` was written by EPIC-021's sibling epic and never composed.
 * Binding it is the fix; these tests are the proof.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import type { INestApplication } from '@nestjs/common';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../../prisma/migrations');

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_grants';
const OWNER = 'u_owner';
const OUTSIDER = 'u_outsider';
const ARTIFACT = { artifactType: 'specification', artifactId: 'spec_guarded' };

suite('T1119 · grants survive a restart, and access never widens', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;
  let app: INestApplication;
  let url = '';

  async function boot(): Promise<INestApplication> {
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../../../src/app.module.js');
    const fresh = await NestFactory.create(AppModule, { logger: false });
    await fresh.init();
    return fresh;
  }

  async function grants(): Promise<any> {
    const { AccessGrantService } = await import(
      '../../../src/modules/access/access-grant.service.js'
    );
    return app.get(AccessGrantService, { strict: false });
  }

  async function enforcement(): Promise<any> {
    const { AccessEnforcementService } = await import(
      '../../../src/modules/access/access-enforcement.service.js'
    );
    return app.get(AccessEnforcementService, { strict: false });
  }

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    url = container.getConnectionUri();
    db = new Client({ connectionString: url });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'grants',now())`, [
      WS,
    ]);
    process.env['DATABASE_URL'] = url;
    app = await boot();
  }, 300_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
    await container?.stop();
  });

  it('a grant created through the production service lands in the database', async () => {
    await (await grants()).grant(WS, ARTIFACT, {
      userId: OWNER,
      level: 'edit',
      grantedById: 'u_admin',
    });
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM "access_grants" WHERE "workspaceId" = $1 AND "artifactId" = $2`,
      [WS, ARTIFACT.artifactId],
    );
    expect(Number(rows[0]!.n), 'the grant did not reach PostgreSQL').toBe(1);
  });

  it('the artifact is governed: an outsider is refused', async () => {
    await expect((await enforcement()).requireEditable(WS, OUTSIDER, ARTIFACT)).rejects.toThrow();
  });

  it('STAYS governed after a restart — this is the X13 harm', async () => {
    // With the in-memory store, the grant vanished here, "no grants" meant
    // "unrestricted", and the outsider was silently allowed.
    await app.close();
    app = await boot();

    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM "access_grants" WHERE "workspaceId" = $1 AND "artifactId" = $2`,
      [WS, ARTIFACT.artifactId],
    );
    expect(Number(rows[0]!.n), 'the grant did not survive the restart').toBe(1);

    await expect(
      (await enforcement()).requireEditable(WS, OUTSIDER, ARTIFACT),
      'a restart re-opened a governed artifact',
    ).rejects.toThrow();

    // And the holder still holds it — durability must not cut both ways.
    await expect((await enforcement()).requireEditable(WS, OWNER, ARTIFACT)).resolves.toBeUndefined();
  });

  it('a revocation survives a restart', async () => {
    const service = await grants();
    // FR-ACC-027 — an artifact may never be left with nobody holding edit
    // access, so a second holder is granted before the first is revoked. The
    // rule refused this outright when the test tried to revoke the only grant,
    // which is the requirement working exactly as written.
    await service.grant(WS, ARTIFACT, {
      userId: 'u_second',
      level: 'edit',
      grantedById: 'u_admin',
    });
    const { rows } = await db.query<{ id: string }>(
      `SELECT "id" FROM "access_grants" WHERE "workspaceId" = $1 AND "userId" = $2`,
      [WS, OWNER],
    );
    await service.revoke(WS, rows[0]!.id, 'u_admin');

    await app.close();
    app = await boot();

    await expect(
      (await enforcement()).requireEditable(WS, OWNER, ARTIFACT),
      'a revoked grant came back after a restart',
    ).rejects.toThrow();
    // The remaining holder is unaffected — revocation is durable, not global.
    await expect(
      (await enforcement()).requireEditable(WS, 'u_second', ARTIFACT),
    ).resolves.toBeUndefined();
  });

  it('records every refusal, so a widening would leave a trail either way', async () => {
    const attempts = await (await enforcement()).attemptsFor(WS, ARTIFACT);
    expect(
      attempts.some((a: { userId: string }) => a.userId === OUTSIDER),
      'refusals are not audited',
    ).toBe(true);
    // The attempts are durable too — same store, same binding.
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM "access_attempt_records" WHERE "workspaceId" = $1`,
      [WS],
    );
    expect(Number(rows[0]!.n)).toBeGreaterThan(0);
  });

  it('FAILS CLOSED when the grant store cannot answer', async () => {
    // "Zero grants" and "the store did not answer" must not be the same
    // outcome: the first opens the artifact, the second must refuse. Fault
    // injected at the delegate; the enforcement service is production code.
    const { PrismaAccessStore } = await import('../../../src/modules/access/access.store.js');
    const { AccessInheritanceService, InMemoryDerivationGraph } = await import(
      '../../../src/modules/access/access-inheritance.service.js'
    );
    const { AccessEnforcementService, InMemoryAttemptStore } = await import(
      '../../../src/modules/access/access-enforcement.service.js'
    );

    const broken = new PrismaAccessStore({
      accessGrant: {
        create: async () => {
          throw new Error('grant store unavailable');
        },
        findUnique: async () => {
          throw new Error('grant store unavailable');
        },
        findMany: async () => {
          throw new Error('grant store unavailable');
        },
        update: async () => {
          throw new Error('grant store unavailable');
        },
      },
      accessAttemptRecord: { create: async () => ({}) as never, findMany: async () => [] },
      auditEntry: { create: async () => ({}), findMany: async () => [] },
      $queryRawUnsafe: async () => [],
      $transaction: async <T,>(fn: (tx: never) => Promise<T>) => fn(undefined as never),
        } as any);

    const enforcementWithBrokenStore = new AccessEnforcementService(
      new AccessInheritanceService(broken, new InMemoryDerivationGraph()),
      new InMemoryAttemptStore(),
    );

    await expect(
      enforcementWithBrokenStore.requireEditable(WS, OUTSIDER, ARTIFACT),
      'an unreadable grant store was treated as "no grants", which OPENS the artifact',
    ).rejects.toThrow();
  });
});
