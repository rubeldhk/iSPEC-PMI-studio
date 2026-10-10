/**
 * `T1980` (EPIC-047) — `EvidenceContracts` over `EPIC-032`'s `ContractCatalog`.
 *
 * `R-047-11`, `FR-EXP-022`. A contract references an Evidence Contract by its
 * package identity, `{workClass, contractVersion}` — the identity the
 * completion gate binds work to — so the question is asked of the catalog that
 * gate reads, not of a database row id.
 *
 * Nothing is caught. A catalog that cannot answer throws, and the throw reaches
 * the caller: an unchecked reference reading as *absent* would refuse a valid
 * contract for the wrong reason, and reading as *present* would accept one
 * nobody checked.
 */
import type { EvidenceContract } from '@pmi/evidence-contract';
import type { EvidenceContracts } from '../experts.tokens.js';

/** `EPIC-032`'s `ContractCatalog`, as far as a lookup needs it. */
export interface EvidenceCatalog {
  get(workClass: string, contractVersion: number): EvidenceContract | null;
}

export function catalogEvidence(catalog: EvidenceCatalog): EvidenceContracts {
  return {
    async exists(ref) {
      return catalog.get(ref.workClass, ref.contractVersion) !== null;
    },
  };
}
