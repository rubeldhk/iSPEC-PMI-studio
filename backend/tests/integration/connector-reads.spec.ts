/**
 * `T1446` (EPIC-043, US4, US5, `FR-PIC-040`–`FR-PIC-046`) — the reads and the
 * health call through the routes and through the MCP client, against the
 * composed `AppModule`.
 *
 * Scenario 9: context and requirements for this project only; a credential for
 * project B reading project A is `404`. Scenario 2: `pmi.health` answers and the
 * workstation is recorded; the session route lists it. The reserved tools
 * refuse `not_available_until` after validating arguments.
 *
 * Written to FAIL before Phases 6 and 7 land.
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
  const server = createServer(createPlatformClient({ baseUrl, credential: token }), { serverVersion: 'reads' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'reads', version: '1.0.0' });
  await server.connect(st);
  await client.connect(ct);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-reads-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  process.env['PMI_PUBLIC_URL'] = 'http://localhost:3000';
  started = await startAuthenticatedApp({ workspaceId: 'ws_rd', userId: 'u_owner' });
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
  await request(api).post(`/v1/projects/${projectA}/requirements`).set('Cookie', started.cookie).send({ reference: 'REQ-002', description: 'Alpha shall refuse', type: 'constraint', priority: 'p2' }).expect(201);
  await request(api).post(`/v1/projects/${projectB}/requirements`).set('Cookie', started.cookie).send({ reference: 'REQ-B01', description: 'Beta only', type: 'functional', priority: 'p3' }).expect(201);
}, 600_000);

afterAll(async () => {
  await started?.close();
  rmSync(root, { recursive: true, force: true });
  delete process.env['PMI_PROJECTS_ROOT'];
  delete process.env['PMI_PROJECTS_ROOT_HOST'];
  delete process.env['PMI_PUBLIC_URL'];
}, 120_000);

suite('T1446 · Scenario 9 — the reads, this project only', () => {
  it('context over REST and over MCP agree, and name the derivation of the Epic list', async () => {
    const api = started.app.getHttpServer();
    const rest = await request(api).get(`/v1/projects/${projectA}/context`).set({ Authorization: `Bearer ${tokenA}`, ...VERSION }).expect(200);
    expect(rest.body).toMatchObject({ projectId: projectA, name: 'Alpha', scriptType: 'ps', platformUrl: 'http://localhost:3000', contractVersion: CONTRACT_VERSION, epics: [], epicSource: 'unavailable-until-EPIC-044' });
    const m = await mcp(tokenA);
    try {
      const result = await m.client.callTool({ name: 'pmi.project.context', arguments: {} });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual(rest.body);
    } finally {
      await m.close();
    }
  });

  it('requirements grouped by Epic: every active requirement once under unassigned, this project only', async () => {
    const api = started.app.getHttpServer();
    const rest = await request(api).get(`/v1/projects/${projectA}/requirements?groupBy=epic`).set({ Authorization: `Bearer ${tokenA}`, ...VERSION }).expect(200);
    expect(rest.body.epicSource).toBe('unavailable-until-EPIC-044');
    const refs = (rest.body.groups as { epic: string; requirements: { reference: string }[] }[]).flatMap((g) => g.requirements.map((r) => `${g.epic}:${r.reference}`));
    expect(refs.sort()).toEqual(['unassigned:REQ-001', 'unassigned:REQ-002']);
    await request(api).get(`/v1/projects/${projectA}/requirements?groupBy=type`).set({ Authorization: `Bearer ${tokenA}`, ...VERSION }).expect(400);
    const m = await mcp(tokenA);
    try {
      const result = await m.client.callTool({ name: 'pmi.requirements.list', arguments: {} });
      expect(result.isError).toBeFalsy();
      expect((result.structuredContent as { groups: unknown[] }).groups).toEqual(rest.body.groups);
    } finally {
      await m.close();
    }
  });

  it('a credential for project B reading project A is absent, not forbidden', async () => {
    const api = started.app.getHttpServer();
    await request(api).get(`/v1/projects/${projectA}/context`).set({ Authorization: `Bearer ${tokenB}`, ...VERSION }).expect(404);
    await request(api).get(`/v1/projects/${projectA}/requirements?groupBy=epic`).set({ Authorization: `Bearer ${tokenB}`, ...VERSION }).expect(404);
    const own = await request(api).get(`/v1/projects/${projectB}/requirements?groupBy=epic`).set({ Authorization: `Bearer ${tokenB}`, ...VERSION }).expect(200);
    expect(JSON.stringify(own.body)).not.toContain('REQ-001');
  });

  it('the reserved tools refuse not_available_until after validating arguments', async () => {
    const m = await mcp(tokenA);
    try {
      const bad = await m.client.callTool({ name: 'pmi.project.decompose', arguments: { epicNumber: 'x' } });
      expect(bad.isError).toBe(true);
      expect((bad.structuredContent as { code: string }).code).toBe('invalid_arguments');
      const reserved = await m.client.callTool({ name: 'pmi.constitution.get', arguments: {} });
      expect(reserved.structuredContent).toMatchObject({ code: 'not_available_until', epic: 'EPIC-042' });
    } finally {
      await m.close();
    }
  });
});

suite('T1446 · Scenario 2 — health records the workstation', () => {
  it('pmi.health answers project, contract and API versions, records the connection, and the session route lists it', async () => {
    const m = await mcp(tokenA);
    try {
      const result = await m.client.callTool({ name: 'pmi.health', arguments: { extensionVersion: '0.1.0', toolkitVersion: 'v0.16.4' } });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({ projectId: projectA, contractVersion: CONTRACT_VERSION, apiVersion: expect.any(String) });
    } finally {
      await m.close();
    }
    const api = started.app.getHttpServer();
    const rows = await request(api).get(`/v1/projects/${projectA}/workstation-connections`).set('Cookie', started.cookie).expect(200);
    expect(rows.body).toHaveLength(1);
    expect(rows.body[0]).toMatchObject({ credentialState: 'active', extensionVersion: '0.1.0', toolkitVersion: 'v0.16.4', contractVersion: CONTRACT_VERSION });
    await request(api).get(`/v1/projects/${projectB}/workstation-connections`).set('Cookie', started.cookie).expect(200).expect([]);
  });
});
