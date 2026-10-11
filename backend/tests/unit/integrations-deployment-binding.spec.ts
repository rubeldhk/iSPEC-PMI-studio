/**
 * `T2200` (EPIC-039, `US7` AS4, `FR-HUB-084`, analysis I1) — the deployment's
 * `Embed` binding is deployment configuration **read at boot** from
 * `PMI_EMBED_ADAPTER` / `PMI_EMBED_BINDING`:
 *
 * - unset → unbound;
 * - an unknown key, an adapter not implementing `Embed`, an unlisted model, or
 *   a secret-looking binding → bound-but-ineligible with the reason named,
 *   never a guessed dimension;
 * - `observedModel` and `modelId` recorded;
 * - a `deployment_capability_bindings` row appended only when the observation
 *   differs from the latest, `reindexRequired: true` when `modelId` changed;
 * - there is NO write method a route or a workspace grant could reach.
 *
 * Written to FAIL before `T2201`.
 */
import { CAPABILITY_CONTRACTS } from '@pmi/capability-contract';
import { describe, expect, it } from 'vitest';
import { createAdapterCatalog } from '../../src/composition/integration-adapters.js';
import { DeploymentBindingService } from '../../src/modules/integrations/embedding/deployment-binding.service.js';
import { InMemoryIntegrationsStore } from '../../src/modules/integrations/integrations.store.js';

const NOW = new Date('2026-10-10T12:00:00Z');

function store(): InMemoryIntegrationsStore {
  return new InMemoryIntegrationsStore(CAPABILITY_CONTRACTS.map((d, i) => ({ id: `cv_${i}`, name: d.name, scope: d.scope, major: d.major, minor: d.minor, status: 'approved' as const, document: d as unknown as Record<string, unknown>, changesState: d.changesState })));
}

async function boot(s: InMemoryIntegrationsStore, env: Record<string, string | undefined>): Promise<DeploymentBindingService> {
  const service = new DeploymentBindingService({ store: s, catalog: createAdapterCatalog(), clock: () => NOW, env });
  await service.observeAtBoot();
  return service;
}

describe('T2200 · the Embed binding, read at boot (FR-HUB-084)', () => {
  it('unset → unbound, recorded once with the reason not-bound', async () => {
    const s = store();
    const svc = await boot(s, {});
    expect(svc.snapshot()).toMatchObject({ capability: 'Embed', bound: false, eligible: false, adapterKey: null, reason: 'not-bound' });
    expect(await s.listObservations('Embed', 10)).toEqual([expect.objectContaining({ adapterKey: null, health: 'unhealthy', reason: 'not-bound', observedBy: 'system:deployment-config' })]);
  });

  it('fixture-embed → bound and eligible; observedModel and modelId recorded; reindexRequired on the first model', async () => {
    const s = store();
    const svc = await boot(s, { PMI_EMBED_ADAPTER: 'fixture-embed' });
    expect(svc.snapshot()).toMatchObject({ bound: true, eligible: true, adapterKey: 'fixture-embed', dimension: 27, modelId: 'fixture-embed:fixture-letters@sha256:fixture-letters-1', health: 'healthy' });
    const [row] = await s.listObservations('Embed', 10);
    expect(row).toMatchObject({ adapterKey: 'fixture-embed', observedModel: { model: 'fixture-letters', version: 'sha256:fixture-letters-1', dimension: 27 }, modelId: 'fixture-embed:fixture-letters@sha256:fixture-letters-1', previousModelId: null, reindexRequired: true, health: 'healthy', reason: null });
  });

  it('DEF-039-001 · an unreachable store does not abort boot; the next recheck records the observation', async () => {
    const s = store();
    let down = true;
    const flaky = new Proxy(s, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver) as unknown;
        if (down && (prop === 'latestObservation' || prop === 'appendObservation')) return async () => { throw new Error("Can't reach database server"); };
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
      },
    });
    const service = new DeploymentBindingService({ store: flaky, catalog: createAdapterCatalog(), clock: () => NOW, env: { PMI_EMBED_ADAPTER: 'fixture-embed' } });
    await expect(service.observeAtBoot()).resolves.toMatchObject({ adapterKey: 'fixture-embed', eligible: true });
    expect(service.snapshot()).toMatchObject({ eligible: true, dimension: 27 });
    expect(service.recordingFault()).toMatch(/reach database/);
    down = false;
    await service.recheck();
    expect(service.recordingFault()).toBeNull();
    expect(await s.listObservations('Embed', 10)).toEqual([expect.objectContaining({ adapterKey: 'fixture-embed', observedBy: 'system:health' })]);
  });

  it('a reboot with the same configuration appends nothing', async () => {
    const s = store();
    await boot(s, { PMI_EMBED_ADAPTER: 'fixture-embed' });
    await boot(s, { PMI_EMBED_ADAPTER: 'fixture-embed' });
    expect(await s.listObservations('Embed', 10)).toHaveLength(1);
  });

  it('a changed model version is a new row with reindexRequired: true naming the previous modelId (US7 AS4)', async () => {
    const s = store();
    await boot(s, { PMI_EMBED_ADAPTER: 'fixture-embed' });
    const svc = await boot(s, { PMI_EMBED_ADAPTER: 'fixture-embed', PMI_EMBED_BINDING: JSON.stringify({ script: { modelDigest: 'sha256:fixture-letters-2' } }) });
    expect(svc.snapshot().modelId).toBe('fixture-embed:fixture-letters@sha256:fixture-letters-2');
    const latest = await s.latestObservation('Embed');
    expect(latest).toMatchObject({ modelId: 'fixture-embed:fixture-letters@sha256:fixture-letters-2', previousModelId: 'fixture-embed:fixture-letters@sha256:fixture-letters-1', reindexRequired: true });
  });

  it('a health change alone is recorded without reindexRequired', async () => {
    const s = store();
    await boot(s, { PMI_EMBED_ADAPTER: 'fixture-embed' });
    await boot(s, { PMI_EMBED_ADAPTER: 'fixture-embed', PMI_EMBED_BINDING: JSON.stringify({ script: { health: 'unhealthy', healthReason: 'model-not-present' } }) });
    expect(await s.latestObservation('Embed')).toMatchObject({ health: 'unhealthy', reason: 'model-not-present', reindexRequired: false });
  });

  it.each([
    ['an unknown key', { PMI_EMBED_ADAPTER: 'no-such-adapter' }, /not in this build/],
    ['an adapter not implementing Embed', { PMI_EMBED_ADAPTER: 'fixture-ci' }, /does not implement Embed/],
    ['an unlisted model', { PMI_EMBED_ADAPTER: 'ollama-embed', PMI_EMBED_BINDING: JSON.stringify({ model: 'unlisted-model' }) }, /model/],
    ['a secret-looking binding', { PMI_EMBED_ADAPTER: 'fixture-embed', PMI_EMBED_BINDING: JSON.stringify({ model: 'ghp_abcdefghijklmnopqrstuvwxyz0123456789' }) }, /secret/],
    ['a binding that is not JSON', { PMI_EMBED_ADAPTER: 'fixture-embed', PMI_EMBED_BINDING: '{nope' }, /JSON/],
  ])('%s → bound but ineligible, the reason named, no dimension guessed', async (_name, env, why) => {
    const s = store();
    const svc = await boot(s, env);
    const snap = svc.snapshot();
    expect(snap).toMatchObject({ bound: true, eligible: false, dimension: null, modelId: null });
    expect(snap.explanation).toMatch(why);
    const [row] = await s.listObservations('Embed', 10);
    expect(row).toMatchObject({ health: 'unhealthy', observedModel: null, modelId: null });
    expect(['binding-invalid', 'model-not-listed']).toContain(row!.reason);
    expect(JSON.stringify(row)).not.toContain('ghp_');
  });

  it('the ticker re-observes health and appends only on change (system:health)', async () => {
    const s = store();
    const svc = await boot(s, { PMI_EMBED_ADAPTER: 'fixture-embed' });
    await svc.recheck();
    expect(await s.listObservations('Embed', 10)).toHaveLength(1);
  });

  it('there is no write method: nothing a route or a workspace grant could reach', () => {
    const proto = Object.getOwnPropertyNames(DeploymentBindingService.prototype);
    for (const name of proto) expect(name).not.toMatch(/^(set|put|bind|unbind|switch|update|delete|remove|grant)/i);
  });
});
