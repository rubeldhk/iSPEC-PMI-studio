/**
 * T762 — the visible set follows the reader's current standing, and nothing
 * persists because it was once visible. `SC-DPE-004`, `FR-DPE-022`, `FR-DPE-024`.
 *
 * Two people, two real sessions, through the composed application.
 *
 * **What "role" can mean today.** The platform has no per-action authority
 * model yet: until `U-02`, an authorized approver is an authenticated human in
 * the workspace other than the requester (the slice's stated limitation,
 * `DEF-031-002`). So the role that changes here is the one that exists — the
 * requester's standing under the **current policy**: when a policy permitting
 * self-approval is issued, the requester's own Inbox gains the approval on the
 * next read, with no invalidation step; and once anyone decides it, it leaves
 * every Inbox at once.
 */
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import { SessionService } from '../../src/modules/auth/sessions.js';
import { SESSION_COOKIE } from '../../src/modules/auth/auth.controller.js';

const PREFIX = 'v1';
const WS = 'ws_t762';
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

suite('T762 · the Inbox follows the reader, at read time', () => {
  let harness: AuthenticatedApp;
  let app: INestApplication;
  let alice = '';
  let bob = '';
  let decisionId = '';
  const inbox = async (cookie: string) =>
    ((await request(app.getHttpServer()).get(`/${PREFIX}/inbox`).set('Cookie', cookie)).body.entries ?? []) as Array<{
      decisionId: string;
      kind: string;
    }>;
  const sees = async (cookie: string) => (await inbox(cookie)).filter((e) => e.kind === 'approval').map((e) => e.decisionId);

  beforeAll(async () => {
    harness = await startAuthenticatedApp({
      prefix: PREFIX,
      workspaceId: WS,
      userId: 'u_alice',
      seed: async (db, ids) => {
        await db.query(
          `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
           VALUES ('u_bob',$1,'u_bob@example.test','Bob','x',now())`,
          [ids.workspaceId],
        );
      },
    });
    app = harness.app;
    alice = harness.cookie;
    const session = app.get(SessionService, { strict: false }).create({
      userId: 'u_bob',
      workspaceId: WS,
      email: 'u_bob@example.test',
      displayName: 'Bob',
    });
    bob = `${SESSION_COOKIE}=${session.token}`;

    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/decisions`)
      .set('Cookie', alice)
      .send({ actionType: 'release.promote', target: { type: 'release', id: 'r-9' }, projectId: 'p1', objectVersion: '2' });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    decisionId = res.body.decisionId;
  }, 300_000);

  afterAll(async () => {
    await harness?.close();
  }, 120_000);

  it('shows Alice’s request to Bob, who may approve it, and not to Alice', async () => {
    expect(await sees(bob)).toEqual([decisionId]);
    expect(await sees(alice)).toEqual([]);
  });

  it('shows it to Alice on her next read once policy permits her to self-approve — no invalidation step', async () => {
    const issued = await request(app.getHttpServer())
      .post(`/${PREFIX}/decision-policies`)
      .set('Cookie', alice)
      .send({
        bandTreatment: { low: 'auto-execute', medium: 'gates-required', high: 'human-approval' },
        selfApprovalAllowed: ['release.*'],
        automatedActions: [],
      });
    expect(issued.status).toBe(201);
    expect(await sees(alice)).toEqual([decisionId]);
  });

  it('removes it from every Inbox the moment Bob decides it (FR-DPE-024)', async () => {
    const approved = await request(app.getHttpServer()).post(`/${PREFIX}/decisions/${decisionId}/approve`).set('Cookie', bob);
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    expect(await sees(bob)).toEqual([]);
    expect(await sees(alice)).toEqual([]);
  });

  it('keeps the decision retrievable from the object after it leaves the Inbox', async () => {
    const res = await request(app.getHttpServer()).get(`/${PREFIX}/decisions/${decisionId}/explanation`).set('Cookie', bob);
    expect(res.status).toBe(200);
    expect(res.body.resolvedBy).toEqual(expect.any(String));
  });
});
