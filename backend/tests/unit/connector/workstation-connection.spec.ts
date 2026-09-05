/**
 * `T1448` (EPIC-043, `FR-PIC-044`, `FR-PIC-046`, `FR-PIC-053`, `R-043-8`) — the
 * workstation connection record `pmi.health` touches: one row per credential,
 * created on first call, updated after; a revoked credential's row is kept and
 * the read joins the credential's label and state; the health call is audited
 * as `connector.health` (analysis `C3`); the in-memory and Prisma stores behave
 * alike (`durable-stores.spec.ts` gains the binding).
 *
 * Written to FAIL before `T1449`.
 */
import { describe, expect, it, vi } from 'vitest';
import { InMemoryConnectorCredentialStore } from '../../../src/modules/connector/connector-credential.store.js';
import { WorkstationConnectionService } from '../../../src/modules/connector/workstation-connection.service.js';
import { InMemoryWorkstationConnectionStore } from '../../../src/modules/connector/workstation-connection.store.js';

const CTX = { credentialId: 'cred_1', workspaceId: 'ws_a', projectId: 'proj_1', principalId: 'pr_1' };

function harness() {
  const store = new InMemoryWorkstationConnectionStore();
  const credentials = new InMemoryConnectorCredentialStore();
  const audits: Record<string, unknown>[] = [];
  let now = new Date('2026-09-04T10:00:00Z');
  const service = new WorkstationConnectionService({
    store,
    credentials,
    contractVersion: '1.0',
    apiVersion: '1',
    audit: { record: vi.fn(async (row: Record<string, unknown>) => void audits.push(row)) },
    now: () => now,
  });
  const tick = (iso: string): void => {
    now = new Date(iso);
  };
  return { service, store, credentials, audits, tick };
}

async function credential(store: InMemoryConnectorCredentialStore, id: string, label: string) {
  return store.create({ id, workspaceId: 'ws_a', projectId: 'proj_1', principalId: 'pr_1', tokenPrefix: 'pmi_ct_x', tokenHash: 'h', label, createdById: 'u_owner', createdAt: new Date(), lastUsedAt: null, revokedAt: null, revokedById: null, snapshotId: null });
}

describe('T1448 · touch', () => {
  it('creates the row on first call with firstSeenAt = lastSeenAt and the versions, and answers the health shape', async () => {
    const { service, store, credentials } = harness();
    await credential(credentials, 'cred_1', 'laptop');
    const health = await service.touch(CTX, { extensionVersion: '0.1.0', toolkitVersion: 'v0.16.4', serverVersion: '0.1.0' });
    expect(health).toEqual({ projectId: 'proj_1', contractVersion: '1.0', apiVersion: '1', serverVersion: '0.1.0', connectedAt: '2026-09-04T10:00:00.000Z', constitutionState: null });
    const row = await store.findByCredential('cred_1');
    expect(row).toMatchObject({ workspaceId: 'ws_a', projectId: 'proj_1', credentialId: 'cred_1', extensionVersion: '0.1.0', toolkitVersion: 'v0.16.4', contractVersion: '1.0', serverVersion: '0.1.0' });
    expect(row?.firstSeenAt.toISOString()).toBe('2026-09-04T10:00:00.000Z');
    expect(row?.lastSeenAt.toISOString()).toBe('2026-09-04T10:00:00.000Z');
  });

  it('updates lastSeenAt and the versions after; one row per credential', async () => {
    const { service, store, credentials, tick } = harness();
    await credential(credentials, 'cred_1', 'laptop');
    await service.touch(CTX, { extensionVersion: '0.1.0' });
    tick('2026-09-04T11:00:00Z');
    await service.touch(CTX, { extensionVersion: '0.2.0', toolkitVersion: 'v0.16.5' });
    const rows = await store.listForProject('ws_a', 'proj_1');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.firstSeenAt.toISOString()).toBe('2026-09-04T10:00:00.000Z');
    expect(rows[0]?.lastSeenAt.toISOString()).toBe('2026-09-04T11:00:00.000Z');
    expect(rows[0]).toMatchObject({ extensionVersion: '0.2.0', toolkitVersion: 'v0.16.5' });
  });

  it('is audited as connector.health with the versions in detail (FR-PIC-036)', async () => {
    const { service, credentials, audits } = harness();
    await credential(credentials, 'cred_1', 'laptop');
    await service.touch(CTX, { extensionVersion: '0.1.0' });
    expect(audits[0]).toMatchObject({ workspaceId: 'ws_a', actorId: 'pr_1', targetType: 'project', targetId: 'proj_1', outcome: 'success', detail: { kind: 'connector', operation: 'connector.health', extensionVersion: '0.1.0' } });
  });
});

describe('T1448 · the read for the screen', () => {
  it('joins the credential\'s label and state, and keeps a revoked credential\'s row', async () => {
    const { service, credentials, tick } = harness();
    await credential(credentials, 'cred_1', 'laptop');
    await credential(credentials, 'cred_2', 'desktop');
    await service.touch(CTX, { extensionVersion: '0.1.0' });
    tick('2026-09-04T12:00:00Z');
    await service.touch({ ...CTX, credentialId: 'cred_2' }, {});
    await credentials.revoke('ws_a', 'cred_1', 'u_owner', new Date('2026-09-04T12:30:00Z'));
    const views = await service.listForProject('ws_a', 'proj_1');
    expect(views.map((v) => `${v.label}:${v.credentialState}`)).toEqual(['desktop:active', 'laptop:revoked']);
    expect(views[1]).toMatchObject({ credentialId: 'cred_1', lastSeenAt: '2026-09-04T10:00:00.000Z' });
  });
});

describe('T1527 · the setup skill reports its constitution digest on pmi.health (EPIC-042)', () => {
  it('classifies the digest through the port, stores digest, state and time, and a second call updates the same row', async () => {
    const store = new InMemoryWorkstationConnectionStore();
    const credentials = new InMemoryConnectorCredentialStore();
    const seen: (string | null)[] = [];
    const service = new WorkstationConnectionService({
      store,
      credentials,
      contractVersion: '1.0',
      apiVersion: '1',
      audit: { record: async () => undefined },
      constitution: { classify: async (_projectId, digest) => { seen.push(digest); return digest === null ? 'missing' : 'current'; } },
      now: () => new Date('2026-09-04T10:00:00Z'),
    });
    const ctx = { credentialId: 'cred_1', workspaceId: 'ws_1', projectId: 'proj_1', principalId: 'pr_1' };
    const first = await service.touch(ctx, { extensionVersion: '0.2.0', toolkitVersion: 'v0.14.3', constitutionDigest: 'a'.repeat(64) });
    expect(first.constitutionState).toBe('current');
    const row = await store.findByCredential('cred_1');
    expect(row).toMatchObject({ constitutionDigest: 'a'.repeat(64), constitutionState: 'current', extensionVersion: '0.2.0', toolkitVersion: 'v0.14.3' });
    expect(row?.constitutionReportedAt?.toISOString()).toBe('2026-09-04T10:00:00.000Z');
    const second = await service.touch(ctx, { constitutionDigest: null });
    expect(second.constitutionState).toBe('missing');
    expect((await store.findByCredential('cred_1'))?.constitutionState).toBe('missing');
    expect(seen).toEqual(['a'.repeat(64), null]);
    // Not reported: the stored report is kept, the answer is null.
    const third = await service.touch(ctx, { serverVersion: '0.2.0' });
    expect(third.constitutionState).toBeNull();
    expect((await store.findByCredential('cred_1'))?.constitutionState).toBe('missing');
  });
});

describe('T1542 · the read for the screen names the render version a stale file last matched (EPIC-042 FR-EXT-067, Phase 9)', () => {
  it('resolves constitutionRenderVersion through the port for a digest that matched a render, and null for drift or nothing reported', async () => {
    const store = new InMemoryWorkstationConnectionStore();
    const credentials = new InMemoryConnectorCredentialStore();
    const service = new WorkstationConnectionService({
      store,
      credentials,
      contractVersion: '1.0',
      apiVersion: '1',
      audit: { record: async () => undefined },
      constitution: {
        classify: async (_projectId, digest) => (digest === 'b'.repeat(64) ? 'stale' : 'drift'),
        renderVersionOf: async (_projectId, digest) => (digest === 'b'.repeat(64) ? 2 : null),
      },
      now: () => new Date('2026-09-05T10:00:00Z'),
    });
    await credential(credentials, 'cred_1', 'laptop');
    await credential(credentials, 'cred_2', 'desktop');
    await credential(credentials, 'cred_3', 'tablet');
    await service.touch(CTX, { constitutionDigest: 'b'.repeat(64) });
    await service.touch({ ...CTX, credentialId: 'cred_2' }, { constitutionDigest: 'c'.repeat(64) });
    await service.touch({ ...CTX, credentialId: 'cred_3' }, {});
    const views = await service.listForProject('ws_a', 'proj_1');
    const byLabel = Object.fromEntries(views.map((v) => [v.label, v]));
    expect(byLabel['laptop']).toMatchObject({ constitutionState: 'stale', constitutionRenderVersion: 2 });
    expect(byLabel['desktop']).toMatchObject({ constitutionState: 'drift', constitutionRenderVersion: null });
    expect(byLabel['tablet']).toMatchObject({ constitutionState: null, constitutionRenderVersion: null });
  });
});
