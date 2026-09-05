/**
 * `T1519` (EPIC-042, US3, `FR-EXT-025`–`FR-EXT-027`, `FR-EXT-067`, `SC-EXT-004`,
 * `R-042-5`) — drift through the composed `AppModule`: `pmi.health` with the
 * current digest → `current`; an earlier render's → `stale`; unknown → `drift`;
 * `null` → `missing`; the connection row carries the state and time; a later
 * `current` report clears it; `pmi.constitution.get` classifies the same way.
 *
 * Mutation owed at closure (`SC-EXT-004`): make `classify` answer `current` for
 * every digest and observe this fail. Written to FAIL before `T1520`.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
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
let token = '';

async function mcp(): Promise<{ client: Client; close(): Promise<void> }> {
  const server = createServer(createPlatformClient({ baseUrl, credential: token }), { serverVersion: 'drift' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'drift', version: '1.0.0' });
  await server.connect(st);
  await client.connect(ct);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-drift-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  process.env['PMI_PUBLIC_URL'] = 'http://localhost:3000';
  started = await startAuthenticatedApp({ workspaceId: 'ws_drift', userId: 'u_owner' });
  await started.app.listen(0);
  baseUrl = await started.app.getUrl();
  const api = started.app.getHttpServer();
  const a = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Alpha', rootPath: 'alpha' }).expect(201);
  projectId = a.body.id;
  token = a.body.connectorCredential.value;
}, 600_000);

afterAll(async () => {
  await started?.close();
  rmSync(root, { recursive: true, force: true });
  delete process.env['PMI_PROJECTS_ROOT'];
  delete process.env['PMI_PROJECTS_ROOT_HOST'];
  delete process.env['PMI_PUBLIC_URL'];
}, 120_000);

suite('T1519 · the four states, on health and on the read, and on the connection row', () => {
  it('current → stale → drift → missing, and a later current report clears the warning', async () => {
    const api = started.app.getHttpServer();
    const first = await request(api).get(`/v1/projects/${projectId}/constitution`).set('Cookie', started.cookie).expect(200);
    const m = await mcp();
    try {
      const state = async (digest: string | null): Promise<string> => {
        const r = await m.client.callTool({ name: 'pmi.health', arguments: { constitutionDigest: digest } });
        expect(r.isError).toBeFalsy();
        return (r.structuredContent as { constitutionState: string }).constitutionState;
      };
      const row = async (): Promise<{ constitutionState: string | null; constitutionDigest: string | null; constitutionReportedAt: string | null }> => {
        const rows = await request(api).get(`/v1/projects/${projectId}/workstation-connections`).set('Cookie', started.cookie).expect(200);
        return rows.body[0];
      };

      expect(await state(first.body.digest)).toBe('current');
      expect(await row()).toMatchObject({ constitutionState: 'current', constitutionDigest: first.body.digest });
      expect((await row()).constitutionReportedAt).toMatch(/^\d{4}-/);

      // The owner changes a constraint: the old digest is now stale.
      await request(api).post(`/v1/projects/${projectId}/constraints`).set('Cookie', started.cookie).send({ kind: 'principle', title: 'Later', body: 'Added after the file was written.' }).expect(201);
      expect(await state(first.body.digest)).toBe('stale');
      expect((await row()).constitutionState).toBe('stale');

      expect(await state('f'.repeat(64))).toBe('drift');
      expect((await row()).constitutionState).toBe('drift');

      expect(await state(null)).toBe('missing');
      expect((await row()).constitutionState).toBe('missing');

      const second = await request(api).get(`/v1/projects/${projectId}/constitution`).set('Cookie', started.cookie).expect(200);
      expect(await state(second.body.digest)).toBe('current');
      expect((await row()).constitutionState).toBe('current');

      // pmi.constitution.get classifies the same way.
      for (const [digest, expected] of [[second.body.digest, 'current'], [first.body.digest, 'stale'], ['a'.repeat(64), 'drift'], [null, 'missing']] as [string | null, string][]) {
        const r = await m.client.callTool({ name: 'pmi.constitution.get', arguments: { onDiskDigest: digest } });
        expect((r.structuredContent as { state: string }).state, `${String(digest)} → ${expected}`).toBe(expected);
      }
    } finally {
      await m.close();
    }
  });
});
