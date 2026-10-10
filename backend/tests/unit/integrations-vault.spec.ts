/**
 * `T2174` (EPIC-039, `FR-HUB-042`, `FR-HUB-044`) — the vault yields a handle
 * only for the resolved project and adapter, and the plaintext only inside
 * `use(fn)`.
 *
 * Written to FAIL before `T2175`.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT, OTHER_PROJECT, WS, testHub } from './integrations-hub.fixture.js';

const now = new Date('2026-10-10T12:00:00Z');

describe('T2174 · withCredential', () => {
  it('yields a handle for the project and adapter it was stored for', async () => {
    const hub = testHub();
    await hub.vault.store({ workspaceId: WS, projectId: PROJECT, registryEntryId: 'e1' }, 'github-token', 'secret-A', 'u', now);
    const seen = await hub.vault.withCredential({ workspaceId: WS, projectId: PROJECT, registryEntryId: 'e1' }, async (h) => (h === null ? null : h.use((v) => v)));
    expect(seen).toBe('secret-A');
  });

  it('yields nothing for another project or another adapter — never A\'s credential for B (SC-HUB-005)', async () => {
    const hub = testHub();
    await hub.vault.store({ workspaceId: WS, projectId: PROJECT, registryEntryId: 'e1' }, 'github-token', 'secret-A', 'u', now);
    expect(await hub.vault.withCredential({ workspaceId: WS, projectId: OTHER_PROJECT, registryEntryId: 'e1' }, async (h) => h)).toBeNull();
    expect(await hub.vault.withCredential({ workspaceId: WS, projectId: PROJECT, registryEntryId: 'e2' }, async (h) => h)).toBeNull();
  });

  it('a row copied to another project fails to decrypt and is treated as absent', async () => {
    const hub = testHub();
    await hub.vault.store({ workspaceId: WS, projectId: PROJECT, registryEntryId: 'e1' }, 'github-token', 'secret-A', 'u', now);
    const port = hub.store.vaultPort();
    const row = (await port.readCredentialRow(WS, PROJECT, 'e1'))!;
    await port.putCredentialRow({ ...row, projectId: OTHER_PROJECT });
    expect(await hub.vault.withCredential({ workspaceId: WS, projectId: OTHER_PROJECT, registryEntryId: 'e1' }, async (h) => h)).toBeNull();
  });

  it('the handle itself reveals nothing; the status view carries no value', async () => {
    const hub = testHub();
    const status = await hub.vault.store({ workspaceId: WS, projectId: PROJECT, registryEntryId: 'e1' }, 'github-token', 'secret-A', 'u', now);
    expect(JSON.stringify(status)).not.toContain('secret-A');
    await hub.vault.withCredential({ workspaceId: WS, projectId: PROJECT, registryEntryId: 'e1' }, async (h) => {
      expect(String(h)).toBe('[credential]');
      expect(() => JSON.stringify(h)).toThrow();
    });
  });
});
