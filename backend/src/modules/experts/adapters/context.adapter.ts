/**
 * `T1982` (EPIC-047) — `ContextAssembler` over `EPIC-038`'s `AssemblyService`.
 *
 * `R-047-10`, `FR-EXP-015`. The contract's context policy is a named subset of
 * `AssembleInput`, and it is passed field for field with the run's objective
 * and actor. This Epic assembles nothing, ranks nothing and excludes nothing:
 * every inclusion and exclusion is `EPIC-038`'s, recorded on its package.
 *
 * Assembly runs before the binding, so no `executionId` is put on the input —
 * `EPIC-038` stores an absent one as `null`, where an invented one would be a
 * binding to nothing that looks like one (`FR-CTX-062`). Dispatch then binds
 * the package to its execution with `bindExecution`.
 *
 * Refusals propagate. A run is not dispatched without the context its policy
 * calls for.
 */
import type { AssembleInput } from '../../context/assembly.service.js';
import type { ContextAssembler } from '../experts.tokens.js';

/** `EPIC-038`'s `AssemblyService`, as far as an Expert run needs it. */
export interface ContextAssembly {
  assemble(input: AssembleInput): Promise<{ readonly packageId: string }>;
  bindExecution(workspaceId: string, packageId: string, executionId: string): Promise<unknown>;
}

export function assemblyContext(assembly: ContextAssembly): ContextAssembler {
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
        includeLiveState: input.policy.includeLiveState,
        essentialSources: input.policy.essentialSources ?? [],
      });
      return { packageId };
    },

    async bind(workspaceId, packageId, executionId) {
      await assembly.bindExecution(workspaceId, packageId, executionId);
    },
  };
}
