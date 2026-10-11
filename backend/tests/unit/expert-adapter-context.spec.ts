/**
 * `T1981` (EPIC-047) — the context policy through the merged `EPIC-038`
 * assembly.
 *
 * `R-047-10`, `FR-EXP-015`. The Expert's context policy maps onto
 * `AssembleInput` field for field — `essentialSources` absent becomes `[]`,
 * which `EPIC-038` reads as "nothing marked essential" — and the package is
 * bound to the execution with `bindExecution`. A refusal from assembly
 * propagates as itself.
 */
import { describe, expect, it } from 'vitest';
import type { AssembleInput } from '../../src/modules/context/assembly.service.js';
import { contextAssembler } from '../../src/modules/experts/adapters/context.adapter.js';
import { ValidationFailedError } from '../../src/core/errors.js';

function assembly(refuse = false) {
  const inputs: AssembleInput[] = [];
  const bound: [string, string, string][] = [];
  return {
    inputs,
    bound,
    port: {
      async assemble(input: AssembleInput) {
        inputs.push(input);
        if (refuse) throw new ValidationFailedError('an essential source was excluded by budget');
        return { packageId: 'pkg_1' };
      },
      async bindExecution(ws: string, packageId: string, executionId: string) {
        bound.push([ws, packageId, executionId]);
        return {};
      },
    },
  };
}

const request = {
  workspaceId: 'ws_1',
  projectId: 'pr_1',
  objective: 'write the tests',
  actorId: 'u_1',
  actorRole: 'engineer',
  policy: { budgetTokens: 12000, budgetCost: 4, includeLiveState: true },
};

describe('T1981 · context assembly over EPIC-038', () => {
  it('maps the policy onto AssembleInput field for field', async () => {
    const a = assembly();
    const { packageId } = await contextAssembler(a.port).assemble(request);
    expect(packageId).toBe('pkg_1');
    expect(a.inputs).toEqual([
      {
        workspaceId: 'ws_1',
        projectId: 'pr_1',
        objective: 'write the tests',
        actorId: 'u_1',
        actorRole: 'engineer',
        budgetTokens: 12000,
        budgetCost: 4,
        essentialSources: [],
        includeLiveState: true,
      },
    ]);
  });

  it('carries the essential sources when the policy names them', async () => {
    const a = assembly();
    const essential = [{ sourceType: 'requirement', sourceId: 'rq_1' }];
    await contextAssembler(a.port).assemble({ ...request, policy: { ...request.policy, essentialSources: essential } });
    expect(a.inputs[0]?.essentialSources).toEqual(essential);
  });

  it('binds the package to the execution', async () => {
    const a = assembly();
    await contextAssembler(a.port).bind!('ws_1', 'pkg_1', 'exe_1');
    expect(a.bound).toEqual([['ws_1', 'pkg_1', 'exe_1']]);
  });

  it('a refusal from assembly propagates as itself', async () => {
    await expect(contextAssembler(assembly(true).port).assemble(request)).rejects.toBeInstanceOf(ValidationFailedError);
  });
});
