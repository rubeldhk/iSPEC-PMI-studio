/**
 * `T2143` (EPIC-039, `FR-HUB-030`–`FR-HUB-039`) — the resolver service assembles
 * every candidate's facts and records its decision **before** any provider is
 * called. A refusal is final at once: no queue, no retry, no fallback.
 *
 * Written to FAIL before `T2144`.
 */
import { describe, expect, it } from 'vitest';
import { GovernanceSeamUnboundError } from '../../src/core/errors.js';
import { OWNER, PROJECT, WS, catalogWithSecondCi, configure, markHealthy, testHub } from './integrations-hub.fixture.js';

const req = (capability = 'ReadBuildStatus', major = 1) => ({ workspaceId: WS, projectId: PROJECT, capability, major, caller: 'room:change' as const, actorPrincipalId: OWNER, executionId: null });

describe('T2143 · resolution', () => {
  it('resolves the one eligible adapter and records the decision with every condition (US1 AS1)', async () => {
    const hub = testHub();
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    const out = await hub.resolver.resolve(req());
    expect(out.record).toMatchObject({ outcome: 'resolved', adapterKey: 'fixture-ci', adapterVersion: '0.1.0', provider: 'fixture', contractVersion: '1.0', scope: 'project' });
    const stored = await hub.store.listResolutions(WS, { projectId: PROJECT });
    expect(stored.map((r) => r.id)).toEqual([out.record.id]);
    expect((out.record.reasons as { rule: string }).rule).toBe('only-eligible');
    expect((out.record.reasons as { eligibleBecause: string[] }).eligibleBecause).toContain('policy');
  });

  it('refuses unknown-capability, naming it (US1 AS2)', async () => {
    const hub = testHub();
    const out = await hub.resolver.resolve(req('ReadSecrets'));
    expect(out.record).toMatchObject({ outcome: 'refused', refusalCode: 'unknown-capability' });
    expect(out.refusal!.message).toContain('ReadSecrets');
  });

  it('refuses no-compatible-adapter for a major nobody implements (FR-HUB-033)', async () => {
    const hub = testHub();
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    const out = await hub.resolver.resolve(req('ReadBuildStatus', 2));
    expect(out.record.refusalCode).toBe('no-compatible-adapter');
  });

  it('assembles each fact: not configured, credential missing, unhealthy, environment, policy pending', async () => {
    const hub = testHub({ environment: 'prod' });
    const ci = await hub.entry('fixture-ci');
    await hub.configuration.put({ workspaceId: WS, userId: OWNER }, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: ci.id, preference: 1 }], permittedEnvironments: ['local'] });
    await markHealthy(hub, ci.id);
    let out = await hub.resolver.resolve(req());
    expect(out.refusal!.candidates.find((c) => c.entryKey === 'fixture-ci')!.ineligibleBecause).toBe('environment-not-permitted');

    await hub.configuration.put({ workspaceId: WS, userId: OWNER }, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: ci.id, preference: 1 }] });
    hub.policy!.set('pending');
    out = await hub.resolver.resolve(req());
    expect(out.refusal!.candidates[0]!.ineligibleBecause).toBe('policy-pending');

    hub.policy!.set('permitted');
    hub.clock.advance(1000);
    await hub.store.appendCheck({ workspaceId: WS, projectId: PROJECT, registryEntryId: ci.id, state: 'unhealthy', reason: 'credential-rejected', adapterVersion: '0.1.0', source: 'request', checkedAt: hub.clock.now, durationMs: 1 });
    out = await hub.resolver.resolve(req());
    expect(out.refusal!.candidates[0]).toMatchObject({ ineligibleBecause: 'health-unhealthy', detail: 'credential-rejected' });
  });

  it('reads stale health as unknown and ineligible (FR-HUB-027)', async () => {
    const hub = testHub();
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    hub.clock.advance(301_000);
    const out = await hub.resolver.resolve(req());
    expect(out.refusal!.candidates[0]!.ineligibleBecause).toBe('health-unknown');
  });

  it('a retired entry is a candidate that fails "active", with its history kept', async () => {
    const hub = testHub();
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    const e = (await hub.store.findEntryByKey(WS, 'fixture-ci'))!;
    await hub.store.retireEntry(WS, e.id, OWNER, hub.clock.now);
    const out = await hub.resolver.resolve(req());
    expect(out.refusal!.candidates[0]!.ineligibleBecause).toBe('retired');
  });

  it('a registered entry whose key left the build reads not-in-build, never a crash', async () => {
    const hub = testHub();
    const gone = await hub.store.createEntry({ workspaceId: WS, key: 'gone-adapter', direction: 'outbound', listedOrder: 99, registeredBy: OWNER, registeredAt: hub.clock.now });
    const ci = await hub.entry('fixture-ci');
    await hub.store.putConfiguration({ workspaceId: WS, projectId: PROJECT, capability: 'ReadBuildStatus', adapters: [{ registryEntryId: gone.id, preference: 1 }, { registryEntryId: ci.id, preference: 2 }], permitDegraded: false, permittedEnvironments: ['local'], onNotNarrowable: 'proceed-and-record', healthIntervalSeconds: 300, providerBinding: {}, decisionId: 'dec_x', updatedBy: OWNER });
    await markHealthy(hub, ci.id);
    const out = await hub.resolver.resolve(req());
    expect(out.record.adapterKey).toBe('fixture-ci');
    expect((out.record.reasons as { candidates: { entryKey: string; firstFailure?: string }[] }).candidates.find((c) => c.entryKey === 'gone-adapter')!.firstFailure).toBe('not-in-build');
  });

  it('never consults the policy for an unconfigured candidate, and 503s when a configured one cannot be decided', async () => {
    const hub = testHub();
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    hub.policySeam.bind(new (await import('../../src/modules/integrations/integrations.tokens.js')).CapabilityPolicySeam().port());
    await expect(hub.resolver.resolve(req())).rejects.toThrow(GovernanceSeamUnboundError);
  });

  it('records the resolution before returning, and uses the configured preference', async () => {
    const hub = testHub({ catalog: catalogWithSecondCi() });
    await configure(hub, 'ReadBuildStatus', ['fixture-ci', 'fixture-ci-2']);
    const out = await hub.resolver.resolve(req());
    expect(out.record.adapterKey).toBe('fixture-ci');
    expect(await hub.store.findResolution(WS, out.record.id)).not.toBeNull();
  });
});
