/**
 * `T1593` (EPIC-044, `FR-EPB-026`, `FR-EPB-064`, `SC-EPB-006`, `R-044-6`) — a
 * first run with a confirmed split through a REAL `pmi-studio` server records the
 * `decomposition-decision` comment; the next Epic-list read creates the children
 * once; executions bound as `<number><suffix>` resolve to them on the board; a
 * rejected decision creates nothing. Written to FAIL before `T1594`.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createPlatformClient, createServer } from '@pmi/mcp-server';
import { runFirstRun } from '@pmi/workspace-bundle';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let started: AuthenticatedApp;
let root: string;
let baseUrl = '';
let projectId = '';
let token = '';
let projectDir = '';
let intakeId = '';
let reviewId = '';

async function mcp(): Promise<{ client: Client; close(): Promise<void> }> {
  const server = createServer(createPlatformClient({ baseUrl, credential: token }), { serverVersion: 'reconcile' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'reconcile', version: '1.0.0' });
  await server.connect(st);
  await client.connect(ct);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-rec-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  process.env['PMI_PUBLIC_URL'] = 'http://localhost:3000';
  started = await startAuthenticatedApp({ workspaceId: 'ws_rec', userId: 'u_owner' });
  await started.app.listen(0);
  baseUrl = await started.app.getUrl();
  const api = started.app.getHttpServer();
  const a = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Alpha', rootPath: 'alpha' }).expect(201);
  projectId = a.body.id;
  token = a.body.connectorCredential.value;
  const intake = await request(api).post(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).send({ title: 'Intake' }).expect(201);
  const review = await request(api).post(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).send({ title: 'Review' }).expect(201);
  intakeId = intake.body.id;
  reviewId = review.body.id;
  for (const [reference, epicId] of [['REQ-001', intakeId], ['REQ-002', intakeId], ['REQ-003', intakeId], ['REQ-004', reviewId], ['REQ-005', reviewId]] as const) {
    const r = await request(api).post(`/v1/projects/${projectId}/requirements`).set('Cookie', started.cookie).send({ reference, description: `${reference} shall`, type: 'functional', priority: 'p1' }).expect(201);
    await request(api).put(`/v1/requirements/${r.body.id}/epic`).set('Cookie', started.cookie).send({ epicId }).expect(200);
  }
  const constitution = await request(api).get(`/v1/projects/${projectId}/constitution`).set('Cookie', started.cookie).expect(200);
  projectDir = mkdtempSync(join(tmpdir(), 'pmi-rec-dir-'));
  mkdirSync(join(projectDir, '.pmi'), { recursive: true });
  mkdirSync(join(projectDir, '.specify', 'memory'), { recursive: true });
  writeFileSync(join(projectDir, '.pmi', 'project.json'), JSON.stringify({ schemaVersion: 1, projectId, platformUrl: baseUrl, bundleVersion: '0.2.0' }));
  writeFileSync(join(projectDir, '.pmi', 'first-run'), `${new Date().toISOString()} rec_1\n`);
  writeFileSync(join(projectDir, '.specify', 'memory', 'constitution.md'), constitution.body.content as string, 'utf8');
}, 600_000);

afterAll(async () => {
  await started?.close();
  rmSync(root, { recursive: true, force: true });
  rmSync(projectDir, { recursive: true, force: true });
  delete process.env['PMI_PROJECTS_ROOT'];
  delete process.env['PMI_PROJECTS_ROOT_HOST'];
  delete process.env['PMI_PUBLIC_URL'];
}, 120_000);

suite('T1593 · a recorded split becomes child Epics once', () => {
  it('the first run splits Intake (confirmed) and keeps Review whole (rejected); the next read creates two children and nothing for Review', async () => {
    const api = started.app.getHttpServer();
    const m = await mcp();
    try {
      const result = await runFirstRun(m.client, projectDir, {
        estimate: (epic) => (epic.slug === 'intake' ? 68 : 60),
        decide: (proposal) => ({ decision: proposal.epic.slug === 'intake' ? 'confirmed' : 'rejected' }),
        runStock: async () => undefined,
        decidedBy: 'u_owner',
      });
      expect(result.firstRun).toBe(true);
      expect(result.splits).toBe(1);
      // Two children of Intake, one whole Review: three specify executions.
      expect(result.executions).toHaveLength(3);
      expect(result.decisionComments).toHaveLength(2);
      expect(existsSync(join(projectDir, '.pmi', 'first-run'))).toBe(false);
    } finally {
      await m.close();
    }

    // DEF-044-003: the screens read the list and the board together, so the first read is three
    // simultaneous requests — every one answers 200 and the children exist once.
    const [first, boardRace, listAgain] = await Promise.all([
      request(api).get(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie),
      request(api).get(`/v1/projects/${projectId}/epics/stages`).set('Cookie', started.cookie),
      request(api).get(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie),
    ]);
    expect([first.status, boardRace.status, listAgain.status]).toEqual([200, 200, 200]);
    expect((boardRace.body.epics as { number: number }[]).map((e) => e.number)).toEqual([1, 2, 3, 4]);
    const epics = first.body.epics as { id: string; number: number; slug: string; status: string; parentEpicId: string | null; splitSuffix: string | null }[];
    expect(epics.map((e) => [e.number, e.status, e.splitSuffix])).toEqual([
      [1, 'split', null],
      [2, 'active', null],
      [3, 'active', 'a'],
      [4, 'active', 'b'],
    ]);
    expect(epics.filter((e) => e.parentEpicId === intakeId).map((e) => e.slug)).toEqual(['intake-a', 'intake-b']);
    const review = epics.find((e) => e.id === reviewId)!;
    expect(review.status).toBe('active');

    // Requirements moved from the parent to the children by reference.
    const requirements = await request(api).get(`/v1/projects/${projectId}/requirements`).set('Cookie', started.cookie).expect(200);
    const byRef = Object.fromEntries((requirements.body as { reference: string; epicNumber: number | null }[]).map((r) => [r.reference, r.epicNumber]));
    expect(byRef['REQ-001']).toBe(3);
    expect(byRef['REQ-002']).toBe(3);
    expect(byRef['REQ-003']).toBe(4);
    expect(byRef['REQ-004']).toBe(2);

    // A second read creates nothing (SC-EPB-006).
    const second = await request(api).get(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).expect(200);
    expect(second.body.epics.map((e: { number: number }) => e.number)).toEqual([1, 2, 3, 4]);

    // The children's executions were registered as 1a and 1b and resolve to them on the board.
    const board = await request(api).get(`/v1/projects/${projectId}/epics/stages`).set('Cookie', started.cookie).expect(200);
    const stages = Object.fromEntries((board.body.epics as { number: number; stage: string }[]).map((e) => [e.number, e.stage]));
    expect(stages).toMatchObject({ 1: 'Not started', 2: 'Specified', 3: 'Specified', 4: 'Specified' });
    expect(board.body.unbound).toEqual([]);

    // The parent's detail names the decision and its children.
    const detail = await request(api).get(`/v1/epics/${intakeId}`).set('Cookie', started.cookie).expect(200);
    expect(detail.body.children.map((c: { number: number }) => c.number)).toEqual([3, 4]);
    expect(detail.body.decisions.lastProcessed).toMatch(/\S/);
    const child = await request(api).get(`/v1/epics/${epics[2]!.id}`).set('Cookie', started.cookie).expect(200);
    expect(child.body.parent.id).toBe(intakeId);
    expect(child.body.decisions.createdBy).toBe(detail.body.decisions.lastProcessed);
  }, 300_000);
});
