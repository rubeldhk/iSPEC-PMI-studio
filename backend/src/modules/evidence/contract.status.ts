/**
 * `T857d` — the derived Contract status. `FR-EVS-022`, `FR-EVS-027`,
 * `FR-EVS-030`.
 *
 * **met/unmet is computed from evidence and never set.** There is no column a
 * caller can write to mark an item satisfied (data-model §3), so the only way to
 * change an item's state is to change the evidence — which is append-only.
 *
 * Two steps, kept apart so the rules need no database to exercise:
 *
 * 1. `assess` — I/O. For each attestation: does its stored payload still match
 *    its recorded digest (`FR-EVS-013`, `FR-EVS-034`), and does its reference
 *    still resolve (`FR-EVS-014`)?
 * 2. `deriveStatus` — pure. Given the Contract, the assessed evidence and the
 *    subject the work is judged against, the state of every item.
 *
 * Deriving on read is what makes `FR-EVS-031` true without a cleanup path:
 * evidence arriving changes the answer on the next read, with nothing to
 * invalidate.
 */
import { declaresFailure } from '@pmi/evidence-contract';
import type {
  ContractStatus,
  EvidenceContract,
  EvidenceStorage,
  ItemState,
  ItemStatus,
} from '@pmi/evidence-contract';
import { digestOf, sameDigest } from './integrity.js';
import type { StoredAttestation } from './evidence.types.js';

export interface AssessedEvidence {
  readonly id: string;
  readonly predicateType: string;
  readonly attestedArtifactId: string;
  readonly attestedVersion: number;
  readonly resolution: 'resolved' | 'unresolvable';
  readonly integrity: 'valid' | 'failed';
  /**
   * The evidence reports a failure of what it attests — a `test-result` whose
   * result is `FAILED` (`declaresFailure`). Optional: absent means it does not.
   */
  readonly reportsFailure?: boolean;
}

export interface JudgedSubject {
  readonly artifactId: string;
  readonly version: number;
}

/**
 * Step 1. Never throws: a provider that fails reads as unresolvable, which is
 * not met (`FR-EVS-014`). An absent `EvidenceStorage` port makes every
 * reference unresolvable — the port's declared absent-behaviour is refuse.
 */
export async function assess(
  attestations: readonly StoredAttestation[],
  storage: EvidenceStorage | null,
): Promise<AssessedEvidence[]> {
  return Promise.all(
    attestations.map(async (a): Promise<AssessedEvidence> => {
      let integrity: 'valid' | 'failed' = a.integrityValid ? 'valid' : 'failed';
      let resolution: 'resolved' | 'unresolvable' = 'resolved';

      if (a.storage === 'stored') {
        // Re-checked on every read, not trusted from the write: the row is
        // append-only, but the check costs a hash and the guarantee is the point.
        if (!sameDigest(digestOf(a.payload), a.integrity)) integrity = 'failed';
      } else if (a.reference === null || storage === null) {
        resolution = 'unresolvable';
      } else {
        const resolved = await storage.resolve(a.reference).catch(() => null);
        if (resolved === null || !resolved.resolved) resolution = 'unresolvable';
        else if (resolved.digest?.sha256 !== undefined && resolved.digest.sha256 !== a.integrity.value) {
          integrity = 'failed';
        }
      }

      // The stored payload is the in-toto Statement; its predicate says what
      // was proved. A referenced payload cannot be read back (storage-contract
      // S4), so its outcome is unknown here — recorded as DEF-032-004.
      const predicate =
        a.storage === 'stored' && typeof a.payload === 'object' && a.payload !== null
          ? (a.payload as { predicate?: unknown }).predicate
          : undefined;

      return {
        id: a.id,
        predicateType: a.predicateType,
        attestedArtifactId: a.attestedArtifactId,
        attestedVersion: a.attestedVersion,
        resolution,
        integrity,
        reportsFailure: declaresFailure(a.predicateType, predicate),
      };
    }),
  );
}

function itemStatus(
  itemId: string,
  description: string,
  accepting: readonly string[],
  evidence: readonly AssessedEvidence[],
  subject: JudgedSubject,
): ItemStatus {
  const unmet = (state: ItemState, reason: string): ItemStatus => ({ itemId, description, state, reason });

  const ofType = evidence.filter((e) => accepting.includes(e.predicateType));
  if (ofType.length === 0) {
    // FR-EVS-025 — say why, when something was attached that does not count.
    const other = evidence.find((e) => !accepting.includes(e.predicateType));
    return other === undefined
      ? unmet('unmet', 'no evidence attached')
      : unmet(
          'unmet',
          `evidence ${other.id} is ${other.predicateType}; this item accepts ${accepting.join(', ')} (FR-EVS-025)`,
        );
  }

  // FR-EVS-011, FR-EVS-012 — the right artifact AND the right version.
  const onSubject = ofType.filter(
    (e) => e.attestedArtifactId === subject.artifactId && e.attestedVersion === subject.version,
  );
  if (onSubject.length === 0) {
    const stale = ofType[0]!;
    return unmet(
      'unmet',
      `evidence ${stale.id} attests ${stale.attestedArtifactId} v${stale.attestedVersion}, ` +
        `not ${subject.artifactId} v${subject.version} (FR-EVS-012)`,
    );
  }

  const valid = onSubject.find(
    (e) => e.resolution === 'resolved' && e.integrity === 'valid' && e.reportsFailure !== true,
  );
  if (valid !== undefined) return { itemId, description, state: 'met', evidenceId: valid.id };

  // Nothing on the subject is usable. Each candidate is untrusted, unreachable
  // or reports failure; say the most serious, in that order.
  const tampered = onSubject.find((e) => e.integrity === 'failed');
  if (tampered !== undefined) {
    return unmet('integrity-failed', `evidence ${tampered.id} failed its integrity check (FR-EVS-034)`);
  }
  const unreachable = onSubject.find((e) => e.resolution === 'unresolvable');
  if (unreachable !== undefined) {
    return unmet('unresolvable', `evidence ${unreachable.id} references a target that no longer resolves (FR-EVS-014)`);
  }
  return unmet('unmet', `evidence ${onSubject[0]!.id} reports a failure of what it attests (BR-0144)`);
}

/** Step 2. Pure. */
export function deriveStatus(
  contract: EvidenceContract,
  evidence: readonly AssessedEvidence[],
  subject: JudgedSubject,
): ContractStatus {
  const items = contract.items.map((item) =>
    itemStatus(item.itemId, item.description, item.acceptingPredicateTypes, evidence, subject),
  );
  const unmet = items.filter((i) => i.state !== 'met').map((i) => i.itemId);
  return {
    workClass: contract.workClass,
    contractVersion: contract.contractVersion,
    items,
    unmet,
    satisfied: unmet.length === 0,
    ...(contract.items.length === 0 && contract.zeroItemPolicyRef !== undefined
      ? { zeroItemPolicyRef: contract.zeroItemPolicyRef }
      : {}),
  };
}
