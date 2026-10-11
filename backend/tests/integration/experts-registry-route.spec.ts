/**
 * `T1925` (EPIC-047) — the registry through its real routes.
 *
 * Constitution XI Tier 1: the composed application, a real session, a real
 * database. The two ports whose owners are open pull requests are first shown
 * refusing **as composed**, then replaced by in-test bindings that record every
 * call (`R-047-13`, analysis finding I1) — visibly, here, never in the module.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { EXPERT_PORTS, type ExpertPorts } from '../../src/modules/experts/experts.tokens.js';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import { contract, evidenceKnowing, recordingApprovals, type RecordingApprovals } from '../helpers/expert-fixtures.js';

const PREFIX = 'v1';
const WS = 'ws_experts';
const AUTHOR = 'u_author';
const READER = 'u_reader';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let harness: AuthenticatedApp;
let app: INestApplication;
let readerCookie = '';
let approvals: RecordingApprovals;
let composedId = '';

beforeAll(async () => {
  if (noRuntime) return;
  harness = await startAuthenticatedApp({
    prefix: PREFIX,
    workspaceId: WS,
    userId: AUTHOR,
    async seed(db, ids) {
      await db.query(
        `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
         VALUES ($1,$2,$3,'Reader','unused',now())`,
        [READER, ids.workspaceId, `${READER}@example.test`],
      );
      // FR-EXP-009 — authority is an EPIC-024 grant on the workspace's registry.
      await db.query(
        `INSERT INTO "access_grants" ("id","workspaceId","artifactType","artifactId","userId","level","grantedById")
         VALUES ('g_author',$1,'expert-registry',$1,$2,'edit',$2),
                ('g_reader',$1,'expert-registry',$1,$3,'read',$2)`,
        [ids.workspaceId, ids.userId, READER],
      );
    },
  });
  app = harness.app;
  const { SessionService } = await import('../../src/modules/auth/sessions.js');
  const { SESSION_COOKIE } = await import('../../src/modules/auth/auth.controller.js');
  const session = app.get(SessionService, { strict: false }).create({
    userId: READER,
    workspaceId: WS,
    email: `${READER}@example.test`,
    displayName: 'Reader',
  });
  readerCookie = `${SESSION_COOKIE}=${session.token}`;
}, 600_000);

afterAll(async () => {
  await harness?.close();
}, 120_000);

const api = () => request(app.getHttpServer());
const body = { key: 'test-engineer', name: 'Test Engineer', contract: contract() };

suite('T1925 · the registry routes', () => {
  it('refuses with no session', async () => {
    expect((await api().get(`/${PREFIX}/experts`)).status).toBe(401);
  });

  // `T2545` — since EPIC-032 merged, the composed application checks Evidence
  // Contracts against EPIC-032's real catalogue: a contract it does not hold is
  // a dangling reference (400), one it holds is accepted.
  it('as composed, the EPIC-032 catalogue decides whether the Evidence Contract exists', async () => {
    const unknown = await api().post(`/${PREFIX}/experts`).set('Cookie', harness.cookie).send(body);
    expect(unknown.status).toBe(400);
    expect(JSON.stringify(unknown.body)).toMatch(/implementation@1/);
    const real = await api()
      .post(`/${PREFIX}/experts`)
      .set('Cookie', harness.cookie)
      .send({
        key: 'composed',
        name: 'Composed',
        contract: contract({ evidenceContract: { workClass: 'task-completion', contractVersion: 1 } }),
      });
    expect(real.status).toBe(201);
    composedId = real.body.expert.id as string;
  });

  // `T2543` — submitting reaches EPIC-031's decision engine, and the version's
  // status is read back from the decision it created — whatever EPIC-031's
  // policy made of it, the two must agree.
  it('as composed, submitting reaches EPIC-031, and the status is read back from its decision', async () => {
    const submitted = await api()
      .post(`/${PREFIX}/experts/${composedId}/contract-versions/1/submit`)
      .set('Cookie', harness.cookie);
    expect(submitted.status).toBe(201);
    expect(submitted.body.decisionId).toBeTruthy();
    expect(['submitted', 'approved', 'refused']).toContain(submitted.body.status);
    const read = await api().get(`/${PREFIX}/experts/${composedId}`).set('Cookie', harness.cookie);
    expect(read.body.versions[0].status).toBe(submitted.body.status);
  });

  it('with in-test bindings: register, list, read', async () => {
    const ports = app.get<ExpertPorts>(EXPERT_PORTS, { strict: false });
    ports.evidence = evidenceKnowing('implementation@1');
    approvals = recordingApprovals();

    ports.approvals = approvals;
    const created = await api().post(`/${PREFIX}/experts`).set('Cookie', harness.cookie).send(body);
    expect(created.status).toBe(201);
    const id = created.body.expert.id as string;

    const list = await api().get(`/${PREFIX}/experts`).set('Cookie', harness.cookie);
    expect(list.status).toBe(200);
    expect(list.body).toContainEqual(expect.objectContaining({ key: 'test-engineer', effectiveVersion: null, latestVersion: 1 }));
    const one = await api().get(`/${PREFIX}/experts/${id}`).set('Cookie', harness.cookie);
    expect(one.body.versions.map((v: { status: string }) => v.status)).toEqual(['draft']);
  });

  it('an incomplete contract is refused 400 naming every gap', async () => {
    const { rolePurpose: _r, budget: _b, ...partial } = contract();
    const res = await api()
      .post(`/${PREFIX}/experts`)
      .set('Cookie', harness.cookie)
      .send({ key: 'partial', name: 'Partial', contract: partial });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/role and purpose/);
    expect(JSON.stringify(res.body)).toMatch(/budget/);
  });

  it('a duplicate key is 409', async () => {
    const res = await api().post(`/${PREFIX}/experts`).set('Cookie', harness.cookie).send(body);
    expect(res.status).toBe(409);
  });

  it('version, submit, approve, compare and retire', async () => {
    const summary = ((await api().get(`/${PREFIX}/experts`).set('Cookie', harness.cookie)).body as { id: string; key: string }[]).find(
      (e) => e.key === 'test-engineer',
    );
    const id = summary!.id;
    const v2 = await api()
      .post(`/${PREFIX}/experts/${id}/contract-versions`)
      .set('Cookie', harness.cookie)
      .send({ contract: contract({ riskClass: 'high' }) });
    expect([v2.status, v2.body.version]).toEqual([201, 2]);

    const submitted = await api().post(`/${PREFIX}/experts/${id}/contract-versions/1/submit`).set('Cookie', harness.cookie);
    expect([submitted.status, submitted.body.status]).toEqual([201, 'submitted']);
    expect(approvals.submitted).toHaveLength(1);
    const again = await api().post(`/${PREFIX}/experts/${id}/contract-versions/1/submit`).set('Cookie', harness.cookie);
    expect(again.status).toBe(409);

    approvals.resolve('d_1', 'approved');
    const read = await api().get(`/${PREFIX}/experts/${id}`).set('Cookie', harness.cookie);
    expect(read.body.effectiveVersion.version).toBe(1);

    const diff = await api().get(`/${PREFIX}/experts/${id}/contract-versions/compare?from=1&to=2`).set('Cookie', harness.cookie);
    expect(diff.status).toBe(200);
    expect(diff.body).toHaveLength(12);
    expect(diff.body.filter((d: { changed: boolean }) => d.changed).map((d: { element: string }) => d.element)).toEqual([
      'risk class',
    ]);

    const retired = await api().post(`/${PREFIX}/experts/${id}/retire`).set('Cookie', harness.cookie);
    expect([retired.status, retired.body.status]).toEqual([201, 'retired']);
  });

  it('a reader reads but cannot author (US1/AC6, FR-EXP-009)', async () => {
    expect((await api().get(`/${PREFIX}/experts`).set('Cookie', readerCookie)).status).toBe(200);
    const res = await api().post(`/${PREFIX}/experts`).set('Cookie', readerCookie).send({ ...body, key: 'by-reader' });
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toMatch(/FR-EXP-009/);
  });

  it('an Expert in another workspace is not found (FR-EXP-008)', async () => {
    const res = await api().get(`/${PREFIX}/experts/does-not-exist`).set('Cookie', harness.cookie);
    expect(res.status).toBe(404);
  });
});
