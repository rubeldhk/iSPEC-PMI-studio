/**
 * `T1943` (EPIC-047) — dispatch through its real routes.
 *
 * Constitution XI Tier 1, quickstart Q5–Q7. As composed, dispatch refuses
 * `503` — no runner and no execution identity exist anywhere yet
 * (`DEF-047-001`). The ports are then replaced by **in-test bindings that
 * record every call** (`R-047-13`, analysis finding I1), here, visibly; the
 * module's own defaults stay refusing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { EXPERT_PORTS, type ExpertPorts } from '../../src/modules/experts/experts.tokens.js';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import {
  contract,
  evidenceKnowing,
  gatewaysFor,
  recordingApprovals,
  recordingContext,
  recordingExecutions,
  runner,
  type RecordingExecutions,
} from '../helpers/expert-fixtures.js';

const PREFIX = 'v1';
const WS = 'ws_dispatch';
const USER = 'u_dispatch';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let harness: AuthenticatedApp;
let app: INestApplication;
let expertId = '';
let executions: RecordingExecutions;

beforeAll(async () => {
  if (noRuntime) return;
  harness = await startAuthenticatedApp({
    prefix: PREFIX,
    workspaceId: WS,
    userId: USER,
    async seed(db, ids) {
      await db.query(
        `INSERT INTO "access_grants" ("id","workspaceId","artifactType","artifactId","userId","level","grantedById")
         VALUES ('g_reg',$1,'expert-registry',$1,$2,'edit',$2),
                ('g_spec',$1,'specification','sp_1',$2,'read',$2)`,
        [ids.workspaceId, ids.userId],
      );
    },
  });
  app = harness.app;
}, 600_000);

afterAll(async () => {
  await harness?.close();
}, 120_000);

const api = () => request(app.getHttpServer());
const dispatchBody = (over: Record<string, unknown> = {}) => ({
  command: 'implement',
  objective: 'write the tests for the booking notification',
  projectId: 'pr_1',
  capabilities: ['test'],
  tools: ['run-tests'],
  actions: [],
  targets: [{ artifactType: 'specification', artifactId: 'sp_1', action: 'read' }],
  ...over,
});

suite('T1943 · the dispatch routes', () => {
  it('as composed, an approved Expert still cannot be dispatched: 503 naming the unbound port', async () => {
    const ports = app.get<ExpertPorts>(EXPERT_PORTS, { strict: false });
    // Registration and approval need their own in-test bindings first.
    ports.evidence = evidenceKnowing('implementation@1');
    const approvals = recordingApprovals();
    ports.approvals = approvals;
    const created = await api()
      .post(`/${PREFIX}/experts`)
      .set('Cookie', harness.cookie)
      .send({ key: 'test-engineer', name: 'Test Engineer', contract: contract() })
      .expect(201);
    expertId = created.body.expert.id;
    await api().post(`/${PREFIX}/experts/${expertId}/contract-versions/1/submit`).set('Cookie', harness.cookie).expect(201);
    approvals.resolve('d_1', 'approved');

    const res = await api().post(`/${PREFIX}/experts/${expertId}/dispatch`).set('Cookie', harness.cookie).send(dispatchBody());
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).toMatch(/ExpertExecutions.*DEF-047-001/);
  });

  it('Q7 — with in-test runner and registry: runs, falling back, and records why', async () => {
    const ports = app.get<ExpertPorts>(EXPERT_PORTS, { strict: false });
    executions = recordingExecutions();
    ports.executions = executions;
    ports.context = recordingContext();
    ports.gateways = gatewaysFor({ 'claude-sonnet-5-5': [runner({ model: 'claude-sonnet-5-5' })] });

    const res = await api().post(`/${PREFIX}/experts/${expertId}/dispatch`).set('Cookie', harness.cookie).send(dispatchBody());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ model: 'claude-sonnet-5-5', usedFallback: true, outcome: 'succeeded', contractVersion: 1 });

    const session = await api().get(`/${PREFIX}/experts/sessions/${res.body.executionId}`).set('Cookie', harness.cookie);
    expect(session.status).toBe(200);
    expect(session.body.session).toMatchObject({ executionId: res.body.executionId, usedFallback: true, toolObservation: 'unobserved' });
    // The default contract's token limit has no control on this runner, so it
    // is recorded as unenforceable (FR-EXP-042) — never silently enforced.
    expect(session.body.events.map((e: { kind: string }) => e.kind)).toEqual([
      'fallback-used',
      'limit-unenforceable',
      'tool-use-unobserved',
    ]);
  });

  it('Q5 — a tool outside the contract is refused 400, as an event on a registered execution', async () => {
    const res = await api()
      .post(`/${PREFIX}/experts/${expertId}/dispatch`)
      .set('Cookie', harness.cookie)
      .send(dispatchBody({ tools: ['shell'] }));
    expect(res.status).toBe(400);
    const executionId = res.body.error.details.executionId as string;
    expect(executions.kindsFor(executionId)).toEqual(['dispatch-refused']);
  });

  it('Q6 — a prohibited action is refused even when also an allowed tool', async () => {
    const res = await api()
      .post(`/${PREFIX}/experts/${expertId}/dispatch`)
      .set('Cookie', harness.cookie)
      .send(dispatchBody({ actions: ['push'] }));
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/prohibited by the contract: push/);
  });

  it('a target the requester may not read is refused, whatever the contract allows (FR-EXP-014)', async () => {
    const res = await api()
      .post(`/${PREFIX}/experts/${expertId}/dispatch`)
      .set('Cookie', harness.cookie)
      .send(dispatchBody({ targets: [{ artifactType: 'specification', artifactId: 'sp_secret', action: 'read' }] }));
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/may not read specification sp_secret/);
  });

  it('recent runs are listed newest first (analysis C3)', async () => {
    const res = await api().get(`/${PREFIX}/experts/${expertId}/sessions?limit=5`).set('Cookie', harness.cookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0]).toMatchObject({ outcome: 'succeeded', model: 'claude-sonnet-5-5' });
  });

  it('a session in another workspace, or none, is not found', async () => {
    expect((await api().get(`/${PREFIX}/experts/sessions/exe_nope`).set('Cookie', harness.cookie)).status).toBe(404);
  });
});
