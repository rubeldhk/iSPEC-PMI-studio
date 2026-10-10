/**
 * `T1870` (EPIC-038 Convergence) — history that drops out never held budget.
 *
 * `FR-CTX-035`, `FR-CTX-037`, `FR-CTX-039`, `SC-CTX-004`, `SC-CTX-008`.
 * A regression from `T1865`: when `EPIC-037`'s projection reader failed partway,
 * history already judged current was moved out of the package *after* the
 * budget had been charged for it. The budget it held was never given back, so
 * a candidate that fitted had already been excluded in its place — and the
 * package then refused as "the budget admits nothing", or as an excluded
 * essential, or as all-stale, or was marked bounded when nothing that remained
 * was cut. Reproduced by the sixth audit with exactly the fixture below.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import type { Candidate } from '../../src/modules/context/retrieval/outcome.types.js';
import { allow, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

const history = (sourceId: string, score: number): Candidate => ({
  sourceType: 'execution-history',
  sourceId,
  sourceVersion: '4',
  relevanceScore: score,
  workspaceId: 'ws_1',
});
const requirement = (sourceId: string, score: number, stale = false): Candidate => ({
  sourceType: 'requirement',
  sourceId,
  sourceVersion: 'v1',
  relevanceScore: score,
  workspaceId: 'ws_1',
  ...(stale ? { stale: { currentVersion: 'v2' } } : {}),
});

/** ex_1's projection is current; ex_2's read throws — so history drops out. */
function assembler(store: InMemoryContextStore, found: Candidate[]) {
  return new AssemblyService(store, {
    retrieval: retrieval(found),
    access: allow(),
    sourceClasses: classes(['execution-history', 'requirement']),
    authorisations: noAuthorisations(),
    costOf: () => 500,
    executions: {
      async projectedVersion(_ws, executionId) {
        if (executionId === 'ex_1') return '4';
        throw new Error('projection store unreachable');
      },
    },
  });
}

describe('T1870 · history that drops out holds no budget', () => {
  it('the audit repro: a candidate that fits is included, not refused as "budget admits nothing"', async () => {
    const store = new InMemoryContextStore();
    const result = await assembler(store, [history('ex_1', 0.9), history('ex_2', 0.8), requirement('rq_1', 0.5)]).assemble(
      input({ executionId: undefined, budgetTokens: 500 }),
    );
    expect((await store.itemsFor('ws_1', result.packageId)).map((i) => i.sourceId)).toEqual(['rq_1']);
  });

  it('an essential candidate that fits is not falsely refused as excluded by budget', async () => {
    const store = new InMemoryContextStore();
    const result = await assembler(store, [history('ex_1', 0.9), history('ex_2', 0.8), requirement('rq_1', 0.5)]).assemble(
      input({
        executionId: undefined,
        budgetTokens: 500,
        essentialSources: [{ sourceType: 'requirement', sourceId: 'rq_1' }],
      }),
    );
    expect(result.itemCount).toBe(1);
  });

  it('nothing that remained was cut, so the package is not bounded', async () => {
    const store = new InMemoryContextStore();
    const result = await assembler(store, [history('ex_1', 0.9), history('ex_2', 0.8), requirement('rq_1', 0.5)]).assemble(
      input({ executionId: undefined, budgetTokens: 500 }),
    );
    expect(result.bounded).toBe(false);
  });

  it('a genuinely stale remainder is not mistaken for a budget refusal, and current history is never counted as stale', async () => {
    // With history dropped out and the only document stale, the eligible set
    // is genuinely all stale: the all-stale refusal is the right answer here,
    // and it must not be confused with a budget one.
    const store = new InMemoryContextStore();
    await expect(
      assembler(store, [history('ex_1', 0.9), history('ex_2', 0.8), requirement('rq_1', 0.5, true)]).assemble(
        input({ executionId: undefined, budgetTokens: 500 }),
      ),
    ).rejects.toThrow(/stale/);
  });
});
