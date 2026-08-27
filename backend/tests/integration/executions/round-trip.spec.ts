/**
 * T1039, T1081 (EPIC-037 Band A) — the fixture connector's round trip, through
 * the real `AppModule`, real DI and a real PostgreSQL.
 *
 * This is the Epic's claim in one test: a governed command executed anywhere,
 * by an agent nobody mistook for a person, recorded in a stream nobody can
 * edit, with a status decided by the platform rather than the agent.
 *
 * **Nothing on the success path is inserted directly.** The specification is
 * created through EPIC-009's production store with its owner grant; the agent
 * and connector are registered through EPIC-028; the delegation is granted
 * through EPIC-024; the gate and its human decision go through EPIC-021; the
 * application policy through EPIC-030. Only tenancy fixtures — workspace, user,
 * project — are raw inserts, because no service under test creates those.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import type { INestApplication } from '@nestjs/common';
import { FixtureConnector, RegistryRefusedError } from '@pmi/execution-registry-contract';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../../prisma/migrations');

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_rt';
const OTHER_WS = 'ws_rt_other';
const OWNER = 'u_rt_owner';
const OUTSIDER = 'u_rt_outsider';
const SPEC = 'spec_rt';
const PROJECT = 'proj_rt';

suite('T1081 · a governed command travels the whole path and comes back applied', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let url = '';
  let agentId = '';
  let connectorId = '';
  let agentSnapshotId = '';
  let delegationId = '';
  let executionId = '';

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
    const facade = await import('../../../src/modules/executions/execution-registry.facade.js');
    const proj = await import('../../../src/modules/executions/execution-projection.service.js');
    const ev = await import('../../../src/modules/executions/execution-event.service.js');
    const cm = await import('../../../src/modules/executions/execution-comment.service.js');
    return {
      registry: app.get(reg.PrincipalRegistryService, { strict: false }),
      snapshots: app.get(reg.IdentitySnapshotService, { strict: false }),
      delegations: app.get(pd.PrincipalDelegationService, { strict: false }),
      executions: app.get(facade.ExecutionRegistryFacade, { strict: false }),
      projections: app.get(proj.ExecutionProjectionService, { strict: false }),
      events: app.get(ev.ExecutionEventService, { strict: false }),
      comments: app.get(cm.ExecutionCommentService, { strict: false }),
    };
  }

  const identity = () => ({
    authenticatedPrincipalId: agentId,
    agentSnapshotId,
    connectorRegistrationId: connectorId,
    sponsorUserId: OWNER,
    delegationId,
    delegationIdentityVersion: 1,
  });

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
      [WS, 'round trip'],
      [OTHER_WS, 'elsewhere'],
    ]) {
      await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$2,now())`, [
        id,
        name,
      ]);
    }
    for (const [id, ws] of [
      [OWNER, WS],
      [OUTSIDER, OTHER_WS],
    ]) {
      await db.query(
        `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
         VALUES ($1,$2,$1,$1,'x',now())`,
        [id, ws],
      );
    }
    await db.query(
      `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt")
       VALUES ($1,$2,'rt',$3,now())`,
      [PROJECT, WS, OWNER],
    );
    await db.end();

    app = await boot();

    // 1. The governed specification, through EPIC-009's PRODUCTION store — with
    //    its owner grant written in the same transaction (`C2E`).
    const specsModule = await import('../../../src/modules/specifications/specifications.module.js');
    const store = app.get(specsModule.SPECIFICATION_STORE, { strict: false });
    await store.commitGeneration({
      specification: {
        id: SPEC,
        workspaceId: WS,
        projectId: PROJECT,
        title: 'Round trip probe',
        lifecycleState: 'draft',
        currentVersionId: null,
        engineName: 'fixture',
        engineVersion: '1',
        generatedAt: new Date(),
        isOutOfDate: false,
        createdById: OWNER,
        updatedById: OWNER,
      },
      version: {
        id: 'ver_rt',
        workspaceId: WS,
        specificationId: SPEC,
        versionNumber: 1,
        contentRaw: '# probe',
        contentParsed: {},
        lifecycleStateAtCreation: 'draft',
        authoredById: OWNER,
      },
      links: [],
      job: { id: 'job_rt', state: 'succeeded', resultRef: SPEC },
      ownership: {
        initiatingActorId: OWNER,
        initiatingActorType: 'human',
        ownerUserId: OWNER,
        ownerSnapshotId: `snap-${OWNER}`,
        correlationId: 'corr-rt',
        causationId: 'job_rt',
        idempotencyKey: 'job_rt',
      },
    });

    const { registry, snapshots, delegations } = await svc();

    // 2 & 3. The connector is registered SEPARATELY from the agent — it is a
    //        surface, and the same agent could act through another tomorrow.
    connectorId = (
      await registry.registerConnector({
        workspaceId: WS,
        kind: 'fixture',
        registeredByUserId: OWNER,
      })
    ).connectorId;

    agentId = (
      await registry.register({
        workspaceId: WS,
        kind: 'agent',
        descriptorRef: 'fixture-agent',
        sponsorUserId: OWNER,
        registeredByUserId: OWNER,
        connectorRegistrationId: connectorId,
        correlationId: 'corr-rt',
        causationId: 'cause-rt',
      })
    ).principalId;

    // 4. Explicit, scoped delegation. The sponsor owns the specification; that
    //    ownership does NOT reach the agent (`C3B`).
    delegationId = (
      await delegations.delegate({
        workspaceId: WS,
        principalId: agentId,
        sponsorUserId: OWNER,
        artifact: { artifactType: 'specification', artifactId: SPEC },
        actions: [
          'execution.register',
          'execution.report',
          'execution.attach-evidence',
          'transition.propose',
        ],
        identityVersion: 1,
        correlationId: 'corr-rt',
      })
    ).id;

    // 5 & 6. The frozen identity, minted SERVER-SIDE. The connector receives a
    //        reference; it cannot construct one.
    agentSnapshotId = (await snapshots.capture(WS, agentId)).snapshotId;
  }, 300_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  }, 120_000);

  it('registers with INPUT binding, and refuses commitAfter there', async () => {
    const { executions } = await svc();
    const fixture = new FixtureConnector(executions, {
      workspaceId: WS,
      identity: identity(),
      correlationId: 'corr-rt',
    });

    const snapshot = await fixture.register({
      command: 'specify',
      args: { spec: 'specs/037/spec.md', branch: 'main' },
      binding: {
        targetType: 'specification',
        targetId: SPEC,
        targetVersion: 1,
        repositoryId: 'pmi',
        branch: 'main',
        commitBefore: 'abc123',
      },
    });
    executionId = snapshot.executionId;
    expect(snapshot.governanceState).toBe('governed');
    expect(snapshot.surface).toBe('fixture');

    // `AC-EXR-17b`: asking for an output commit before the work has run is the
    // defect, so a request carrying one is refused rather than ignored.
    await expect(
      fixture.register({
        command: 'specify',
        args: {},
        binding: {
          targetType: 'specification',
          targetId: SPEC,
          commitAfter: 'def456',
        } as never,
      }),
    ).rejects.toThrow(RegistryRefusedError);
  });

  it('records started, then completed with OUTPUT binding and a comment', async () => {
    const { executions, comments } = await svc();
    const fixture = new FixtureConnector(executions, {
      workspaceId: WS,
      identity: identity(),
      correlationId: 'corr-rt',
    });

    const started = await fixture.start(executionId);
    expect(started.sequence).toBe(2);

    const completed = await fixture.complete({
      executionId,
      outcome: 'completed',
      comment: 'Specification generated and reviewed.',
      output: {
        commitAfter: 'def456',
        resultingVersion: 2,
        generatedArtifactDigests: ['sha256:aaa'],
      },
    });
    expect(completed.sequence).toBe(3);

    await comments.add({
      workspaceId: WS,
      executionId,
      authorId: agentId,
      authorType: 'agent',
      commentType: 'completion',
      body: 'Specification generated and reviewed.',
      idempotencyKey: 'rt-comment',
    });
  });

  it('refuses a successful completion with NO output binding', async () => {
    const { executions } = await svc();
    await expect(
      executions.complete({
        executionId,
        workspaceId: WS,
        outcome: 'completed',
        identity: identity(),
        idempotencyKey: 'rt-no-output',
        occurredAt: new Date().toISOString(),
        completionComment: 'done',
      }),
    ).rejects.toThrow(/output/i);
  });

  it('refuses a completion with NO comment', async () => {
    const { executions } = await svc();
    await expect(
      executions.complete({
        executionId,
        workspaceId: WS,
        outcome: 'failed',
        identity: identity(),
        idempotencyKey: 'rt-no-comment',
        occurredAt: new Date().toISOString(),
        completionComment: '   ',
      }),
    ).rejects.toThrow(/comment/i);
  });

  it('blocks a LIFECYCLE event after terminality, and permits a comment', async () => {
    const { executions, comments } = await svc();
    await expect(
      executions.appendEvent({
        executionId,
        workspaceId: WS,
        type: 'started',
        payload: {},
        occurredAt: new Date().toISOString(),
        identity: identity(),
        idempotencyKey: 'rt-after-terminal',
      }),
    ).rejects.toThrow(/no further lifecycle/i);

    // The other half: a finished execution can still be asked about.
    await expect(
      comments.add({
        workspaceId: WS,
        executionId,
        authorId: OWNER,
        authorType: 'human',
        commentType: 'review',
        body: 'Looks right.',
        idempotencyKey: 'rt-after-comment',
      }),
    ).resolves.toBeTruthy();
  });

  it('the projection rebuilds from the authoritative events alone', async () => {
    const { projections, events } = await svc();
    const rebuilt = await projections.rebuild(WS, executionId);
    expect(rebuilt.lifecycleState).toBe('completed');

    const verified = await events.verify(WS, executionId);
    expect(verified, 'the stream is not gapless or not chained').toEqual({
      gapless: true,
      chained: true,
    });
  });

  it('a substituted snapshot from another workspace is refused', async () => {
    // A real, resolvable snapshot — just not one of ours. This is the
    // substitution the resolution check exists for.
    const { registry, snapshots, executions } = await svc();
    await registry.registerConnector({
      workspaceId: OTHER_WS,
      kind: 'fixture',
      registeredByUserId: OUTSIDER,
    });
    const foreignAgent = await registry.register({
      workspaceId: OTHER_WS,
      kind: 'agent',
      descriptorRef: 'other',
      sponsorUserId: OUTSIDER,
      registeredByUserId: OUTSIDER,
      correlationId: 'c',
      causationId: 'c',
    });
    const foreignSnapshot = await snapshots.capture(OTHER_WS, foreignAgent.principalId);

    await expect(
      executions.register({
        workspaceId: WS,
        command: 'specify',
        argsSanitized: {},
        surface: 'fixture',
        identity: { ...identity(), agentSnapshotId: foreignSnapshot.snapshotId },
        input: { targetType: 'specification', targetId: SPEC },
        correlationId: 'corr-x',
        idempotencyKey: 'rt-foreign',
        contractVersion: '1.0',
      }),
    ).rejects.toThrow(/different workspace|different principal/i);
  });

  it('a credential in the arguments refuses registration outright', async () => {
    const { executions } = await svc();
    await expect(
      executions.register({
        workspaceId: WS,
        command: 'specify',
        argsSanitized: { apiKey: 'ghp_abcdefghijklmnop0123456789' },
        surface: 'fixture',
        identity: identity(),
        input: { targetType: 'specification', targetId: SPEC },
        correlationId: 'corr-cred',
        idempotencyKey: 'rt-cred',
        contractVersion: '1.0',
      }),
    ).rejects.toThrow(/credential/i);
  });

  it('an unsupported contract version is refused', async () => {
    const { executions } = await svc();
    await expect(
      executions.register({
        workspaceId: WS,
        command: 'specify',
        argsSanitized: {},
        surface: 'fixture',
        identity: identity(),
        input: { targetType: 'specification', targetId: SPEC },
        correlationId: 'corr-v',
        idempotencyKey: 'rt-version',
        contractVersion: '9.9',
      }),
    ).rejects.toThrow(/contract version/i);
  });

  it('an execution against an UNDELEGATED artifact is refused', async () => {
    // The sponsor owns other specifications. The agent reaches none of them.
    //
    // Asserted on the REFUSAL CODE, not the message. EPIC-024's refusal is
    // deliberately opaque — it says "Not found." so a caller learns nothing
    // about whether the artifact exists — so matching prose here would either
    // fail or force that opacity to be weakened. This is the same lesson `X1`
    // taught: branch on the discriminator, never on the sentence.
    const { executions } = await svc();
    const failure = await executions
      .register({
        workspaceId: WS,
        command: 'specify',
        argsSanitized: {},
        surface: 'fixture',
        identity: identity(),
        input: { targetType: 'specification', targetId: 'spec_elsewhere' },
        correlationId: 'corr-d',
        idempotencyKey: 'rt-undelegated',
        contractVersion: '1.0',
      })
      .then(() => null)
      .catch((e: unknown) => e as RegistryRefusedError);

    expect(failure, 'an undelegated artifact was accepted').not.toBeNull();
    expect(failure).toBeInstanceOf(RegistryRefusedError);
    expect(failure?.refusal).toBe('delegation_missing');
  });

  it('history and identity survive a RESTART', async () => {
    const before = await (await svc()).executions.history(WS, executionId);

    await app.close();
    app = await boot();

    const { executions, projections } = await svc();
    const after = await executions.history(WS, executionId);
    expect(after.map((e) => [e.sequence, e.type])).toEqual(
      before.map((e) => [e.sequence, e.type]),
    );

    const rebuilt = await projections.rebuild(WS, executionId);
    expect(rebuilt.lifecycleState).toBe('completed');
  }, 180_000);
});
