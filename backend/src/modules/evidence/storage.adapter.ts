/**
 * `T856m` — `EvidenceStorage` bound to `EPIC-025`'s `StorageProvider`
 * (`FR-EVS-005`, `R-032-2`).
 *
 * Named as its own file because `EPIC-031`'s analysis found the equivalent
 * binding missing there (`C2`): the port was declared, the adapter was not, and
 * nothing failed — `DOR-08` asks whether tasks have tests, not whether ports
 * have bindings.
 *
 * ## Every failure is unresolvable
 *
 * `FR-EVS-014`: a reference whose target cannot be read reads as unresolvable,
 * never as satisfied. So an unknown provider, every `StorageFailure.reason`, a
 * target the destination does not list, and a provider that throws despite the
 * storage contract's *"adapters RETURN failures; they never throw"* all return
 * `resolved: false`. This adapter never throws either.
 *
 * ## Resolution is a listing, not a read
 *
 * `StorageProvider` exposes no read-back — `S4` says adding one is an ADR-level
 * decision. Listing the parent and finding the name is the strongest check the
 * contract permits, and it is what `FR-EVS-014` asks: *does the target still
 * resolve?* Whether its bytes are intact is `FR-EVS-013`, which the attestation
 * store checks against the recorded digest.
 */
import type { EvidenceReference, EvidenceStorage, ResolveResult, UnresolvableReason } from '@pmi/evidence-contract';
import type { StorageFailureReason, StorageProvider } from '@pmi/storage-contract';

/** The slice of `EPIC-025`'s `ProviderRegistry` this adapter reads. */
export interface StorageProviderLookup {
  get(name: string): StorageProvider | null;
}

const READ_FAILURES: ReadonlySet<StorageFailureReason> = new Set([
  'provider_unavailable',
  'authorisation_expired',
  'destination_missing',
]);

function split(location: string): { directory: string; name: string } {
  const cut = location.lastIndexOf('/');
  return cut < 0
    ? { directory: '', name: location }
    : { directory: location.slice(0, cut), name: location.slice(cut + 1) };
}

export class StorageProviderEvidenceStorage implements EvidenceStorage {
  constructor(private readonly providers: StorageProviderLookup) {}

  async resolve(reference: EvidenceReference): Promise<ResolveResult> {
    const provider = this.providers.get(reference.provider);
    if (provider === null) return { resolved: false, reason: 'unbound' };

    const { directory, name } = split(reference.location);
    try {
      const listed = await provider.listDestination(
        { providerName: reference.provider, destination: directory },
        directory,
      );
      if (!listed.ok) {
        const reason: UnresolvableReason = READ_FAILURES.has(listed.failure.reason)
          ? (listed.failure.reason as UnresolvableReason)
          : 'provider_unavailable';
        return { resolved: false, reason };
      }
      return listed.value.some((entry) => entry.name === name)
        ? { resolved: true }
        : { resolved: false, reason: 'destination_missing' };
    } catch {
      return { resolved: false, reason: 'provider_unavailable' };
    }
  }
}
