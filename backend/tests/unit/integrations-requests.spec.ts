/**
 * `T2147` (EPIC-039, `FR-HUB-001`, `FR-HUB-016`, `FR-HUB-038`, `FR-HUB-039`,
 * `FR-HUB-045`, `FR-HUB-047`) — the `CapabilityRequests` service in-process
 * callers use, and the route wraps.
 *
 * Written to FAIL before `T2148`.
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import { OWNER, PROJECT, SHA, WS, configure, testHub } from './integrations-hub.fixture.js';

const actor = { workspaceId: WS, userId: OWNER };
const body = (over: Record<string, unknown> = {}) => ({ capability: 'ReadBuildStatus', major: 1, caller: 'room:change', input: { revision: SHA }, ...over });

describe('T2147 · a request through the fixture', () => {
  it('validates, resolves, invokes once, writes exactly one invocation, and returns the result', async () => {
    const hub = testHub();
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    const r = await hub.requests.request(actor, PROJECT, body(), { http: true });
    expect(r).toMatchObject({ outcome: 'resolved', invocation: { outcome: 'succeeded' }, result: { revision: SHA, state: 'success', final: true } });
    expect(r.resolution).toMatchObject({ adapterKey: 'fixture-ci', provider: 'fixture', contractVersion: '1.0' });
    expect(await hub.store.findInvocation(r.resolutionId)).toMatchObject({ outcome: 'succeeded' });
  });

  it('refuses a malformed input with 400 before resolving', async () => {
    const hub = testHub();
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    await expect(hub.requests.request(actor, PROJECT, body({ input: { revision: 'main' } }), { http: true })).rejects.toThrow(ValidationFailedError);
    expect(await hub.store.listResolutions(WS, { projectId: PROJECT })).toEqual([]);
  });

  it('refuses credential material in the input, recorded, never invoked (FR-HUB-045)', async () => {
    const hub = testHub();
    await configure(hub, 'ReadRepository', ['fixture-git']);
    const r = await hub.requests.request(actor, PROJECT, body({ capability: 'ReadRepository', input: { revision: 'ghp_abcdefghijklmnopqrstuvwxyz0123', mode: 'tree' } }), { http: true });
    expect(r).toMatchObject({ outcome: 'refused', refusal: { code: 'credential-material-in-content' } });
    expect(r.invocation).toBeUndefined();
  });

  it.each([
    [{ adapter: 'github-rest' }],
    [{ provider: 'github' }],
    [{ transport: 'native-api' }],
    [{ registryEntryId: 'x' }],
    [{ input: { revision: SHA, via: 'fixture-ci' } }],
  ])('refuses a body that pins a provider: %j → provider-pinned (US1 AS3)', async (over) => {
    const hub = testHub();
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    const r = await hub.requests.request(actor, PROJECT, body(over), { http: true });
    expect(r).toMatchObject({ outcome: 'refused', refusal: { code: 'provider-pinned' } });
  });

  it('refuses Embed here — it is resolved at deployment scope (400)', async () => {
    const hub = testHub();
    await expect(hub.requests.request(actor, PROJECT, body({ capability: 'Embed', input: { texts: ['a'] } }), { http: true })).rejects.toThrow(/deployment scope/);
  });

  it('a non-conforming adapter output is an adapter-fault and is never returned (FR-HUB-016)', async () => {
    const hub = testHub();
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    const e = (await hub.store.findEntryByKey(WS, 'fixture-ci'))!;
    await hub.configuration.put(actor, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: e.id, preference: 1, binding: { script: { invoke: 'non-conforming' } } }] });
    const r = await hub.requests.request(actor, PROJECT, body(), { http: true });
    expect(r).toMatchObject({ outcome: 'resolved', invocation: { outcome: 'adapter-fault', errorCategory: 'adapter-fault' } });
    expect(r.result).toBeUndefined();
  });

  it('a credential rejection marks the adapter unhealthy at once; a throttle marks it degraded with the hint (FR-HUB-047)', async () => {
    const hub = testHub();
    const e = await hub.entry('fixture-ci');
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    await hub.configuration.put(actor, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: e.id, preference: 1, binding: { script: { invoke: 'credential-rejected' } } }] });
    hub.clock.advance(1000);
    const r = await hub.requests.request(actor, PROJECT, body(), { http: true });
    expect(r.invocation).toMatchObject({ outcome: 'failed', errorCategory: 'credential-rejected' });
    expect(await hub.store.latestCheck(WS, PROJECT, e.id)).toMatchObject({ state: 'unhealthy', reason: 'credential-rejected', source: 'request' });

    hub.clock.advance(1000);
    await hub.store.appendCheck({ workspaceId: WS, projectId: PROJECT, registryEntryId: e.id, state: 'healthy', adapterVersion: '0.1.0', source: 'request', checkedAt: hub.clock.now, durationMs: 1 });
    await hub.configuration.put(actor, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: e.id, preference: 1, binding: { script: { invoke: 'throttled' } } }] });
    hub.clock.advance(1000);
    const t = await hub.requests.request(actor, PROJECT, body(), { http: true });
    expect(t.invocation).toMatchObject({ outcome: 'failed', errorCategory: 'provider-throttled', retryAfterSeconds: 30 });
    expect(await hub.store.latestCheck(WS, PROJECT, e.id)).toMatchObject({ state: 'degraded', reason: 'provider-throttled', retryAfterSeconds: 30 });
  });

  it('a success writes no health row — one success is not a health check', async () => {
    const hub = testHub();
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    const e = (await hub.store.findEntryByKey(WS, 'fixture-ci'))!;
    const before = (await hub.store.listChecks(WS, e.id, { limit: 100 })).length;
    await hub.requests.request(actor, PROJECT, body(), { http: true });
    expect((await hub.store.listChecks(WS, e.id, { limit: 100 })).length).toBe(before);
  });
});

describe('T2147 · the execution event (FR-HUB-038)', () => {
  it('appends capability-resolved to the execution named, keyed by the resolution', async () => {
    const hub = testHub();
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    const r = await hub.requests.request(actor, PROJECT, body({ executionId: 'ex_1' }), { http: true });
    expect(hub.events.rows).toEqual([
      expect.objectContaining({ workspaceId: WS, executionId: 'ex_1', resolutionId: r.resolutionId, payload: expect.objectContaining({ capability: 'ReadBuildStatus', outcome: 'resolved', adapterKey: 'fixture-ci' }) }),
    ]);
    expect(JSON.stringify(hub.events.rows)).not.toContain('scopeGranted');
  });

  it('appends it for a refusal too, and refuses an execution that does not exist (400)', async () => {
    const hub = testHub();
    const r = await hub.requests.request(actor, PROJECT, body({ capability: 'ReadSecrets', executionId: 'ex_1' }), { http: true });
    expect(hub.events.rows[0]).toMatchObject({ resolutionId: r.resolutionId, payload: expect.objectContaining({ outcome: 'refused', refusalCode: 'unknown-capability' }) });
    await expect(hub.requests.request(actor, PROJECT, body({ executionId: 'ex_nope' }), { http: true })).rejects.toThrow(ValidationFailedError);
  });
});
