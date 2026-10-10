/**
 * `T2135`, `T2160` (EPIC-039, `R-039-4`) — the catalog is code, the registry is
 * data, and the join between them never crashes.
 *
 * Written to FAIL before `T2136`.
 */
import type { CapabilityAdapter } from '@pmi/capability-contract';
import { describe, expect, it } from 'vitest';
import { createAdapterCatalog } from '../../src/composition/integration-adapters.js';
import { AdapterCatalog, describeEntry, versionChange } from '../../src/modules/integrations/catalog.service.js';

const now = new Date('2026-10-10T12:00:00Z');

function adapter(key: string, version = '0.1.0'): CapabilityAdapter {
  return {
    descriptor: {
      key,
      name: key,
      provider: 'test',
      transport: 'native-api',
      version,
      implements: [{ capability: 'ReadBuildStatus', majors: [1] }],
      credentialKinds: [],
      credentialRequired: false,
      bindingSchema: { type: 'object', additionalProperties: false, properties: {} },
      scopeMapping: { 'ci.checks': ['x'] },
    },
    invoke: async () => ({ ok: false, errorCategory: 'adapter-fault', message: 'n/a' }),
    checkHealth: async () => ({ state: 'healthy' }),
  };
}

describe('T2135 · the catalog', () => {
  it('refuses two adapters with one key', () => {
    expect(() => new AdapterCatalog([adapter('a'), adapter('a')])).toThrow(/a.*twice|duplicate/);
  });

  it('refuses an adapter whose descriptor is incomplete', () => {
    const bad = adapter('b');
    (bad.descriptor as { provider: string }).provider = '';
    expect(() => new AdapterCatalog([bad])).toThrow(/provider/);
  });

  it('lists the adapters implementing a capability', () => {
    const c = new AdapterCatalog([adapter('a'), adapter('b')]);
    expect(c.implementing('ReadBuildStatus').map((x) => x.descriptor.key)).toEqual(['a', 'b']);
    expect(c.implementing('Embed')).toEqual([]);
  });
});

describe('T2135 · joining a registry row to its descriptor', () => {
  const entry = { id: 'e1', workspaceId: 'w', key: 'a', direction: 'outbound' as const, status: 'active' as const, listedOrder: 10, registeredBy: 'u', registeredAt: now, retiredBy: null, retiredAt: null };

  it('reads the facts from the descriptor', () => {
    const d = describeEntry(new AdapterCatalog([adapter('a', '1.2.3')]), entry);
    expect(d.inBuild).toBe(true);
    expect(d.version).toEqual({ applicable: true, value: '1.2.3' });
    expect(d.provider).toEqual({ applicable: true, value: 'test' });
  });

  it('reads a key absent from the build as not applicable, and ineligible — never a crash', () => {
    const d = describeEntry(new AdapterCatalog([]), { ...entry, key: 'gone' });
    expect(d.inBuild).toBe(false);
    expect(d.version).toEqual({ applicable: false, reason: 'adapter not present in this build' });
    expect(d.provider).toEqual({ applicable: false, reason: 'adapter not present in this build' });
  });
});

describe('T2135 · a changed version is detected against the last observed one', () => {
  it('nothing observed yet → first observation, not a change', () => {
    expect(versionChange(null, '0.1.0')).toEqual({ changed: false, first: true });
  });
  it('same → no change; different → a change with before and after', () => {
    expect(versionChange('0.1.0', '0.1.0')).toEqual({ changed: false, first: false });
    expect(versionChange('0.1.0', '0.2.0')).toEqual({ changed: true, first: false, before: '0.1.0', after: '0.2.0' });
  });
});

describe('T2136 · the composition file builds the catalog', () => {
  it('holds the fixture read adapters, each conforming to assertDescriptor', () => {
    const keys = createAdapterCatalog().keys();
    expect(keys).toEqual(expect.arrayContaining(['fixture-git', 'fixture-ci']));
  });
});
