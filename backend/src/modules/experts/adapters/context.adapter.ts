/**
 * `T1982` (EPIC-047) — `ContextAssembler` over the merged `EPIC-038`
 * assembly.
 *
 * `R-047-10`, `FR-EXP-015`. The Expert's context policy is the subset of
 * `AssembleInput` an Expert fixes; it maps field for field, with an absent
 * `essentialSources` passed as `[]` — "nothing marked essential", which is how
 * `EPIC-038` reads it. The package is bound to the run's execution with
 * `bindExecution`. Assembly's refusals propagate as themselves: dispatch
 * records them as a refused dispatch.
 */
import type { AssembleInput } from '../../context/assembly.service.js';
import type { ContextAssembler } from '../experts.tokens.js';

export interface Assembly {
  assemble(input: AssembleInput): Promise<{ readonly packageId: string }>;
  bindExecution(workspaceId: string, packageId: string, executionId: string): Promise<unknown>;
}

export function contextAssembler(assembly: Assembly): ContextAssembler {
  return {
    async assemble(input) {
      const { packageId } = await assembly.assemble({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        objective: input.objective,
        actorId: input.actorId,
        actorRole: input.actorRole,
        budgetTokens: input.policy.budgetTokens,
        budgetCost: input.policy.budgetCost,
        essentialSources: input.policy.essentialSources ?? [],
        includeLiveState: input.policy.includeLiveState,
      });
      return { packageId };
    },
    async bind(workspaceId, packageId, executionId) {
      await assembly.bindExecution(workspaceId, packageId, executionId);
    },
  };
}
