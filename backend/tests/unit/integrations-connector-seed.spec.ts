/**
 * `T2165` (EPIC-039, `FR-HUB-021`, `R-039-5`, `R-039-10`) — the connector seed.
 *
 * Each workspace's registry lists `pmi-studio` first and the four `EPIC-037`
 * surfaces beside it, idempotently, as `system:epic-039-seed`; their facts are
 * read from the server and the contract, not copied; the `fixture` surface is
 * named as omitted rather than silently left out; and because access is
 * deny-by-default, the seed grants edit on `integration-registry` to the
 * workspace's creator.
 *
 * Written to FAIL before `T2166`.
 */
import { describe, expect, it } from 'vitest';
import { OWNER, WS, testHub } from './integrations-hub.fixture.js';

const owner = { workspaceId: WS, userId: OWNER };

describe('T2165 · the connector seed', () => {
  it('lists pmi-studio first, then the four EPIC-037 surfaces, and names the fixture surface as omitted', async () => {
    const hub = testHub();
    const view = await hub.registry.list(owner);
    expect(view.entries.map((e) => e.key)).toEqual(['pmi-studio', 'surface:ide-extension', 'surface:local-cli', 'surface:ci-cd', 'surface:managed-sandbox']);
    expect(view.entries.every((e) => e.direction === 'inbound')).toBe(true);
    expect(view.omitted).toEqual([{ key: 'surface:fixture', reason: expect.stringContaining('test surface') }]);
  });

  it('reads pmi-studio\'s facts from the server, not from a copy', async () => {
    const hub = testHub();
    const pmi = (await hub.registry.list(owner)).entries[0]!;
    expect(pmi.transport).toEqual({ applicable: true, value: 'mcp' });
    expect(pmi.version).toEqual({ applicable: true, value: '0.1.0' });
    expect(pmi.compatibility).toEqual({ applicable: true, value: { integrationContract: '1.0' } });
    expect(pmi.permissionScope.applicable && (pmi.permissionScope.value as { operations: string[] }).operations).toContain('pmi.project.context');
    expect(pmi.health).toMatchObject({ applicable: false, reason: expect.stringContaining('inbound; liveness is observed by the client') });
  });

  it('grants edit on integration-registry to the workspace creator, acts as system:epic-039-seed, and is idempotent', async () => {
    const hub = testHub();
    await hub.registry.list(owner);
    await hub.registry.list(owner);
    expect(hub.access.grants).toEqual([{ workspaceId: WS, userId: OWNER, level: 'edit', by: 'system:epic-039-seed' }]);
    const created = hub.audit.rows.filter((r) => r['action'] === 'create' && r['targetType'] === 'integration-registry-entry');
    expect(created).toHaveLength(5);
    expect(created.every((r) => r['actorId'] === 'system:epic-039-seed')).toBe(true);
    expect((await hub.store.listEntries(WS)).length).toBe(5);
  });
});
