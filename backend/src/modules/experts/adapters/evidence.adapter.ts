/**
 * `T2545` (EPIC-047) — `EvidenceContracts` over the merged `EPIC-032`
 * catalogue. Supersedes `T1980`.
 *
 * `R-047-11`, `FR-EXP-022`. The catalogue (`EVIDENCE_CATALOG`) answers
 * synchronously and returns `null` for a version it does not hold: `null` is
 * `false`. A catalogue that throws propagates — a fault is never read as
 * "this Evidence Contract does not exist", which would refuse a valid contract
 * for the wrong reason.
 */
import type { EvidenceContracts } from '../experts.tokens.js';

export interface EvidenceCatalog {
  get(workClass: string, contractVersion: number): object | null;
}

export function evidenceContracts(catalog: EvidenceCatalog): EvidenceContracts {
  return {
    async exists(ref) {
      return catalog.get(ref.workClass, ref.contractVersion) !== null;
    },
  };
}
