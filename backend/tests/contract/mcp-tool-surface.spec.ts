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
