/**
 * `T1318` (EPIC-041) — the database refuses what the services refuse.
 *
 * Every assertion goes **around** the services with raw SQL, in the pattern
 * `EPIC-035` `T998i` and `EPIC-038` `T1230` established: the type, the service
 * and the constraint each refuse independently because each is bypassed
 * differently. `data-model.md` §1–§6.
 *
 * | Constraint | Without it |
 * |---|---|
 * | `projects.rootPath` unique per workspace | two projects claim one directory and the second silently overwrites the first's files |
 * | `provisioning_records` append-only | a failed run is edited into a success and nobody can tell |
 * | a `failed` record names its step | *"it failed"* with no step is the message that sends a user to the wrong place |
 * | `connector_credentials` has no value column | the credential could be re-displayed, which `FR-LPW-021` forbids |
 * | `executions.assurance` NOT NULL | an execution with no assurance reads as neither managed nor local |
 * | `principals.kind` admits `connector` | a credential has no principal to resolve to |
 * | `JobKind` admits `initialise_workspace` | the worker has no job kind to claim |
 *
 * Written to FAIL before `T1319` exists.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let container: StartedPostgreSqlContainer;
let db: Client;
let seq = 0;
const id = (prefix: string): string => `${prefix}_${(seq += 1)}`;

const WS = 'ws_lpw';

async function project(over: Record<string, unknown> = {}): Promise<string> {
  const row: Record<string, unknown> = {
    id: id('pr'),
    workspaceId: WS,
    name: id('Project'),
    ownerUserId: 'u_1',
    updatedAt: new Date(),
    ...over,
  };
  const cols = Object.keys(row).map((c) => `"${c}"`).join(',');
  const params = Object.keys(row).map((_, i) => `$${i + 1}`).join(',');
  await db.query(`INSERT INTO "projects" (${cols}) VALUES (${params})`, Object.values(row));
  return String(row['id']);
}

async function record(projectId: string, over: Record<string, unknown> = {}): Promise<string> {
  const row: Record<string, unknown> = {
    id: id('prov'),
    workspaceId: WS,
    projectId,
    actorId: 'u_1',
    correlationId: id('corr'),
    startedAt: new Date(),
    outcome: 'succeeded',
    stepsCompleted: JSON.stringify(['check_root', 'create_directory']),
    filesWritten: JSON.stringify(['.pmi/project.json']),
    ...over,
  };
  const cols = Object.keys(row).map((c) => `"${c}"`).join(',');
  const params = Object.keys(row).map((_, i) => `$${i + 1}`).join(',');
  await db.query(`INSERT INTO "provisioning_records" (${cols}) VALUES (${params})`, Object.values(row));
  return String(row['id']);
}

async function execution(over: Record<string, unknown> = {}): Promise<void> {
  const row: Record<string, unknown> = {
    id: id('ex'),
    correlationId: id('corr'),
    idempotencyKey: id('idem'),
    workspaceId: WS,
    command: 'specify',
    argsSanitized: '{}',
    initiatorType: 'human',
    initiatorId: 'u_1',
    surface: 'local-cli',
    contractVersion: '1.0.0',
    updatedAt: new Date(),
    ...over,
  };
  const cols = Object.keys(row).map((c) => `"${c}"`).join(',');
  const params = Object.keys(row).map((_, i) => `$${i + 1}`).join(',');
  await db.query(`INSERT INTO "executions" (${cols}) VALUES (${params})`, Object.values(row));
}

async function columns(table: string): Promise<{ name: string; nullable: string }[]> {
  const r = await db.query<{ column_name: string; is_nullable: string }>(
    `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = $1`,
    [table],
  );
  return r.rows.map((c) => ({ name: c.column_name, nullable: c.is_nullable }));
}

beforeAll(async () => {
  if (noRuntime) return;
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  db = new Client({ connectionString: container.getConnectionUri() });
  await db.connect();
  for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  }
  await db.query(
    `INSERT INTO "organizations" ("id","name","updatedAt") VALUES ('org_default','Default',now()) ON CONFLICT DO NOTHING`,
  );
  await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'LPW',now())`, [WS]);
  // A principal's sponsor must be a real person (D-46); the FK says so.
  await db.query(
    `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
     VALUES ('u_1',$1,'u_1@example.test','Sponsor','unused',now())`,
    [WS],
  );
}, 600_000);

afterAll(async () => {
  await db?.end();
  await container?.stop();
}, 120_000);

suite('T1318 · the local-workspace tables refuse at the database', () => {
  it('accepts a project with a root path and a provisioning state — or every refusal below is vacuous', async () => {
    await expect(
      project({ rootPath: '/home/dev/pmi/alpha', agentIntegration: 'claude', scriptType: 'sh', provisioningState: 'prepared' }),
    ).resolves.toBeTruthy();
  });

  describe('data-model.md §1 · one directory, one project', () => {
    it('refuses a second project in the same workspace with the same root path', async () => {
      await project({ rootPath: '/home/dev/pmi/shared' });
      await expect(project({ rootPath: '/home/dev/pmi/shared' })).rejects.toThrow(/unique|duplicate/i);
    });

    it('defaults provisioningState to not_provisioned', async () => {
      const pid = await project();
      const r = await db.query(`SELECT "provisioningState" FROM "projects" WHERE id = $1`, [pid]);
      expect(r.rows[0]['provisioningState']).toBe('not_provisioned');
    });

    it('refuses a provisioning state outside the vocabulary', async () => {
      await expect(project({ provisioningState: 'done' })).rejects.toThrow(/enum|invalid input value/i);
    });
  });

  describe('data-model.md §2 · provisioning records are append-only and a failure names its step', () => {
    it('refuses UPDATE', async () => {
      const pid = await project();
      const rid = await record(pid);
      await expect(
        db.query(`UPDATE "provisioning_records" SET "outcome" = 'failed' WHERE id = $1`, [rid]),
      ).rejects.toThrow(/append-only/);
    });

    it('refuses DELETE', async () => {
      const pid = await project();
      const rid = await record(pid);
      await expect(db.query(`DELETE FROM "provisioning_records" WHERE id = $1`, [rid])).rejects.toThrow(
        /append-only/,
      );
    });

    it('refuses a failed record with no failedStep', async () => {
      const pid = await project();
      await expect(record(pid, { outcome: 'failed' })).rejects.toThrow(/failed_step|check/i);
    });

    it('and accepts one that names it', async () => {
      const pid = await project();
      await expect(
        record(pid, { outcome: 'failed', failedStep: 'merge_mcp_json', failureReason: 'unparseable' }),
      ).resolves.toBeTruthy();
    });

    it('refuses an outcome outside the vocabulary', async () => {
      const pid = await project();
      await expect(record(pid, { outcome: 'partial' })).rejects.toThrow(/outcome|check/i);
    });
  });

  describe('data-model.md §3 · a credential has no value column and no expiry', () => {
    it('stores a hash and a prefix, never a value', async () => {
      const names = (await columns('connector_credentials')).map((c) => c.name);
      expect(names).toContain('tokenHash');
      expect(names).toContain('tokenPrefix');
      expect(names).toContain('revokedAt');
      for (const forbidden of ['value', 'token', 'secret', 'expiresAt']) {
        expect(names, `connector_credentials must not have a ${forbidden} column`).not.toContain(forbidden);
      }
    });
  });

  describe('data-model.md §4 · principals admit connector', () => {
    it('accepts kind = connector', async () => {
      await expect(
        db.query(
          `INSERT INTO "principals" ("id","workspaceId","kind","descriptorRef","sponsorUserId","registeredByUserId","correlationId","causationId","updatedAt")
           VALUES ($1,$2,'connector','pmi-studio-connector','u_1','u_1',$3,$3,now())`,
          [id('pp'), WS, id('corr')],
        ),
      ).resolves.toBeTruthy();
    });

    it('still refuses kind = human — D-46 stands', async () => {
      await expect(
        db.query(
          `INSERT INTO "principals" ("id","workspaceId","kind","descriptorRef","sponsorUserId","registeredByUserId","correlationId","causationId","updatedAt")
           VALUES ($1,$2,'human','x','u_1','u_1',$3,$3,now())`,
          [id('pp'), WS, id('corr')],
        ),
      ).rejects.toThrow(/kind|check/i);
    });
  });

  describe('data-model.md §5 · every execution carries an assurance', () => {
    it('is NOT NULL', async () => {
      const col = (await columns('executions')).find((c) => c.name === 'assurance');
      expect(col, 'executions.assurance is missing').toBeDefined();
      expect(col!.nullable).toBe('NO');
    });

    it('refuses an execution with no assurance', async () => {
      await expect(execution()).rejects.toThrow(/assurance|null/i);
    });

    it('refuses an assurance outside the vocabulary', async () => {
      await expect(execution({ assurance: 'high' })).rejects.toThrow(/assurance|check/i);
    });

    it('accepts local and managed', async () => {
      await expect(execution({ assurance: 'local' })).resolves.toBeUndefined();
      await expect(execution({ assurance: 'managed', surface: 'managed-sandbox' })).resolves.toBeUndefined();
    });
  });

  describe('data-model.md §6 · the worker has a job kind to claim', () => {
    it('JobKind admits initialise_workspace', async () => {
      const r = await db.query(
        `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'JobKind'`,
      );
      expect(r.rows.map((x) => x['enumlabel'])).toContain('initialise_workspace');
    });
  });
});
