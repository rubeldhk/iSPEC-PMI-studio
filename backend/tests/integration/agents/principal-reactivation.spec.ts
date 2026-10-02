/**
 * T1147 (EPIC-028, C3B closure) — `Z2`: reactivation restores nothing.
 *
 * Its **own file**, deliberately. `prismaClient()` is a module-level singleton
 * bound to the first DATABASE_URL it sees, so a second container inside one
 * test file talks to the first container's database. Splitting the suite is the
 * fix; sharing a container between two unrelated scenarios would have hidden
 * which one left the state behind.
 *
 * The rule under test: withdrawing authority and then reactivating a principal
 * must not quietly hand that authority back.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { POSTGRES_IMAGE } from '../../helpers/postgres-image.js';
import { Client } from 'pg';
import type { INestApplication } from '@nestjs/common';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../../prisma/migrations');

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_react';
const SPONSOR = 'u_react_sponsor';

suite('T1147 · reactivation does not restore what suspension took away (Z2)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let url = '';
  let agentId = '';
  let preSuspensionSnapshot = '';

  async function boot(): Promise<INestApplication> {
    process.env['DATABASE_URL'] = url;
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../../../src/app.module.js');
    const created = await NestFactory.create(AppModule, { logger: false });
    await created.init();
    return created;
  }

  async function svc() {
    const reg = await import('../../../src/modules/agents/principal-registry.service.js');
    const pd = await import('../../../src/modules/access/principal-delegation.service.js');
    return {
      registry: app.get(reg.PrincipalRegistryService, { strict: false }),
      snapshots: app.get(reg.IdentitySnapshotService, { strict: false }),
      delegations: app.get(pd.PrincipalDelegationService, { strict: false }),
    };
  }

  const artifact = { artifactType: 'specification', artifactId: 'spec_react' };

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    url = container.getConnectionUri();
    const db = new Client({ connectionString: url });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'react',now())`, [
      WS,
    ]);
    await db.query(
      `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
       VALUES ($1,$2,$1,$1,'x',now())`,
      [SPONSOR, WS],
    );
    await db.end();

    app = await boot();
    const { registry, snapshots, delegations } = await svc();
    const agent = await registry.register({
      workspaceId: WS,
      kind: 'agent',
      descriptorRef: 'react-fixture',
      sponsorUserId: SPONSOR,
      registeredByUserId: SPONSOR,
      correlationId: 'corr-react',
      causationId: 'cause-react',
    });
    agentId = agent.principalId;
    preSuspensionSnapshot = (await snapshots.capture(WS, agentId)).snapshotId;
    await delegations.delegate({
      workspaceId: WS,
      principalId: agentId,
      sponsorUserId: SPONSOR,
      artifact,
      actions: ['transition.propose'],
      identityVersion: 1,
      correlationId: 'corr-react',
    });
  }, 300_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  }, 120_000);

  /**
   * No version parameter, deliberately.
   *
   * An earlier draft passed one, and a caller supplying the pre-suspension
   * value walked straight through a suspension — the pin compared the
   * delegation against what the *request* claimed rather than against what was
   * true. The service now resolves the authoritative version itself, so this
   * helper cannot express the hole that existed.
   */
  const propose = async (): Promise<unknown> => {
    const { delegations } = await svc();
    return delegations.requireDelegated({
      workspaceId: WS,
      principalId: agentId,
      artifact,
      action: 'transition.propose',
    });
  };

  it('the delegation works while the principal is active', async () => {
    // The control. Without it, every assertion below is satisfied by a
    // delegation that never worked at all.
    await expect(propose()).resolves.toBeTruthy();
  });

  it('suspension invalidates it', async () => {
    const { registry } = await svc();
    await registry.changeState({
      workspaceId: WS,
      principalId: agentId,
      toState: 'suspended',
      actorUserId: SPONSOR,
      reason: 'under review',
      correlationId: 'corr-react',
      causationId: 'cause-suspend',
    });
    // Refused because the principal is not active — and would still be refused
    // on the version pin alone.
    await expect(propose()).rejects.toThrow();
  });

  it('reactivation creates a NEW identity version', async () => {
    const { registry } = await svc();
    const back = await registry.changeState({
      workspaceId: WS,
      principalId: agentId,
      toState: 'active',
      actorUserId: SPONSOR,
      reason: 'review cleared',
      correlationId: 'corr-react',
      causationId: 'cause-reactivate',
    });
    // Version 3, not back to 1. A restored version number would restore the
    // authority with it.
    expect(back.identityVersion).toBe(3);
    expect(back.state).toBe('active');
  });

  it('the pre-suspension delegation does NOT become valid again', async () => {
    // The rule this suite exists for. Reactivating a principal must not quietly
    // hand back authority somebody withdrew.
    // The principal is active again, so nothing here is refused for state. The
    // delegation is refused because it was pinned to version 1 and the current
    // version is 3.
    await expect(propose()).rejects.toThrow();
  });

  it('a NEW delegation is required, and works', async () => {
    const { delegations } = await svc();
    await delegations.delegate({
      workspaceId: WS,
      principalId: agentId,
      sponsorUserId: SPONSOR,
      artifact,
      actions: ['transition.propose'],
      identityVersion: 3,
      correlationId: 'corr-react',
    });
    await expect(propose()).resolves.toBeTruthy();
  });

  it('the pre-suspension snapshot is unchanged', async () => {
    const { snapshots } = await svc();
    const frozen = await snapshots.resolve(preSuspensionSnapshot);
    expect(frozen?.identityVersion, 'the snapshot followed the principal').toBe(1);
  });

  it('state and evidence committed together, and survive a restart (Z2)', async () => {
    await app.close();
    app = await boot();

    const { registry } = await svc();
    const agent = await registry.find(WS, agentId);
    expect(agent?.state).toBe('active');
    expect(agent?.identityVersion).toBe(3);

    const db = new Client({ connectionString: url });
    await db.connect();
    const { rows } = await db.query<{ toState: string; identityVersion: number }>(
      `SELECT "toState","identityVersion" FROM "principal_state_events"
       WHERE "principalId"=$1 ORDER BY "identityVersion"`,
      [agentId],
    );
    await db.end();

    // Three events for three versions. A state change with no event would be an
    // unexplained suspension; an event with no state change would record
    // something that did not happen. Before this step they were two separate
    // writes with no transaction between them.
    expect(rows.map((r) => [r.identityVersion, r.toState])).toEqual([
      [1, 'active'],
      [2, 'suspended'],
      [3, 'active'],
    ]);
  }, 180_000);
});
