/**
 * `T1981` (EPIC-047) — an Expert's context comes from `EPIC-038`'s assembly.
 *
 * `R-047-10`, `FR-EXP-015`. The contract's context policy is a named subset of
 * `AssembleInput`, passed field for field with the run's objective and actor;
 * this Epic assembles nothing itself. The package is then bound to the
 * execution with `bindExecution`, so `EPIC-038` can say which run was shown it.
 */
import { describe, expect, it } from 'vitest';
import type { AssembleInput } from '../../src/modules/context/assembly.service.js';
import { assemblyContext, type ContextAssembly } from '../../src/modules/experts/adapters/context.adapter.js';
import type { ContextPolicy } from '../../src/modules/experts/expert.types.js';

function assembly(): ContextAssembly & { assembled: AssembleInput[]; bound: string[] } {
  const assembled: AssembleInput[] = [];
  const bound: string[] = [];
  return {
    assembled,
    bound,
    async assemble(input) {
      assembled.push(input);
      return { packageId: `pkg_${assembled.length}` };
    },
    async bindExecution(workspaceId, packageId, executionId) {
      bound.push(`${workspaceId}/${packageId}->${executionId}`);
    },
  };
}

const run = (policy: ContextPolicy) => ({
  workspaceId: 'ws_1',
  projectId: 'pr_1',
  objective: 'write the tests for the booking notification',
  actorId: 'u_1',
  actorRole: 'engineer',
  policy,
});

describe('T1981 · the context policy maps onto AssembleInput field for field', () => {
  it('every policy field, the objective and the actor reach assemble — and nothing else', async () => {
    const a = assembly();
    const essential = [{ sourceType: 'specification', sourceId: 'sp_1' }];
    const result = await assemblyContext(a).assemble(
      run({ budgetTokens: 8000, budgetCost: 2.5, includeLiveState: true, essentialSources: essential }),
    );
    expect(result).toEqual({ packageId: 'pkg_1' });
    expect(a.assembled).toEqual([
      {
        workspaceId: 'ws_1',
        projectId: 'pr_1',
        objective: 'write the tests for the booking notification',
        actorId: 'u_1',
        actorRole: 'engineer',
        budgetTokens: 8000,
        budgetCost: 2.5,
        includeLiveState: true,
        essentialSources: essential,
      },
    ]);
  });

  it('a policy naming no essential sources asks for none — an empty list, never undefined', async () => {
    const a = assembly();
    await assemblyContext(a).assemble(run({ budgetTokens: 1000, budgetCost: 0.1, includeLiveState: false }));
    expect(a.assembled[0]).toMatchObject({ essentialSources: [], includeLiveState: false });
  });

  it('assembles ahead of the binding: no execution id is invented on the input', async () => {
    const a = assembly();
    await assemblyContext(a).assemble(run({ budgetTokens: 1000, budgetCost: 0.1, includeLiveState: false }));
    expect(a.assembled[0]).not.toHaveProperty('executionId');
  });

  it('an assembly refusal propagates — no run without the context its policy calls for', async () => {
    const refusing: ContextAssembly = {
      async assemble() {
        throw new Error('the budget cannot fit an essential source (FR-CTX-038)');
      },
      async bindExecution() {
        throw new Error('not reached');
      },
    };
    await expect(
      assemblyContext(refusing).assemble(run({ budgetTokens: 10, budgetCost: 0, includeLiveState: false })),
    ).rejects.toThrow(/FR-CTX-038/);
  });
});

describe('T1981 · the package is bound to the execution with bindExecution', () => {
  it('binds the assembled package to the execution that consumes it', async () => {
    const a = assembly();
    const context = assemblyContext(a);
    const { packageId } = await context.assemble(run({ budgetTokens: 1000, budgetCost: 0.1, includeLiveState: false }));
    expect(context.bind).toBeTypeOf('function');
    await context.bind!('ws_1', packageId, 'exe_1');
    expect(a.bound).toEqual(['ws_1/pkg_1->exe_1']);
  });

  it('a binding fault propagates', async () => {
    const a = assembly();
    a.bindExecution = async () => {
      throw new Error('package already bound');
    };
    await expect(assemblyContext(a).bind!('ws_1', 'pkg_1', 'exe_1')).rejects.toThrow(/already bound/);
  });
});
