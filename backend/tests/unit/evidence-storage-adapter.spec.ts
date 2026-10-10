/**
 * T856l — binding `EvidenceStorage` to `EPIC-025`'s `StorageProvider`, written
 * to fail first.
 *
 * Named as its own task because `EPIC-031`'s analysis found the equivalent
 * binding missing there (`C2`): the port existed, the adapter did not, and
 * nothing failed.
 *
 * The property under test is the direction of every failure. `FR-EVS-014`: a
 * reference whose target cannot be read is **unresolvable**, never satisfied —
 * so every `StorageFailure.reason`, an unknown provider, a provider that throws
 * against its own contract, and a target simply not listed all land on
 * `resolved: false`.
 */
import { describe, expect, it } from 'vitest';
import {
  storageFail,
  storageOk,
  type DestinationEntry,
  type StorageProvider,
  type StorageResult,
} from '@pmi/storage-contract';
import { StorageProviderEvidenceStorage } from '../../src/modules/evidence/storage.adapter.js';

function provider(list: () => Promise<StorageResult<DestinationEntry[]>>): StorageProvider {
  return {
    descriptor: { name: 'fixture' } as StorageProvider['descriptor'],
    connect: async () => storageOk({ providerName: 'fixture', destination: 'evidence' }),
    checkHealth: async () => storageOk('healthy' as const),
    putFile: async () => storageFail('provider_unavailable', 'unused'),
    listDestination: list,
  };
}

function registry(p: StorageProvider | null) {
  return { get: (name: string) => (p !== null && name === p.descriptor.name ? p : null) };
}

const ref = { provider: 'fixture', location: 'evidence/run-42/report.json' };

describe('T856l · FR-EVS-005 — a reference resolves through EPIC-025, not a second path', () => {
  it('resolves a target the provider lists', async () => {
    const storage = new StorageProviderEvidenceStorage(
      registry(provider(async () => storageOk([{ name: 'report.json', publishedVersion: null }]))),
    );
    await expect(storage.resolve(ref)).resolves.toEqual({ resolved: true });
  });

  it('asks the provider for the directory the location names', async () => {
    const asked: Array<string | undefined> = [];
    const storage = new StorageProviderEvidenceStorage(
      registry(
        provider(async (..._args) => {
          asked.push((_args as unknown[])[1] as string | undefined);
          return storageOk([{ name: 'report.json', publishedVersion: null }]);
        }) as StorageProvider,
      ),
    );
    await storage.resolve(ref);
    expect(asked).toEqual(['evidence/run-42']);
  });
});

describe('T856l · FR-EVS-014 — every way a target cannot be read is unresolvable', () => {
  it.each(['provider_unavailable', 'destination_missing', 'authorisation_expired'] as const)(
    'maps StorageFailure %s onto unresolvable',
    async (reason) => {
      const storage = new StorageProviderEvidenceStorage(
        registry(provider(async () => storageFail(reason, 'nope'))),
      );
      await expect(storage.resolve(ref)).resolves.toEqual({ resolved: false, reason });
    },
  );

  it('maps a failure reason that means nothing for a read onto provider_unavailable', async () => {
    const storage = new StorageProviderEvidenceStorage(
      registry(provider(async () => storageFail('quota_exceeded', 'nope'))),
    );
    await expect(storage.resolve(ref)).resolves.toEqual({
      resolved: false,
      reason: 'provider_unavailable',
    });
  });

  it('reads a target the provider does not list as destination_missing', async () => {
    const storage = new StorageProviderEvidenceStorage(
      registry(provider(async () => storageOk([{ name: 'other.json', publishedVersion: null }]))),
    );
    await expect(storage.resolve(ref)).resolves.toEqual({
      resolved: false,
      reason: 'destination_missing',
    });
  });

  it('reads an unregistered provider as unbound', async () => {
    const storage = new StorageProviderEvidenceStorage(registry(null));
    await expect(storage.resolve(ref)).resolves.toEqual({ resolved: false, reason: 'unbound' });
  });

  it('reads a provider that throws — against its own S1 rule — as provider_unavailable', async () => {
    const storage = new StorageProviderEvidenceStorage(
      registry(
        provider(async () => {
          throw new Error('boom');
        }),
      ),
    );
    await expect(storage.resolve(ref)).resolves.toEqual({
      resolved: false,
      reason: 'provider_unavailable',
    });
  });
});
