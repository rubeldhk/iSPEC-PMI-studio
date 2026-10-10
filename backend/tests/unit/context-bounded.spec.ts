/**
 * `T1832` (EPIC-038 Convergence) — a bounded package says it is bounded.
 *
 * `FR-CTX-035`: *the package MUST state that it is bounded and name what was
 * excluded.* The exclusions were named; the statement was left for a reader to
 * infer by scanning reasons. It is now said, on the result and on inspection.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { InspectionService } from '../../src/modules/context/inspection.service.js';
import { allow, candidates, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

function assembler(store: InMemoryContextStore) {
  return new AssemblyService(store, {
    retrieval: retrieval(candidates(['rq_1', 'rq_2', 'rq_3'])),
    access: allow(),
    sourceClasses: classes(['requirement']),
    authorisations: noAuthorisations(),
    costOf: () => 1000,
  });
}

describe('T1832 · boundedness is stated', () => {
  it('the result says bounded when the budget excluded anything', async () => {
    const store = new InMemoryContextStore();
    const result = await assembler(store).assemble(input({ budgetTokens: 2000 }));
    expect(result.bounded).toBe(true);
    const seen = await new InspectionService(store, null, null).inspect('ws_1', result.packageId);
    expect(seen?.bounded).toBe(true);
  });

  it('and not bounded when everything fit', async () => {
    const store = new InMemoryContextStore();
    const result = await assembler(store).assemble(input({ budgetTokens: 12000 }));
    expect(result.bounded).toBe(false);
    expect((await new InspectionService(store, null, null).inspect('ws_1', result.packageId))?.bounded).toBe(false);
  });
});
