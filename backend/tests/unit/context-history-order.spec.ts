/**
 * `T1852` (EPIC-038 Convergence) — execution history is judged only once the
 * actor may see it.
 *
 * `FR-CTX-051`, `FR-CTX-053`, and `T1841`'s own rule. The history judge ran
 * before the boundary and permission checks, so an execution the actor could
 * not read had its projection version looked up and written into a `stale`
 * exclusion's detail — and that `stale` counted toward the all-stale refusal,
 * which is meant to see only what reached the staleness check.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import type { Candidate } from '../../src/modules/context/retrieval/outcome.types.js';
import { classes, denyFor, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

const history = (sourceId: string, workspaceId = 'ws_1'): Candidate => ({
  sourceType: 'execution-history',
  sourceId,
  sourceVersion: '3',
  relevanceScore: 0.9,
  workspaceId,
});

describe('T1852 · history after boundary and permission', () => {
  it('an execution the actor may not read is excluded as permission, and its projection is never asked', async () => {
    const store = new InMemoryContextStore();
    const asked: string[] = [];
    const result = await new AssemblyService(store, {
      retrieval: retrieval([history('ex_secret'), history('ex_open')]),
      access: denyFor('ex_secret'),
      sourceClasses: classes(['execution-history']),
      authorisations: noAuthorisations(),
      executions: {
        async projectedVersion(_ws, executionId) {
          asked.push(executionId);
          return '3';
        },
      },
    }).assemble(input({ executionId: undefined }));
    expect(asked).toEqual(['ex_open']);
    const [exclusion] = await store.exclusionsFor('ws_1', result.packageId);
    expect([exclusion?.sourceId, exclusion?.reason]).toEqual(['ex_secret', 'permission']);
  });

  it('foreign history with no authorisation is a boundary exclusion, not a stale one', async () => {
    const store = new InMemoryContextStore();
    const asked: string[] = [];
    const result = await new AssemblyService(store, {
      retrieval: retrieval([history('ex_far', 'ws_other'), history('ex_near')]),
      access: { async mayRead() { return true; } },
      sourceClasses: classes(['execution-history']),
      authorisations: noAuthorisations(),
      executions: {
        async projectedVersion(_ws, executionId) {
          asked.push(executionId);
          return executionId === 'ex_near' ? '3' : '99';
        },
      },
    }).assemble(input({ executionId: undefined }));
    expect(asked).toEqual(['ex_near']);
    const [exclusion] = await store.exclusionsFor('ws_1', result.packageId);
    expect(exclusion?.reason).toBe('boundary');
  });
});
