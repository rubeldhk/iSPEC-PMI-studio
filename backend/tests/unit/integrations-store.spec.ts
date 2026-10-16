/**
 * `T2127` (EPIC-039) — the store's shape carries three guarantees:
 *
 * - every read is scoped to a workspace (`FR-HUB-005`);
 * - the three decision tables have **no update method** — not a disabled one,
 *   none (`FR-HUB-036`, data-model §5, §6, §6a);
 * - the credential view type every service sees has **no `ciphertext`** field
 *   (`R-039-10`); only the vault's port carries it.
 *
 * Written to FAIL before `T2128`.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import { InMemoryIntegrationsStore, type CredentialStatusRecord, type IntegrationsStore } from '../../src/modules/integrations/integrations.store.js';

const now = new Date('2026-10-10T12:00:00Z');

function store(): InMemoryIntegrationsStore {
  return new InMemoryIntegrationsStore();
}

describe('T2127 · workspace scoping on every read', () => {
  it('an entry in another workspace is invisible by id, by key and in the list', async () => {
    const s = store();
    const e = await s.createEntry({ workspaceId: 'ws_a', key: 'fixture-ci', direction: 'outbound', listedOrder: 10, registeredBy: 'u', registeredAt: now });
    expect(await s.findEntry('ws_b', e.id)).toBeNull();
    expect(await s.findEntryByKey('ws_b', 'fixture-ci')).toBeNull();
    expect(await s.listEntries('ws_b')).toEqual([]);
    expect((await s.listEntries('ws_a')).map((x) => x.key)).toEqual(['fixture-ci']);
  });

  it('refuses an unscoped read', async () => {
    await expect(store().listEntries('')).rejects.toThrow(/workspace scope/i);
  });

  it('configurations, credentials, health and resolutions are scoped too', async () => {
    const s = store();
    const e = await s.createEntry({ workspaceId: 'ws_a', key: 'fixture-ci', direction: 'outbound', listedOrder: 10, registeredBy: 'u', registeredAt: now });
    await s.putConfiguration({ workspaceId: 'ws_a', projectId: 'p', capability: 'ReadBuildStatus', adapters: [{ registryEntryId: e.id, preference: 1 }], permitDegraded: false, permittedEnvironments: ['local'], onNotNarrowable: 'proceed-and-record', healthIntervalSeconds: 300, providerBinding: {}, decisionId: null, updatedBy: 'u' });
    expect(await s.getConfiguration('ws_b', 'p', 'ReadBuildStatus')).toBeNull();
    expect(await s.listConfigurations('ws_b', 'p')).toEqual([]);
    await s.appendCheck({ workspaceId: 'ws_a', projectId: 'p', registryEntryId: e.id, state: 'healthy', adapterVersion: '1', source: 'request', checkedAt: now, durationMs: 1 });
    expect(await s.latestCheck('ws_b', 'p', e.id)).toBeNull();
    expect(await s.latestCheck('ws_a', 'p', e.id)).not.toBeNull();
    expect(await s.credentialStatus('ws_b', 'p', e.id)).toBeNull();
    expect(await s.listResolutions('ws_b', { projectId: 'p' })).toEqual([]);
  });
});

describe('T2127 · the decision tables have no update method', () => {
  it.each(['updateResolution', 'deleteResolution', 'updateInvocation', 'deleteInvocation', 'updateCheck', 'deleteCheck'])('%s does not exist', (name) => {
    expect((store() as unknown as Record<string, unknown>)[name]).toBeUndefined();
  });

  it('a second invocation for one resolution is refused — one call per resolution (FR-HUB-039)', async () => {
    const s = store();
    const r = await s.appendResolution({ workspaceId: 'ws', scope: 'project', projectId: 'p', caller: 'room:change', actorPrincipalId: 'u', executionId: null, capability: 'ReadBuildStatus', requestedMajor: 1, contractVersion: '1.0', outcome: 'resolved', refusalCode: null, registryEntryId: 'e', adapterKey: 'fixture-ci', adapterVersion: '0.1.0', provider: 'fixture', modelIdentity: null, scopeGranted: null, reasons: {}, decidedAt: now });
    await s.appendInvocation({ resolutionId: r.id, workspaceId: 'ws', projectId: 'p', outcome: 'succeeded', errorCategory: null, providerRequestId: null, retryAfterSeconds: null, durationMs: 3, endedAt: now });
    await expect(s.appendInvocation({ resolutionId: r.id, workspaceId: 'ws', projectId: 'p', outcome: 'failed', errorCategory: 'timed-out', providerRequestId: null, retryAfterSeconds: null, durationMs: 3, endedAt: now })).rejects.toThrow(/already/);
  });
});

describe('T2127 · the credential view has no ciphertext', () => {
  it('as a type', () => {
    expectTypeOf<CredentialStatusRecord>().not.toHaveProperty('ciphertext');
    expectTypeOf<IntegrationsStore>().not.toHaveProperty('readCredentialCiphertext');
  });

  it('and at runtime: the status read returns the documented fields only', async () => {
    const s = store();
    await s.vaultPort().putCredentialRow({ workspaceId: 'ws', projectId: 'p', registryEntryId: 'e', kind: 'fixture-token', ciphertext: Buffer.from('x'), iv: Buffer.alloc(12), authTag: Buffer.alloc(16), keyId: 'k1', setBy: 'u', setAt: now });
    const status = await s.credentialStatus('ws', 'p', 'e');
    expect(Object.keys(status!).sort()).toEqual(['id', 'kind', 'projectId', 'registryEntryId', 'setAt', 'setBy', 'workspaceId']);
  });
});

describe('T2244/T2245 (U2) · recordScheduledCheck records one check per pair per bucket', () => {
  it('the second row for the same bucket is not recorded', async () => {
    const s = store();
    const row = { workspaceId: 'ws', projectId: 'p', registryEntryId: 'e', state: 'healthy' as const, adapterVersion: '1', checkedAt: now, durationMs: 1, intervalBucket: 7 };
    expect(await s.recordScheduledCheck(row)).toBe(true);
    expect(await s.recordScheduledCheck(row)).toBe(false);
    expect(await s.recordScheduledCheck({ ...row, intervalBucket: 8 })).toBe(true);
  });
});
