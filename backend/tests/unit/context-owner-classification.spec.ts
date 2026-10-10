/**
 * `T1866` (EPIC-038 Convergence) — a crossing is classified by its owner.
 *
 * `FR-CTX-031`, `FR-CTX-034`, `SC-CTX-007`. Classification is the owning
 * workspace's statement about its own material. Asking the requester instead
 * admitted a source its owner classed `restricted` and recorded it as the
 * requester's `public` — and excluded an authorised source outright whenever
 * the requester simply had no class for its type.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import type { Candidate } from '../../src/modules/context/retrieval/outcome.types.js';
import { allow, authorisedCrossing, input, retrieval } from '../helpers/context-fixtures.js';

const crossing: Candidate = {
  sourceType: 'specification',
  sourceId: 'sp_s',
  sourceVersion: 'v1',
  relevanceScore: 0.9,
  workspaceId: 'ws_owner',
};

/** Each workspace's own classes. ws_1 (the requester) may have none. */
function classesBy(table: Record<string, Record<string, string>>) {
  const asked: string[] = [];
  return {
    asked,
    async classify(workspaceId: string, sourceType: string) {
      asked.push(workspaceId);
      const c = table[workspaceId]?.[sourceType];
      return c === undefined ? null : { securityClassification: c, indexable: true };
    },
  };
}

describe('T1866 · the owner classifies its own material', () => {
  it("records the owner's classification, not the requester's", async () => {
    const store = new InMemoryContextStore();
    const sourceClasses = classesBy({
      ws_owner: { specification: 'restricted' },
      ws_1: { specification: 'public' },
    });
    const result = await new AssemblyService(store, {
      retrieval: retrieval([crossing]),
      access: allow(),
      sourceClasses,
      authorisations: authorisedCrossing('sp_s', 'ws_owner', 'ws_1'),
    }).assemble(input());
    const [item] = await store.itemsFor('ws_1', result.packageId);
    expect(item?.securityClassification).toBe('restricted');
    expect(sourceClasses.asked).toEqual(['ws_owner']);
  });

  it('an authorised source is not excluded merely because the requester has no class for its type', async () => {
    const store = new InMemoryContextStore();
    const result = await new AssemblyService(store, {
      retrieval: retrieval([crossing]),
      access: allow(),
      sourceClasses: classesBy({ ws_owner: { specification: 'internal' } }),
      authorisations: authorisedCrossing('sp_s', 'ws_owner', 'ws_1'),
    }).assemble(input());
    expect(result.itemCount).toBe(1);
  });
});
