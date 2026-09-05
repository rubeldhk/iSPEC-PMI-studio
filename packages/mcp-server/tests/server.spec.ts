/**
 * `T1422` (EPIC-043, `contracts/mcp-tool-surface.md`) — the `pmi-studio` server
 * through a real MCP client over an in-memory transport.
 *
 * Fourteen tools (ten live, four reserved), each with an input and an output
 * schema; the contract version declared for a person (`instructions`) and for a
 * program (`pmi.health`); a client naming another version refused before any
 * platform call; a reserved tool validating its arguments and then refusing by
 * naming its Epic. Written to FAIL before `T1425`.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CONTRACT_VERSION } from '@pmi/execution-registry-contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from '../src/server.js';
import type { PlatformCall, PlatformPort, PlatformResult } from '../src/platform-client.js';

export const LIVE_TOOLS = [
  'pmi.execution.register',
  'pmi.execution.appendEvent',
  'pmi.execution.complete',
  'pmi.execution.comment',
  'pmi.execution.proposeStatus',
  'pmi.execution.history',
  'pmi.health',
  'pmi.project.context',
  'pmi.requirements.list',
  // EPIC-042 T1490 (R-042-11): the two reads EPIC-043 reserved, now live.
  'pmi.constitution.get',
  'pmi.project.decompose',
] as const;
export const RESERVED_TOOLS = ['pmi.execution.sync', 'pmi.artifacts.sync', 'pmi.tasks.sync'] as const;

export function stubPlatform(answer: (call: PlatformCall) => PlatformResult = () => ({ ok: true, status: 200, body: {} })) {
  const calls: PlatformCall[] = [];
  const port: PlatformPort = {
    call: vi.fn(async (call: PlatformCall) => {
      calls.push(call);
      return answer(call);
    }),
    describe: () => ({ address: 'localhost:3000', credentialPresent: true }),
  };
  return { port, calls };
}

export async function connect(port: PlatformPort) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(port, { serverVersion: '0.1.0-test' });
  const client = new Client({ name: 'test-harness', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

let open: { client: Client; server: { close(): Promise<void> } }[] = [];
afterEach(async () => {
  for (const o of open) {
    await o.client.close();
    await o.server.close();
  }
  open = [];
});

describe('T1422 · the tool surface', () => {
  it('lists exactly the fourteen tools, each with an input and an output schema', async () => {
    const { port } = stubPlatform();
    const o = await connect(port);
    open.push(o);
    const { tools } = await o.client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...LIVE_TOOLS, ...RESERVED_TOOLS].sort());
    for (const t of tools) {
      expect(t.inputSchema, `${t.name} has no input schema`).toBeDefined();
      expect(t.outputSchema, `${t.name} has no output schema`).toBeDefined();
    }
  });

  it('declares the contract version for a person (instructions) and for a program (pmi.health)', async () => {
    const { port } = stubPlatform((call) =>
      call.path.endsWith('/health')
        ? { ok: true, status: 201, body: { projectId: 'proj_1', contractVersion: CONTRACT_VERSION, apiVersion: '1', serverVersion: '0.1.0-test', connectedAt: 'now' } }
        : { ok: true, status: 200, body: {} },
    );
    const o = await connect(port);
    open.push(o);
    expect(o.client.getInstructions()).toContain(`contract version ${CONTRACT_VERSION}`);
    const result = await o.client.callTool({ name: 'pmi.health', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect((result.structuredContent as { contractVersion: string }).contractVersion).toBe(CONTRACT_VERSION);
  });

  it('refuses a client naming another contract version before any platform call', async () => {
    const { port, calls } = stubPlatform();
    const o = await connect(port);
    open.push(o);
    const result = await o.client.callTool({ name: 'pmi.health', arguments: { contractVersion: '9.9' } });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: 'unsupported_contract_version', supported: CONTRACT_VERSION, received: '9.9' });
    expect(calls).toEqual([]);
  });

  it.each(RESERVED_TOOLS.filter((t) => t !== 'pmi.execution.sync'))('%s validates its arguments, then refuses not_available_until naming its Epic', async (name) => {
    const { port, calls } = stubPlatform();
    const o = await connect(port);
    open.push(o);
    const result = await o.client.callTool({ name, arguments: { epicNumber: 'not-a-number', paths: 'not-a-list' } });
    expect(result.isError).toBe(true);
    // A schema error before the reservation: the client is validated even while the content is absent.
    expect(JSON.stringify(result.structuredContent ?? result.content)).toMatch(/invalid|expected|schema/i);
    const ok = await o.client.callTool({ name, arguments: {} });
    expect(ok.isError).toBe(true);
    expect(ok.structuredContent).toMatchObject({ code: 'not_available_until', epic: expect.stringMatching(/^EPIC-04[256]$/) });
    expect(calls).toEqual([]);
  });

  it('pmi.execution.sync is listed and refuses not_available_until EPIC-037 (FR-PIC-034)', async () => {
    const { port } = stubPlatform();
    const o = await connect(port);
    open.push(o);
    const result = await o.client.callTool({ name: 'pmi.execution.sync', arguments: { batch: [] } });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: 'not_available_until', epic: 'EPIC-037' });
  });

  it('a live execution tool translates to its route with the surface header and forwards the idempotency key unchanged', async () => {
    const { port, calls } = stubPlatform(() => ({ ok: true, status: 201, body: { executionId: 'exec_1', workspaceId: 'ws_a', command: 'specify', surface: 'mcp-client', assurance: 'local', lifecycleState: 'registered', governanceState: 'governed', projectedThroughSequence: 1, parentExecutionId: null } }));
    const o = await connect(port);
    open.push(o);
    const result = await o.client.callTool({
      name: 'pmi.execution.register',
      arguments: { command: 'specify', argsSanitized: {}, input: { targetType: 'project', targetId: 'proj_1' }, correlationId: 'corr_1', idempotencyKey: 'k_1' },
    });
    expect(result.isError).toBeFalsy();
    expect((result.structuredContent as { executionId: string }).executionId).toBe('exec_1');
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/v1/executions', surface: 'mcp-client', idempotencyKey: 'k_1' });
    expect(calls[0]?.body).toMatchObject({ command: 'specify', idempotencyKey: 'k_1' });
    // Never sent: what the platform derives.
    for (const field of ['workspaceId', 'projectId', 'identity', 'surface', 'assurance']) expect(calls[0]?.body).not.toHaveProperty(field);
  });

  it('a platform refusal comes back as isError with its structured code, never a protocol error', async () => {
    const { port } = stubPlatform(() => ({ ok: false, refusal: { code: 'delegation_missing', message: 'No delegation authorises registration.' } }));
    const o = await connect(port);
    open.push(o);
    const result = await o.client.callTool({ name: 'pmi.execution.history', arguments: { executionId: 'exec_1' } });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: 'delegation_missing' });
  });
});

describe('T1443 · replay passthrough (US3)', () => {
  it('forwards the same idempotency key unchanged on a retry and returns whatever the platform answers', async () => {
    let calls = 0;
    const { port, calls: seen } = stubPlatform(() => ({ ok: true, status: 201, body: { executionId: 'exec_1', replayed: (calls += 1) > 1 } }));
    const o = await connect(port);
    open.push(o);
    const args = { command: 'specify', argsSanitized: {}, input: { targetType: 'project', targetId: 'proj_1' }, correlationId: 'corr_1', idempotencyKey: 'k_retry' };
    const first = await o.client.callTool({ name: 'pmi.execution.register', arguments: args });
    const again = await o.client.callTool({ name: 'pmi.execution.register', arguments: args });
    expect(seen.map((c) => c.idempotencyKey)).toEqual(['k_retry', 'k_retry']);
    expect((first.structuredContent as { executionId: string }).executionId).toBe('exec_1');
    expect((again.structuredContent as { replayed: boolean }).replayed).toBe(true);
  });
});

describe('T1469 · a correlation id on every mutating tool (FR-PIC-004)', () => {
  it('appendEvent, complete and comment accept an optional correlationId and it reaches the platform call', async () => {
    const { port, calls } = stubPlatform(() => ({ ok: true, status: 201, body: { sequence: 2, commentId: 'c_1' } }));
    const o = await connect(port);
    open.push(o);
    await o.client.callTool({ name: 'pmi.execution.appendEvent', arguments: { executionId: 'e', type: 'started', payload: {}, occurredAt: 'now', idempotencyKey: 'k1', correlationId: 'corr-1' } });
    await o.client.callTool({ name: 'pmi.execution.complete', arguments: { executionId: 'e', outcome: 'completed', occurredAt: 'now', completionComment: 'x', idempotencyKey: 'k2', correlationId: 'corr-2' } });
    await o.client.callTool({ name: 'pmi.execution.comment', arguments: { executionId: 'e', body: 'b', idempotencyKey: 'k3', correlationId: 'corr-3' } });
    expect(calls.map((c) => c.correlationId)).toEqual(['corr-1', 'corr-2', 'corr-3']);
    await o.client.callTool({ name: 'pmi.execution.comment', arguments: { executionId: 'e', body: 'b', idempotencyKey: 'k4' } });
    expect(calls[3]?.correlationId).toBeUndefined();
  });
});
