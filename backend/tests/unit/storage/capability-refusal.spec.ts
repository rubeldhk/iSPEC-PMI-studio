/**
 * T383 — a provider missing a required capability is refused, NAMING it
 * (FR-PUB-039, FR-PUB-030).
 */
import { describe, expect, it } from 'vitest';
import type { StorageProvider } from '@pmi/storage-contract';
import { ValidationFailedError } from '../../../src/core/errors.js';
import { WS, USER, storageHarness } from './helpers.js';

function crippledProvider(): StorageProvider {
  const h = storageHarness();
  const provider = h.provider;
  return {
    ...provider,
    descriptor: {
      ...provider.descriptor,
      name: 'crippled',
      capabilities: ['connect', 'checkHealth', 'putFile'], // no listDestination
    },
    connect: provider.connect.bind(provider),
    checkHealth: provider.checkHealth.bind(provider),
    putFile: provider.putFile.bind(provider),
    listDestination: provider.listDestination.bind(provider),
  };
}

describe('T383 · capability refusal at connection time', () => {
  it('refuses the provider, naming the missing capability', async () => {
    const h = storageHarness();
    h.registry.register(crippledProvider());
    const attempt = h.connectionService.connect(WS, {
      providerName: 'crippled',
      destination: 'folder',
      authorisedById: USER,
    });
    await expect(attempt).rejects.toThrow(ValidationFailedError);
    const err = (await attempt.catch((e: unknown) => e)) as ValidationFailedError;
    expect(err.message).toContain('listDestination');
    expect((err.details as { missingCapabilities: string[] }).missingCapabilities).toEqual([
      'listDestination',
    ]);
  });

  it('a fully-capable provider connects', async () => {
    const h = storageHarness();
    const view = await h.connectionService.connect(WS, {
      providerName: 'fixture',
      destination: 'folder',
      authorisedById: USER,
    });
    expect(view.id).toBeDefined();
  });
});
