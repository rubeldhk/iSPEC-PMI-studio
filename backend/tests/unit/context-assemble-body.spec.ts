/**
 * `T1868` (EPIC-038 Convergence) — the `201` carries the items and exclusions.
 *
 * `contracts/context-api.md`: an assembled package's response *"carries items,
 * exclusions and any retrieval shortfall"*. It carried counts, so a caller had
 * to make a second request to learn what the session was given and what was
 * left out — and between the two, nothing guaranteed it was reading the same
 * thing it had just been told about.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { candidates, classes, denyFor, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

describe('T1868 · the assembled result carries what it assembled', () => {
  it('returns the stored items and exclusions, matching the counts', async () => {
    const store = new InMemoryContextStore();
    const result = await new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1', 'rq_2'])),
      access: denyFor('rq_2'),
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
    }).assemble(input());

    expect(result.items.map((i) => i.sourceId)).toEqual(['rq_1']);
    expect(result.exclusions.map((e) => [e.sourceId, e.reason])).toEqual([['rq_2', 'permission']]);
    expect([result.itemCount, result.exclusionCount]).toEqual([result.items.length, result.exclusions.length]);
    // The same rows the store holds — not a second description of them.
    expect(result.items).toEqual(await store.itemsFor('ws_1', result.packageId));
  });
});
