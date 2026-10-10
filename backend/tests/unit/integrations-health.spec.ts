/**
 * `T2168`, `T2244` (EPIC-039, `FR-HUB-026`, `FR-HUB-027`, `FR-HUB-047`,
 * `R-039-6`) — derived health and the scheduled job handler.
 *
 * Written to FAIL before `T2169`.
 */
import type { AdapterContext, CapabilityAdapter, HealthObservation } from '@pmi/capability-contract';
import { describe, expect, it } from 'vitest';
import { AdapterCatalog } from '../../src/modules/integrations/catalog.service.js';
import { CHECK_CONCURRENCY, HealthService, MAX_CHECKS_PER_TICK } from '../../src/modules/integrations/health/health.service.js';
import { InMemoryIntegrationsStore } from '../../src/modules/integrations/integrations.store.js';
import { OWNER, PROJECT, WS, configure, testHub } from './integrations-hub.fixture.js';

describe('T2168 · derived health (FR-HUB-027)', () => {
  it('reads unknown / never-checked, then the latest check, then unknown / stale', async () => {
    const hub = testHub();
    const e = await hub.entry('fixture-ci');
    await hub.configuration.put({ workspaceId: WS, userId: OWNER }, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: e.id, preference: 1 }], healthIntervalSeconds: 120 });
    expect(await hub.health.derive(WS, PROJECT, e.id)).toMatchObject({ state: 'unknown', reason: 'never-checked' });
    await hub.health.runDueHealthChecks();
    expect(await hub.health.derive(WS, PROJECT, e.id)).toMatchObject({ state: 'healthy' });
    hub.clock.advance(121_000);
    expect(await hub.health.derive(WS, PROJECT, e.id)).toMatchObject({ state: 'unknown', reason: expect.stringMatching(/^stale \(last checked /) });
  });

  it('the effective interval is the minimum over the project\'s configurations naming the adapter', async () => {
    const hub = testHub();
    const e = await hub.entry('fixture-ci');
    await hub.configuration.put({ workspaceId: WS, userId: OWNER }, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: e.id, preference: 1 }], healthIntervalSeconds: 600 });
    await hub.configuration.put({ workspaceId: WS, userId: OWNER }, PROJECT, 'ReadTestResults', { adapters: [{ registryEntryId: e.id, preference: 1 }], healthIntervalSeconds: 90 });
    expect(await hub.health.intervalFor(WS, PROJECT, e.id)).toBe(90);
  });
});

describe('T2168 · the job handler', () => {
  it('records the scripted state with its reason, and skips a pair checked within its interval', async () => {
    const hub = testHub();
    const e = await hub.entry('fixture-ci');
    await hub.configuration.put({ workspaceId: WS, userId: OWNER }, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: e.id, preference: 1, binding: { script: { health: 'unhealthy', healthReason: 'provider-unreachable' } } }] });
    expect(await hub.health.runDueHealthChecks()).toMatchObject({ checked: 1, recorded: 1 });
    expect(await hub.store.latestCheck(WS, PROJECT, e.id)).toMatchObject({ state: 'unhealthy', reason: 'provider-unreachable', source: 'scheduled' });
    expect(await hub.health.runDueHealthChecks()).toMatchObject({ checked: 0 });
  });

  it('a degraded check carries the provider\'s retry hint', async () => {
    const hub = testHub();
    const e = await hub.entry('fixture-ci');
    await hub.configuration.put({ workspaceId: WS, userId: OWNER }, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: e.id, preference: 1, binding: { script: { invoke: 'throttled' } } }] });
    await hub.health.runDueHealthChecks();
    expect(await hub.store.latestCheck(WS, PROJECT, e.id)).toMatchObject({ state: 'degraded', reason: 'provider-throttled', retryAfterSeconds: 30 });
  });

  it(`selects at most ${MAX_CHECKS_PER_TICK} due pairs per tick, ${CHECK_CONCURRENCY} at a time`, async () => {
    expect(MAX_CHECKS_PER_TICK).toBe(50);
    expect(CHECK_CONCURRENCY).toBe(4);
    let running = 0;
    let peak = 0;
    let calls = 0;
    const slow: CapabilityAdapter = {
      descriptor: { key: 'slow', name: 'slow', provider: 'test', transport: 'native-api', version: '1', implements: [{ capability: 'ReadBuildStatus', majors: [1] }], credentialKinds: [], credentialRequired: false, bindingSchema: { type: 'object' }, scopeMapping: { 'ci.checks': ['x'] } },
      invoke: async () => ({ ok: false, errorCategory: 'adapter-fault', message: 'n/a' }),
      checkHealth: async (_c: AdapterContext): Promise<HealthObservation> => {
        calls += 1;
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 5));
        running -= 1;
        return { state: 'healthy' };
      },
    };
    const hub = testHub({ catalog: new AdapterCatalog([slow]) });
    const e = await hub.entry('slow');
    for (let i = 0; i < 60; i++) {
      await hub.store.putConfiguration({ workspaceId: WS, projectId: `p${i}`, capability: 'ReadBuildStatus', adapters: [{ registryEntryId: e.id, preference: 1 }], permitDegraded: false, permittedEnvironments: ['local'], onNotNarrowable: 'proceed-and-record', healthIntervalSeconds: 300, providerBinding: {}, decisionId: 'd', updatedBy: OWNER });
    }
    const report = await hub.health.runDueHealthChecks();
    expect(report.checked).toBe(50);
    expect(calls).toBe(50);
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
  });

  it('a check that does not answer in 5 s is recorded unhealthy / timed-out', async () => {
    const hang: CapabilityAdapter = {
      descriptor: { key: 'hang', name: 'hang', provider: 'test', transport: 'native-api', version: '1', implements: [{ capability: 'ReadBuildStatus', majors: [1] }], credentialKinds: [], credentialRequired: false, bindingSchema: { type: 'object' }, scopeMapping: { 'ci.checks': ['x'] } },
      invoke: async () => ({ ok: false, errorCategory: 'adapter-fault', message: 'n/a' }),
      checkHealth: (ctx) => new Promise((resolve) => ctx.signal.addEventListener('abort', () => resolve({ state: 'healthy' }))),
    };
    const hub = testHub({ catalog: new AdapterCatalog([hang]) });
    const e = await hub.entry('hang');
    await hub.configuration.put({ workspaceId: WS, userId: OWNER }, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: e.id, preference: 1 }] });
    const started = Date.now();
    await hub.health.runDueHealthChecks();
    expect(Date.now() - started).toBeLessThan(7000);
    expect(await hub.store.latestCheck(WS, PROJECT, e.id)).toMatchObject({ state: 'unhealthy', reason: 'timed-out' });
  }, 10_000);
});

describe('T2244 (U2) · concurrent instances record one check per pair per interval', () => {
  it('two handlers over one store: both probe, one row', async () => {
    const hub = testHub();
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    const e = (await hub.store.findEntryByKey(WS, 'fixture-ci'))!;
    hub.clock.advance(301_000); // the configure() check is now stale: due again
    const second = new HealthService({ store: hub.store, catalog: hub.catalog, vault: hub.vault, clock: () => hub.clock.now });
    const [a, b] = await Promise.all([hub.health.runDueHealthChecks(), second.runDueHealthChecks()]);
    expect(a.recorded + b.recorded).toBe(1);
    const scheduled = (await hub.store.listChecks(WS, e.id, { limit: 10 })).filter((c) => c.source === 'scheduled');
    expect(scheduled).toHaveLength(1);
  });

  it('the in-memory store is the same rule the database index enforces', async () => {
    const s = new InMemoryIntegrationsStore();
    const row = { workspaceId: WS, projectId: PROJECT, registryEntryId: 'e', state: 'healthy' as const, adapterVersion: '1', checkedAt: new Date(), durationMs: 1, intervalBucket: 3 };
    expect([await s.recordScheduledCheck(row), await s.recordScheduledCheck(row)]).toEqual([true, false]);
  });
});
