/**
 * `T2024` (EPIC-047) — amendment `A-047-2`: which Expert ran an execution.
 *
 * `FR-EXP-064`. Exported from `ExpertsModule` as `EXPERT_PROVENANCE` for
 * `EPIC-048`'s `ExpertProvenance` port, which uses the memory policy to decide
 * whether an Expert may submit learning (`FR-LRN-055`). Read from the session
 * record every time — never cached — and answered with the version the session
 * **started** under (`FR-EXP-062`), not whatever is approved now. An execution
 * that is not an Expert session, or belongs to another workspace, reads `null`
 * (`FR-EXP-008`). Nothing here does any learning.
 */
import type { MemoryPolicy } from './expert.types.js';
import type { ExpertsStore } from './experts.store.js';

export const EXPERT_PROVENANCE = Symbol('EXPERT_PROVENANCE');

export interface ExpertExecutionProvenance {
  readonly expertId: string;
  readonly contractVersionId: string;
  readonly contractVersion: number;
  readonly memoryPolicy: MemoryPolicy;
}

export interface ExpertProvenance {
  forExecution(workspaceId: string, executionId: string): Promise<ExpertExecutionProvenance | null>;
}

export function expertProvenance(store: ExpertsStore): ExpertProvenance {
  return {
    async forExecution(workspaceId, executionId) {
      const session = await store.findSession(workspaceId, executionId);
      if (session === null) return null;
      const version = (await store.versionsFor(workspaceId, session.expertId)).find((v) => v.id === session.contractVersionId);
      // A session always names a stored version (foreign key); if it cannot be
      // read, saying "not an Expert" would be wrong, so the fault is raised.
      if (version === undefined) {
        throw new Error(`session ${executionId} names contract version ${session.contractVersionId}, which cannot be read`);
      }
      return {
        expertId: session.expertId,
        contractVersionId: version.id,
        contractVersion: version.version,
        memoryPolicy: version.contract.memoryPolicy,
      };
    },
  };
}
