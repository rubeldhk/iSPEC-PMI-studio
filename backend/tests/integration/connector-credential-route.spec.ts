/**
 * `T1363` (EPIC-041) — Tier 1: the credential routes and the guard through the
 * real `AppModule`.
 *
 * Scenario 9 (`whoami` → A; B with A's token → `404`), Scenario 10 (revoke →
 * `401` identical to unknown; one audit entry; second revoke `200`, no new
 * entry), Scenario 11 (`403` without the grant, audited). Requires Docker.
 *
 * Written to FAIL before `T1362` registers the module.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let started: AuthenticatedApp;
let root: string;
let memberCookie: string;
let projectA: string;
let projectB: string;
let tokenA: string;
let credentialA: string;

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-cred-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  started = await startAuthenticatedApp({
    workspaceId: 'ws_cred',
    userId: 'u_owner',
    seed: async (db, { workspaceId }) => {
      await db.query(
        `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
         VALUES ('u_member',$1,'u_member@example.test','Member','unused',now())`,
        [workspaceId],
      );
    },
  });
  const { SessionService } = await import('../../src/modules/auth/sessions.js');
  const { SESSION_COOKIE } = await import('../../src/modules/auth/auth.controller.js');
  const member = started.app.get(SessionService, { strict: false }).create({
    userId: 'u_member',
    workspaceId: 'ws_cred',
    email: 'u_member@example.test',
    displayName: 'Member',
  });
  memberCookie = `${SESSION_COOKIE}=${member.token}`;

  const api = started.app.getHttpServer();
  const a = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'A', rootPath: 'a' }).expect(201);
  const b = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'B', rootPath: 'b' }).expect(201);
  projectA = a.body.id;
  projectB = b.body.id;
  // Provisioning mints once, in the create response only (FR-LPW-020).
  expect(a.body.connectorCredential?.value).toMatch(/^pmi_ct_/);
  tokenA = a.body.connectorCredential.value;
  credentialA = a.body.connectorCredential.id;
}, 600_000);

afterAll(async () => {
  await started?.close();
  rmSync(root, { recursive: true, force: true });
  delete process.env['PMI_PROJECTS_ROOT'];
  delete process.env['PMI_PROJECTS_ROOT_HOST'];
}, 120_000);

suite('T1363 · connector credentials through the routes', () => {
  it('Scenario 9 — a credential opens exactly one project (FR-LPW-025)', async () => {
    const api = started.app.getHttpServer();
    const me = await request(api).get('/v1/connector/whoami').set('Authorization', `Bearer ${tokenA}`).expect(200);
    expect(me.body).toEqual({ projectId: projectA });
    const other = await request(api).get(`/v1/connector/projects/${projectB}/whoami`).set('Authorization', `Bearer ${tokenA}`).expect(404);
    expect(other.body.error.code).toBe('not_found');
    await request(api).get(`/v1/connector/projects/${projectA}/whoami`).set('Authorization', `Bearer ${tokenA}`).expect(200);
    // No credential at all is the same 401 as a wrong one.
    await request(api).get('/v1/connector/whoami').expect(401);
  });

  it('the value never reaches the directory, and the list never shows it (FR-LPW-024, FR-LPW-053)', async () => {
    const api = started.app.getHttpServer();
    const list = await request(api).get(`/v1/projects/${projectA}/connector-credentials`).set('Cookie', started.cookie).expect(200);
    expect(list.body).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain(tokenA);
    expect(list.body[0]).not.toHaveProperty('tokenHash');
    expect(list.body[0].lastUsedAt).not.toBeNull();
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((e) => {
        const p = join(dir, e);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });
    for (const file of walk(join(root, 'a'))) {
      expect(readFileSync(file, 'utf8'), file).not.toContain(tokenA);
    }
  });

  it('Scenario 11 — minting without the owner grant is 403 and audited (FR-LPW-027)', async () => {
    const api = started.app.getHttpServer();
    const refused = await request(api)
      .post(`/v1/projects/${projectA}/connector-credentials`)
      .set('Cookie', memberCookie)
      .send({ label: 'rogue' })
      .expect(403);
    expect(refused.body.error.code).toBe('forbidden');
    const { prismaClient } = await import('../../src/persistence/prisma.js');
    const audited = await prismaClient().auditEntry.findMany({ where: { workspaceId: 'ws_cred', actorId: 'u_member', outcome: 'refused' } });
    expect(audited.map((a) => a.targetId)).toContain(projectA);
    // The owner can mint on demand, and gets the value exactly once.
    const minted = await request(api)
      .post(`/v1/projects/${projectA}/connector-credentials`)
      .set('Cookie', started.cookie)
      .send({ label: 'ci' })
      .expect(201);
    expect(minted.body.value).toMatch(/^pmi_ct_/);
    expect(minted.body).not.toHaveProperty('tokenHash');
  });

  it('Scenario 10 — revocation is immediate, audited once, irreversible (FR-LPW-023)', async () => {
    const api = started.app.getHttpServer();
    const unknown = await request(api).get('/v1/connector/whoami').set('Authorization', 'Bearer pmi_ct_nope').expect(401);
    const first = await request(api).post(`/v1/connector-credentials/${credentialA}/revoke`).set('Cookie', started.cookie).expect(201);
    expect(first.body.revokedAt).not.toBeNull();
    expect(first.body.revokedById).toBe('u_owner');
    const revoked = await request(api).get('/v1/connector/whoami').set('Authorization', `Bearer ${tokenA}`).expect(401);
    expect(revoked.body).toEqual(unknown.body);
    const { prismaClient } = await import('../../src/persistence/prisma.js');
    const before = await prismaClient().auditEntry.count({ where: { workspaceId: 'ws_cred', targetType: 'connector_credential', targetId: credentialA } });
    await request(api).post(`/v1/connector-credentials/${credentialA}/revoke`).set('Cookie', started.cookie).expect(200);
    const after = await prismaClient().auditEntry.count({ where: { workspaceId: 'ws_cred', targetType: 'connector_credential', targetId: credentialA } });
    expect(after).toBe(before);
    const list = await request(api).get(`/v1/projects/${projectA}/connector-credentials?revoked=true`).set('Cookie', started.cookie).expect(200);
    expect(list.body.map((r: { id: string }) => r.id)).toEqual([credentialA]);
    // A member without the grant cannot revoke either.
    await request(api).post(`/v1/connector-credentials/${credentialA}/revoke`).set('Cookie', memberCookie).expect(403);
  });
});
