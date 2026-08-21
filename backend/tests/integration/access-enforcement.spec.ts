/**
 * T427 — SC-007 against a REAL PostgreSQL via Testcontainers: an ungranted
 * artifact is ABSENT from listings and returns 404 directly, and the refusal
 * is recorded in the same transaction. A mocked repository passes while the
 * real query leaks — this is the G-02.5 gap, closed.
 *
 * RAID R-04: needs a container runtime; skipped loudly by name where none.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../src/core/errors.js';
import { AccessEnforcementService } from '../../src/modules/access/access-enforcement.service.js';
import { AccessGrantService } from '../../src/modules/access/access-grant.service.js';
import {
  AccessInheritanceService,
  InMemoryDerivationGraph,
} from '../../src/modules/access/access-inheritance.service.js';
import { PrismaAccessStore, type AccessDb } from '../../src/modules/access/access.store.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_acc';
const ADMIN = 'u_admin';
const BOB = 'u_bob';
const SPEC = { artifactType: 'specification', artifactId: 'spec_1' };
const OPEN = { artifactType: 'requirement', artifactId: 'req_open' };

suite('T427 · SC-007 — enforcement against a real PostgreSQL', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let store: PrismaAccessStore;
  let enforcement: AccessEnforcementService;
  let grantService: AccessGrantService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const url = container.getConnectionUri();
    const db = new Client({ connectionString: url });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ('${WS}','Access',now())`);
    await db.end();

    prisma = new PrismaClient({ datasources: { db: { url } } });
    store = new PrismaAccessStore(prisma as unknown as AccessDb);
    grantService = new AccessGrantService(store);
    const inheritance = new AccessInheritanceService(store, new InMemoryDerivationGraph());
    enforcement = new AccessEnforcementService(inheritance, store);

    await grantService.grant(WS, SPEC, { userId: ADMIN, level: 'edit', grantedById: ADMIN });
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it('the ungranted artifact is ABSENT from listings — the real query hides it', async () => {
    const listing = await enforcement.filterReadable(WS, BOB, [SPEC, OPEN]);
    expect(listing).toEqual([OPEN]);
  });

  it('direct access returns 404 and the refusal lands in access_attempt_records', async () => {
    await expect(enforcement.requireReadable(WS, BOB, SPEC)).rejects.toThrow(NotFoundError);

    const rows = await prisma.accessAttemptRecord.findMany({
      where: { workspaceId: WS, artifactId: SPEC.artifactId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: BOB, action: 'read' });
  });

  it('the refusal record is immutable at the database — the trigger rejects mutation', async () => {
    const row = (await prisma.accessAttemptRecord.findMany({ where: { workspaceId: WS } }))[0]!;
    await expect(
      prisma.accessAttemptRecord.delete({ where: { id: row.id } }),
    ).rejects.toThrow(/append-only/);
  });

  it('grant + audit land in one transaction — the audit row exists with the grant', async () => {
    const grant = await grantService.grant(WS, OPEN, {
      userId: BOB,
      level: 'read',
      grantedById: ADMIN,
    });
    const audit = await prisma.auditEntry.findMany({
      where: { workspaceId: WS, targetType: 'access_grant', targetId: grant.id },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: ADMIN, action: 'create', outcome: 'success' });
  });
});
