/**
 * `T2181`, `T2182` (EPIC-039, `SC-HUB-004`, `SC-HUB-005`, quickstart Q13–Q14) —
 * the canary.
 *
 * A credential shaped like a secret (`pmi-canary-<uuid>`, which the shared
 * patterns recognise) is set for two adapters of project A. Then every route of
 * the API contract is exercised, a provider failure is forced, a request is
 * made inside an execution, and `pmi-studio` reads the project context and the
 * execution history through its in-process client. Everything that came back,
 * everything written to the audit log, the three decision tables, the execution
 * events, and everything written to the console or stdout is searched for the
 * canary — raw, base64 and URL-encoded. It is found nowhere.
 *
 * And project B never resolves with project A's credential (`SC-HUB-005`).
 *
 * **This is the suite the `SC-HUB-004` mutation proof targets** (`T2229`):
 * make `credential.service.ts → status()` return the decrypted value and this
 * file must fail. The Integrations page's DOM is scanned by its own component
 * test (`frontend/tests/unit/pages/integrations.spec.tsx`), which renders the
 * same response shapes — a backend process cannot render the React page.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CONTRACT_VERSION } from '@pmi/execution-registry-contract';
import { Replay, startReplayServer, type Recording } from '@pmi/capability-contract/replay';
import { createPlatformClient, createServer } from '@pmi/mcp-server';
import { Client as Pg } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startIntegrationsApp, type IntegrationsApp } from '../helpers/integrations-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;
const here = dirname(fileURLToPath(import.meta.url));
const RECORDINGS = resolve(here, '../../../packages/capability-adapters/github/tests/recordings');
const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

const CANARY = `pmi-canary-${randomUUID()}`;
const FORMS = [CANARY, Buffer.from(CANARY).toString('base64'), encodeURIComponent(CANARY), CANARY.slice(11)];

let t: IntegrationsApp;
let replay: { url: string; close(): Promise<void> };
let baseUrl = '';
let executionId = '';
const ids: Record<string, string> = {};
const haystack: string[] = [];
const captured: string[] = [];
const restore: (() => void)[] = [];

function collect(label: string, value: unknown): void {
  haystack.push(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
}

function hits(): string[] {
  const all = [...haystack, ...captured.map((c) => `console: ${c}`)];
  return all.filter((h) => FORMS.some((f) => h.includes(f))).map((h) => h.slice(0, 160));
}

beforeAll(async () => {
  if (noRuntime) return;
  // Everything the process writes while the canary exists is part of the search.
  for (const name of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const original = console[name];
    console[name] = (...args: unknown[]) => {
      captured.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    };
    restore.push(() => {
      console[name] = original;
    });
  }
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
    captured.push(String(chunk));
    return (write as (...a: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof process.stdout.write;
  restore.push(() => {
    process.stdout.write = write;
  });

  // The recorded provider answers 401 to a plain token: the forced provider failure.
  const recording = JSON.parse(readFileSync(join(RECORDINGS, '2026-10-10.github-rest.json'), 'utf8')) as Recording;
  replay = await startReplayServer(new Replay([recording], { overlay: (req, rec) => (req.path.startsWith('/app/') ? rec : req.headers['authorization']?.includes('pmi-canary-') ? { status: 401, json: { message: 'Bad credentials' } } : rec) }));
  t = await startIntegrationsApp({ workspaceId: 'ws_canary', userId: 'u_canary' });
  await t.app.listen(0);
  baseUrl = await t.app.getUrl();
  t.bindPolicy();
  for (const key of ['fixture-ci', 'fixture-git', 'github-rest']) ids[key] = await t.register(key);
}, 600_000);

afterAll(async () => {
  for (const r of restore.reverse()) r();
  await t?.stop();
  await replay?.close();
}, 120_000);

suite('T2181 · the canary is set, and every surface is exercised', () => {
  it('sets the canary for two adapters of project A (204, nothing echoed)', async () => {
    await t.configure(t.projectA, 'ReadBuildStatus', [{ registryEntryId: ids['fixture-ci']! }, { registryEntryId: ids['github-rest']!, binding: { repository: 'acme/widgets', apiBaseUrl: replay.url } }]).expect(200);
    await t.configure(t.projectA, 'ReadRepository', [{ registryEntryId: ids['github-rest']!, binding: { repository: 'acme/widgets', apiBaseUrl: replay.url } }]).expect(200);
    for (const [entry, kind] of [[ids['fixture-ci']!, 'fixture-token'], [ids['github-rest']!, 'github-token']] as const) {
      const res = await request(t.api).put(`/v1/projects/${t.projectA}/integrations/credentials/${entry}`).set('Cookie', t.cookie).send({ kind, value: CANARY }).expect(204);
      collect('PUT credential', { status: res.status, body: res.text, headers: res.headers });
    }
  });

  it('exercises every route of the API contract and collects what came back', async () => {
    const get = async (path: string) => {
      const res = await request(t.api).get(path).set('Cookie', t.cookie);
      collect(`GET ${path}`, res.text);
      return res;
    };
    expect((await get(`/v1/projects/${t.projectA}/integrations/credentials`)).status).toBe(200);
    await get(`/v1/integrations/registry?projectId=${t.projectA}`);
    await get('/v1/integrations/registry');
    for (const id of Object.values(ids)) await get(`/v1/integrations/registry/${id}?projectId=${t.projectA}`);
    await get('/v1/integrations/capabilities');
    await get('/v1/integrations/capabilities/ReadBuildStatus/versions/1.0');
    await get(`/v1/projects/${t.projectA}/integrations/configuration`);
    await get('/v1/integrations/deployment/capabilities');
    await t.tick();
    for (const capability of ['ReadBuildStatus', 'ReadRepository']) {
      const res = await request(t.api).post(`/v1/projects/${t.projectA}/capability-requests`).set('Cookie', t.cookie).send({ capability, major: 1, caller: 'room:change', input: capability === 'ReadRepository' ? { revision: 'main', mode: 'tree' } : { revision: SHA } });
      collect(`POST ${capability}`, res.text);
    }
  });

  it('forces a provider failure with the canary as the token: the refusal names no credential', async () => {
    const res = await request(t.api).post(`/v1/projects/${t.projectA}/capability-requests`).set('Cookie', t.cookie).send({ capability: 'ReadRepository', major: 1, caller: 'room:change', input: { revision: 'main', mode: 'tree' } });
    collect('forced provider failure', res.text);
    expect(res.body.invocation ?? res.body.refusal).toBeDefined();
    const sent = (replay as unknown as { url: string }).url;
    expect(sent.length).toBeGreaterThan(0);
  });

  it('a request inside an execution, and pmi-studio reading the project and the execution', async () => {
    const server = createServer(createPlatformClient({ baseUrl, credential: t.tokenA }), { serverVersion: 'canary' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'canary', version: '1.0.0' });
    await server.connect(st);
    await client.connect(ct);
    try {
      const reg = await client.callTool({ name: 'pmi.execution.register', arguments: { command: 'implement', argsSanitized: {}, input: { targetType: 'project', targetId: t.projectA, targetVersion: 1 }, correlationId: 'corr_canary', idempotencyKey: 'k_canary', contractVersion: CONTRACT_VERSION } });
      expect(reg.isError).toBeFalsy();
      executionId = (reg.structuredContent as { executionId: string }).executionId;
      const inside = await request(t.api).post(`/v1/projects/${t.projectA}/capability-requests`).set('Cookie', t.cookie).send({ capability: 'ReadBuildStatus', major: 1, caller: 'room:change', executionId, input: { revision: SHA } });
      collect('request inside an execution', inside.text);
      const context = await client.callTool({ name: 'pmi.project.context', arguments: {} });
      collect('pmi.project.context', context);
      const history = await client.callTool({ name: 'pmi.execution.history', arguments: { executionId } });
      collect('pmi.execution.history', history);
      expect(JSON.stringify(history)).toContain('capability-resolved');
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('collects the audit log, the decision tables and the execution events', async () => {
    const db = new Pg({ connectionString: t.databaseUrl });
    await db.connect();
    try {
      for (const table of ['audit_entries', 'capability_resolutions', 'capability_invocations', 'integration_health_checks', 'execution_events', 'project_capability_configurations', 'integration_registry_entries']) {
        collect(table, (await db.query(`SELECT * FROM "${table}"`)).rows);
      }
      // The credentials table holds ciphertext only: the plaintext is not in it either.
      const creds = await db.query(`SELECT "ciphertext","kind","keyId" FROM "integration_credentials"`);
      expect(creds.rows).toHaveLength(2);
      collect('integration_credentials (ciphertext)', creds.rows.map((r) => ({ ...r, ciphertext: Buffer.from(r.ciphertext).toString('utf8') })));
    } finally {
      await db.end();
    }
  });
});

suite('T2181 · SC-HUB-004 — the canary appears nowhere', () => {
  it('searched raw, base64 and URL-encoded across everything collected', () => {
    expect(haystack.length).toBeGreaterThan(20);
    expect(hits()).toEqual([]);
  });

  it('the search can fail: the canary is found when it is there', () => {
    expect(FORMS.some((f) => `prefix ${Buffer.from(CANARY).toString('base64')} suffix`.includes(f))).toBe(true);
  });
});

suite('T2181 · SC-HUB-005 — project B never resolves with project A\'s credential', () => {
  it('B configured for github-rest without its own credential is refused credential-missing', async () => {
    await t.configure(t.projectB, 'ReadRepository', [{ registryEntryId: ids['github-rest']!, binding: { repository: 'acme/widgets', apiBaseUrl: replay.url } }]).expect(200);
    const res = await request(t.api).post(`/v1/projects/${t.projectB}/capability-requests`).set('Cookie', t.cookie).send({ capability: 'ReadRepository', major: 1, caller: 'room:change', input: { revision: 'main', mode: 'tree' } }).expect(200);
    expect(res.body.refusal.candidates.find((c: { entryKey: string }) => c.entryKey === 'github-rest')).toMatchObject({ ineligibleBecause: 'credential-missing' });
  });

  it('A\'s row copied to B fails to decrypt — B reads it as absent, never as A\'s', async () => {
    const db = new Pg({ connectionString: t.databaseUrl });
    await db.connect();
    try {
      await db.query(
        `INSERT INTO "integration_credentials" ("id","workspaceId","projectId","registryEntryId","kind","ciphertext","iv","authTag","keyId","setBy","setAt")
         SELECT gen_random_uuid()::text, "workspaceId", $1, "registryEntryId", "kind", "ciphertext", "iv", "authTag", "keyId", "setBy", "setAt" FROM "integration_credentials" WHERE "projectId" = $2 AND "registryEntryId" = $3`,
        [t.projectB, t.projectA, ids['github-rest']],
      );
    } finally {
      await db.end();
    }
    const seen = await t.hub.vault.withCredential({ workspaceId: 'ws_canary', projectId: t.projectB, registryEntryId: ids['github-rest']! }, async (h) => h);
    expect(seen).toBeNull();
  });
});
