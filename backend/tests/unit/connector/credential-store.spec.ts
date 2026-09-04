/**
 * `T1355` (EPIC-041) — the credential store.
 *
 * Lookup by `tokenPrefix`; `lastUsedAt` written at most once per minute;
 * `revokedAt` set once and never cleared; no method deletes; the record type
 * has no `expiresAt`, and a credential minted under a mocked clock ninety days
 * in the past still verifies — the only thing that ends a credential is
 * `revokedAt` (`FR-LPW-022`, `FR-LPW-023`, `FR-LPW-028`; analysis `C2`).
 *
 * Written to FAIL before `T1356` exists.
 */
import { describe, expect, it } from 'vitest';
import {
  InMemoryConnectorCredentialStore,
  LAST_USED_WRITE_INTERVAL_MS,
  type ConnectorCredentialRecord,
  type ConnectorCredentialStore,
} from '../../../src/modules/connector/connector-credential.store.js';
import { mintToken, verifyToken } from '../../../src/modules/connector/credential-token.js';

const NOW = new Date('2026-09-04T12:00:00Z');
const NINETY_DAYS_AGO = new Date(NOW.getTime() - 90 * 24 * 60 * 60 * 1000);

function record(over: Partial<ConnectorCredentialRecord> = {}): ConnectorCredentialRecord {
  const minted = mintToken();
  return {
    id: over.id ?? `cred_${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: 'ws_a',
    projectId: 'p_a',
    principalId: 'pr_1',
    tokenPrefix: minted.tokenPrefix,
    tokenHash: minted.tokenHash,
    label: 'laptop',
    createdById: 'u_owner',
    createdAt: NOW,
    lastUsedAt: null,
    revokedAt: null,
    revokedById: null,
    ...over,
  };
}

describe('T1355 · ConnectorCredentialStore (in-memory)', () => {
  const fresh = (): ConnectorCredentialStore => new InMemoryConnectorCredentialStore();

  it('looks a credential up by its token prefix', async () => {
    const store = fresh();
    const r = await store.create(record({ tokenPrefix: 'abcdefgh' }));
    expect(await store.findByPrefix('abcdefgh')).toEqual([r]);
    expect(await store.findByPrefix('zzzzzzzz')).toEqual([]);
  });

  it('lists a project\'s credentials, filtered by revoked and label, scoped to the workspace', async () => {
    const store = fresh();
    await store.create(record({ id: 'c1', label: 'laptop' }));
    await store.create(record({ id: 'c2', label: 'ci', revokedAt: NOW, revokedById: 'u_owner' }));
    await store.create(record({ id: 'c3', label: 'laptop', projectId: 'p_b' }));
    await store.create(record({ id: 'c4', label: 'laptop', workspaceId: 'ws_other' }));
    expect((await store.listForProject('ws_a', 'p_a')).map((r) => r.id).sort()).toEqual(['c1', 'c2']);
    expect((await store.listForProject('ws_a', 'p_a', { revoked: false })).map((r) => r.id)).toEqual(['c1']);
    expect((await store.listForProject('ws_a', 'p_a', { revoked: true })).map((r) => r.id)).toEqual(['c2']);
    expect((await store.listForProject('ws_a', 'p_a', { label: 'ci' })).map((r) => r.id)).toEqual(['c2']);
  });

  it('writes lastUsedAt at most once per minute', async () => {
    const store = fresh();
    const r = await store.create(record({ id: 'c1' }));
    expect(await store.touchLastUsed(r.id, NOW)).toBe(true);
    expect(await store.touchLastUsed(r.id, new Date(NOW.getTime() + 10_000))).toBe(false);
    expect((await store.find('ws_a', 'c1'))?.lastUsedAt).toEqual(NOW);
    const later = new Date(NOW.getTime() + LAST_USED_WRITE_INTERVAL_MS + 1);
    expect(await store.touchLastUsed(r.id, later)).toBe(true);
    expect((await store.find('ws_a', 'c1'))?.lastUsedAt).toEqual(later);
  });

  it('sets revokedAt once and never clears it', async () => {
    const store = fresh();
    await store.create(record({ id: 'c1' }));
    const first = await store.revoke('ws_a', 'c1', 'u_owner', NOW);
    expect(first.revokedAt).toEqual(NOW);
    expect(first.revokedById).toBe('u_owner');
    const again = await store.revoke('ws_a', 'c1', 'u_other', new Date(NOW.getTime() + 5000));
    expect(again.revokedAt).toEqual(NOW);
    expect(again.revokedById).toBe('u_owner');
  });

  it('has no method that deletes', () => {
    const store = fresh();
    const names = Object.getOwnPropertyNames(Object.getPrototypeOf(store)).filter((n) => n !== 'constructor');
    expect(names.some((n) => /delete|remove|purge|clear/i.test(n))).toBe(false);
    expect(names.sort()).toEqual(['create', 'find', 'findByPrefix', 'listForProject', 'revoke', 'touchLastUsed']);
  });

  it('has no expiresAt: a credential minted ninety days ago still verifies (FR-LPW-028)', async () => {
    const store = fresh();
    const minted = mintToken();
    const r = await store.create(record({ id: 'old', createdAt: NINETY_DAYS_AGO, tokenPrefix: minted.tokenPrefix, tokenHash: minted.tokenHash }));
    expect('expiresAt' in r).toBe(false);
    const [found] = await store.findByPrefix(minted.tokenPrefix);
    expect(found?.revokedAt).toBeNull();
    expect(verifyToken(minted.value, found?.tokenHash ?? '')).toBe(true);
  });

  it('is workspace-scoped on find', async () => {
    const store = fresh();
    await store.create(record({ id: 'c1' }));
    expect(await store.find('ws_other', 'c1')).toBeNull();
  });
});
