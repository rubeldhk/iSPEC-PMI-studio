/**
 * `T2401` (EPIC-048, Phase 9, `R-048-10`) — `ExpertProvenance` over `EPIC-047`'s
 * export `EXPERT_PROVENANCE` (`A-047-2`).
 *
 * A pass-through, narrowed to the port's shape. `EPIC-047` answers from the
 * session record every time, with the contract version the session **started**
 * under; `null` means the execution is not an Expert session in this workspace.
 * A fault is thrown as itself: reading it as `null` would let an Expert whose
 * policy is `none` submit as if it were a person's execution (`FR-LRN-055`).
 *
 * Framework-free (PC-1).
 */
import type { ExpertProvenance } from '../../experts/provenance.js';
import type { ExpertProvenancePort } from '../learning.tokens.js';

export function expertsAdapter(provenance: ExpertProvenance): ExpertProvenancePort {
  return {
    async forExecution(workspaceId, executionId) {
      const facts = await provenance.forExecution(workspaceId, executionId);
      if (facts === null) return null;
      return {
        expertId: facts.expertId,
        contractVersionId: facts.contractVersionId,
        contractVersion: facts.contractVersion,
        memoryPolicy: facts.memoryPolicy,
      };
    },
  };
}
