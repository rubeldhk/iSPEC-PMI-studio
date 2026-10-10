/**
 * `T1801` (EPIC-038 Convergence) — the cost half of the budget.
 *
 * `FR-CTX-031`, `FR-CTX-035`, `FR-CTX-037`. A package is assembled within a
 * token **and** cost budget. `budgetCost` was recorded on every package and
 * compared with nothing, so a package could exceed it with no exclusion and no
 * refusal — a limit somebody set, silently ignored.
 *
 * Cost is tokens priced by the workspace's budget policy (`FR-CTX-036`): the
 * price is configuration, so the test supplies one.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { allow, candidates, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

/** 1,000 tokens per candidate at 2.00 per thousand: each candidate costs 2.00. */
async function storeWithPolicy(): Promise<InMemoryContextStore> {
  const store = new InMemoryContextStore();
  await store.addBudgetPolicy({
    workspaceId: 'ws_1',
    retrievalLimit: 10,
    tokensPerCandidate: 1000,
    costPerThousandTokens: 2,
  });
  return store;
}

function assembler(store: InMemoryContextStore, ids: string[]) {
  return new AssemblyService(store, {
    retrieval: retrieval(candidates(ids)),
    access: allow(),
    sourceClasses: classes(['requirement']),
    authorisations: noAuthorisations(),
    budgetPolicy: store,
  });
}

describe('T1801 · the cost budget is enforced', () => {
  it('a candidate inside the token budget but over the cost budget is excluded as budget', async () => {
    const store = await storeWithPolicy();
    // Tokens admit all three (3,000 of 12,000); cost admits two (4.00 of 5.00).
    const result = await assembler(store, ['rq_1', 'rq_2', 'rq_3']).assemble(
      input({ budgetTokens: 12000, budgetCost: 5 }),
    );
    expect((await store.itemsFor('ws_1', result.packageId)).map((i) => i.sourceId)).toEqual(['rq_1', 'rq_2']);
    const [exclusion] = await store.exclusionsFor('ws_1', result.packageId);
    expect(exclusion?.reason).toBe('budget');
    expect(exclusion?.detail).toMatch(/cost/);
    expect(exclusion?.detail).toMatch(/5/);
  });

  it('and every candidate is accounted for: items + exclusions = candidates', async () => {
    const store = await storeWithPolicy();
    const result = await assembler(store, ['rq_1', 'rq_2', 'rq_3']).assemble(
      input({ budgetTokens: 12000, budgetCost: 5 }),
    );
    expect(result.itemCount + result.exclusionCount).toBe(3);
  });

  it('a cost budget that admits nothing refuses, rather than returning an empty package', async () => {
    const store = await storeWithPolicy();
    await expect(
      assembler(store, ['rq_1', 'rq_2']).assemble(input({ budgetTokens: 12000, budgetCost: 1 })),
    ).rejects.toThrow(/budget[\s\S]*FR-CTX-037/);
    const [refused] = await store.packagesForExecution('ws_1', 'ex_1');
    expect(refused?.state).toBe('refused');
  });

  it('the token budget still binds when it is the tighter of the two', async () => {
    const store = await storeWithPolicy();
    const result = await assembler(store, ['rq_1', 'rq_2', 'rq_3']).assemble(
      input({ budgetTokens: 1500, budgetCost: 100 }),
    );
    expect(result.itemCount).toBe(1);
    const [exclusion] = await store.exclusionsFor('ws_1', result.packageId);
    expect(exclusion?.detail).toMatch(/token/);
  });
});
