/**
 * `T2163`, `T2165` (EPIC-039, `FR-HUB-020`–`FR-HUB-029`, `R-039-5`) — one
 * registry, two directions.
 *
 * Registering lists a catalog adapter in a workspace (deployment makes it
 * available; registration lists it — `R-039-4`). Connectors are listed by the
 * seed, never registered. Every act is audited with before and after, and the
 * `integration-registry` grant decides who may read and who may change it.
 *
 * Written to FAIL before `T2164` / `T2166`.
 */
import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../src/core/errors.js';
import { OWNER, PROJECT, WS, configure, testHub } from './integrations-hub.fixture.js';

const owner = { workspaceId: WS, userId: OWNER };

describe('T2163 · register and retire', () => {
  it('registers a catalog key with the edit grant, audited with before and after', async () => {
    const hub = testHub();
    const e = await hub.registry.register(owner, 'fixture-ci');
    expect(e).toMatchObject({ key: 'fixture-ci', direction: 'outbound', status: 'active' });
    const row = hub.audit.rows.find((r) => r['targetId'] === e.id)!;
    expect(row).toMatchObject({ action: 'create', actorId: OWNER, detail: { before: null, after: expect.objectContaining({ key: 'fixture-ci', status: 'active' }) } });
  });

  it('refuses a connector key, an unknown key (400) and a second listing (409)', async () => {
    const hub = testHub();
    await expect(hub.registry.register(owner, 'pmi-studio')).rejects.toThrow(/connectors are listed by the platform, not registered/);
    await expect(hub.registry.register(owner, 'surface:local-cli')).rejects.toThrow(ValidationFailedError);
    await expect(hub.registry.register(owner, 'no-such-adapter')).rejects.toThrow(ValidationFailedError);
    await hub.registry.register(owner, 'fixture-ci');
    await expect(hub.registry.register(owner, 'fixture-ci')).rejects.toThrow(ConflictError);
  });

  it('retires idempotently, keeps the history readable, and audits lifecycle_transition', async () => {
    const hub = testHub();
    const e = await hub.registry.register(owner, 'fixture-ci');
    await hub.registry.retire(owner, e.id);
    await hub.registry.retire(owner, e.id);
    const detail = await hub.registry.detail(owner, e.id);
    expect(detail.entry.status).toBe('retired');
    expect(hub.audit.rows.filter((r) => r['action'] === 'lifecycle_transition')).toHaveLength(1);
  });

  it('requires edit to register or retire, and read to read — refusals are absences (404)', async () => {
    const hub = testHub();
    const stranger = { workspaceId: WS, userId: 'u_stranger' };
    await hub.registry.list(owner);
    await expect(hub.registry.register(stranger, 'fixture-ci')).rejects.toThrow(NotFoundError);
    await expect(hub.registry.list(stranger)).rejects.toThrow(NotFoundError);
    hub.access.grant(WS, 'u_reader', 'read');
    await expect(hub.registry.list({ workspaceId: WS, userId: 'u_reader' })).resolves.toBeDefined();
    await expect(hub.registry.register({ workspaceId: WS, userId: 'u_reader' }, 'fixture-ci')).rejects.toThrow(NotFoundError);
  });
});

describe('T2163 · every field is a value or a reason (FR-HUB-023, SC-HUB-003)', () => {
  it('for every entry, with and without a project', async () => {
    const hub = testHub();
    await hub.registry.register(owner, 'fixture-ci');
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    for (const projectId of [undefined, PROJECT]) {
      const view = await hub.registry.list(owner, projectId);
      for (const e of view.entries) {
        for (const field of ['provider', 'transport', 'version', 'compatibility', 'permissionScope', 'authorisation', 'configuration', 'health'] as const) {
          const f = e[field] as { applicable: boolean; value?: unknown; reason?: string };
          expect(f.applicable ? f.value !== undefined : typeof f.reason === 'string' && f.reason.length > 0, `${e.key}.${field}`).toBe(true);
        }
        expect(e.audit.registeredBy.length).toBeGreaterThan(0);
      }
    }
    const withProject = (await hub.registry.list(owner, PROJECT)).entries.find((e) => e.key === 'fixture-ci')!;
    expect(withProject.health).toMatchObject({ applicable: true, value: { state: 'healthy' } });
    expect(withProject.configuration).toMatchObject({ applicable: true, value: { state: 'configured' } });
    const without = (await hub.registry.list(owner)).entries.find((e) => e.key === 'fixture-ci')!;
    expect(without.health).toEqual({ applicable: false, reason: 'no project selected' });
  });

  it('the entry detail carries health history and recent resolutions with their explanations, in one response (FR-HUB-072)', async () => {
    const hub = testHub();
    const e = await hub.registry.register(owner, 'fixture-ci');
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    await hub.requests.request(owner, PROJECT, { capability: 'ReadBuildStatus', major: 1, caller: 'room:change', input: { revision: 'e'.repeat(40) } }, { http: true });
    hub.policy!.set('pending');
    hub.clock.advance(1000);
    await hub.requests.request(owner, PROJECT, { capability: 'ReadBuildStatus', major: 1, caller: 'room:change', input: { revision: 'e'.repeat(40) } }, { http: true });
    const d = await hub.registry.detail(owner, e.id, PROJECT);
    expect(d.healthHistory.length).toBeGreaterThan(0);
    expect(d.resolutions.map((r) => r.outcome)).toEqual(['refused', 'resolved']);
    expect(d.resolutions[0]!.refusal!.candidates[0]).toMatchObject({ entryKey: 'fixture-ci', ineligibleBecause: 'policy-pending' });
  });
});
