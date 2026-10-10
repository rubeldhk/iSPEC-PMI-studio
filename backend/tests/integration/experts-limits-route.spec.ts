/**
 * `T1964` (EPIC-047) — limits through the real routes: Q8, Q9, Q10.
 *
 * With the in-test bindings of `T1943`. The runner declares no enforceable
 * limits — as no real provider does today (`R-047-7`) — so a token limit under
 * the clarified default refuses, one under `proceed` runs and reads
 * `unenforceable`, and the `resource` limit (maximum tool calls) reads
 * `unenforceable` on a runner that reports no tool calls (analysis A1).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { AgentContext } from '@pmi/agent-contract';
import { EXPERT_PORTS, type ExpertPorts, type RunReport } from '../../src/modules/experts/experts.tokens.js';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import {
  contract,
  evidenceKnowing,
  gatewaysFor,
  recordingApprovals,
  recordingContext,
  recordingExecutions,
  runner,
} from '../helpers/expert-fixtures.js';

const PREFIX = 'v1';
const WS = 'ws_limits';
const USER = 'u_limits';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let harness: AuthenticatedApp;
let app: INestApplication;
const ids: Record<string, string> = {};

const api = () => request(app.getHttpServer());
const body = {
  command: 'implement',
  objective: 'run the booking tests',
  projectId: 'pr_1',
  capabilities: ['test'],
  tools: ['run-tests'],
  actions: [],
  targets: [{ artifactType: 'specification', artifactId: 'sp_1', action: 'read' }],
};

const untilStopped = (ctx: AgentContext) =>
  new Promise<RunReport>((resolve) => ctx.signal?.addEventListener('abort', () => resolve({ status: 'cancelled', outputs: [] })));

beforeAll(async () => {
  if (noRuntime) return;
  harness = await startAuthenticatedApp({
    prefix: PREFIX,
    workspaceId: WS,
    userId: USER,
    async seed(db, s) {
      await db.query(
        `INSERT INTO "access_grants" ("id","workspaceId","artifactType","artifactId","userId","level","grantedById")
         VALUES ('g_lr',$1,'expert-registry',$1,$2,'edit',$2), ('g_ls',$1,'specification','sp_1',$2,'read',$2)`,
        [s.workspaceId, s.userId],
      );
    },
  });
  app = harness.app;
  const ports = app.get<ExpertPorts>(EXPERT_PORTS, { strict: false });
  ports.evidence = evidenceKnowing('implementation@1');
  const approvals = recordingApprovals();
  ports.approvals = approvals;
  ports.executions = recordingExecutions();
  ports.context = recordingContext();

  const budgets: [string, Record<string, unknown>, string][] = [
    ['strict', { time: { value: 60_000 }, tokens: { value: 1000 } }, 'quick-model'],
    ['lenient', { time: { value: 60_000 }, tokens: { value: 1000, onUnenforceable: 'proceed' }, resource: { value: 10 } }, 'quick-model'],
    ['hurried', { time: { value: 50 } }, 'slow-model'],
  ];
  for (const [key, budget, model] of budgets) {
    const created = await api()
      .post(`/${PREFIX}/experts`)
      .set('Cookie', harness.cookie)
      .send({ key, name: key, contract: contract({ budget: budget as never, models: { preferred: model, fallbacks: [] } }) })
      .expect(201);
    ids[key] = created.body.expert.id;
    await api().post(`/${PREFIX}/experts/${ids[key]}/contract-versions/1/submit`).set('Cookie', harness.cookie).expect(201);
  }
  for (const i of approvals.submitted.keys()) approvals.resolve(`d_${i + 1}`, 'approved');
  ports.gateways = gatewaysFor({
    'quick-model': [runner({ model: 'quick-model' })],
    'slow-model': [runner({ model: 'slow-model' }, untilStopped)],
  });
}, 600_000);

afterAll(async () => {
  await harness?.close();
}, 120_000);

suite('T1964 · limits through the routes', () => {
  it('Q8 — an unenforceable token limit under the default posture refuses 400', async () => {
    const res = await api().post(`/${PREFIX}/experts/${ids['strict']}/dispatch`).set('Cookie', harness.cookie).send(body);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/tokens limit cannot be enforced/);
  });

  it('Q9 — under `proceed` it runs, and the limit reads unenforceable, never enforced', async () => {
    const res = await api().post(`/${PREFIX}/experts/${ids['lenient']}/dispatch`).set('Cookie', harness.cookie).send(body);
    expect(res.status).toBe(201);
    const view = await api().get(`/${PREFIX}/experts/sessions/${res.body.executionId}`).set('Cookie', harness.cookie);
    const byKind = Object.fromEntries(view.body.limits.map((l: { limit: string; enforcement: string }) => [l.limit, l.enforcement]));
    expect(byKind).toEqual({ time: 'enforced', tokens: 'unenforceable', resource: 'unenforceable' });
    const kinds = view.body.events.map((e: { kind: string }) => e.kind);
    expect(kinds.filter((k: string) => k === 'limit-unenforceable')).toHaveLength(2);
  });

  it('a request above its contract is narrowed, and says so', async () => {
    const res = await api()
      .post(`/${PREFIX}/experts/${ids['lenient']}/dispatch`)
      .set('Cookie', harness.cookie)
      .send({ ...body, limits: { time: 999_999 } });
    expect(res.status).toBe(201);
    const view = await api().get(`/${PREFIX}/experts/sessions/${res.body.executionId}`).set('Cookie', harness.cookie);
    expect(view.body.limits.find((l: { limit: string }) => l.limit === 'time')).toMatchObject({ value: 60_000, requested: 999_999 });
    expect(view.body.events.map((e: { kind: string }) => e.kind)).toContain('limit-narrowed');
  });

  it('Q10 — reaching the time limit stops the run', async () => {
    const res = await api().post(`/${PREFIX}/experts/${ids['hurried']}/dispatch`).set('Cookie', harness.cookie).send(body);
    expect(res.status).toBe(201);
    expect(res.body.outcome).toBe('stopped-by-limit');
    const view = await api().get(`/${PREFIX}/experts/sessions/${res.body.executionId}`).set('Cookie', harness.cookie);
    expect(view.body.limits[0]).toMatchObject({ limit: 'time', enforcement: 'enforced', reached: 'stopped' });
  });
});
