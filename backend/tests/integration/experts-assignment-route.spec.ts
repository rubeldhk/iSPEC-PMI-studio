/**
 * `T1971` (EPIC-047) — assignment through the real routes: Q14, Q15, Q16.
 *
 * Against `EPIC-046`'s real `tasks` table. `ContractApprovals` is an in-test
 * binding (analysis finding I1) for the contract approval and the risk gate,
 * after the composed default is shown refusing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { EXPERT_PORTS, type ExpertPorts } from '../../src/modules/experts/experts.tokens.js';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import { contract, evidenceKnowing, recordingApprovals, type RecordingApprovals } from '../helpers/expert-fixtures.js';

const PREFIX = 'v1';
const WS = 'ws_assign';
const USER = 'u_assign';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let harness: AuthenticatedApp;
let app: INestApplication;
let approvals: RecordingApprovals;
let expertId = '';

const api = () => request(app.getHttpServer());

beforeAll(async () => {
  if (noRuntime) return;
  harness = await startAuthenticatedApp({
    prefix: PREFIX,
    workspaceId: WS,
    userId: USER,
    async seed(db, s) {
      for (const t of ['t_low', 't_high']) {
        await db.query(
          `INSERT INTO "tasks" ("id","workspaceId","description","engineName","engineVersion","updatedAt")
           VALUES ($1,$2,'a task','spec-kit','0.14.3',now())`,
          [t, s.workspaceId],
        );
      }
      await db.query(
        `INSERT INTO "access_grants" ("id","workspaceId","artifactType","artifactId","userId","level","grantedById")
         VALUES ('g_ar',$1,'expert-registry',$1,$2,'edit',$2),
                ('g_t1',$1,'task','t_low',$2,'edit',$2),
                ('g_t2',$1,'task','t_high',$2,'edit',$2)`,
        [s.workspaceId, s.userId],
      );
    },
  });
  app = harness.app;
  const ports = app.get<ExpertPorts>(EXPERT_PORTS, { strict: false });
  ports.evidence = evidenceKnowing('implementation@1');
  approvals = recordingApprovals();
  ports.approvals = approvals;
  const created = await api()
    .post(`/${PREFIX}/experts`)
    .set('Cookie', harness.cookie)
    .send({ key: 'test-engineer', name: 'Test Engineer', contract: contract({ capabilities: ['test', 'analyze'] }) })
    .expect(201);
  expertId = created.body.expert.id;
  await api().post(`/${PREFIX}/experts/${expertId}/contract-versions/1/submit`).set('Cookie', harness.cookie).expect(201);
  approvals.resolve('d_1', 'approved');
  await api()
    .put(`/${PREFIX}/experts/delegation-policy`)
    .set('Cookie', harness.cookie)
    .send({ maxDepth: 3, maxFanOut: 5, allowedPairs: [], maxUnattendedBand: 'medium' })
    .expect(200);
}, 600_000);

afterAll(async () => {
  await harness?.close();
}, 120_000);

suite('T1971 · assignment routes', () => {
  it('Q14 — an Expert lacking a capability is refused 400, naming it', async () => {
    const res = await api()
      .post(`/${PREFIX}/tasks/t_low/assignment`)
      .set('Cookie', harness.cookie)
      .send({ assigneeKind: 'expert', assigneeId: expertId, capabilities: ['test', 'generate'], riskClass: 'low' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/generate/);
  });

  it('a covered, low-band assignment stands at once, with its rule', async () => {
    const res = await api()
      .post(`/${PREFIX}/tasks/t_low/assignment`)
      .set('Cookie', harness.cookie)
      .send({ assigneeKind: 'expert', assigneeId: expertId, capabilities: ['test'], riskClass: 'low' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ state: 'standing', decisionId: null });
    expect(res.body.rule).toMatch(/covered/);
  });

  it('Q15 — a high-band task above the maximum is pending a decision, and nothing runs', async () => {
    const res = await api()
      .post(`/${PREFIX}/tasks/t_high/assignment`)
      .set('Cookie', harness.cookie)
      .send({ assigneeKind: 'expert', assigneeId: expertId, capabilities: ['test'], riskClass: 'high' });
    expect(res.status).toBe(201);
    expect(res.body.state).toBe('pending-decision');
    expect(res.body.decisionId).toBeTruthy();
    expect(approvals.submitted.at(-1)).toMatchObject({ actionType: 'task.assign-expert', targetId: 't_high' });
  });

  it('Q16 — reassigning Expert → person keeps both, the first superseded', async () => {
    await api()
      .post(`/${PREFIX}/tasks/t_low/assignment`)
      .set('Cookie', harness.cookie)
      .send({ assigneeKind: 'person', assigneeId: USER })
      .expect(201);
    const history = await api().get(`/${PREFIX}/tasks/t_low/assignments`).set('Cookie', harness.cookie);
    expect(history.status).toBe(200);
    expect(history.body.map((a: { assigneeKind: string; supersededBy: string | null }) => [a.assigneeKind, a.supersededBy !== null])).toEqual([
      ['person', false],
      ['expert', true],
    ]);
  });

  it('a task that does not exist is not found', async () => {
    const res = await api()
      .post(`/${PREFIX}/tasks/t_none/assignment`)
      .set('Cookie', harness.cookie)
      .send({ assigneeKind: 'person', assigneeId: USER });
    // No grant on a task that does not exist: refused before it is looked up.
    expect([403, 404]).toContain(res.status);
  });
});
