/**
 * `T1442` (EPIC-043, US3, `FR-EXR-009`, `SC-PIC-006`) — a retried registration
 * is the same registration, through both bindings.
 *
 * The same key and payload return the original execution and create no second
 * row; the same key with a different payload is a conflict; the same key from a
 * second credential of the same project is a conflict on emitting principal;
 * no sequence number is consumed by a refused replay.
 *
 * Constitution XI Tier 1: the composed `AppModule`, a real MCP client. Written
 * to FAIL before Phase 5 is verified.
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
let projectId = '';
let tokenA = '';
let tokenA2 = '';

const VERSION = { 'x-contract-version': CONTRACT_VERSION };

function registration(key: string, command = 'specify') {
  return { command, argsSanitized: {}, input: { targetType: 'project', targetId: projectId, targetVersion: 1 }, correlationId: `corr_${key}`, idempotencyKey: key, contractVersion: CONTRACT_VERSION };
}

async function rows(sql: string): Promise<number> {
  const { Client: Pg } = await import('pg');
  const db = new Pg({ connectionString: started.databaseUrl });
  await db.connect();
  try {
    const res = await db.query<{ n: string }>(sql);
    return Number(res.rows[0]?.n ?? 0);
  } finally {
    await db.end();
  }
}

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-replay-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  started = await startAuthenticatedApp({ workspaceId: 'ws_rep', userId: 'u_owner' });
  await started.app.listen(0);
  baseUrl = await started.app.getUrl();
  const api = started.app.getHttpServer();
  const created = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Replay', rootPath: 'replay' }).expect(201);
  projectId = created.body.id;
  tokenA = created.body.connectorCredential.value;
  const second = await request(api).post(`/v1/projects/${projectId}/connector-credentials`).set('Cookie', started.cookie).send({ label: 'second' }).expect(201);
  tokenA2 = second.body.value;
}, 600_000);

afterAll(async () => {
  await started?.close();
  rmSync(root, { recursive: true, force: true });
  delete process.env['PMI_PROJECTS_ROOT'];
  delete process.env['PMI_PROJECTS_ROOT_HOST'];
}, 120_000);

suite('T1442 · replay over REST', () => {
  it('the same key and payload return the original; no second row, no sequence consumed', async () => {
    const api = started.app.getHttpServer();
    const auth = { Authorization: `Bearer ${tokenA}`, ...VERSION };
    const first = await request(api).post('/v1/executions').set(auth).set('Idempotency-Key', 'k_same').send(registration('k_same')).expect(201);
    const before = await rows(`SELECT count(*)::text AS n FROM "execution_events"`);
    const again = await request(api).post('/v1/executions').set(auth).set('Idempotency-Key', 'k_same').send(registration('k_same')).expect(201);
    expect(again.body.executionId).toBe(first.body.executionId);
    expect(again.body.command).toBe(first.body.command);
    expect(await rows(`SELECT count(*)::text AS n FROM "executions" WHERE "idempotencyKey" = 'k_same'`)).toBe(1);
    expect(await rows(`SELECT count(*)::text AS n FROM "execution_events"`)).toBe(before);
  });

  it('the same key with a different payload is a conflict, and the original is untouched', async () => {
    const api = started.app.getHttpServer();
    const auth = { Authorization: `Bearer ${tokenA}`, ...VERSION };
    await request(api).post('/v1/executions').set(auth).set('Idempotency-Key', 'k_diff').send(registration('k_diff', 'specify')).expect(201);
    const before = await rows(`SELECT count(*)::text AS n FROM "executions"`);
    const res = await request(api).post('/v1/executions').set(auth).set('Idempotency-Key', 'k_diff').send(registration('k_diff', 'plan'));
    expect([409, 422]).toContain(res.status);
    expect(res.body.error.code).toBe('conflict');
    expect(res.body.error.details.refusal).toBe('idempotency_conflict');
    expect(await rows(`SELECT count(*)::text AS n FROM "executions"`)).toBe(before);
  });

  it('the same key from a second credential of the same project is a conflict on emitting principal', async () => {
    const api = started.app.getHttpServer();
    await request(api).post('/v1/executions').set({ Authorization: `Bearer ${tokenA}`, ...VERSION }).set('Idempotency-Key', 'k_who').send(registration('k_who')).expect(201);
    const res = await request(api).post('/v1/executions').set({ Authorization: `Bearer ${tokenA2}`, ...VERSION }).set('Idempotency-Key', 'k_who').send(registration('k_who'));
    expect([409, 422]).toContain(res.status);
    expect(await rows(`SELECT count(*)::text AS n FROM "executions" WHERE "idempotencyKey" = 'k_who'`)).toBe(1);
  });
});

suite('T1442 · replay over MCP', () => {
  it('the server forwards the idempotency key unchanged and the second answer is the original', async () => {
    const server = createServer(createPlatformClient({ baseUrl, credential: tokenA }), { serverVersion: 'replay' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'replay', version: '1.0.0' });
    await server.connect(st);
    await client.connect(ct);
    try {
      const args = { command: 'specify', argsSanitized: {}, input: { targetType: 'project', targetId: projectId, targetVersion: 1 }, correlationId: 'corr_mcp', idempotencyKey: 'k_mcp' };
      const first = await client.callTool({ name: 'pmi.execution.register', arguments: args });
      const again = await client.callTool({ name: 'pmi.execution.register', arguments: args });
      expect(first.isError).toBeFalsy();
      expect(again.isError).toBeFalsy();
      expect((again.structuredContent as { executionId: string }).executionId).toBe((first.structuredContent as { executionId: string }).executionId);
      const conflict = await client.callTool({ name: 'pmi.execution.register', arguments: { ...args, command: 'plan' } });
      expect(conflict.isError).toBe(true);
      expect(String((conflict.structuredContent as { code: string }).code)).toMatch(/idempotency_conflict|conflict/);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
