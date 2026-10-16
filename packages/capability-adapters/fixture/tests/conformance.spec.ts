/**
 * `T2139` (EPIC-039, `FR-HUB-060`) — the fixture read adapters pass the shared
 * conformance suite (`T2123`).
 *
 * They are complete providers, not mocks (`R-039-9`): scriptable health,
 * throttling, non-final runs and a deliberately non-conforming output for
 * `FR-HUB-016`, all reachable through the project's non-secret binding — which
 * is how a project without a Git host exercises the Hub, and how the backend's
 * route tests script them through `AppModule`.
 *
 * Written to FAIL before `T2140`.
 */
import { capabilityConformanceSuite, type CapabilityConformanceHarness } from '@pmi/capability-contract/conformance';
import { createCredentialHandle, type AdapterContext, type CapabilityAdapter, type CapabilityName } from '@pmi/capability-contract';
import { describe, expect, it } from 'vitest';
import { FixtureCiAdapter, FixtureGitAdapter, type FixtureAdapter } from '../src/index.js';

const SECRET = 'pmi-canary-11111111-2222-3333-4444-555555555555';
const SHA = 'a'.repeat(40);

function context(adapter: CapabilityAdapter, binding: Record<string, unknown> = {}): AdapterContext {
  return {
    workspaceId: 'ws',
    projectId: 'pr',
    binding,
    credential: createCredentialHandle(SECRET, 'fixture-token'),
    scope: { requested: { access: 'read', resources: [] }, granted: [], narrowing: 'exact' },
    signal: new AbortController().signal,
    timeoutMs: 1000,
  };
}

function harness(capability: CapabilityName, make: () => FixtureAdapter, validInput: () => unknown): CapabilityConformanceHarness {
  return {
    capability,
    adapter: make,
    context: (a) => context(a),
    validInput,
    inject: (a, scenario) => (a as FixtureAdapter).inject(scenario),
    supports: ['throttled', 'credential-rejected', 'revision-not-found', 'unhealthy', 'provider-error', ...(capability === 'ReadRepository' ? [] : (['non-final'] as const))],
    credentialSecret: SECRET,
  };
}

capabilityConformanceSuite('fixture-git', harness('ReadRepository', () => new FixtureGitAdapter(), () => ({ revision: 'main', mode: 'tree' })));
capabilityConformanceSuite('fixture-ci', harness('ReadBuildStatus', () => new FixtureCiAdapter(), () => ({ revision: SHA })));
capabilityConformanceSuite('fixture-ci', harness('ReadTestResults', () => new FixtureCiAdapter(), () => ({ revision: SHA })));

describe('T2139 · the fixtures are scripted through the binding, as a project would', () => {
  it('reads the script from the binding: unhealthy with its reason', async () => {
    const a = new FixtureCiAdapter();
    const h = await a.checkHealth(context(a, { script: { health: 'unhealthy', healthReason: 'credential-rejected' } }));
    expect(h).toMatchObject({ state: 'unhealthy', reason: 'credential-rejected' });
  });

  it('runs non-final until the configured number of reads, then final (Q17)', async () => {
    const a = new FixtureCiAdapter();
    const ctx = { ...context(a, { script: { finalAfterReads: 2 } }), capability: 'ReadTestResults' as const, contractVersion: '1.0', input: { revision: SHA } };
    const first = await a.invoke(ctx);
    const second = await a.invoke(ctx);
    const third = await a.invoke(ctx);
    expect([first, second, third].map((r) => (r.ok ? (r.output as { final: boolean }).final : null))).toEqual([false, false, true]);
  });

  it('can return a non-conforming output, which the Hub must refuse (FR-HUB-016)', async () => {
    const a = new FixtureCiAdapter();
    const r = await a.invoke({ ...context(a, { script: { invoke: 'non-conforming' } }), capability: 'ReadBuildStatus', contractVersion: '1.0', input: { revision: SHA } });
    expect(r.ok).toBe(true);
    expect((r as { output: Record<string, unknown> }).output['state']).toBe('almost');
  });

  it('uses the credential only through the handle, and never echoes it', async () => {
    const a = new FixtureGitAdapter();
    const r = await a.invoke({ ...context(a, { script: { invoke: 'provider-error' } }), capability: 'ReadRepository', contractVersion: '1.0', input: { revision: 'main', mode: 'tree' } });
    expect(JSON.stringify(r)).not.toContain(SECRET);
    expect(a.credentialUses).toBe(1);
  });

  it('declares itself a fixture provider, needing no credential', () => {
    for (const a of [new FixtureGitAdapter(), new FixtureCiAdapter()]) {
      expect(a.descriptor.provider).toBe('fixture');
      expect(a.descriptor.credentialRequired).toBe(false);
    }
  });
});
