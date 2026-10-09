/**
 * `T1878` (EPIC-038 Convergence) — history the judge verified is not of
 * unknown staleness.
 *
 * `SC-CTX-009`. When search cannot read an execution's projection it marks the
 * candidate `stalenessUnknown` and leaves it to the history judge (`T1872`). If
 * the judge then reads the projection and finds it current, the staleness is
 * known — yet the package still counted the item as unknown, overstating how
 * much of what the session saw nobody could vouch for.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import type { Candidate } from '../../src/modules/context/retrieval/outcome.types.js';
import { allow, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

const unverified = (sourceType: string, sourceId: string, version: string): Candidate => ({
  sourceType,
  sourceId,
  sourceVersion: version,
  relevanceScore: 0.9,
  workspaceId: 'ws_1',
  stalenessUnknown: 'the version read failed at search',
});

describe('T1878 · judged history is not counted as staleness unknown', () => {
  it('counts the unverified document, not the history the judge verified', async () => {
    const store = new InMemoryContextStore();
    const result = await new AssemblyService(store, {
      retrieval: retrieval([unverified('execution-history', 'ex_9', '4'), unverified('requirement', 'rq_1', 'v1')]),
      access: allow(),
      sourceClasses: classes(['execution-history', 'requirement']),
      authorisations: noAuthorisations(),
      executions: { projectedVersion: async () => '4' },
    }).assemble(input({ executionId: undefined }));
    expect(result.itemCount).toBe(2);
    expect((await store.findPackage('ws_1', result.packageId))?.stalenessUnknown).toBe(1);
  });
});
