/**
 * `T2141` (EPIC-039, `FR-HUB-031`, `FR-HUB-032`, `FR-HUB-062`, `R-039-7`) — a
 * project configures which adapters serve a capability.
 *
 * Policy is decided at configuration and read at resolution: every change
 * requests one decision through `CapabilityPolicy` and stores its id; the
 * status is derived on read, never cached. Every change is an audited `update`
 * with before and after.
 *
 * Written to FAIL before `T2142`.
 */
import { describe, expect, it } from 'vitest';
import { GovernanceSeamUnboundError, ValidationFailedError } from '../../src/core/errors.js';
import { OWNER, PROJECT, WS, catalogWithSecondCi, testHub } from './integrations-hub.fixture.js';

const ctx = { workspaceId: WS, userId: OWNER };

describe('T2141 · PUT a capability configuration', () => {
  it('increments configVersion, requests a decision, stores its id', async () => {
    const hub = testHub();
    const ci = await hub.entry('fixture-ci');
    const first = await hub.configuration.put(ctx, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: ci.id, preference: 1 }] });
    const second = await hub.configuration.put(ctx, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: ci.id, preference: 1 }], permitDegraded: true });
    expect(first).toMatchObject({ configVersion: 1, decisionId: 'dec_1', policyStatus: 'permitted' });
    expect(second).toMatchObject({ configVersion: 2, decisionId: 'dec_2' });
    const decides = hub.policy!.calls.filter((c) => c.method === 'requestDecision').map((c) => c.args);
    expect(decides[1]).toMatchObject({ workspaceId: WS, projectId: PROJECT, capability: 'ReadBuildStatus', configVersion: 2 });
  });

  it('defaults onNotNarrowable to refuse for a state-changing capability, proceed-and-record otherwise (FR-HUB-034)', async () => {
    const hub = testHub();
    const ci = await hub.entry('fixture-ci');
    await hub.configuration.put(ctx, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: ci.id, preference: 1 }] });
    expect((await hub.store.getConfiguration(WS, PROJECT, 'ReadBuildStatus'))!.onNotNarrowable).toBe('proceed-and-record');
  });

  it.each([
    ['several adapters without distinct preferences', async (hub: ReturnType<typeof testHub>) => {
      const a = await hub.entry('fixture-ci');
      const b = await hub.entry('fixture-ci-2');
      return { adapters: [{ registryEntryId: a.id, preference: 1 }, { registryEntryId: b.id, preference: 1 }] };
    }, 'distinct preferences'],
    ['an inbound entry', async (hub: ReturnType<typeof testHub>) => ({ adapters: [{ registryEntryId: (await hub.entry('pmi-studio', 'inbound')).id, preference: 1 }] }), 'inbound'],
    ['a retired entry', async (hub: ReturnType<typeof testHub>) => {
      const e = await hub.entry('fixture-ci');
      await hub.store.retireEntry(WS, e.id, OWNER, hub.clock.now);
      return { adapters: [{ registryEntryId: e.id, preference: 1 }] };
    }, 'retired'],
    ['a binding failing the adapter schema', async (hub: ReturnType<typeof testHub>) => ({ adapters: [{ registryEntryId: (await hub.entry('fixture-ci')).id, preference: 1, binding: { colour: 'blue' } }] }), 'colour'],
    ['a binding holding secret-looking material', async (hub: ReturnType<typeof testHub>) => ({ adapters: [{ registryEntryId: (await hub.entry('fixture-ci')).id, preference: 1, binding: { repository: 'ghp_abcdefghijklmnopqrstuvwxyz0123' } }] }), 'secret'],
    ['an entry from another workspace or none at all', async () => ({ adapters: [{ registryEntryId: 'nope', preference: 1 }] }), 'not listed'],
    ['an environment outside the vocabulary', async (hub: ReturnType<typeof testHub>) => ({ adapters: [{ registryEntryId: (await hub.entry('fixture-ci')).id, preference: 1 }], permittedEnvironments: ['qa'] }), 'qa'],
    ['an interval outside 60–3600', async (hub: ReturnType<typeof testHub>) => ({ adapters: [{ registryEntryId: (await hub.entry('fixture-ci')).id, preference: 1 }], healthIntervalSeconds: 5 }), 'healthIntervalSeconds'],
  ])('refuses %s (400)', async (_label, body, fragment) => {
    const hub = testHub({ catalog: catalogWithSecondCi() });
    const b = await body(hub);
    const err = await hub.configuration.put(ctx, PROJECT, 'ReadBuildStatus', b).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationFailedError);
    expect(JSON.stringify({ m: (err as Error).message, d: (err as ValidationFailedError).details })).toContain(fragment);
    expect(await hub.store.getConfiguration(WS, PROJECT, 'ReadBuildStatus')).toBeNull();
  });

  it('refuses an unknown capability and Embed (deployment scope — I1)', async () => {
    const hub = testHub();
    await expect(hub.configuration.put(ctx, PROJECT, 'ReadSecrets', { adapters: [] })).rejects.toThrow(/ReadSecrets/);
    await expect(hub.configuration.put(ctx, PROJECT, 'Embed', { adapters: [] })).rejects.toThrow(/deployment/);
  });

  it('answers 503 naming CapabilityPolicy while the seam is unbound, and stores nothing', async () => {
    const hub = testHub({ policy: null });
    const ci = await hub.entry('fixture-ci');
    await expect(hub.configuration.put(ctx, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: ci.id, preference: 1 }] })).rejects.toThrow(GovernanceSeamUnboundError);
    expect(await hub.store.getConfiguration(WS, PROJECT, 'ReadBuildStatus')).toBeNull();
  });

  it('requires the owner grant to write (FR-HUB-041 rule, reused)', async () => {
    const hub = testHub();
    const ci = await hub.entry('fixture-ci');
    await expect(hub.configuration.put({ workspaceId: WS, userId: 'u_stranger' }, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: ci.id, preference: 1 }] })).rejects.toThrow(/owner/);
  });
});

describe('T2141 · policy status is derived on read, never cached', () => {
  it('a later refusal takes effect on the next read', async () => {
    const hub = testHub();
    const ci = await hub.entry('fixture-ci');
    await hub.configuration.put(ctx, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: ci.id, preference: 1 }] });
    expect((await hub.configuration.list(WS, PROJECT))[0]!.policyStatus).toBe('permitted');
    hub.policy!.set('not-permitted');
    expect((await hub.configuration.list(WS, PROJECT))[0]!.policyStatus).toBe('not-permitted');
  });

  it('reads policy-seam-unbound rather than guessing when the seam is gone', async () => {
    const hub = testHub();
    const ci = await hub.entry('fixture-ci');
    await hub.configuration.put(ctx, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: ci.id, preference: 1 }] });
    hub.policySeam.bind(new (await import('../../src/modules/integrations/integrations.tokens.js')).CapabilityPolicySeam().port());
    expect((await hub.configuration.list(WS, PROJECT))[0]!.policyStatus).toBe('policy-seam-unbound');
  });
});

describe('T2141 · every change is audited with before and after (FR-HUB-062)', () => {
  it('records update on capability-configuration', async () => {
    const hub = testHub({ catalog: catalogWithSecondCi() });
    const ci = await hub.entry('fixture-ci');
    const git = await hub.entry('fixture-ci-2');
    await hub.configuration.put(ctx, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: ci.id, preference: 1 }] });
    await hub.configuration.put(ctx, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: git.id, preference: 1 }] });
    const rows = hub.audit.rows.filter((r) => r['targetType'] === 'capability-configuration');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ action: 'update', actorId: OWNER, outcome: 'success' });
    const detail = rows[1]!['detail'] as { before: { adapters: { key: string }[] }; after: { adapters: { key: string }[] } };
    expect(detail.before.adapters.map((a) => a.key)).toEqual(['fixture-ci']);
    expect(detail.after.adapters.map((a) => a.key)).toEqual(['fixture-ci-2']);
  });
});
