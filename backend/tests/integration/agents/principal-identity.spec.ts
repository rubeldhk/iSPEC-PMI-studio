/**
 * T1138, T1141 (EPIC-028 / EPIC-024, C3B) — the identity proof.
 *
 * `Y2` was that nothing could say who an agent is, so the only way past
 * EPIC-024's boundary was to register the agent as a person. This walks the
 * chain the C3B authorisation asks for, through the real `AppModule`, real DI
 * and a real PostgreSQL — and then restarts the application twice, because an
 * identity that does not survive a restart is not an identity.
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

const WS = 'ws_id';
const OTHER_WS = 'ws_id_other';
const SPONSOR = 'u_sponsor';
const OUTSIDER = 'u_outsider';
const REVIEWER = 'u_reviewer';

suite('T1138 · a non-human principal is registered, resolved, frozen and scoped', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let url = '';
  let agentId = '';
  let connectorId = '';

  async function boot(): Promise<INestApplication> {
    process.env['DATABASE_URL'] = url;
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../../../src/app.module.js');
    return NestFactory.create(AppModule, { logger: false });
  }

  async function services(): Promise<{
    registry: import('../../../src/modules/agents/principal-registry.service.js').PrincipalRegistryService;
    snapshots: import('../../../src/modules/agents/principal-registry.service.js').IdentitySnapshotService;
    trusted: import('../../../src/modules/agents/trusted-principal.js').TrustedPrincipalFactory;
    boundary: import('../../../src/modules/access/workspace-boundary.service.js').WorkspaceBoundaryService;
    delegations: import('../../../src/modules/access/principal-delegation.service.js').PrincipalDelegationService;
  }> {
    const reg = await import('../../../src/modules/agents/principal-registry.service.js');
    const tp = await import('../../../src/modules/agents/trusted-principal.js');
    const wb = await import('../../../src/modules/access/workspace-boundary.service.js');
    const pd = await import('../../../src/modules/access/principal-delegation.service.js');
    return {
      registry: app.get(reg.PrincipalRegistryService, { strict: false }),
      snapshots: app.get(reg.IdentitySnapshotService, { strict: false }),
      trusted: app.get(tp.TrustedPrincipalFactory, { strict: false }),
      boundary: app.get(wb.WorkspaceBoundaryService, { strict: false }),
      delegations: app.get(pd.PrincipalDelegationService, { strict: false }),
    };
  }

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    url = container.getConnectionUri();

    const db = new Client({ connectionString: url });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    for (const [id, name] of [
      [WS, 'identity'],
      [OTHER_WS, 'elsewhere'],
    ]) {
      await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$2,now())`, [
        id,
        name,
      ]);
    }
    for (const [id, ws] of [
      [SPONSOR, WS],
      [REVIEWER, WS],
      [OUTSIDER, OTHER_WS],
    ]) {
      await db.query(
        `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
         VALUES ($1,$2,$1,$1,'x',now())`,
        [id, ws],
      );
    }
    await db.end();

    app = await boot();
    await app.init();
  }, 300_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  }, 120_000);

  it('registers a connector — a surface, registered separately from any agent', async () => {
    const { registry } = await services();
    const connector = await registry.registerConnector({
      workspaceId: WS,
      kind: 'fixture',
      registeredByUserId: SPONSOR,
    });
    connectorId = connector.connectorId;
    expect(connector.state).toBe('active');
    expect(connector.registeredByUserId, 'a connector is registered by a person').toBe(SPONSOR);
  });

  it('registers an agent with a human sponsor', async () => {
    const { registry } = await services();
    const agent = await registry.register({
      workspaceId: WS,
      kind: 'agent',
      descriptorRef: 'claude-fixture',
      sponsorUserId: SPONSOR,
      registeredByUserId: SPONSOR,
      connectorRegistrationId: connectorId,
      correlationId: 'corr-id',
      causationId: 'cause-id',
    });
    agentId = agent.principalId;
    expect(agent.kind).toBe('agent');
    expect(agent.sponsorUserId).toBe(SPONSOR);
    expect(agent.identityVersion).toBe(1);
    // The connector is ASSOCIATED, not merged: it is a separate concept with
    // its own id, and the agent could act through a different one tomorrow.
    expect(agent.connectorRegistrationId).toBe(connectorId);
  });

  it('refuses an agent whose sponsor is in another workspace', async () => {
    const { registry } = await services();
    await expect(
      registry.register({
        workspaceId: WS,
        kind: 'agent',
        descriptorRef: 'x',
        sponsorUserId: OUTSIDER,
        registeredByUserId: SPONSOR,
        correlationId: 'c',
        causationId: 'c',
      }),
    ).rejects.toThrow(/different workspace/i);
  });

  it('refuses an agent with a sponsor who does not exist', async () => {
    const { registry } = await services();
    await expect(
      registry.register({
        workspaceId: WS,
        kind: 'agent',
        descriptorRef: 'x',
        sponsorUserId: 'u_ghost',
        registeredByUserId: SPONSOR,
        correlationId: 'c',
        causationId: 'c',
      }),
    ).rejects.toThrow(/does not exist/i);
  });

  it('resolves the AGENT through EPIC-024 — without it being a User', async () => {
    // The heart of `Y2`. The agent has no `users` row, and the boundary admits
    // it anyway, because EPIC-024 now resolves through EPIC-028's registry.
    const { boundary } = await services();
    const actor = await boundary.requireWithinWorkspace(WS, agentId);
    expect(actor.kind).toBe('agent');

    const db = new Client({ connectionString: url });
    await db.connect();
    const { rows } = await db.query(`SELECT "id" FROM "users" WHERE "id"=$1`, [agentId]);
    await db.end();
    expect(rows, 'the agent was smuggled in as a human user').toHaveLength(0);
  });

  it('refuses an agent naming another workspace', async () => {
    const { boundary } = await services();
    await expect(boundary.requireWithinWorkspace(OTHER_WS, agentId)).rejects.toThrow();
  });

  it('mints frozen identities server-side, for agent and sponsor alike', async () => {
    const { trusted, snapshots } = await services();
    const ctx = await trusted.forPrincipal(WS, agentId);
    const frozen = await trusted.freeze(ctx);

    expect(frozen.principalId).toBe(agentId);
    expect(frozen.sponsorUserId).toBe(SPONSOR);
    expect(frozen.identityVersion).toBe(1);
    expect(frozen.connectorRegistrationId).toBe(connectorId);

    // Resolvable afterwards — which is how a submitted snapshot id is verified
    // rather than believed.
    const resolved = await snapshots.resolve(frozen.snapshotId);
    expect(resolved?.principalId).toBe(agentId);
  });

  it('refuses a snapshot for a principal in another workspace', async () => {
    const { snapshots } = await services();
    await expect(snapshots.capture(OTHER_WS, agentId)).rejects.toThrow(/not registered/i);
  });

  it('scopes delegation to one artifact, and refuses another', async () => {
    const { delegations } = await services();
    await delegations.delegate({
      workspaceId: WS,
      principalId: agentId,
      sponsorUserId: SPONSOR,
      artifact: { artifactType: 'specification', artifactId: 'spec_a' },
      actions: ['execution.register', 'execution.report', 'transition.propose'],
      identityVersion: 1,
      correlationId: 'corr-id',
    });

    await expect(
      delegations.requireDelegated({
        workspaceId: WS,
        principalId: agentId,
        artifact: { artifactType: 'specification', artifactId: 'spec_a' },
        action: 'transition.propose',
      }),
    ).resolves.toBeTruthy();

    // The sponsor may own other specifications. The agent reaches none of them.
    await expect(
      delegations.requireDelegated({
        workspaceId: WS,
        principalId: agentId,
        artifact: { artifactType: 'specification', artifactId: 'spec_b' },
        action: 'transition.propose',
      }),
    ).rejects.toThrow();
  });

  it('SURVIVES a restart — identity, snapshot and delegation all persist', async () => {
    await app.close();
    app = await boot();
    await app.init();

    const { registry, delegations, boundary } = await services();
    const agent = await registry.find(WS, agentId);
    expect(agent?.sponsorUserId).toBe(SPONSOR);
    await expect(boundary.requireWithinWorkspace(WS, agentId)).resolves.toBeTruthy();
    await expect(
      delegations.requireDelegated({
        workspaceId: WS,
        principalId: agentId,
        artifact: { artifactType: 'specification', artifactId: 'spec_a' },
        action: 'transition.propose',
      }),
    ).resolves.toBeTruthy();
  }, 180_000);

  it('a SUSPENDED agent cannot act, and its delegation stops matching', async () => {
    const { registry, trusted, boundary, delegations } = await services();
    await registry.changeState({
      workspaceId: WS,
      principalId: agentId,
      toState: 'suspended',
      actorUserId: SPONSOR,
      reason: 'under review',
      correlationId: 'corr-id',
      causationId: 'cause-2',
    });

    await expect(trusted.forPrincipal(WS, agentId)).rejects.toThrow(/suspended/);
    await expect(boundary.requireWithinWorkspace(WS, agentId)).rejects.toThrow();
    // The version moved, so yesterday's delegation no longer matches — a
    // suspended principal does not keep its authority in reserve.
    await expect(
      delegations.requireDelegated({
        workspaceId: WS,
        principalId: agentId,
        artifact: { artifactType: 'specification', artifactId: 'spec_a' },
        action: 'transition.propose',
      }),
    ).rejects.toThrow();
  });

  it('but suspension does NOT rewrite history — the old snapshot stands', async () => {
    // The whole reason snapshots are a separate, append-only table. An
    // execution recorded last week was performed by an active agent, and
    // deactivating it now must not change that record.
    const db = new Client({ connectionString: url });
    await db.connect();
    const { rows } = await db.query<{ identityVersion: number; sponsorUserId: string }>(
      `SELECT "identityVersion","sponsorUserId" FROM "principal_identity_snapshots"
       WHERE "principalId"=$1 ORDER BY "capturedAt"`,
      [agentId],
    );
    await db.end();
    expect(rows[0]?.identityVersion, 'the snapshot followed the principal').toBe(1);
    expect(rows[0]?.sponsorUserId).toBe(SPONSOR);
  });

  it('records WHY the state changed, append-only', async () => {
    const db = new Client({ connectionString: url });
    await db.connect();
    const { rows } = await db.query<{ toState: string; reason: string }>(
      `SELECT "toState","reason" FROM "principal_state_events"
       WHERE "principalId"=$1 ORDER BY "occurredAt"`,
      [agentId],
    );
    await expect(
      db.query(`UPDATE "principal_state_events" SET "reason"='x' WHERE "principalId"=$1`, [
        agentId,
      ]),
    ).rejects.toThrow(/append-only/i);
    await db.end();
    expect(rows.map((r) => r.toState)).toEqual(['active', 'suspended']);
  });

  it('identity evidence survives a SECOND restart', async () => {
    await app.close();
    app = await boot();
    await app.init();

    const { registry } = await services();
    const agent = await registry.find(WS, agentId);
    expect(agent?.state).toBe('suspended');
    expect(agent?.identityVersion).toBe(2);
  }, 180_000);
});
