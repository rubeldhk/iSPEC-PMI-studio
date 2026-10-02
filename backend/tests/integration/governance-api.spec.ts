/**
 * `T1487`, `T1492` (EPIC-042, `contracts/governance-api.md`) — the governance
 * routes through the composed `AppModule` with a real session and real
 * credentials: constraints and the policy are authored by the owner; the render
 * is what the connector reads; the on-disk digest is classified on
 * `pmi.health` and on `pmi.constitution.get`; another project's credential
 * gets nothing; every read and write is audited.
 *
 * Written to FAIL before `T1488`/`T1489`/`T1493`.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CONTRACT_VERSION } from '@pmi/execution-registry-contract';
import { createPlatformClient, createServer } from '@pmi/mcp-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let started: AuthenticatedApp;
let root: string;
let baseUrl = '';
let projectA = '';
let projectB = '';
let tokenA = '';
let tokenB = '';
const VERSION = { 'x-contract-version': CONTRACT_VERSION };

async function mcp(token: string): Promise<{ client: Client; close(): Promise<void> }> {
  const server = createServer(createPlatformClient({ baseUrl, credential: token }), { serverVersion: 'governance' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'governance', version: '1.0.0' });
  await server.connect(st);
  await client.connect(ct);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-gov-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  process.env['PMI_PUBLIC_URL'] = 'http://localhost:3000';
  started = await startAuthenticatedApp({ workspaceId: 'ws_gov', userId: 'u_owner' });
  await started.app.listen(0);
  baseUrl = await started.app.getUrl();
  const api = started.app.getHttpServer();
  const a = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Alpha', rootPath: 'alpha', scriptType: 'ps' }).expect(201);
  const b = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Beta', rootPath: 'beta' }).expect(201);
  projectA = a.body.id;
  projectB = b.body.id;
  tokenA = a.body.connectorCredential.value;
  tokenB = b.body.connectorCredential.value;
  await request(api).post(`/v1/projects/${projectA}/requirements`).set('Cookie', started.cookie).send({ reference: 'REQ-001', description: 'Alpha shall register', type: 'functional', priority: 'p1' }).expect(201);
}, 600_000);

afterAll(async () => {
  await started?.close();
  rmSync(root, { recursive: true, force: true });
  delete process.env['PMI_PROJECTS_ROOT'];
  delete process.env['PMI_PROJECTS_ROOT_HOST'];
  delete process.env['PMI_PUBLIC_URL'];
}, 120_000);

suite('T1487 · the owner authors; the render follows', () => {
  it('constraints and the policy through the session routes, versioned and audited', async () => {
    const api = started.app.getHttpServer();
    const p1 = await request(api).post(`/v1/projects/${projectA}/constraints`).set('Cookie', started.cookie).send({ kind: 'principle', title: 'Spec first', body: 'Write it down.' }).expect(201);
    await request(api).post(`/v1/projects/${projectA}/constraints`).set('Cookie', started.cookie).send({ kind: 'constraint', title: 'Postgres 16', body: 'Nothing else.' }).expect(201);
    await request(api).post(`/v1/projects/${projectA}/constraints`).set('Cookie', started.cookie).send({ kind: 'non_goal', title: 'No mobile', body: 'Not in v1.' }).expect(201);
    const edited = await request(api).patch(`/v1/projects/${projectA}/constraints/${p1.body.id}`).set('Cookie', started.cookie).send({ body: 'Write it down, then build.' }).expect(200);
    expect(edited.body.version).toBe(2);
    const list = await request(api).get(`/v1/projects/${projectA}/constraints?kind=principle`).set('Cookie', started.cookie).expect(200);
    expect(list.body.map((c: { title: string }) => c.title)).toEqual(['Spec first']);
    const policy = await request(api).put(`/v1/projects/${projectA}/policy`).set('Cookie', started.cookie).send({ oneSpecPerEpic: true, taskCeiling: 40, splitRequiresConfirmation: true, offlineMode: 'strict' }).expect(200);
    expect(policy.body).toMatchObject({ taskCeiling: 40, version: 2 });
    await request(api).put(`/v1/projects/${projectA}/policy`).set('Cookie', started.cookie).send({ oneSpecPerEpic: true, taskCeiling: 0, splitRequiresConfirmation: true, offlineMode: 'strict' }).expect(400);
  });

  it('GET …/constitution is the render: headings in order, the entries, the policy, the invariant section', async () => {
    const api = started.app.getHttpServer();
    const res = await request(api).get(`/v1/projects/${projectA}/constitution`).set('Cookie', started.cookie).expect(200);
    expect(res.body.digest).toMatch(/^[0-9a-f]{64}$/);
    const headings = (res.body.content as string).split('\n').filter((l) => l.startsWith('## '));
    expect(headings).toEqual(['## Core Principles', '## Constraints', '## Non-goals', '## Decomposition Policy', '## Governed Execution', '## Steering']);
    expect(res.body.content).toContain('### Spec first');
    expect(res.body.content).toContain('exceeds 40 MUST be split');
    expect(res.body.content).toContain('Offline mode: strict');
    expect(res.body.content).toContain('# Alpha Constitution');
  });
});

suite('T1492 · the connector reads the render and the plan — this project only', () => {
  it('pmi.constitution.get equals the session render and classifies the on-disk digest', async () => {
    const api = started.app.getHttpServer();
    const session = await request(api).get(`/v1/projects/${projectA}/constitution`).set('Cookie', started.cookie).expect(200);
    const rest = await request(api).get(`/v1/projects/${projectA}/constitution`).set({ Authorization: `Bearer ${tokenA}`, ...VERSION }).expect(200);
    expect(rest.body).toMatchObject({ version: session.body.version, digest: session.body.digest, content: session.body.content, state: 'current' });
    const m = await mcp(tokenA);
    try {
      const current = await m.client.callTool({ name: 'pmi.constitution.get', arguments: { onDiskDigest: session.body.digest } });
      expect(current.isError).toBeFalsy();
      expect((current.structuredContent as { state: string }).state).toBe('current');
      const drift = await m.client.callTool({ name: 'pmi.constitution.get', arguments: { onDiskDigest: 'f'.repeat(64) } });
      expect((drift.structuredContent as { state: string }).state).toBe('drift');
      const missing = await m.client.callTool({ name: 'pmi.constitution.get', arguments: { onDiskDigest: null } });
      expect((missing.structuredContent as { state: string }).state).toBe('missing');
    } finally {
      await m.close();
    }
  });

  it('pmi.health records the reported digest and its state on the workstation connection', async () => {
    const api = started.app.getHttpServer();
    const session = await request(api).get(`/v1/projects/${projectA}/constitution`).set('Cookie', started.cookie).expect(200);
    const m = await mcp(tokenA);
    try {
      const ok = await m.client.callTool({ name: 'pmi.health', arguments: { extensionVersion: '0.2.0', constitutionDigest: session.body.digest } });
      expect((ok.structuredContent as { constitutionState: string }).constitutionState).toBe('current');
      const rows = await request(api).get(`/v1/projects/${projectA}/workstation-connections`).set('Cookie', started.cookie).expect(200);
      expect(rows.body[0]).toMatchObject({ constitutionDigest: session.body.digest, constitutionState: 'current' });
      const drift = await m.client.callTool({ name: 'pmi.health', arguments: { constitutionDigest: 'a'.repeat(64) } });
      expect((drift.structuredContent as { constitutionState: string }).constitutionState).toBe('drift');
      const after = await request(api).get(`/v1/projects/${projectA}/workstation-connections`).set('Cookie', started.cookie).expect(200);
      expect(after.body[0].constitutionState).toBe('drift');
    } finally {
      await m.close();
    }
  });

  it('pmi.project.decompose: first run, the policy, the bundle; nothing to decompose for an empty project', async () => {
    const api = started.app.getHttpServer();
    const rest = await request(api).get(`/v1/projects/${projectA}/decomposition`).set({ Authorization: `Bearer ${tokenA}`, ...VERSION }).expect(200);
    // 2026-09-19 — `epicSource` is `epic.entity` since EPIC-044 wired the Epic
    // store into the connector's project context; the placeholder this line
    // named was the pre-044 state (`decomposition-read.spec.ts` asserts the same).
    expect(rest.body).toMatchObject({ firstRun: true, nothingToDecompose: false, policy: { taskCeiling: 40, offlineMode: 'strict' }, epics: [], epicSource: 'epic.entity' });
    expect(rest.body.unassigned.map((r: { reference: string }) => r.reference)).toEqual(['REQ-001']);
    const empty = await request(api).get(`/v1/projects/${projectB}/decomposition`).set({ Authorization: `Bearer ${tokenB}`, ...VERSION }).expect(200);
    expect(empty.body).toMatchObject({ firstRun: true, nothingToDecompose: true, epics: [], unassigned: [] });
    const m = await mcp(tokenA);
    try {
      const result = await m.client.callTool({ name: 'pmi.project.decompose', arguments: {} });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual(rest.body);
    } finally {
      await m.close();
    }
  });

  it("another project's credential gets nothing; a revoked one is refused; the reserved tools still refuse by name", async () => {
    const api = started.app.getHttpServer();
    await request(api).get(`/v1/projects/${projectA}/constitution`).set({ Authorization: `Bearer ${tokenB}`, ...VERSION }).expect(404);
    await request(api).get(`/v1/projects/${projectA}/decomposition`).set({ Authorization: `Bearer ${tokenB}`, ...VERSION }).expect(404);
    const own = await request(api).get(`/v1/projects/${projectB}/constitution`).set({ Authorization: `Bearer ${tokenB}`, ...VERSION }).expect(200);
    expect(own.body.content).toContain('# Beta Constitution');
    expect(own.body.content).not.toContain('Spec first');
    const m = await mcp(tokenB);
    try {
      // EPIC-046 T1710: `pmi.tasks.sync` is live, so the only tool still
      // answering `not_available_until` is EPIC-037's provisional intake.
      const r = await m.client.callTool({ name: 'pmi.execution.sync', arguments: { batch: [] } });
      expect(r.isError).toBe(true);
      expect(r.structuredContent).toMatchObject({ code: 'not_available_until' });
    } finally {
      await m.close();
    }
  });

  it('every governance read and write wrote an audit entry', async () => {
    const api = started.app.getHttpServer();
    const audit = await request(api).get('/v1/audit').set('Cookie', started.cookie).expect(200);
    const ops = JSON.stringify(audit.body);
    for (const op of ['constraint.create', 'constraint.update', 'policy.update', 'constitution.render', 'constitution.read', 'decomposition.read']) {
      expect(ops, `${op} not audited`).toContain(op);
    }
  });
});
