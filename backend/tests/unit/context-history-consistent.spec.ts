/**
 * `T1864` (EPIC-038 Convergence) — a package saying history dropped out
 * contains none.
 *
 * `FR-CTX-015`, `R-038-8`, `SC-CTX-006`. The history judge reads `EPIC-037`'s
 * projections one candidate at a time. When the reader failed partway, the
 * package was marked `executionHistory = 'unavailable'` — *"execution history
 * dropped out of this package"* — while history judged before the failure was
 * already kept. The record then contradicted itself, and a reviewer asking
 * "what did this session see?" could not answer from it.
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
const requirement: Candidate = {
  sourceType: 'requirement',
  sourceId: 'rq_1',
  sourceVersion: 'v1',
  relevanceScore: 0.5,
  workspaceId: 'ws_1',
};

describe('T1864 · history is all in or all out', () => {
  it('a reader failing after one history item was judged current leaves no history in the package', async () => {
    const store = new InMemoryContextStore();
    const result = await new AssemblyService(store, {
      retrieval: retrieval([history('ex_1', 0.9), history('ex_2', 0.8), requirement]),
      access: allow(),
      sourceClasses: classes(['execution-history', 'requirement']),
      authorisations: noAuthorisations(),
      executions: {
        async projectedVersion(_ws, executionId) {
          if (executionId === 'ex_1') return '4';
          throw new Error('projection store unreachable');
        },
      },
    }).assemble(input({ executionId: undefined }));

    const pkg = await store.findPackage('ws_1', result.packageId);
    const items = await store.itemsFor('ws_1', result.packageId);
    expect(pkg?.executionHistory).toBe('unavailable');
    expect(items.map((i) => i.sourceId)).toEqual(['rq_1']);
    const excluded = (await store.exclusionsFor('ws_1', result.packageId)).map((e) => e.sourceId).sort();
    expect(excluded).toEqual(['ex_1', 'ex_2']);
    // Every candidate is still accounted for.
    expect(result.itemCount + result.exclusionCount).toBe(3);
  });
});
