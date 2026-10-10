/**
 * `T2172` (EPIC-039, `R-039-10`, `SC-HUB-005`) — AES-256-GCM with the project
 * bound into the additional authenticated data.
 *
 * Written to FAIL before `T2173`.
 */
import { describe, expect, it } from 'vitest';
import { GovernanceSeamUnboundError } from '../../src/core/errors.js';
import { CredentialCipher, CredentialDecryptionError, additionalData } from '../../src/modules/integrations/credentials/credential.cipher.js';
import { CredentialKeyringSeam } from '../../src/modules/integrations/integrations.tokens.js';
import { OWNER, PROJECT, WS, configure, testHub } from './integrations-hub.fixture.js';

const k1 = Buffer.alloc(32, 1);
const k2 = Buffer.alloc(32, 2);
const keyring = (active = 'k1') => {
  const seam = new CredentialKeyringSeam();
  seam.bind({ activeKey: () => ({ keyId: active, key: active === 'k1' ? k1 : k2 }), key: (id) => (id === 'k1' ? k1 : id === 'k2' ? k2 : null) });
  return seam;
};
const scope = { workspaceId: 'w', projectId: 'pA', registryEntryId: 'e', kind: 'github-token' };

describe('T2172 · the cipher', () => {
  it('round-trips', () => {
    const c = new CredentialCipher(() => keyring().port());
    expect(c.open(c.seal('s3cret-value', scope), scope)).toBe('s3cret-value');
  });

  it('uses a fresh random 12-byte IV per write, and a 16-byte tag', () => {
    const c = new CredentialCipher(() => keyring().port());
    const a = c.seal('same', scope);
    const b = c.seal('same', scope);
    expect(a.iv).toHaveLength(12);
    expect(a.authTag).toHaveLength(16);
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });

  it('fails to decrypt with another project\'s AAD (SC-HUB-005 holds in the cipher)', () => {
    const c = new CredentialCipher(() => keyring().port());
    const sealed = c.seal('project A only', scope);
    expect(() => c.open(sealed, { ...scope, projectId: 'pB' })).toThrow(CredentialDecryptionError);
    expect(() => c.open(sealed, { ...scope, registryEntryId: 'other' })).toThrow(CredentialDecryptionError);
    expect(additionalData(scope).toString()).toBe('w|pA|e|github-token');
  });

  it('fails closed on an unknown keyId, and rotation keeps old rows readable', () => {
    const old = new CredentialCipher(() => keyring('k1').port()).seal('v', scope);
    const rotated = new CredentialCipher(() => keyring('k2').port());
    expect(rotated.open(old, scope)).toBe('v');
    expect(() => rotated.open({ ...old, keyId: 'k9' }, scope)).toThrow(/no platform key k9/);
  });

  it('with no keyring the write is refused naming CredentialKeyring', () => {
    const c = new CredentialCipher(() => new CredentialKeyringSeam().port());
    expect(() => c.seal('v', scope)).toThrow(GovernanceSeamUnboundError);
    expect(() => c.seal('v', scope)).toThrow(/CredentialKeyring/);
  });
});

describe('T2172 · no keyring: nothing is stored, and the route answers 503', () => {
  it('set refuses and stores nothing', async () => {
    const hub = testHub({ keyring: false });
    const e = await hub.entry('github-rest');
    await expect(hub.credentials.set({ workspaceId: WS, userId: OWNER }, PROJECT, e.id, { kind: 'github-token', value: 'ghp_x0000000000000000000000' })).rejects.toThrow(/CredentialKeyring/);
    expect(await hub.store.credentialStatus(WS, PROJECT, e.id)).toBeNull();
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
  });
});
