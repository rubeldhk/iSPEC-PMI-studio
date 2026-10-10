/**
 * `T2395` (EPIC-048, Phase 9, `R-048-8`, `R-048-9`) — `EvidenceReads` and
 * `ReaderAccess` over `EPIC-032`.
 *
 * - `EvidenceReads` is `EvidenceService.resolve` (`A-032-1`), mapped to the
 *   port's shape. A citation is a **sha256** digest (`FR-LRN-012`), so the
 *   stored subject's sha256 is what it is compared with; an item attested under
 *   another algorithm only has none, and can therefore never read `verified`.
 *   A store outage is thrown as itself — `EvidenceView` reads every citation
 *   `unresolvable` with that reason, never `verified`.
 * - `ReaderAccess` is `EPIC-032`'s own `AccessControlEvidencePolicy` over
 *   `EPIC-024`: the question reading the artifact would ask. This Epic does not
 *   widen or narrow `EPIC-032`'s rule (`DEF-032-003` is inherited as-is).
 *
 * Framework-free (PC-1).
 */
import type { AccessPolicy } from '@pmi/evidence-contract';
import type { ResolvedAttestation } from '../../evidence/completion.gate.js';
import type { EvidenceReadsPort, ReaderAccessPort, ResolvedEvidence } from '../learning.tokens.js';

/** The slice of `EvidenceService` this adapter calls. */
export interface EvidenceResolver {
  resolve(workspaceId: string, ids: readonly string[]): Promise<ReadonlyMap<string, ResolvedAttestation>>;
}

export function toResolvedEvidence(item: ResolvedAttestation): ResolvedEvidence {
  return {
    evidenceId: item.id,
    integrity: item.integrity,
    resolution: item.resolution,
    // No sha256 subject: nothing a sha256 citation could equal.
    subjectDigest: item.subjectDigest.sha256 ?? '',
    predicateType: item.predicateType,
    attestedArtifact: { id: item.attestedArtifact.id, version: item.attestedArtifact.version },
    attestedTarget: { type: item.attestedTarget.type, id: item.attestedTarget.id },
  };
}

export function evidenceReadsAdapter(evidence: EvidenceResolver): EvidenceReadsPort {
  return {
    async resolve(workspaceId, evidenceIds) {
      const resolved = await evidence.resolve(workspaceId, evidenceIds);
      const out = new Map<string, ResolvedEvidence>();
      for (const [id, item] of resolved) out.set(id, toResolvedEvidence(item));
      return out;
    },
  };
}

export function readerAccessAdapter(policy: AccessPolicy): ReaderAccessPort {
  return {
    async canRead(reader, target) {
      try {
        return await policy.canRead({ workspaceId: reader.workspaceId, userId: reader.userId }, { type: target.type, id: target.id });
      } catch {
        return false;
      }
    },
  };
}
