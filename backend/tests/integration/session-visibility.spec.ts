/**
 * T815 — SC-018 against a real PostgreSQL: a reviewer whose grant is revoked
 * while a session is open sees the affected questions as RESTRICTED on next
 * open, and the run's snapshot does not re-admit them. A mocked repository
 * passes here while the real query leaks — the same reason T427 exists
 * (G-02.5).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { AccessEnforcementService } from '../../src/modules/access/access-enforcement.service.js';
import { AccessEvaluationService } from '../../src/modules/access/access-evaluation.service.js';
import { AccessGrantService } from '../../src/modules/access/access-grant.service.js';
import {
  AccessInheritanceService,
  InMemoryDerivationGraph,
} from '../../src/modules/access/access-inheritance.service.js';
import { AccessSnapshotService } from '../../src/modules/access/access-snapshot.service.js';
import { PrismaAccessStore, type AccessDb } from '../../src/modules/access/access.store.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_vis';
const ADMIN = 'u_admin';
const REVIEWER = 'u_reviewer';
const SPEC = { artifactType: 'specification', artifactId: 'spec_1' };
const OPEN = { artifactType: 'requirement', artifactId: 'req_open' };
const QUESTIONS = [
  { questionId: 'q_restricted', concerns: SPEC },
  { questionId: 'q_open', concerns: OPEN },
];

suite('T815 · SC-018 — open-time visibility against a real PostgreSQL', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let grants: AccessGrantService;
  let evaluation: AccessEvaluationService;
  let snapshots: AccessSnapshotService;
  let store: PrismaAccessStore;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const url = container.getConnectionUri();
    const db = new Client({ connectionString: url });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ('${WS}','Vis',now())`);
    await db.end();

    prisma = new PrismaClient({ datasources: { db: { url } } });
    store = new PrismaAccessStore(prisma as unknown as AccessDb);
    grants = new AccessGrantService(store);
    const inheritance = new AccessInheritanceService(store, new InMemoryDerivationGraph());
    evaluation = new AccessEvaluationService(new AccessEnforcementService(inheritance, store));
    snapshots = new AccessSnapshotService(store);
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it('revoked mid-session → restricted on next open; the run snapshot does not re-admit', async () => {
    await grants.grant(WS, SPEC, { userId: ADMIN, level: 'edit', grantedById: ADMIN });
    const reviewers = await grants.grant(WS, SPEC, {
      userId: REVIEWER,
      level: 'read',
      grantedById: ADMIN,
    });

    // The run starts and snapshots the reviewer's generous access.
    const snapshot = await snapshots.capture(WS, REVIEWER);
    expect(snapshots.runMayRead(snapshot, SPEC)).toBe(true);

    // The session opens: everything readable.
    const before = await evaluation.visibilityAtOpen(WS, REVIEWER, QUESTIONS);
    expect(before).toEqual([
      { questionId: 'q_restricted', restricted: false },
      { questionId: 'q_open', restricted: false },
    ]);

    // The grant is revoked while the session sits open…
    await grants.revoke(WS, reviewers.id, ADMIN);

    // …NEXT open, evaluated against the REAL grant table: restricted, marked
    // — not omitted — and the open question is untouched.
    const after = await evaluation.visibilityAtOpen(WS, REVIEWER, QUESTIONS);
    expect(after).toEqual([
      { questionId: 'q_restricted', restricted: true },
      { questionId: 'q_open', restricted: false },
    ]);

    // The RUN's snapshot still reads (run-scope consistency, FR-ACC-028) but
    // it governs the run alone — it never re-admitted the reviewer above.
    expect(snapshots.runMayRead(snapshot, SPEC)).toBe(true);
  });
});
