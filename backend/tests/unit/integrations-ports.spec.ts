/**
 * `T2133` (EPIC-039, `R-039-13`) — the ports this Epic declares are bound
 * **refusing** until their owners merge. A refusing port throws
 * `GovernanceSeamUnboundError` naming itself; none answers permissively.
 *
 * Route tests that need a permitted adapter bind a recording policy visibly in
 * the test (`seam.bind(...)`), never by a permissive default in the module.
 *
 * Written to FAIL before `T2134`.
 */
import { describe, expect, it } from 'vitest';
import { GovernanceSeamUnboundError } from '../../src/core/errors.js';
import { CapabilityPolicySeam, CredentialKeyringSeam, EvidenceSinkSeam, envKeyring } from '../../src/modules/integrations/integrations.tokens.js';

describe('T2133 · unbound ports refuse, naming themselves', () => {
  it('CapabilityPolicy', async () => {
    const seam = new CapabilityPolicySeam();
    expect(seam.isBound()).toBe(false);
    await expect(seam.port().requestDecision({ workspaceId: 'w', projectId: 'p', actorId: 'u', capability: 'ReadBuildStatus', configurationId: 'c', configVersion: 1 })).rejects.toThrow(GovernanceSeamUnboundError);
    await expect(seam.port().statusOf('w', 'd')).rejects.toThrow(/CapabilityPolicy/);
  });

  it('EvidenceSink', async () => {
    const seam = new EvidenceSinkSeam();
    await expect(seam.port().contribute({} as never)).rejects.toThrow(/EvidenceSink/);
    await expect(seam.port().bindingExists('w', { type: 't', id: 'i' }, 'item')).rejects.toThrow(GovernanceSeamUnboundError);
  });

  it('CredentialKeyring', () => {
    const seam = new CredentialKeyringSeam();
    expect(() => seam.port().activeKey()).toThrow(/CredentialKeyring/);
    expect(seam.port().key('k1')).toBeNull();
  });

  it('binding replaces the refusal, and is visible', async () => {
    const seam = new CapabilityPolicySeam();
    const calls: string[] = [];
    seam.bind({
      requestDecision: async () => {
        calls.push('decide');
        return { decisionId: 'd1' };
      },
      statusOf: async () => ({ status: 'permitted' }),
    });
    expect(seam.isBound()).toBe(true);
    await seam.port().requestDecision({ workspaceId: 'w', projectId: 'p', actorId: 'u', capability: 'ReadBuildStatus', configurationId: 'c', configVersion: 1 });
    expect(calls).toEqual(['decide']);
  });
});

describe('T2133 · the keyring from configuration (R-039-10)', () => {
  const key = Buffer.alloc(32, 7).toString('base64');

  it('is unbound without PMI_INTEGRATION_KEYS', () => {
    expect(envKeyring({})).toBeNull();
  });

  it('reads the keys and the active one', () => {
    const k = envKeyring({ PMI_INTEGRATION_KEYS: JSON.stringify({ k1: key }), PMI_INTEGRATION_ACTIVE_KEY: 'k1' })!;
    expect(k.activeKey().keyId).toBe('k1');
    expect(k.key('k1')!.length).toBe(32);
    expect(k.key('nope')).toBeNull();
  });

  it('refuses a key that is not 32 bytes, or an active key that is not listed — at boot, not at first use', () => {
    expect(() => envKeyring({ PMI_INTEGRATION_KEYS: JSON.stringify({ k1: 'c2hvcnQ=' }), PMI_INTEGRATION_ACTIVE_KEY: 'k1' })).toThrow(/32 bytes/);
    expect(() => envKeyring({ PMI_INTEGRATION_KEYS: JSON.stringify({ k1: key }), PMI_INTEGRATION_ACTIVE_KEY: 'k2' })).toThrow(/k2/);
  });
});
