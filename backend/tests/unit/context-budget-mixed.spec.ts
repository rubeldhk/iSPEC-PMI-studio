/**
 * `T1823` (EPIC-038 Convergence) — the budget admits nothing, though not every
 * exclusion was budget.
 *
 * `FR-CTX-037`. The refusal fired only when *every* exclusion was `budget`, so
 * a package where permission removed some candidates and the budget removed
 * all the rest assembled empty — reporting "nothing was relevant" when the
 * truth was "nothing that was eligible was affordable". The test that matters
 * is whether the budget admitted anything that got that far.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { candidates, classes, denyFor, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

describe('T1823 · a budget that admits no eligible candidate refuses', () => {
  it('permission removes one, the budget removes the rest: refused', async () => {
    const store = new InMemoryContextStore();
    await expect(
      new AssemblyService(store, {
        retrieval: retrieval(candidates(['rq_1', 'rq_2', 'rq_3'])),
        access: denyFor('rq_1'),
        sourceClasses: classes(['requirement']),
        authorisations: noAuthorisations(),
        costOf: () => 1000,
      }).assemble(input({ budgetTokens: 500 })),
    ).rejects.toThrow(/budget[\s\S]*FR-CTX-037/);
    const [refused] = await store.packagesForExecution('ws_1', 'ex_1');
    expect(refused?.state).toBe('refused');
  });

  it('the control: permission removes everything, so the budget was never tested — an empty package that says so', async () => {
    const store = new InMemoryContextStore();
    const result = await new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1', 'rq_2'])),
      access: denyFor('rq_1', 'rq_2'),
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
      costOf: () => 1000,
    }).assemble(input({ budgetTokens: 500 }));
    expect([result.itemCount, result.exclusionCount]).toEqual([0, 2]);
  });
});
