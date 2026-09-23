/**
 * `T1435` (EPIC-043, `FR-PIC-010`, `AC-EXR-01`–`04`, `SC-PIC-002`, `SC-PIC-008`)
 * — parity across the four surfaces, against the composed `AppModule` with a
 * real credential.
 *
 * (a) the managed fixture through the facade (`managed-sandbox`), (b) an MCP
 * `Client` connected to `createServer` whose platform client's fetch is the
 * application's own HTTP server (`mcp-client`), (c) REST with the credential
 * (`local-cli`), (d) the CI fixture through the facade (`ci-cd`). All four agree
 * on normalised command, target binding, lifecycle milestones and governance
 * outcome; (b) and (c) carry the local surfaces and assurance `local`, none of
 * it from the caller; the timeline read returns (b) and (c).
 *
 * Constitution XI Tier 1: the real routes, the real module graph, a real MCP
 * client. Written to FAIL before Phase 3 lands.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CONTRACT_VERSION, type ExecutionIdentityRefs, type ExecutionSnapshot } from '@pmi/execution-registry-contract';
import { createPlatformClient, createServer, registryOverClient } from '@pmi/mcp-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let started: AuthenticatedApp;
let root: string;
let baseUrl = '';
let projectId = '';
let credentialId = '';
let token = '';
let identity: ExecutionIdentityRefs;

const HEADERS = { 'x-contract-version': CONTRACT_VERSION };

function registration(key: string) {
  return {
    command: 'specify' as const,
    argsSanitized: { feature: 'Apollo' },
    input: { targetType: 'project', targetId: projectId, targetVersion: 1 },
    correlationId: `corr_${key}`,
    idempotencyKey: `reg_${key}`,
    contractVersion: CONTRACT_VERSION,
  };
}

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-parity-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  started = await startAuthenticatedApp({ workspaceId: 'ws_par', userId: 'u_owner' });
  await started.app.listen(0);
  baseUrl = await started.app.getUrl();
  const api = started.app.getHttpServer();
  const created = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Parity', rootPath: 'parity' }).expect(201);
  projectId = created.body.id;
  token = created.body.connectorCredential.value;
  credentialId = created.body.connectorCredential.id;

  // The identity the facade paths use: derived exactly as the guard derives it.
  const { CONNECTOR_CREDENTIAL_STORE } = await import('../../src/modules/connector/connector.tokens.js');
  const { TrustedPrincipalFactory } = await import('../../src/modules/agents/trusted-principal.js');
  const { CONNECTOR_IDENTITY_RESOLVER } = await import('../../src/modules/executions/executions.controller.js');
  const store = started.app.get(CONNECTOR_CREDENTIAL_STORE, { strict: false }) as { find(ws: string, id: string): Promise<{ principalId: string } | null> };
  const credential = await store.find('ws_par', credentialId);
  const principals = started.app.get(TrustedPrincipalFactory, { strict: false }) as { forPrincipal(ws: string, id: string): Promise<unknown> };
  const principal = await principals.forPrincipal('ws_par', credential!.principalId);
  const resolver = started.app.get(CONNECTOR_IDENTITY_RESOLVER, { strict: false }) as { forRequest(ctx: unknown): Promise<ExecutionIdentityRefs> };
  identity = await resolver.forRequest({ credentialId, workspaceId: 'ws_par', projectId, principal });
}, 600_000);

afterAll(async () => {
  await started?.close();
  rmSync(root, { recursive: true, force: true });
  delete process.env['PMI_PROJECTS_ROOT'];
  delete process.env['PMI_PROJECTS_ROOT_HOST'];
}, 120_000);

async function throughFacade(surface: 'managed-sandbox' | 'ci-cd', key: string): Promise<ExecutionSnapshot> {
  const { ExecutionRegistryFacade } = await import('../../src/modules/executions/execution-registry.facade.js');
  const facade = started.app.get(ExecutionRegistryFacade, { strict: false });
  const snapshot = await facade.register({ ...registration(key), workspaceId: 'ws_par', projectId, surface, identity });
  await facade.appendEvent({ executionId: snapshot.executionId, workspaceId: 'ws_par', type: 'started', payload: {}, occurredAt: new Date().toISOString(), identity, idempotencyKey: `start_${key}` });
  await facade.complete({ executionId: snapshot.executionId, workspaceId: 'ws_par', outcome: 'completed', identity, idempotencyKey: `done_${key}`, occurredAt: new Date().toISOString(), output: { commitAfter: 'abc' }, completionComment: 'done' });
  return (await facade.snapshot('ws_par', snapshot.executionId)) as ExecutionSnapshot;
}

async function throughRest(key: string): Promise<ExecutionSnapshot> {
  const api = started.app.getHttpServer();
  const auth = { Authorization: `Bearer ${token}`, ...HEADERS };
  const reg = await request(api).post('/v1/executions').set(auth).set('Idempotency-Key', `reg_${key}`).send(registration(key)).expect(201);
  const id = reg.body.executionId as string;
  await request(api).post(`/v1/executions/${id}/events`).set(auth).set('Idempotency-Key', `start_${key}`).send({ type: 'started', payload: {}, occurredAt: new Date().toISOString(), idempotencyKey: `start_${key}` }).expect(201);
  await request(api).post(`/v1/executions/${id}/completion`).set(auth).set('Idempotency-Key', `done_${key}`).send({ outcome: 'completed', occurredAt: new Date().toISOString(), completionComment: 'done', output: { commitAfter: 'abc' }, idempotencyKey: `done_${key}` }).expect(201);
  const snap = await request(api).get(`/v1/executions/${id}`).set(auth).expect(200);
  return snap.body as ExecutionSnapshot;
}

async function throughMcp(key: string): Promise<ExecutionSnapshot> {
  const platform = createPlatformClient({ baseUrl, credential: token });
  const server = createServer(platform, { serverVersion: 'parity' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'parity', version: '1.0.0' });
  await server.connect(st);
  await client.connect(ct);
  try {
    const registry = registryOverClient(client);
    const snapshot = await registry.register({ ...registration(key), workspaceId: 'ws_par', projectId, surface: 'mcp-client', identity });
    await registry.appendEvent({ executionId: snapshot.executionId, workspaceId: 'ws_par', type: 'started', payload: {}, occurredAt: new Date().toISOString(), identity, idempotencyKey: `start_${key}` });
    await registry.complete({ executionId: snapshot.executionId, workspaceId: 'ws_par', outcome: 'completed', identity, idempotencyKey: `done_${key}`, occurredAt: new Date().toISOString(), output: { commitAfter: 'abc' }, completionComment: 'done' });
    return (await registry.snapshot('ws_par', snapshot.executionId)) as ExecutionSnapshot;
  } finally {
    await client.close();
    await server.close();
  }
}

suite('T1435 · parity across the four surfaces (AC-EXR-01–04)', () => {
  it('the same governed command agrees everywhere; only surface and assurance differ', async () => {
    const managed = await throughFacade('managed-sandbox', 'a');
    const mcp = await throughMcp('b');
    const rest = await throughRest('c');
    const ci = await throughFacade('ci-cd', 'd');
    const all = [managed, mcp, rest, ci];
    for (const s of all) {
      expect(s.command).toBe('specify');
      expect(s.lifecycleState).toBe('completed');
      expect(s.governanceState).toBe('governed');
      expect(s.workspaceId).toBe('ws_par');
    }
    expect(managed.surface).toBe('managed-sandbox');
    expect(managed.assurance).toBe('managed');
    expect(ci.surface).toBe('ci-cd');
    expect(ci.assurance).toBe('managed');
    expect(mcp.surface).toBe('mcp-client');
    expect(mcp.assurance).toBe('local');
    expect(rest.surface).toBe('local-cli');
    expect(rest.assurance).toBe('local');
    expect(new Set(all.map((s) => s.executionId)).size).toBe(4);
  });

  it('nothing local came from the caller: a body naming assurance or surface is refused (SC-PIC-008)', async () => {
    const api = started.app.getHttpServer();
    const auth = { Authorization: `Bearer ${token}`, ...HEADERS };
    await request(api).post('/v1/executions').set(auth).set('Idempotency-Key', 'x1').send({ ...registration('x1'), assurance: 'managed' }).expect(400);
    await request(api).post('/v1/executions').set(auth).set('Idempotency-Key', 'x2').send({ ...registration('x2'), surface: 'managed-sandbox' }).expect(400);
  });

  it('the timeline read returns the two local executions with their derived surfaces', async () => {
    const api = started.app.getHttpServer();
    // SC-PIC-005 — how long after a completion call the timeline shows it (in-process, reference-local composition).
    const t0 = Date.now();
    const fresh = await throughRest('timing');
    let seen = false;
    while (!seen && Date.now() - t0 < 5000) {
      const page = await request(api).get(`/v1/projects/${projectId}/executions`).set('Cookie', started.cookie).expect(200);
      seen = (page.body.items as { executionId: string; state: string }[]).some((i) => i.executionId === fresh.executionId && i.state === 'completed');
    }
    console.log(`SC-PIC-005 timeline latency after completion: ${Date.now() - t0} ms (seen=${seen})`);
    expect(seen).toBe(true);
    const res = await request(api).get(`/v1/projects/${projectId}/executions`).set('Cookie', started.cookie).expect(200);
    const surfaces = (res.body.items as { surface: string; assurance: string; state: string }[]).map((i) => `${i.surface}:${i.assurance}:${i.state}`);
    expect(surfaces).toContain('mcp-client:local:completed');
    expect(surfaces).toContain('local-cli:local:completed');
    const local = await request(api).get(`/v1/projects/${projectId}/executions?surface=local-cli`).set('Cookie', started.cookie).expect(200);
    expect((local.body.items as { surface: string }[]).every((i) => i.surface === 'local-cli')).toBe(true);
    expect(local.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('history through MCP and through REST is the same event sequence', async () => {
    const api = started.app.getHttpServer();
    const auth = { Authorization: `Bearer ${token}`, ...HEADERS };
    const listed = await request(api).get(`/v1/projects/${projectId}/executions?surface=mcp-client`).set('Cookie', started.cookie).expect(200);
    const id = listed.body.items[0].executionId as string;
    const viaRest = await request(api).get(`/v1/executions/${id}/history`).set(auth).expect(200);
    const platform = createPlatformClient({ baseUrl, credential: token });
    const server = createServer(platform, { serverVersion: 'parity' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'parity', version: '1.0.0' });
    await server.connect(st);
    await client.connect(ct);
    try {
      const viaMcp = await registryOverClient(client).history('ws_par', id);
      expect(viaMcp.map((e) => `${e.sequence}:${e.type}`)).toEqual((viaRest.body as { sequence: number; type: string }[]).map((e) => `${e.sequence}:${e.type}`));
    } finally {
      await client.close();
      await server.close();
    }
  });
});
