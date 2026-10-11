/**
 * `T2215` (EPIC-039, `R-039-11`, `FR-HUB-052`) — `EPIC-032`'s `AttestationSource`,
 * filled by the Hub. Unit test: `T2214`.
 *
 * `EPIC-032` refuses every external evidence source until an adapter registry
 * authorises it (`FR-EVS-040`), and records the version it was authorised at
 * (`FR-EVS-041`). The registry is this Epic's: `pmi-adapter:<key>` is
 * authorised for an **active outbound** entry of **that** workspace whose
 * adapter is in this build, at the catalog's version. Anything else is `null`
 * — `EPIC-032` turns that into its own refusal.
 */
import type { AttestationSource, AuthorisedSource } from '@pmi/evidence-contract';
import type { RegistryEntryRecord } from '../integrations.store.js';

export const ADAPTER_SOURCE_PREFIX = 'pmi-adapter:';

export interface AttestationSourceDeps {
  readonly store: { findEntryByKey(workspaceId: string, key: string): Promise<RegistryEntryRecord | null> };
  readonly catalog: { descriptor(key: string): { readonly version: string } | null };
}

export function hubAttestationSource(deps: AttestationSourceDeps): AttestationSource {
  return {
    async authorise(sourceUri: string, workspaceId: string): Promise<AuthorisedSource | null> {
      if (!sourceUri.startsWith(ADAPTER_SOURCE_PREFIX)) return null;
      const key = sourceUri.slice(ADAPTER_SOURCE_PREFIX.length);
      if (key === '') return null;
      const entry = await deps.store.findEntryByKey(workspaceId, key);
      if (entry === null || entry.workspaceId !== workspaceId || entry.status !== 'active' || entry.direction !== 'outbound') return null;
      const descriptor = deps.catalog.descriptor(key);
      if (descriptor === null) return null;
      return { uri: sourceUri, version: descriptor.version };
    },
  };
}
