/**
 * `T1507` (EPIC-042, US2, `FR-EXT-041`, `FR-EXT-046`–`FR-EXT-048`) — the
 * decomposition read against the composed `AppModule`: `firstRun` is a
 * platform fact that flips once a `specify` execution completes (driven through
 * the hook harness over a real server); an empty project is nothing to
 * decompose; and a first run over the composed application today registers
 * nothing, because until `EPIC-044` the platform derives no Epic
 * (`FR-PIC-043`) and one-spec-per-Epic has nothing to specify — stated, not
 * hidden. Written to FAIL before `T1508`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CONTRACT_VERSION } from '@pmi/execution-registry-contract';
import { createPlatformClient, createServer } from '@pmi/mcp-server';
import { runBegin, runFinish, runFirstRun } from '@pmi/workspace-bundle';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;
const VERSION = { 'x-contract-version': CONTRACT_VERSION };

let started: AuthenticatedApp;
let root: string;
let baseUrl = '';
let projectId = '';
let emptyId = '';
let token = '';
let emptyToken = '';
let projectDir = '';

async function mcp(credential: string): Promise<{ client: Client; close(): Promise<void> }> {
  const server = createServer(createPlatformClient({ baseUrl, credential }), { serverVersion: 'decompose' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'decompose', version: '1.0.0' });
  await server.connect(st);
  await client.connect(ct);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-dec-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  process.env['PMI_PUBLIC_URL'] = 'http://localhost:3000';
  started = await startAuthenticatedApp({ workspaceId: 'ws_dec', userId: 'u_owner' });
  await started.app.listen(0);
  baseUrl = await started.app.getUrl();
  const api = started.app.getHttpServer();
  const a = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Alpha', rootPath: 'alpha' }).expect(201);
  const e = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Empty', rootPath: 'empty' }).expect(201);
  projectId = a.body.id;
  emptyId = e.body.id;
  token = a.body.connectorCredential.value;
  emptyToken = e.body.connectorCredential.value;
  const r1 = await request(api).post(`/v1/projects/${projectId}/requirements`).set('Cookie', started.cookie).send({ reference: 'REQ-001', description: 'Alpha shall intake', type: 'functional', priority: 'p1' }).expect(201);
  // EPIC-044 T1591 (FR-EPB-062): the plan is the entity's — two Epics, one requirement assigned, one unassigned.
  await request(api).post(`/v1/projects/${projectId}/requirements`).set('Cookie', started.cookie).send({ reference: 'REQ-002', description: 'Alpha shall report', type: 'functional', priority: 'p2' }).expect(201);
  const intake = await request(api).post(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).send({ title: 'Intake' }).expect(201);
  await request(api).post(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).send({ title: 'Review' }).expect(201);
  await request(api).put(`/v1/requirements/${r1.body.id}/epic`).set('Cookie', started.cookie).send({ epicId: intake.body.id }).expect(200);
  const constitution = await request(api).get(`/v1/projects/${projectId}/constitution`).set('Cookie', started.cookie).expect(200);
  projectDir = mkdtempSync(join(tmpdir(), 'pmi-dec-dir-'));
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

suite('T1507 · the decomposition read', () => {
  it('an empty project is nothing to decompose (FR-EXT-048)', async () => {
    const api = started.app.getHttpServer();
    const res = await request(api).get(`/v1/projects/${emptyId}/decomposition`).set({ Authorization: `Bearer ${emptyToken}`, ...VERSION }).expect(200);
    expect(res.body).toMatchObject({ firstRun: true, nothingToDecompose: true, epics: [], unassigned: [], openFirstRun: null });
  });

  it('a first run over the composed application registers one specify execution per Epic of the entity (EPIC-044 T1591, FR-EPB-062)', async () => {
    const api = started.app.getHttpServer();
    const plan = await request(api).get(`/v1/projects/${projectId}/decomposition`).set({ Authorization: `Bearer ${token}`, ...VERSION }).expect(200);
    expect(plan.body.epicSource).toBe('epic.entity');
    expect((plan.body.epics as { number: number; slug: string; requirements: { reference: string }[] }[]).map((e) => [e.number, e.slug, e.requirements.map((r) => r.reference)])).toEqual([
      [1, 'intake', ['REQ-001']],
      [2, 'review', []],
    ]);
    expect((plan.body.unassigned as { reference: string }[]).map((r) => r.reference)).toEqual(['REQ-002']);
    const m = await mcp(token);
    try {
      const result = await runFirstRun(m.client, projectDir, { estimate: () => 10, decide: () => ({ decision: 'confirmed' }), runStock: async () => undefined, decidedBy: 'test' });
      expect(result.firstRun).toBe(true);
      // One registered and completed specify per Epic — the stub-proved loop of EPIC-042
      // (closure assumption 8), now against real Epics.
      expect(result.executions).toHaveLength(2);
      expect(result.lines.at(-1)).toMatch(/^PMI · first run: 2 specifications, 0 splits \(decomposition policy v\d+\)$/);
      expect(existsSync(join(projectDir, '.pmi', 'first-run'))).toBe(false);
    } finally {
      await m.close();
    }
  }, 120_000);

  it('firstRun is false once specify executions completed, and a later specify is a single-Epic run (FR-EXT-046, FR-EXT-047)', async () => {
    const api = started.app.getHttpServer();
    const after = await request(api).get(`/v1/projects/${projectId}/decomposition`).set({ Authorization: `Bearer ${token}`, ...VERSION }).expect(200);
    expect(after.body.firstRun).toBe(false);
    expect(after.body.unassigned.map((r: { reference: string }) => r.reference)).toEqual(['REQ-002']);
    const m = await mcp(token);
    try {
      const plan = await m.client.callTool({ name: 'pmi.project.decompose', arguments: {} });
      expect((plan.structuredContent as { firstRun: boolean }).firstRun).toBe(false);
      const begun = await runBegin(m.client, projectDir, { command: 'specify', epic: '1', epicDir: 'specs/001-intake' });
      expect(begun.executionId).toMatch(/\S/);
      mkdirSync(join(projectDir, 'specs', '001-intake'), { recursive: true });
      writeFileSync(join(projectDir, 'specs', '001-intake', 'spec.md'), '# Intake\n');
      const finished = await runFinish(m.client, projectDir, 'specs/001-intake');
      expect(finished.outcome).toBe('completed');
    } finally {
      await m.close();
    }
  });
});
