/**
 * `T1639` (EPIC-045, `R-045-8`, `contracts/artifacts-api.md` §1, §4) —
 * `pmi.artifacts.sync` is **live**.
 *
 * The tool the finish hook has been calling since `EPIC-042` now translates to
 * a route instead of refusing. What is asserted here is the whole of the
 * client-side change: the translation, the dropped `epicNumber`, the fact that
 * it is no longer reserved, and — the part most easily broken by accident —
 * that the other two reserved tools still refuse exactly as they did.
 *
 * Written to FAIL before `T1640`.
 */
import { describe, expect, it, afterEach } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { RESERVED_TOOLS as RESERVED_SPECS } from '../src/tools/reserved.js';
import { ARTIFACT_TOOLS } from '../src/tools/artifacts.js';
import { connect, stubPlatform, LIVE_TOOLS, RESERVED_TOOLS } from './server.spec.js';

const ANSWER = { syncId: 'sync_1', epicId: 'epic_3', created: 1, reused: 0, refused: [] };
const FILES = [{ path: 'specs/003-reports/spec.md', digest: 'a'.repeat(64), content: '# Reports\n' }];

let open: { client: Client; server: { close(): Promise<void> } }[] = [];
afterEach(async () => {
  for (const o of open) {
    await o.client.close();
    await o.server.close();
  }
  open = [];
});

describe('T1639 · the tool is live and translates to its route', () => {
  it('POSTs to /v1/projects/me/artifacts/sync with the execution and the files', async () => {
    const { port, calls } = stubPlatform(() => ({ ok: true, status: 201, body: ANSWER }));
    const o = await connect(port);
    open.push(o);
    const result = await o.client.callTool({ name: 'pmi.artifacts.sync', arguments: { executionId: 'exec_1', files: FILES } });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject(ANSWER);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/v1/projects/me/artifacts/sync', surface: 'mcp-client' });
    expect((calls[0]?.body as { executionId: string; files: unknown[] }).executionId).toBe('exec_1');
    expect((calls[0]?.body as { files: unknown[] }).files).toEqual(FILES);
  });

  it('addresses `me`, never a project id — the server never knows one (EPIC-043 T1445)', async () => {
    const { port, calls } = stubPlatform(() => ({ ok: true, status: 201, body: ANSWER }));
    const o = await connect(port);
    open.push(o);
    await o.client.callTool({ name: 'pmi.artifacts.sync', arguments: { executionId: 'exec_1', files: [] } });
    expect(calls[0]?.path).toContain('/projects/me/');
    expect(calls[0]?.path).not.toMatch(/projects\/(?!me\/)/);
  });

  it('forwards an idempotencyKey the hook sent, and lets the platform derive one when absent (R-045-8)', async () => {
    const { port, calls } = stubPlatform(() => ({ ok: true, status: 201, body: ANSWER }));
    const o = await connect(port);
    open.push(o);
    await o.client.callTool({ name: 'pmi.artifacts.sync', arguments: { executionId: 'exec_1', files: FILES, idempotencyKey: 'k_1' } });
    expect((calls[0]?.body as { idempotencyKey?: string }).idempotencyKey).toBe('k_1');
    expect(calls[0]?.idempotencyKey).toBe('k_1');

    await o.client.callTool({ name: 'pmi.artifacts.sync', arguments: { executionId: 'exec_1', files: FILES } });
    expect((calls[1]?.body as { idempotencyKey?: string }).idempotencyKey).toBeUndefined();
  });

  it('accepts epicNumber and DROPS it — the Epic comes from the binding (R-045-2)', async () => {
    const { port, calls } = stubPlatform(() => ({ ok: true, status: 201, body: ANSWER }));
    const o = await connect(port);
    open.push(o);
    const result = await o.client.callTool({ name: 'pmi.artifacts.sync', arguments: { executionId: 'exec_1', files: FILES, epicNumber: 3 } });
    expect(result.isError, 'epicNumber must be tolerated, not refused').toBeFalsy();
    expect(calls[0]?.body).not.toHaveProperty('epicNumber');
  });

  it('is declared mutating, so it is not advertised as read-only', () => {
    const spec = ARTIFACT_TOOLS.find((t) => t.name === 'pmi.artifacts.sync');
    expect(spec?.mutating).toBe(true);
  });

  it('passes a platform refusal through with its structured code', async () => {
    const { port } = stubPlatform(() => ({ ok: false, refusal: { code: 'not_found', message: 'Not found.' } }));
    const o = await connect(port);
    open.push(o);
    const result = await o.client.callTool({ name: 'pmi.artifacts.sync', arguments: { executionId: 'nope', files: [] } });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: 'not_found' });
  });
});

describe('T1639 · it is no longer reserved, and the other two still are', () => {
  it('is absent from RESERVED_TOOLS', () => {
    expect(RESERVED_SPECS.map((t) => t.name)).not.toContain('pmi.artifacts.sync');
  });

  it('leaves exactly two reserved tools, refusing their own Epics (contracts §4)', async () => {
    expect(RESERVED_SPECS.map((t) => t.name).sort()).toEqual(['pmi.execution.sync', 'pmi.tasks.sync']);
    const { port, calls } = stubPlatform();
    const o = await connect(port);
    open.push(o);
    const sync = await o.client.callTool({ name: 'pmi.execution.sync', arguments: { batch: [] } });
    expect(sync.structuredContent).toMatchObject({ code: 'not_available_until', epic: 'EPIC-037' });
    const tasks = await o.client.callTool({ name: 'pmi.tasks.sync', arguments: {} });
    expect(tasks.structuredContent).toMatchObject({ code: 'not_available_until', epic: 'EPIC-046' });
    expect(calls, 'a reserved tool must not reach the platform').toEqual([]);
  });

  it('keeps the surface at fourteen tools — one moved sides, none was added or lost', async () => {
    const { port } = stubPlatform();
    const o = await connect(port);
    open.push(o);
    const { tools } = await o.client.listTools();
    expect(tools).toHaveLength(14);
    expect(tools.map((t) => t.name)).toContain('pmi.artifacts.sync');
    expect([...LIVE_TOOLS, ...RESERVED_TOOLS]).toHaveLength(14);
  });
});
