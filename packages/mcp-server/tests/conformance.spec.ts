/**
 * `T1428` (EPIC-043, `R-037-10`, `SC-PIC-001`) — the fixture connector is the
 * conformance oracle, and it runs against the MCP server through a real client.
 *
 * `registryOverClient` implements `ExecutionRegistry` over an MCP `Client`; the
 * server's platform port is a stub that behaves like the mounted routes. The
 * fixture's expectations (`T1029`) are asserted unchanged. Written to FAIL
 * before `T1429`.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { AppendedEvent, ExecutionSnapshot } from '@pmi/execution-registry-contract';
import { FixtureConnector } from '@pmi/execution-registry-contract/fixture';
import { afterEach, describe, expect, it } from 'vitest';
import type { PlatformCall, PlatformPort, PlatformResult } from '../src/platform-client.js';
import { registryOverClient } from '../src/registry-adapter.js';
import { createServer } from '../src/server.js';

const IDENTITY = {
  authenticatedPrincipalId: 'p_agent',
  agentSnapshotId: 'snap_agent',
  connectorRegistrationId: 'conn_1',
  sponsorUserId: 'u_sponsor',
  delegationId: 'd_1',
  delegationIdentityVersion: 1,
};

/** A platform that behaves like the mounted routes: registers, sequences, refuses after terminal. */
function platformStub() {
  const seen: PlatformCall[] = [];
  let sequence = 0;
  let terminal = false;
  const event = (type: string): AppendedEvent => ({ eventId: `ev${(sequence += 1)}`, executionId: 'exec_1', sequence, type: type as AppendedEvent['type'], recordedAt: '2026-09-04T00:00:00.000Z', replayed: false });
  const snapshot = (): ExecutionSnapshot => ({ executionId: 'exec_1', workspaceId: 'ws_a', command: 'specify', surface: 'mcp-client', assurance: 'local', lifecycleState: terminal ? 'completed' : 'registered', governanceState: 'governed', projectedThroughSequence: sequence, parentExecutionId: null });
  const port: PlatformPort = {
    describe: () => ({ address: 'stub', credentialPresent: true }),
    call: async (call: PlatformCall): Promise<PlatformResult> => {
      seen.push(call);
      if (call.method === 'POST' && call.path === '/v1/executions') {
        event('registered');
        return { ok: true, status: 201, body: snapshot() };
      }
      if (call.path.endsWith('/events')) {
        if (terminal) return { ok: false, refusal: { code: 'lifecycle_terminal', message: 'terminal' } };
        return { ok: true, status: 201, body: event(String((call.body as { type: string }).type)) };
      }
      if (call.path.endsWith('/completion')) {
        terminal = true;
        return { ok: true, status: 201, body: event('completed') };
      }
      if (call.path.endsWith('/proposals')) return { ok: true, status: 202, body: event('status-transition-proposed') };
      if (call.path.endsWith('/history')) return { ok: true, status: 200, body: [] };
      if (/\/v1\/executions\/[^/]+$/.test(call.path) && call.method === 'GET') return { ok: true, status: 200, body: snapshot() };
      return { ok: false, refusal: { code: 'not_found', message: 'Not found.' } };
    },
  };
  return { port, seen };
}

let cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const c of cleanup) await c();
  cleanup = [];
});

async function harness() {
  const { port, seen } = platformStub();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(port, { serverVersion: '0.1.0-test' });
  const client = new Client({ name: 'conformance', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  cleanup.push(async () => {
    await client.close();
    await server.close();
  });
  const registry = registryOverClient(client);
  const connector = new FixtureConnector(registry, { workspaceId: 'ws_a', surface: 'mcp-client', identity: IDENTITY, correlationId: 'corr_1' });
  return { connector, seen, registry };
}

describe('T1428 · the fixture connector against the MCP server (R-037-10)', () => {
  it('registers, starts and completes in order, and the completion carries output and a comment', async () => {
    const { connector, seen } = await harness();
    const result = await connector.run({
      command: 'specify',
      args: { feature: 'Apollo' },
      binding: { targetType: 'project', targetId: 'proj_1', targetVersion: 1 },
      output: { commitAfter: 'abc123', generatedArtifactDigests: ['sha256:1'] },
      comment: 'done',
    });
    expect(result.snapshot.executionId).toBe('exec_1');
    expect(result.started.sequence).toBeLessThan(result.completed.sequence);
    const paths = seen.map((c) => `${c.method} ${c.path}`);
    expect(paths).toEqual(['POST /v1/executions', 'POST /v1/executions/exec_1/events', 'POST /v1/executions/exec_1/completion']);
    const completion = seen[2]?.body as { completionComment: string; output: unknown };
    expect(completion.completionComment).toBe('done');
    expect(completion.output).toEqual({ commitAfter: 'abc123', generatedArtifactDigests: ['sha256:1'] });
  });

  it('never sends commitAfter at registration, and never sends identity, workspace or surface over the wire', async () => {
    const { connector, seen } = await harness();
    await connector.register({ command: 'plan', args: {}, binding: { targetType: 'project', targetId: 'proj_1', targetVersion: 1 } });
    const body = seen[0]?.body as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain('commitAfter');
    for (const field of ['identity', 'workspaceId', 'surface', 'assurance']) expect(body).not.toHaveProperty(field);
    expect(seen[0]?.surface).toBe('mcp-client');
  });

  it('gives register, start and complete distinct idempotency keys', async () => {
    const { connector, seen } = await harness();
    await connector.run({ command: 'tasks', args: {}, binding: { targetType: 'project', targetId: 'proj_1', targetVersion: 1 }, output: { commitAfter: 'c' }, comment: 'ok' });
    const keys = seen.map((c) => c.idempotencyKey);
    expect(new Set(keys).size).toBe(3);
  });

  it('a refusal after terminal comes back as the contract\'s typed rejection', async () => {
    const { connector, registry } = await harness();
    const run = await connector.run({ command: 'implement', args: {}, binding: { targetType: 'project', targetId: 'proj_1', targetVersion: 1 }, output: { commitAfter: 'c' }, comment: 'ok' });
    await expect(
      registry.appendEvent({ executionId: run.snapshot.executionId, workspaceId: 'ws_a', type: 'progress-reported', payload: {}, occurredAt: 'now', identity: IDENTITY, idempotencyKey: 'late' }),
    ).rejects.toMatchObject({ refusal: 'lifecycle_terminal' });
  });

  it('exposes no apply, approve or patch — the adapter is the contract, no wider', () => {
    const { registry } = { registry: registryOverClient(new Client({ name: 'x', version: '1' })) };
    for (const forbidden of ['applyTransition', 'approve', 'setStatus', 'patch']) {
      expect((registry as unknown as Record<string, unknown>)[forbidden]).toBeUndefined();
    }
  });
});
