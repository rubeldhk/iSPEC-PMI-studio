/**
 * `T1874` (EPIC-038 Convergence) — the budget is spent on essential material
 * first.
 *
 * `FR-CTX-039`, `US1/AC4`, `SC-CTX-004`. Assembly refuses when the budget
 * *cannot* fit something marked essential. The budget pass spent strictly by
 * relevance, so more relevant items used it up before a lower-ranked essential
 * one was reached — and the assembly refused although a package containing the
 * essential item fitted. Reproduced by the seventh audit with the fixture
 * below.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { allow, candidates, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

/** rq_1 > rq_2 > rq_3 by relevance; every candidate costs 500 tokens. */
function assembler(store: InMemoryContextStore) {
  return new AssemblyService(store, {
    retrieval: retrieval(candidates(['rq_1', 'rq_2', 'rq_3'])),
    access: allow(),
    sourceClasses: classes(['requirement']),
    authorisations: noAuthorisations(),
    costOf: () => 500,
  });
}

const essentialRq3 = [{ sourceType: 'requirement', sourceId: 'rq_3' }] as const;

describe('T1874 · essential material is charged before the rest', () => {
  it('the audit repro: an essential item the budget can fit is included, not refused', async () => {
    const store = new InMemoryContextStore();
    const result = await assembler(store).assemble(
      input({ executionId: undefined, budgetTokens: 1000, essentialSources: [...essentialRq3] }),
    );
    expect(result.state).toBe('assembled');
    expect(result.items.map((i) => i.sourceId)).toContain('rq_3');
    // The budget left after the essential item goes to the best of the rest.
    expect(result.exclusions.map((e) => [e.sourceId, e.reason])).toEqual([['rq_2', 'budget']]);
  });

  it('items still appear in ranked order, whatever order the budget charged them in', async () => {
    const store = new InMemoryContextStore();
    const result = await assembler(store).assemble(
      input({ executionId: undefined, budgetTokens: 1000, essentialSources: [...essentialRq3] }),
    );
    expect(result.items.map((i) => i.sourceId)).toEqual(['rq_1', 'rq_3']);
  });

  it('only an essential item the budget cannot fit refuses', async () => {
    const store = new InMemoryContextStore();
    await expect(
      assembler(store).assemble(
        input({ executionId: undefined, budgetTokens: 400, essentialSources: [...essentialRq3] }),
      ),
    ).rejects.toThrow(/essential source was excluded by budget/);
  });
});
