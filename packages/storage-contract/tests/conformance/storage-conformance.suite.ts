/**
 * T430 — the shared storage conformance suite: SC-01 to SC-08 from
 * `storage-provider-contract.md`. One suite, run against EVERY provider; a
 * provider is not conformant until all cases pass. The fixture must be able
 * to inject each failure on demand — that ability is the harness interface.
 */
import { describe, expect, it } from 'vitest';
import {
  missingRequiredCapabilities,
  STORAGE_FAILURE_REASONS,
  type FileToPut,
  type StorageFailureReason,
  type StorageProvider,
} from '../../src/index.js';

export interface StorageConformanceHarness {
  /** A FRESH provider instance per call. */
  provider(): StorageProvider;
  /** Inject the named failure into subsequent operations. */
  injectFailure(provider: StorageProvider, reason: StorageFailureReason): void;
  clearFailures(provider: StorageProvider): void;
  /** A file exceeding the provider's size limit (S6). */
  oversizedFile(): FileToPut;
  /** A file whose name is invalid at the destination (S8). */
  invalidNameFile(): FileToPut;
  /** Authorisation expires after `puts` successful writes (SC-06). */
  expireAuthorisationAfter(provider: StorageProvider, puts: number): void;
}

const DESTINATION = 'conformance-folder';

function file(name: string, content = 'body'): FileToPut {
  return { name, content, sizeBytes: content.length };
}

export function storageConformanceSuite(name: string, harness: StorageConformanceHarness): void {
  describe(`storage conformance · ${name}`, () => {
    it('SC-01 — a provider missing a required capability is refused, naming it (FR-PUB-039)', () => {
      const provider = harness.provider();
      expect(missingRequiredCapabilities(provider.descriptor)).toEqual([]);
      const crippled = {
        ...provider.descriptor,
        capabilities: provider.descriptor.capabilities.filter((c) => c !== 'listDestination'),
      };
      expect(missingRequiredCapabilities(crippled)).toEqual(['listDestination']);
    });

    it('SC-02 — checkHealth returns three DISTINCT states; unreachable is never healthy (S5)', async () => {
      const provider = harness.provider();
      const connected = await provider.connect({ destination: DESTINATION });
      expect(connected.ok).toBe(true);
      if (!connected.ok) return;

      const healthy = await provider.checkHealth(connected.value);
      expect(healthy).toEqual({ ok: true, value: 'healthy' });

      harness.injectFailure(provider, 'authorisation_expired');
      const reauth = await provider.checkHealth(connected.value);
      expect(reauth).toEqual({ ok: true, value: 'needs_reauthorisation' });

      harness.injectFailure(provider, 'provider_unavailable');
      const down = await provider.checkHealth(connected.value);
      expect(down).toEqual({ ok: true, value: 'unavailable' });
    });

    it('SC-03 — each of the five failure reasons is returned distinctly (FR-PUB-035, SC-009)', async () => {
      const seen = new Set<string>();
      for (const reason of STORAGE_FAILURE_REASONS) {
        const provider = harness.provider();
        const connected = await provider.connect({ destination: DESTINATION });
        if (!connected.ok) return expect.fail('connect must succeed before injection');
        harness.injectFailure(provider, reason);
        const outcome = await provider.putFile(connected.value, file('spec.md'));
        expect(outcome.ok).toBe(false);
        if (!outcome.ok) {
          expect(outcome.failure.reason).toBe(reason);
          expect(outcome.failure.message).not.toBe('');
          seen.add(outcome.failure.reason);
        }
      }
      expect(seen.size).toBe(STORAGE_FAILURE_REASONS.length);
    });

    it('SC-04 — an oversized file is skipped and reported; the publish continues (S6)', async () => {
      const provider = harness.provider();
      const connected = await provider.connect({ destination: DESTINATION });
      if (!connected.ok) return expect.fail('connect must succeed');

      const big = await provider.putFile(connected.value, harness.oversizedFile());
      expect(big.ok).toBe(true);
      if (big.ok) {
        expect(big.value.status).toBe('skipped');
        expect(big.value.skippedReason).toBe('size_limit_exceeded');
      }
      // The rest continue: an ordinary file still writes afterwards.
      const small = await provider.putFile(connected.value, file('small.md'));
      expect(small.ok).toBe(true);
      if (small.ok) expect(small.value.status).toBe('written');
    });

    it('SC-05 — an invalid destination name is adapted and the adaptation reported (S8)', async () => {
      const provider = harness.provider();
      const connected = await provider.connect({ destination: DESTINATION });
      if (!connected.ok) return expect.fail('connect must succeed');

      const invalid = harness.invalidNameFile();
      const outcome = await provider.putFile(connected.value, invalid);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.value.status).toBe('written');
        expect(outcome.value.adaptedFrom).toBe(invalid.name);
        expect(outcome.value.name).not.toBe(invalid.name);
        expect(outcome.value.destinationLocation).not.toBeNull();
      }
    });

    it('SC-06 — authorisation expiring mid-publish stops it and what landed stays landed', async () => {
      const provider = harness.provider();
      const connected = await provider.connect({ destination: DESTINATION });
      if (!connected.ok) return expect.fail('connect must succeed');

      harness.expireAuthorisationAfter(provider, 1);
      const first = await provider.putFile(connected.value, file('one.md'));
      expect(first.ok).toBe(true);
      const second = await provider.putFile(connected.value, file('two.md'));
      expect(second.ok).toBe(false);
      if (!second.ok) expect(second.failure.reason).toBe('authorisation_expired');

      // What was published before the expiry is still at the destination.
      harness.clearFailures(provider);
      const listed = await provider.listDestination(connected.value);
      expect(listed.ok).toBe(true);
      if (listed.ok) {
        expect(listed.value.map((e) => e.name)).toContain('one.md');
        expect(listed.value.map((e) => e.name)).not.toContain('two.md');
      }
    });

    it('SC-07 — no read-back capability is exposed (S4, ADR-0004)', async () => {
      const provider = harness.provider() as unknown as Record<string, unknown>;
      for (const forbidden of ['getFile', 'readFile', 'download', 'fetchFile', 'importBack', 'deleteFile']) {
        expect(provider[forbidden], `provider must not expose ${forbidden}`).toBeUndefined();
      }
      // listDestination returns names and versions only — never content.
      const typed = harness.provider();
      const connected = await typed.connect({ destination: DESTINATION });
      if (!connected.ok) return expect.fail('connect must succeed');
      await typed.putFile(connected.value, file('spec.md'));
      const listed = await typed.listDestination(connected.value);
      if (listed.ok && listed.value.length > 0) {
        expect(Object.keys(listed.value[0]!).sort()).toEqual(['name', 'publishedVersion']);
      }
    });

    it('SC-08 — switching providers preserves what was published (FR-PUB-038, SC-010)', async () => {
      const first = harness.provider();
      const connectedA = await first.connect({ destination: DESTINATION });
      if (!connectedA.ok) return expect.fail('connect must succeed');
      await first.putFile(connectedA.value, file('kept.md'));

      // The platform switches to a second provider instance…
      const second = harness.provider();
      const connectedB = await second.connect({ destination: 'other-folder' });
      expect(connectedB.ok).toBe(true);

      // …and nothing about that touched the first destination: the published
      // file is still there, and no contract operation could have removed it.
      const listed = await first.listDestination(connectedA.value);
      expect(listed.ok).toBe(true);
      if (listed.ok) expect(listed.value.map((e) => e.name)).toContain('kept.md');
    });
  });
}
