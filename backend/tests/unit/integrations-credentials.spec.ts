/**
 * `T2177`, `T2248` (EPIC-039, `FR-HUB-041`, `FR-HUB-043`, `FR-HUB-046`,
 * `SC-HUB-008`) — credentials are set by the owner, read back as status only,
 * audited without their value, and make the adapter eligible within one check.
 *
 * Written to FAIL before `T2178`.
 */
import { describe, expect, it } from 'vitest';
import { ForbiddenError, ValidationFailedError } from '../../src/core/errors.js';
import { OWNER, PROJECT, SHA, WS, testHub } from './integrations-hub.fixture.js';

const owner = { workspaceId: WS, userId: OWNER };
const SECRET = 'pmi-canary-7a1c9e22-1b2d-4f3e-8a9b-0c1d2e3f4a5b';

describe('T2177 · set, replace, remove', () => {
  it('requires the owner grant, and the refusal is audited access_refused', async () => {
    const hub = testHub();
    const e = await hub.entry('github-rest');
    await expect(hub.credentials.set({ workspaceId: WS, userId: 'u_stranger' }, PROJECT, e.id, { kind: 'github-token', value: SECRET })).rejects.toThrow(ForbiddenError);
    expect(hub.audit.rows.some((r) => r['action'] === 'access_refused')).toBe(true);
    expect(await hub.store.credentialStatus(WS, PROJECT, e.id)).toBeNull();
  });

  it('status returns { entryId, state, kind, setBy, setAt } and nothing else', async () => {
    const hub = testHub();
    const e = await hub.entry('github-rest');
    await hub.entry('fixture-ci');
    await hub.credentials.set(owner, PROJECT, e.id, { kind: 'github-token', value: SECRET });
    const rows = await hub.credentials.status(WS, PROJECT);
    const row = rows.find((r) => r.entryId === e.id)!;
    expect(Object.keys(row).sort()).toEqual(['entryId', 'kind', 'setAt', 'setBy', 'state']);
    expect(row).toMatchObject({ state: 'configured', kind: 'github-token', setBy: OWNER });
    expect(JSON.stringify(rows)).not.toContain(SECRET);
    expect(rows.find((r) => r.entryId !== e.id && r.state === 'not-configured')).toBeDefined();
  });

  it('audits set, replace and remove with before/after — never the value', async () => {
    const hub = testHub();
    const e = await hub.entry('github-rest');
    await hub.credentials.set(owner, PROJECT, e.id, { kind: 'github-token', value: SECRET });
    await hub.credentials.set(owner, PROJECT, e.id, { kind: 'github-token', value: `${SECRET}-2` });
    await hub.credentials.remove(owner, PROJECT, e.id);
    await hub.credentials.remove(owner, PROJECT, e.id);
    const rows = hub.audit.rows.filter((r) => r['targetType'] === 'integration-credential');
    expect(rows.map((r) => (r['detail'] as { after: { state: string } }).after.state)).toEqual(['configured', 'configured', 'not-configured']);
    expect((rows[0]!['detail'] as { before: { state: string } }).before.state).toBe('not-configured');
    expect(JSON.stringify(hub.audit.rows)).not.toContain('pmi-canary-');
  });

  it('refuses a kind the adapter does not declare, an empty value, and an inbound entry', async () => {
    const hub = testHub();
    const e = await hub.entry('github-rest');
    await expect(hub.credentials.set(owner, PROJECT, e.id, { kind: 'resend-api-key', value: SECRET })).rejects.toThrow(ValidationFailedError);
    await expect(hub.credentials.set(owner, PROJECT, e.id, { kind: 'github-token', value: '' })).rejects.toThrow(ValidationFailedError);
    const pmi = await hub.entry('pmi-studio', 'inbound');
    await expect(hub.credentials.set(owner, PROJECT, pmi.id, { kind: 'github-token', value: SECRET })).rejects.toThrow(ValidationFailedError);
  });

  it('a refusal message never echoes the value', async () => {
    const hub = testHub();
    const e = await hub.entry('github-rest');
    const err = (await hub.credentials.set(owner, PROJECT, e.id, { kind: 'nope', value: SECRET }).catch((x: unknown) => x)) as Error;
    expect(JSON.stringify({ m: err.message, d: (err as ValidationFailedError).details })).not.toContain(SECRET);
  });
});

describe('T2177 · eligibility follows the credential', () => {
  it('removal makes the adapter ineligible as credential-missing (US4 AS5)', async () => {
    const hub = testHub();
    const e = await hub.entry('github-rest');
    await hub.configuration.put(owner, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: e.id, preference: 1, binding: { repository: 'acme/widgets' } }] });
    await hub.credentials.set(owner, PROJECT, e.id, { kind: 'github-token', value: SECRET });
    await hub.credentials.remove(owner, PROJECT, e.id);
    const r = await hub.resolver.resolve({ workspaceId: WS, projectId: PROJECT, capability: 'ReadBuildStatus', major: 1, caller: 'room:change', actorPrincipalId: OWNER, executionId: null });
    expect(r.refusal!.candidates[0]).toMatchObject({ entryKey: 'github-rest', ineligibleBecause: 'credential-missing' });
  });

  it('setting schedules an immediate health check — the owner sees the result within one check (SC-HUB-008)', async () => {
    const hub = testHub();
    const e = await hub.entry('fixture-ci');
    await hub.configuration.put(owner, PROJECT, 'ReadBuildStatus', { adapters: [{ registryEntryId: e.id, preference: 1 }] });
    expect(await hub.store.latestCheck(WS, PROJECT, e.id)).toBeNull();
    await hub.credentials.set(owner, PROJECT, e.id, { kind: 'fixture-token', value: SECRET });
    expect(await hub.store.latestCheck(WS, PROJECT, e.id)).toMatchObject({ state: 'healthy', source: 'credential-set' });
    const r = await hub.requests.request(owner, PROJECT, { capability: 'ReadBuildStatus', major: 1, caller: 'room:change', input: { revision: SHA } }, { http: true });
    expect(r.outcome).toBe('resolved');
  });
});
