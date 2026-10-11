/**
 * `T2578` (EPIC-047 Convergence) — a contract approved through the real
 * decision engine, end to end.
 *
 * `FR-EXP-005`, `US1/AC2`, Constitution XI Tier 1, fourth audit finding F5.
 * Every earlier route test approved a version through an in-test binding. This
 * one binds nothing: the composed application, two real sessions, a real
 * database. The author registers and submits; the version appears in the
 * reviewer's Decision Inbox and not the author's; the author may not approve
 * their own submission (`FR-DPE-015`); the reviewer's approval makes the
 * version effective. Then a gated assignment and its reassignment: the
 * superseded assignment's decision leaves the reviewer's inbox (`T2577`).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import { contract } from '../helpers/expert-fixtures.js';

const PREFIX = 'v1';
const WS = 'ws_experts_journey';
const AUTHOR = 'u_author';
const REVIEWER = 'u_reviewer';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let harness: AuthenticatedApp;
let app: INestApplication;
let reviewer = '';
let expertId = '';
let decisionId = '';

beforeAll(async () => {
  if (noRuntime) return;
  harness = await startAuthenticatedApp({
    prefix: PREFIX,
    workspaceId: WS,
    userId: AUTHOR,
    async seed(db, ids) {
      await db.query(
        `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
         VALUES ($1,$2,$3,'Reviewer','unused',now())`,
        [REVIEWER, ids.workspaceId, `${REVIEWER}@example.test`],
      );
      await db.query(
        `INSERT INTO "tasks" ("id","workspaceId","description","engineName","engineVersion","updatedAt")
         VALUES ('t_journey',$1,'a task','spec-kit','0.14.3',now())`,
        [ids.workspaceId],
      );
      await db.query(
        `INSERT INTO "access_grants" ("id","workspaceId","artifactType","artifactId","userId","level","grantedById")
         VALUES ('g_author',$1,'expert-registry',$1,$2,'edit',$2),
                ('g_reviewer',$1,'expert-registry',$1,$3,'read',$2),
                ('g_task',$1,'task','t_journey',$2,'edit',$2)`,
        [ids.workspaceId, ids.userId, REVIEWER],
      );
    },
  });
  app = harness.app;
  const { SessionService } = await import('../../src/modules/auth/sessions.js');
  const { SESSION_COOKIE } = await import('../../src/modules/auth/auth.controller.js');
  const session = app.get(SessionService, { strict: false }).create({
    userId: REVIEWER,
    workspaceId: WS,
    email: `${REVIEWER}@example.test`,
    displayName: 'Reviewer',
  });
  reviewer = `${SESSION_COOKIE}=${session.token}`;
}, 600_000);

afterAll(async () => {
  await harness?.close();
}, 120_000);

const api = () => request(app.getHttpServer());

type Entry = { decisionId: string; kind: string; actionType: string; objectRef: { type: string; id: string } };
const approvalsFor = async (cookie: string): Promise<Entry[]> =>
  (((await api().get(`/${PREFIX}/inbox`).set('Cookie', cookie)).body.entries ?? []) as Entry[]).filter(
    (e) => e.kind === 'approval',
  );

suite('T2578 · a contract approved through EPIC-031, end to end', () => {
  it('the author registers and submits; the version waits on a human', async () => {
    const created = await api()
      .post(`/${PREFIX}/experts`)
      .set('Cookie', harness.cookie)
      .send({
        key: 'journey',
        name: 'Journey',
        contract: contract({ capabilities: ['test'], evidenceContract: { workClass: 'task-completion', contractVersion: 1 } }),
      });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expertId = created.body.expert.id as string;
    const submitted = await api().post(`/${PREFIX}/experts/${expertId}/contract-versions/1/submit`).set('Cookie', harness.cookie);
    expect([submitted.status, submitted.body.status]).toEqual([201, 'submitted']);
    decisionId = submitted.body.decisionId as string;
  });

  it('it appears in the reviewer’s Decision Inbox, and not in the author’s', async () => {
    const theirs = await approvalsFor(reviewer);
    expect(theirs).toContainEqual(
      expect.objectContaining({
        decisionId,
        actionType: 'expert-contract.approve.medium',
        objectRef: expect.objectContaining({ type: 'expert-contract-version' }),
      }),
    );
    expect((await approvalsFor(harness.cookie)).map((e) => e.decisionId)).not.toContain(decisionId);
  });

  it('the author may not approve their own submission (FR-DPE-015)', async () => {
    const res = await api().post(`/${PREFIX}/decisions/${decisionId}/approve`).set('Cookie', harness.cookie);
    expect(res.status).toBe(403);
    const read = await api().get(`/${PREFIX}/experts/${expertId}`).set('Cookie', harness.cookie);
    expect([read.body.versions[0].status, read.body.effectiveVersion]).toEqual(['submitted', null]);
  });

  it('the reviewer’s approval makes the version effective', async () => {
    const res = await api().post(`/${PREFIX}/decisions/${decisionId}/approve`).set('Cookie', reviewer);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const read = await api().get(`/${PREFIX}/experts/${expertId}`).set('Cookie', harness.cookie);
    expect(read.body.versions[0].status).toBe('approved');
    expect(read.body.effectiveVersion.version).toBe(1);
    expect((await approvalsFor(reviewer)).map((e) => e.decisionId)).not.toContain(decisionId);
  });

  it('a gated assignment waits in the reviewer’s inbox, and leaves it when the task is reassigned (T2577)', async () => {
    // No delegation policy sets an unattended maximum, so a human decides (FR-EXP-054).
    const gated = await api()
      .post(`/${PREFIX}/tasks/t_journey/assignment`)
      .set('Cookie', harness.cookie)
      .send({ assigneeKind: 'expert', assigneeId: expertId, capabilities: ['test'], riskClass: 'high' });
    expect(gated.status, JSON.stringify(gated.body)).toBe(201);
    expect(gated.body.state).toBe('pending-decision');
    const pending = gated.body.decisionId as string;
    expect((await approvalsFor(reviewer)).map((e) => e.decisionId)).toContain(pending);

    await api()
      .post(`/${PREFIX}/tasks/t_journey/assignment`)
      .set('Cookie', harness.cookie)
      .send({ assigneeKind: 'person', assigneeId: AUTHOR })
      .expect(201);
    expect((await approvalsFor(reviewer)).map((e) => e.decisionId)).not.toContain(pending);
    const authorInbox = ((await api().get(`/${PREFIX}/inbox`).set('Cookie', harness.cookie)).body.entries ?? []) as Entry[];
    expect(authorInbox.filter((e) => e.objectRef.id === 't_journey')).toEqual([]);
  });
});
