/**
 * `T2226` (EPIC-039, `FR-HUB-025`, `R-039-4`, data-model §2) — an adapter's
 * version changes by deployment, not by a person, so the lifecycle record has
 * to notice it.
 *
 * At boot, for every **active outbound** registry entry whose adapter is in
 * the build, the catalog's version is compared with the last version the
 * audit trail recorded for it (the registration's `after.version`, or the last
 * `system:catalog` change). A difference writes one audit `update` by
 * `system:catalog` with `before`/`after`; the same version, a first sighting,
 * a retired or inbound entry, or an adapter no longer in the build writes
 * nothing. A store that cannot be read does not abort the boot
 * (`DEF-039-001`).
 */
import { describe, expect, it } from 'vitest';
import { observeCatalogVersions, CATALOG_ACTOR } from '../../src/modules/integrations/catalog.service.js';
import type { AuditPort } from '../../src/modules/integrations/integrations.tokens.js';
import type { RegistryEntryRecord } from '../../src/modules/integrations/integrations.store.js';

const NOW = new Date('2026-10-16T09:00:00.000Z');

function entry(over: Partial<RegistryEntryRecord>): RegistryEntryRecord {
  return { id: 'e_ci', workspaceId: 'ws_1', key: 'fixture-ci', direction: 'outbound', status: 'active', listedOrder: 10, registeredBy: 'u', registeredAt: NOW, retiredBy: null, retiredAt: null, ...over };
}

function harness(rows: RegistryEntryRecord[], recorded: Record<string, string | null>, inBuild: Record<string, string> = { 'fixture-ci': '0.2.0', 'github-rest': '1.0.0' }) {
  const written: Parameters<AuditPort['record']>[0][] = [];
  const deps = {
    entries: async () => rows,
    lastObservedVersion: async (_ws: string, id: string) => recorded[id] ?? null,
    catalog: { descriptor: (key: string) => (key in inBuild ? { version: inBuild[key]! } : null) },
    audit: { record: async (row: Parameters<AuditPort['record']>[0]) => void written.push(row) },
  };
  return { deps, written };
}

describe('T2226 · a catalog version change is recorded at boot (FR-HUB-025)', () => {
  it('a different version writes one audit update by system:catalog with before and after', async () => {
    const { deps, written } = harness([entry({})], { e_ci: '0.1.0' });
    const changes = await observeCatalogVersions(deps);
    expect(CATALOG_ACTOR).toBe('system:catalog');
    expect(written).toEqual([
      {
        workspaceId: 'ws_1',
        actorId: 'system:catalog',
        action: 'update',
        targetType: 'integration-registry-entry',
        targetId: 'e_ci',
        outcome: 'success',
        detail: { key: 'fixture-ci', before: { version: '0.1.0' }, after: { version: '0.2.0' } },
      },
    ]);
    expect(changes).toEqual([{ workspaceId: 'ws_1', entryId: 'e_ci', key: 'fixture-ci', before: '0.1.0', after: '0.2.0' }]);
  });

  it('the same version, or a first sighting with nothing recorded, writes nothing', async () => {
    const same = harness([entry({})], { e_ci: '0.2.0' });
    expect(await observeCatalogVersions(same.deps)).toEqual([]);
    expect(same.written).toEqual([]);
    const first = harness([entry({})], {});
    await observeCatalogVersions(first.deps);
    expect(first.written).toEqual([]);
  });

  it('skips retired and inbound entries, and an adapter no longer in this build', async () => {
    const { deps, written } = harness(
      [entry({ id: 'e_r', status: 'retired' }), entry({ id: 'e_in', key: 'pmi-studio', direction: 'inbound' }), entry({ id: 'e_gone', key: 'gone' })],
      { e_r: '0.1.0', e_in: '0.1.0', e_gone: '0.1.0' },
    );
    await observeCatalogVersions(deps);
    expect(written).toEqual([]);
  });

  it('records each changed entry in each workspace', async () => {
    const { deps, written } = harness([entry({}), entry({ id: 'e_ci2', workspaceId: 'ws_2' }), entry({ id: 'e_gh', key: 'github-rest' })], { e_ci: '0.1.0', e_ci2: '0.1.0', e_gh: '1.0.0' });
    await observeCatalogVersions(deps);
    expect(written.map((w) => [w.workspaceId, w.targetId])).toEqual([
      ['ws_1', 'e_ci'],
      ['ws_2', 'e_ci2'],
    ]);
  });

  it('a store that cannot be read does not abort the boot (DEF-039-001)', async () => {
    const { deps, written } = harness([entry({})], { e_ci: '0.1.0' });
    await expect(observeCatalogVersions({ ...deps, entries: async () => { throw new Error("Can't reach database server"); } })).resolves.toEqual([]);
    await expect(observeCatalogVersions({ ...deps, lastObservedVersion: async () => { throw new Error('audit unreadable'); } })).resolves.toEqual([]);
    expect(written).toEqual([]);
  });
});
