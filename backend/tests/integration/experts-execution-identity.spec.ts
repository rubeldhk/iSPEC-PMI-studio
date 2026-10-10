/**
 * `T2568` (EPIC-047) — an Expert run registered under its own identity,
 * through the composed application. `DEF-047-001`, `FR-EXP-060`,
 * Constitution XI Tier 1.
 *
 * Against PostgreSQL, through the real routes, with `ExpertExecutions` bound to
 * `EPIC-037`'s registry as composed — nothing in this file replaces it. What is
 * replaced, visibly, is what the composed application cannot supply here:
 * approval (a human decides it in `EPIC-031`'s Inbox), context (no embedding
 * provider exists), and — for the second case only — the agent runtime
 * `DEF-047-002` says nothing composes yet. The runtime is replaced with the
 * real runner adapter over a recording gateway and environment, so the run
 * path is the one production would take.
 *
 * Every assertion about identity reads the rows `EPIC-028` and `EPIC-037`
 * wrote, not anything this Epic says about them.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Client } from 'pg';
import type { INestApplication } from '@nestjs/common';
import { agentOk, type AgentGateway } from '@pmi/agent-contract';
import { GENERATION_EGRESS_PROFILE, type ExecutionSession, type ProjectExecutionEnvironment } from '@pmi/execution-contract';
import { agentRunners } from '../../src/modules/experts/adapters/runners.adapter.js';
import { EXPERT_PORTS, type ExpertPorts } from '../../src/modules/experts/experts.tokens.js';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import { contract, descriptor, recordingApprovals, recordingContext } from '../helpers/expert-fixtures.js';

const PREFIX = 'v1';
const WS = 'ws_identity';
const USER = 'u_sponsor';
const OUTSIDER = 'u_outsider';
const PROJECT = 'pr_identity';
const KEY = 'id-engineer';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let harness: AuthenticatedApp;
let app: INestApplication;
let db: Client;
let outsiderCookie = '';
let expertId = '';

beforeAll(async () => {
  if (noRuntime) return;
  harness = await startAuthenticatedApp({
    prefix: PREFIX,
    workspaceId: WS,
    userId: USER,
    async seed(client, ids) {
      await client.query(
        `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
         VALUES ($1,$2,$3,'Outsider','unused',now())`,
        [OUTSIDER, ids.workspaceId, `${OUTSIDER}@example.test`],
      );
      await client.query(
        `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt") VALUES ($1,$2,'Identity',$3,now())`,
        [PROJECT, ids.workspaceId, ids.userId],
      );
      // The sponsor edits the project and the registry; the outsider may author
      // Experts and read the specification, but cannot edit the project.
      await client.query(
        `INSERT INTO "access_grants" ("id","workspaceId","artifactType","artifactId","userId","level","grantedById")
         VALUES ('g_reg',$1,'expert-registry',$1,$2,'edit',$2),
                ('g_proj',$1,'project',$4,$2,'edit',$2),
                ('g_spec',$1,'specification','sp_1',$2,'read',$2),
                ('g_out_reg',$1,'expert-registry',$1,$3,'edit',$2),
                ('g_out_spec',$1,'specification','sp_1',$3,'read',$2)`,
        [ids.workspaceId, ids.userId, OUTSIDER, PROJECT],
      );
    },
  });
  app = harness.app;
  db = new Client({ connectionString: harness.databaseUrl });
  await db.connect();
  const { SessionService } = await import('../../src/modules/auth/sessions.js');
  const { SESSION_COOKIE } = await import('../../src/modules/auth/auth.controller.js');
  const session = app.get(SessionService, { strict: false }).create({
    userId: OUTSIDER,
    workspaceId: WS,
    email: `${OUTSIDER}@example.test`,
    displayName: 'Outsider',
  });
  outsiderCookie = `${SESSION_COOKIE}=${session.token}`;
}, 600_000);

afterAll(async () => {
  await db?.end();
  await harness?.close();
}, 120_000);

const api = () => request(app.getHttpServer());
const dispatchBody = {
  command: 'implement',
  objective: 'write the tests for the booking notification',
  projectId: PROJECT,
  capabilities: ['test'],
  tools: ['run-tests'],
  actions: [],
  targets: [{ artifactType: 'specification', artifactId: 'sp_1', action: 'read' }],
};

async function executionsInWorkspace(): Promise<{ id: string }[]> {
  return (await db.query(`SELECT "id" FROM "executions" WHERE "workspaceId" = $1 ORDER BY "createdAt"`, [WS])).rows;
}

suite('T2568 · an Expert run is registered under its own identity, as composed', () => {
  it('setup — an approved Expert whose contract names a shipped Evidence Contract', async () => {
    const ports = app.get<ExpertPorts>(EXPERT_PORTS, { strict: false });
    const approvals = recordingApprovals();
    ports.approvals = approvals; // a human decides this in EPIC-031's Inbox; not under test here
    const created = await api()
      .post(`/${PREFIX}/experts`)
      .set('Cookie', harness.cookie)
      .send({ key: KEY, name: 'Identity Engineer', contract: contract({ evidenceContract: { workClass: 'task-completion', contractVersion: 1 } }) })
      .expect(201);
    expertId = created.body.expert.id;
    await api().post(`/${PREFIX}/experts/${expertId}/contract-versions/1/submit`).set('Cookie', harness.cookie).expect(201);
    approvals.resolve('d_1', 'approved');
  });

  it('with no runtime composed: registered under an agent principal the sponsor sponsors, refused at the runtime, closed cancelled', async () => {
    const res = await api().post(`/${PREFIX}/experts/${expertId}/dispatch`).set('Cookie', harness.cookie).send(dispatchBody);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).toMatch(/ExpertGateways is not bound.*DEF-047-002/);

    const [execution] = await executionsInWorkspace();
    expect(execution).toBeDefined();
    const row = (
      await db.query(
        `SELECT "command","initiatorType","initiatorId","surface","assurance","governanceState","projectId" FROM "executions" WHERE "id" = $1`,
        [execution!.id],
      )
    ).rows[0];
    expect(row).toMatchObject({
      command: 'implement',
      initiatorType: 'agent',
      surface: 'managed-sandbox',
      assurance: 'managed',
      governanceState: 'governed',
      projectId: PROJECT,
    });

    // EPIC-028's rows: an agent principal for this Expert, sponsored by the dispatcher.
    const principal = (
      await db.query(`SELECT "id","kind","descriptorRef","sponsorUserId","state" FROM "principals" WHERE "id" = $1`, [row.initiatorId])
    ).rows[0];
    expect(principal).toMatchObject({ kind: 'agent', descriptorRef: `engineering-expert:${KEY}`, sponsorUserId: USER, state: 'active' });

    // EPIC-024's row: the sponsor delegated registration on the project, and nothing more.
    const delegations = (
      await db.query(
        `SELECT "artifactType","artifactId","actions","sponsorUserId" FROM "principal_delegations" WHERE "principalId" = $1`,
        [principal.id],
      )
    ).rows;
    expect(delegations).toEqual([
      { artifactType: 'project', artifactId: PROJECT, actions: ['execution.register', 'execution.report'], sponsorUserId: USER },
    ]);

    // EPIC-037's events: the refusal recorded on the execution, then the close.
    const events = (
      await db.query(`SELECT "type","payload" FROM "execution_events" WHERE "executionId" = $1 ORDER BY "sequence"`, [execution!.id])
    ).rows;
    expect(events.map((e: { type: string }) => e.type)).toEqual(['registered', 'expert-governance-recorded', 'cancelled']);
    expect(events[1].payload).toMatchObject({ kind: 'dispatch-refused' });
    expect(String(events[1].payload.reason)).toMatch(/DEF-047-002/);

    const identity = (
      await db.query(`SELECT "principalId","sponsorUserId","projectId" FROM "expert_execution_identities" WHERE "executionId" = $1`, [
        execution!.id,
      ])
    ).rows[0];
    expect(identity).toEqual({ principalId: principal.id, sponsorUserId: USER, projectId: PROJECT });
  });

  it('with a runtime composed in the test: the run executes in a session the runner starts and stops, and the execution closes', async () => {
    const ports = app.get<ExpertPorts>(EXPERT_PORTS, { strict: false });
    ports.context = recordingContext(); // no embedding provider exists to assemble with
    const ran: string[] = [];
    const sessions: { started: number; stopped: number } = { started: 0, stopped: 0 };
    const d = descriptor({ model: contract().models.preferred, name: 'composed-gateway' });
    const gateway: AgentGateway = {
      descriptor: d,
      getCapabilities: () => d,
      healthCheck: async () => agentOk({ reachable: true }, d) as never,
      async execute(invocation) {
        ran.push(invocation.command);
        return agentOk({ exitCode: 0, stdout: 'tests written' }, d);
      },
    };
    const environment: ProjectExecutionEnvironment = {
      descriptor: {
        provider: 'recording',
        kind: 'managed-isolated',
        supportedLifecycles: ['ephemeral'],
        supportsPersistentState: false,
        supportsNetworkPolicy: true,
        maxWallClockMs: 900_000,
      },
      async start() {
        sessions.started += 1;
        return {} as ExecutionSession;
      },
      async stop() {
        sessions.stopped += 1;
      },
    };
    ports.gateways = agentRunners({
      gateways: [gateway],
      environment,
      session: {
        lifecycle: 'ephemeral',
        image: 'test-image',
        env: {},
        workspace: { kind: 'ephemeral', scratchPath: '/workspace' },
        egressProfile: GENERATION_EGRESS_PROFILE,
        credentials: [],
        resourceLimits: { cpus: 1, memoryMb: 1024, pids: 128, wallClockMs: 600_000 },
      },
    });

    const res = await api().post(`/${PREFIX}/experts/${expertId}/dispatch`).set('Cookie', harness.cookie).send(dispatchBody);
    expect(res.status).toBe(201);
    expect(ran).toEqual(['implement: write the tests for the booking notification']);
    expect(sessions).toEqual({ started: 1, stopped: 1 });

    // The runner reports no output kinds it did not observe, so the required
    // `test-report` is missing: the run is incomplete, recorded and closed as such.
    expect(res.body).toMatchObject({ outcome: 'incomplete' });
    const executionId = res.body.executionId as string;
    const events = (
      await db.query(`SELECT "type","payload" FROM "execution_events" WHERE "executionId" = $1 ORDER BY "sequence"`, [executionId])
    ).rows as { type: string; payload: { kind?: string } }[];
    expect(events[0]!.type).toBe('registered');
    expect(events.filter((e) => e.type === 'expert-governance-recorded').map((e) => e.payload.kind)).toEqual(
      expect.arrayContaining(['tool-use-unobserved', 'outputs-incomplete']),
    );
    expect(events.at(-1)!.type).toBe('partially-completed');

    // Same Expert, same sponsor: the principal is reused, not minted again.
    const principals = (
      await db.query(`SELECT count(*)::int AS n FROM "principals" WHERE "descriptorRef" = $1 AND "workspaceId" = $2`, [
        `engineering-expert:${KEY}`,
        WS,
      ])
    ).rows[0].n;
    expect(principals).toBe(1);

    // The session record reads its events back from EPIC-037, through the adapter.
    const session = await api().get(`/${PREFIX}/experts/sessions/${executionId}`).set('Cookie', harness.cookie);
    expect(session.status).toBe(200);
    expect(session.body.events.map((e: { kind: string }) => e.kind)).toEqual(
      expect.arrayContaining(['tool-use-unobserved', 'outputs-incomplete']),
    );
  });

  it('a user who may not edit the project cannot sponsor a run: 403, and nothing is registered', async () => {
    const before = (await executionsInWorkspace()).length;
    const res = await api().post(`/${PREFIX}/experts/${expertId}/dispatch`).set('Cookie', outsiderCookie).send(dispatchBody);
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toMatch(/may not edit project/);
    expect((await executionsInWorkspace()).length).toBe(before);
    const minted = (
      await db.query(`SELECT count(*)::int AS n FROM "principals" WHERE "sponsorUserId" = $1`, [OUTSIDER])
    ).rows[0].n;
    expect(minted).toBe(0);
  });
});
