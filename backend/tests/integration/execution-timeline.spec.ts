/**
 * `T1436` (EPIC-043, `FR-PIC-035`) — the session-scoped timeline read: lists
 * only the project's executions, refuses another workspace's project with the
 * opaque 404, paginates, and returns events in sequence.
 *
 * Constitution XI Tier 1: the composed `AppModule`, the real routes. Written to
 * FAIL before `T1432`.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONTRACT_VERSION } from '@pmi/execution-registry-contract';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let started: AuthenticatedApp;
let root: string;
let projectA = '';
let projectB = '';
let tokenA = '';
const ids: string[] = [];

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-timeline-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  started = await startAuthenticatedApp({ workspaceId: 'ws_tl', userId: 'u_owner' });
  const api = started.app.getHttpServer();
  const a = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'A', rootPath: 'a' }).expect(201);
  const b = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'B', rootPath: 'b' }).expect(201);
  projectA = a.body.id;
  projectB = b.body.id;
  tokenA = a.body.connectorCredential.value;
  const auth = { Authorization: `Bearer ${tokenA}`, 'x-contract-version': CONTRACT_VERSION };
  for (let i = 0; i < 3; i += 1) {
    const reg = await request(api)
      .post('/v1/executions')
      .set(auth)
      .set('Idempotency-Key', `reg_${i}`)
      .send({ command: 'plan', argsSanitized: {}, input: { targetType: 'project', targetId: projectA, targetVersion: 1 }, correlationId: `corr_${i}`, idempotencyKey: `reg_${i}`, contractVersion: CONTRACT_VERSION })
      .expect(201);
    ids.push(reg.body.executionId);
  }
  await request(api).post(`/v1/executions/${ids[0]}/events`).set(auth).set('Idempotency-Key', 'ev_0').send({ type: 'started', payload: {}, occurredAt: new Date().toISOString(), idempotencyKey: 'ev_0' }).expect(201);
  await request(api).post(`/v1/executions/${ids[0]}/events`).set(auth).set('Idempotency-Key', 'ev_1').send({ type: 'progress-reported', payload: { taskId: 'T1' }, occurredAt: new Date().toISOString(), idempotencyKey: 'ev_1' }).expect(201);
}, 600_000);

afterAll(async () => {
  await started?.close();
  rmSync(root, { recursive: true, force: true });
  delete process.env['PMI_PROJECTS_ROOT'];
  delete process.env['PMI_PROJECTS_ROOT_HOST'];
}, 120_000);

suite('T1436 · the timeline read through the session route', () => {
  it('lists only the project\'s executions, newest first, with the seven fields', async () => {
    const api = started.app.getHttpServer();
    const res = await request(api).get(`/v1/projects/${projectA}/executions`).set('Cookie', started.cookie).expect(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.items[0]).toMatchObject({ command: 'plan', surface: 'local-cli', assurance: 'local', initiator: { kind: 'connector' }, sponsorUserId: 'u_owner' });
    // Newest first: the execution that received events is the OLDEST registered.
    expect(res.body.items[2].executionId).toBe(ids[0]);
    expect(res.body.items[2].state).toBe('started');
    expect(res.body.items[0].state).toBe('registered');
    const other = await request(api).get(`/v1/projects/${projectB}/executions`).set('Cookie', started.cookie).expect(200);
    expect(other.body.items).toHaveLength(0);
  });

  it('paginates by cursor', async () => {
    const api = started.app.getHttpServer();
    const first = await request(api).get(`/v1/projects/${projectA}/executions?limit=2`).set('Cookie', started.cookie).expect(200);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).toBeTruthy();
    const second = await request(api).get(`/v1/projects/${projectA}/executions?limit=2&after=${encodeURIComponent(first.body.nextCursor)}`).set('Cookie', started.cookie).expect(200);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();
    const all = new Set([...first.body.items, ...second.body.items].map((i: { executionId: string }) => i.executionId));
    expect(all.size).toBe(3);
  });

  it('returns events in sequence with type, category, actor and time', async () => {
    const api = started.app.getHttpServer();
    const res = await request(api).get(`/v1/projects/${projectA}/executions/${ids[0]}/events`).set('Cookie', started.cookie).expect(200);
    const types = (res.body as { sequence: number; type: string; category: string; actorId: string | null }[]).map((e) => `${e.sequence}:${e.type}:${e.category}`);
    expect(types).toEqual(['1:registered:lifecycle', '2:started:lifecycle', '3:progress-reported:lifecycle']);
    expect(res.body[2].actorId).toBeTruthy();
  });

  it('refuses another workspace\'s project, an unknown project and no session with the opaque answers', async () => {
    const api = started.app.getHttpServer();
    await request(api).get(`/v1/projects/${projectA}/executions`).expect(401);
    await request(api).get(`/v1/projects/no-such-project/executions`).set('Cookie', started.cookie).expect(404);
    const { rebootApp } = await import('../helpers/authenticated-app.js');
    const other = await rebootApp(started.databaseUrl, { workspaceId: 'ws_other', userId: 'u_other', prefix: 'v1' });
    try {
      await request(other.app.getHttpServer()).get(`/v1/projects/${projectA}/executions`).set('Cookie', other.cookie).expect(404);
    } finally {
      await other.app.close();
    }
  });
});
