/**
 * T428 — FR-ACC-027 / SC-008 under CONCURRENT revocation, against a real
 * PostgreSQL: the invariant is enforced inside the revoke transaction
 * (behind a FOR UPDATE lock), not by a pre-check — a pre-check passes both
 * transactions and strands the artifact.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { AccessGrantService } from '../../src/modules/access/access-grant.service.js';
import { PrismaAccessStore, type AccessDb } from '../../src/modules/access/access.store.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_led';
const ADMIN = 'u_admin';
const ROUNDS = 5;

suite('T428 · SC-008 — the last-editor invariant under concurrent revocation', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let service: AccessGrantService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const url = container.getConnectionUri();
    const db = new Client({ connectionString: url });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ('${WS}','LastEd',now())`);
    await db.end();

    prisma = new PrismaClient({ datasources: { db: { url } } });
    service = new AccessGrantService(new PrismaAccessStore(prisma as unknown as AccessDb));
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it(
    'two concurrent revocations of the two last editors: exactly one succeeds, every round',
    async () => {
      for (let round = 1; round <= ROUNDS; round++) {
        const artifact = { artifactType: 'specification', artifactId: `spec_race_${round}` };
        const g1 = await service.grant(WS, artifact, { userId: 'u_a', level: 'edit', grantedById: ADMIN });
        const g2 = await service.grant(WS, artifact, { userId: 'u_b', level: 'edit', grantedById: ADMIN });

        const [r1, r2] = await Promise.allSettled([
          service.revoke(WS, g1.id, ADMIN),
          service.revoke(WS, g2.id, ADMIN),
        ]);

        const outcomes = [r1, r2].map((r) => r.status).sort();
        expect(outcomes, `round ${round}: exactly one revoke must survive`).toEqual([
          'fulfilled',
          'rejected',
        ]);

        // The artifact NEVER reached a state with no editor.
        const editors = await prisma.accessGrant.findMany({
          where: { ...artifact, level: 'edit', revokedAt: null },
        });
        expect(editors, `round ${round}: one active editor remains`).toHaveLength(1);
      }
    },
    120_000,
  );

  it('grant rows are never deleted — the database refuses (revocation is a timestamp)', async () => {
    const artifact = { artifactType: 'specification', artifactId: 'spec_nodelete' };
    const grant = await service.grant(WS, artifact, { userId: 'u_a', level: 'read', grantedById: ADMIN });
    await expect(prisma.accessGrant.delete({ where: { id: grant.id } })).rejects.toThrow(/append-only/);
  });
});
