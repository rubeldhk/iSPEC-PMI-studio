/**
 * `T1430` (EPIC-043, `FR-PIC-005`) — the contract document IS the tool surface.
 *
 * Reads `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md`,
 * starts the server in memory, and asserts `tools/list` names exactly the tools
 * the document tables name — live and reserved — and nothing else. A tool added
 * to the server without the document, or documented without the server, fails
 * here. Written to FAIL before `T1425`.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, type PlatformPort } from '@pmi/mcp-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const DOC = resolve(here, '../../../specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md');
const doc = readFileSync(DOC, 'utf8');

/** Every `| \`pmi.…\` |` first cell in the document's tables. */
function documentedTools(): string[] {
  const names = new Set<string>();
  for (const line of doc.split(/\r?\n/)) {
    const m = /^\|\s*`(pmi\.[a-zA-Z.]+)`\s*\|/.exec(line);
    if (m) names.add(m[1] as string);
  }
  return [...names].sort();
}

const stub: PlatformPort = {
  call: async () => ({ ok: true, status: 200, body: {} }),
  describe: () => ({ address: 'stub', credentialPresent: true }),
};

let client: Client;
let server: { close(): Promise<void> };

beforeAll(async () => {
  const [ct, st] = InMemoryTransport.createLinkedPair();
  server = createServer(stub, { serverVersion: 'contract' });
  client = new Client({ name: 'contract', version: '1.0.0' });
  await (server as unknown as { connect(t: unknown): Promise<void> }).connect(st);
  await client.connect(ct);
});
afterAll(async () => {
  await client?.close();
  await server?.close();
});

describe('T1430 · contracts/mcp-tool-surface.md ⇔ tools/list', () => {
  it('the document names fourteen tools', () => {
    expect(documentedTools()).toHaveLength(14);
  });

  it('the server lists exactly the documented tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t: { name: string }) => t.name).sort()).toEqual(documentedTools());
  });

  it('every documented scope is one the document\'s refusal vocabulary and the platform share', () => {
    const scopes = [...doc.matchAll(/`(execution\.[a-z]+|project\.read|requirements\.read|health\.write)`/g)].map((m) => m[1]);
    expect(new Set(scopes).size).toBeGreaterThanOrEqual(9);
    for (const code of ['invalid_connector_credential', 'scope_required', 'not_available_until', 'platform_unreachable', 'credential_in_argument']) {
      expect(doc).toContain(code);
    }
  });
});

/**
 * `T1671` (EPIC-045, `contracts/artifacts-api.md` §4) — the reserved section
 * shrank by exactly one, and the document says who took it.
 *
 * The check above compares the document's tool NAMES against `tools/list`, and
 * would stay green if `pmi.artifacts.sync` were quietly rewritten as reserved
 * in the document while the server served it live: it appears in a table
 * either way. What must not drift is which SIDE it is on, and whether the
 * document records why it moved.
 */
describe('T1671 · pmi.artifacts.sync is live as of EPIC-045', () => {
  /** The rows of the `## 3. Reserved` section, up to the next heading. */
  function reservedRows(): string[] {
    const section = doc.split(/^## 3\. Reserved/m)[1]?.split(/^## /m)[0] ?? '';
    return [...section.matchAll(/^\|\s*`(pmi\.[a-zA-Z.]+)`\s*\|/gm)].map((m) => m[1] as string);
  }

  it('§3 lists exactly two reserved tools, and pmi.artifacts.sync is not one of them', () => {
    expect(reservedRows().sort()).toEqual(['pmi.execution.sync', 'pmi.tasks.sync']);
  });

  it('carries a dated note naming EPIC-045 as what made the tool live', () => {
    const note = doc.split(/^## 3\. Reserved/m)[1]?.split(/^## /m)[0] ?? '';
    expect(note).toMatch(/Amended \d{4}-\d{2}-\d{2}.*EPIC-045/s);
    expect(note).toContain('pmi.artifacts.sync');
  });

  it('documents the route and the scope the live tool translates to', () => {
    expect(doc).toContain('POST /v1/projects/me/artifacts/sync');
    expect(doc).toContain('artifacts.sync');
  });

  it('the server serves it live — it reaches the platform instead of refusing not_available_until', async () => {
    // Its own stub: the file's shared one answers `{}`, which cannot satisfy
    // this tool's output schema. What is being proved is that the call REACHES
    // the platform at all — a reserved tool never does.
    const calls: { method: string; path: string }[] = [];
    const platform: PlatformPort = {
      call: async (call) => {
        calls.push({ method: call.method, path: call.path });
        return { ok: true, status: 201, body: { syncId: 'sync_1', epicId: null, created: 0, reused: 0, refused: [] } };
      },
      describe: () => ({ address: 'stub', credentialPresent: true }),
    };
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const live = createServer(platform, { serverVersion: 'contract-live' });
    const c = new Client({ name: 'contract-live', version: '1.0.0' });
    await (live as unknown as { connect(t: unknown): Promise<void> }).connect(st);
    await c.connect(ct);
    try {
      const result = await c.callTool({ name: 'pmi.artifacts.sync', arguments: { executionId: 'e', files: [] } });
      expect(result.isError).toBeFalsy();
      expect(JSON.stringify(result.structuredContent ?? {})).not.toContain('not_available_until');
      expect(calls).toEqual([{ method: 'POST', path: '/v1/projects/me/artifacts/sync' }]);
    } finally {
      await c.close();
      await live.close();
    }
  });

  it('the other two still refuse, so making one live did not make three live', async () => {
    for (const [name, args] of [
      ['pmi.execution.sync', { batch: [] }],
      ['pmi.tasks.sync', {}],
    ] as const) {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError, name).toBe(true);
      expect(result.structuredContent, name).toMatchObject({ code: 'not_available_until' });
    }
  });
});
