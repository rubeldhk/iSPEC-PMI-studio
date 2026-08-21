/**
 * T431 — the fixture provider run against the shared conformance suite
 * (T430). A provider is not conformant until all eight cases pass.
 */
import {
  storageConformanceSuite,
  type StorageConformanceHarness,
} from '@pmi/storage-contract/conformance';
import type { FileToPut, StorageFailureReason, StorageProvider } from '@pmi/storage-contract';
import { FixtureStorageProvider } from '../src/index.js';

const harness: StorageConformanceHarness = {
  provider(): StorageProvider {
    return new FixtureStorageProvider({ maxFileSizeBytes: 1000 });
  },
  injectFailure(provider: StorageProvider, reason: StorageFailureReason): void {
    (provider as FixtureStorageProvider).failWith(reason);
  },
  clearFailures(provider: StorageProvider): void {
    (provider as FixtureStorageProvider).clearFailure();
  },
  oversizedFile(): FileToPut {
    return { name: 'huge.bin', content: 'x'.repeat(2000), sizeBytes: 2000 };
  },
  invalidNameFile(): FileToPut {
    return { name: 'spec: draft?.md', content: 'body', sizeBytes: 4 };
  },
  expireAuthorisationAfter(provider: StorageProvider, puts: number): void {
    (provider as FixtureStorageProvider).expireAuthorisationAfter(puts);
  },
};

storageConformanceSuite('fixture', harness);
