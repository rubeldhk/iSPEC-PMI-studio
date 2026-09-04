/**
 * `T1426` (EPIC-043, `FR-PIC-007`) — the bootstrap reads the environment and
 * nothing else. `PMI_STUDIO_URL` is required; an empty `PMI_STUDIO_TOKEN` is
 * absent (the server still starts, every tool refuses, `pmi.health` says
 * `credential_absent`). Written to FAIL before `T1427`.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';
import { compose, resolveEnvironment } from '../src/main.js';

describe('T1426 · resolveEnvironment', () => {
  it('requires PMI_STUDIO_URL', () => {
    expect(() => resolveEnvironment({})).toThrow(/PMI_STUDIO_URL/);
  });

  it('treats an empty PMI_STUDIO_TOKEN as absent', () => {
    expect(resolveEnvironment({ PMI_STUDIO_URL: 'http://localhost:3000', PMI_STUDIO_TOKEN: '' })).toEqual({ baseUrl: 'http://localhost:3000', credential: '' });
    expect(resolveEnvironment({ PMI_STUDIO_URL: 'http://localhost:3000' }).credential).toBe('');
  });

  it('trims what it reads and reads no file', () => {
    const env = resolveEnvironment({ PMI_STUDIO_URL: ' http://localhost:3000 ', PMI_STUDIO_TOKEN: ' pmi_ct_x ' });
    expect(env).toEqual({ baseUrl: 'http://localhost:3000', credential: 'pmi_ct_x' });
  });
});

describe('T1426 · compose', () => {
  it('composes a server over a platform client built from the environment; with no credential every tool refuses and health says why', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
    const server = compose({ baseUrl: 'http://localhost:3000', credential: '' }, { fetch, serverVersion: '0.1.0-test' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '1.0.0' });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const history = await client.callTool({ name: 'pmi.execution.history', arguments: { executionId: 'exec_1' } });
      expect(history.isError).toBe(true);
      expect(history.structuredContent).toMatchObject({ code: 'invalid_connector_credential' });
      const health = await client.callTool({ name: 'pmi.health', arguments: {} });
      expect(health.isError).toBe(true);
      expect(health.structuredContent).toMatchObject({ code: 'invalid_connector_credential', detail: 'credential_absent' });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      await client.close();
      await server.close();
    }
  });
});

describe('T1470 · serverInfo.version is the manifest version (FR-PIC-006)', () => {
  it('reads packages/mcp-server/package.json rather than repeating a literal', async () => {
    const { readFileSync } = await import('node:fs');
    const { PACKAGE_VERSION, packageVersion } = await import('../src/main.js');
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(packageVersion()).toBe(manifest.version);
    expect(PACKAGE_VERSION).toBe(manifest.version);
    const server = compose({ baseUrl: 'http://localhost:3000', credential: '' }, { fetch: vi.fn(async () => new Response('{}')), serverVersion: packageVersion() });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '1.0.0' });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      expect(client.getServerVersion()?.version).toBe(manifest.version);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
