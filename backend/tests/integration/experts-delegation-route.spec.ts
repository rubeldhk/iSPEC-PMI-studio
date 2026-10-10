/**
 * `T1957` (EPIC-047) — delegation through the real routes: Q11, Q12, Q13.
 *
 * The parent's runner delegates **from inside its own run**, through the real
 * `POST /experts/:id/dispatch`, the way a running Expert would. The policy is
 * set through `PUT` (`T1987`); runner and registry are the in-test bindings of
 * `T1943`, after the composed defaults are shown refusing there.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
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
  type RecordingExecutions,
} from '../helpers/expert-fixtures.js';

const PREFIX = 'v1';
const WS = 'ws_delegation';
const USER = 'u_delegation';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let harness: AuthenticatedApp;
let app: INestApplication;
let executions: RecordingExecutions;
const ids: Record<string, string> = {};

const api = () => request(app.getHttpServer());
const body = (over: Record<string, unknown> = {}) => ({
  command: 'implement',
  objective: 'review the booking change',
  projectId: 'pr_1',
  capabilities: ['test'],
  tools: ['run-tests'],
  actions: [],
  targets: [{ artifactType: 'specification', artifactId: 'sp_1', action: 'read' }],
  ...over,
});

/** A runner whose run first does `inside` with its own execution id. */
const delegatingRunner = (model: string, inside: (executionId: string) => Promise<void>) =>
  runner({ model }, async (ctx): Promise<RunReport> => {
    await inside(ctx.correlationId);
    return { status: 'succeeded', outputs: ['test-report'] };
  });

beforeAll(async () => {
  if (noRuntime) return;
  harness = await startAuthenticatedApp({
    prefix: PREFIX,
    workspaceId: WS,
    userId: USER,
    async seed(db, s) {
      await db.query(
        `INSERT INTO "access_grants" ("id","workspaceId","artifactType","artifactId","userId","level","grantedById")
         VALUES ('g_dr',$1,'expert-registry',$1,$2,'edit',$2), ('g_ds',$1,'specification','sp_1',$2,'read',$2)`,
        [s.workspaceId, s.userId],
      );
    },
  });
  app = harness.app;
  const ports = app.get<ExpertPorts>(EXPERT_PORTS, { strict: false });
  ports.evidence = evidenceKnowing('implementation@1');
  const approvals = recordingApprovals();
  ports.approvals = approvals;
  executions = recordingExecutions();
  ports.executions = executions;
  ports.context = recordingContext();

  // Three Experts, each its own model, so each run reaches its own runner.
  // References are checked at registration (FR-EXP-022), so the lead is
  // registered without delegates and given them in version 2, once the
  // reviewer exists — the way an author would have to.
  const experts: [string, Record<string, unknown>][] = [
    ['auditor', { models: { preferred: 'auditor-model', fallbacks: [] } }],
    ['lead', { models: { preferred: 'lead-model', fallbacks: [] } }],
    ['reviewer', { models: { preferred: 'reviewer-model', fallbacks: [] }, allowedTools: ['run-tests', 'shell'], delegatesTo: ['lead', 'auditor'] }],
  ];
  for (const [key, over] of experts) {
    const created = await api()
      .post(`/${PREFIX}/experts`)
      .set('Cookie', harness.cookie)
      .send({ key, name: key, contract: contract(over as never) })
      .expect(201);
    ids[key] = created.body.expert.id;
    await api().post(`/${PREFIX}/experts/${ids[key]}/contract-versions/1/submit`).set('Cookie', harness.cookie).expect(201);
  }
  await api()
    .post(`/${PREFIX}/experts/${ids['lead']}/contract-versions`)
    .set('Cookie', harness.cookie)
    .send({ contract: contract({ models: { preferred: 'lead-model', fallbacks: [] }, delegatesTo: ['reviewer'] }) })
    .expect(201);
  await api().post(`/${PREFIX}/experts/${ids['lead']}/contract-versions/2/submit`).set('Cookie', harness.cookie).expect(201);
  for (const d of approvals.submitted.keys()) approvals.resolve(`d_${d + 1}`, 'approved');
  await api()
    .put(`/${PREFIX}/experts/delegation-policy`)
    .set('Cookie', harness.cookie)
    .send({
      maxDepth: 3,
      maxFanOut: 5,
      allowedPairs: [
        { from: 'lead', to: 'reviewer' },
        { from: 'reviewer', to: 'auditor' },
        { from: 'reviewer', to: 'lead' },
      ],
      maxUnattendedBand: 'medium',
    })
    .expect(200);
}, 600_000);

afterAll(async () => {
  await harness?.close();
}, 120_000);

suite('T1957 · delegation through the routes', () => {
  it('Q11 — a delegate allowed more than its parent gets the intersection', async () => {
    const ports = app.get<ExpertPorts>(EXPERT_PORTS, { strict: false });
    let refused = 0;
    let admitted = '';
    ports.gateways = gatewaysFor({
      'lead-model': [
        delegatingRunner('lead-model', async (parent) => {
          const wide = await api()
            .post(`/${PREFIX}/experts/${ids['reviewer']}/dispatch`)
            .set('Cookie', harness.cookie)
            .send(body({ tools: ['shell'], delegatedFromExecutionId: parent }));
          refused = wide.status;
          const narrow = await api()
            .post(`/${PREFIX}/experts/${ids['reviewer']}/dispatch`)
            .set('Cookie', harness.cookie)
            .send(body({ delegatedFromExecutionId: parent }));
          admitted = narrow.body.executionId;
        }),
      ],
      'reviewer-model': [runner({ model: 'reviewer-model' })],
    });
    await api().post(`/${PREFIX}/experts/${ids['lead']}/dispatch`).set('Cookie', harness.cookie).send(body()).expect(201);
    expect(refused).toBe(400);
    const session = await api().get(`/${PREFIX}/experts/sessions/${admitted}`).set('Cookie', harness.cookie);
    expect(session.body.session.effectiveAuthority.tools).toEqual(['run-tests']);
  });

  it('Q12 — lead → reviewer → lead is refused as a cycle, recorded on the reviewer', async () => {
    const ports = app.get<ExpertPorts>(EXPERT_PORTS, { strict: false });
    let status = 0;
    let reviewerExecution = '';
    ports.gateways = gatewaysFor({
      'lead-model': [
        delegatingRunner('lead-model', async (parent) => {
          await api()
            .post(`/${PREFIX}/experts/${ids['reviewer']}/dispatch`)
            .set('Cookie', harness.cookie)
            .send(body({ delegatedFromExecutionId: parent }));
        }),
      ],
      'reviewer-model': [
        delegatingRunner('reviewer-model', async (parent) => {
          reviewerExecution = parent;
          const back = await api()
            .post(`/${PREFIX}/experts/${ids['lead']}/dispatch`)
            .set('Cookie', harness.cookie)
            .send(body({ delegatedFromExecutionId: parent }));
          status = back.status;
        }),
      ],
    });
    await api().post(`/${PREFIX}/experts/${ids['lead']}/dispatch`).set('Cookie', harness.cookie).send(body()).expect(201);
    expect(status).toBe(400);
    expect(executions.kindsFor(reviewerExecution)).toContain('delegation-refused');
  });

  it('Q13 — a depth-2 tree is read from the record alone', async () => {
    const ports = app.get<ExpertPorts>(EXPERT_PORTS, { strict: false });
    let root = '';
    ports.gateways = gatewaysFor({
      'lead-model': [
        delegatingRunner('lead-model', async (parent) => {
          root = parent;
          await api().post(`/${PREFIX}/experts/${ids['reviewer']}/dispatch`).set('Cookie', harness.cookie).send(body({ delegatedFromExecutionId: parent }));
        }),
      ],
      'reviewer-model': [
        delegatingRunner('reviewer-model', async (parent) => {
          await api().post(`/${PREFIX}/experts/${ids['auditor']}/dispatch`).set('Cookie', harness.cookie).send(body({ delegatedFromExecutionId: parent }));
        }),
      ],
      'auditor-model': [runner({ model: 'auditor-model' })],
    });
    await api().post(`/${PREFIX}/experts/${ids['lead']}/dispatch`).set('Cookie', harness.cookie).send(body()).expect(201);
    const view = await api().get(`/${PREFIX}/experts/sessions/${root}`).set('Cookie', harness.cookie);
    const tree = view.body.tree;
    expect(tree.ancestors).toEqual([]);
    expect(tree.node).toMatchObject({ expertKey: 'lead', contractVersion: 2, depth: 0 });
    expect(tree.node.children[0]).toMatchObject({ expertKey: 'reviewer', depth: 1 });
    expect(tree.node.children[0].children[0]).toMatchObject({ expertKey: 'auditor', depth: 2 });
  });
});
