/**
 * `T1261` (EPIC-038) — inspection shows the package **as supplied**.
 *
 * `FR-CTX-060`, `FR-CTX-063`, `US4/AC1`.
 *
 * The failure this catches is quiet: an inspection that re-assembles answers
 * *"what would the model see now"* while appearing to answer *"what did it
 * see"*. Both render the same screen. So the assertions here change the world
 * after assembly — the corpus, the ranking, the permissions — and require the
 * inspected package not to move.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { InspectionService } from '../../src/modules/context/inspection.service.js';
import {
  allow,
  candidates,
  classes,
  denyFor,
  input,
  noAuthorisations,
  retrieval,
} from '../helpers/context-fixtures.js';

async function assembled(store: InMemoryContextStore): Promise<string> {
  const result = await new AssemblyService(store, {
    retrieval: retrieval(candidates(['rq_1', 'rq_2'])),
    access: denyFor('rq_2'),
    sourceClasses: classes(['requirement']),
    authorisations: noAuthorisations(),
  }).assemble(input());
  return result.packageId;
}

describe('T1261 · the inspected package is the supplied package', () => {
  it('shows the items and the exclusions that were recorded', async () => {
    const store = new InMemoryContextStore();
    const id = await assembled(store);
    const seen = await new InspectionService(store, null, null).inspect('ws_1', id);
    expect(seen?.package.id).toBe(id);
    expect(seen?.items.map((i) => i.sourceId)).toEqual(['rq_1']);
    expect(seen?.exclusions.map((e) => [e.sourceId, e.reason])).toEqual([['rq_2', 'permission']]);
  });

  it('does not change when the corpus and the permissions change after assembly', async () => {
    const store = new InMemoryContextStore();
    const id = await assembled(store);
    const inspection = new InspectionService(store, null, null);
    const before = await inspection.inspect('ws_1', id);

    // The world moves: a better-ranked source arrives and the refused source
    // becomes readable. A re-assembling inspection would now show both.
    await new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_9', 'rq_1', 'rq_2'], 0.99)),
      access: allow(),
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
    }).assemble(input());

    const after = await inspection.inspect('ws_1', id);
    expect(after?.items.map((i) => i.sourceId)).toEqual(before?.items.map((i) => i.sourceId));
    expect(after?.exclusions).toEqual(before?.exclusions);
  });

  it('cannot re-assemble: the service is built without an assembler', () => {
    // Not merely forbidden but unavailable. Its constructor takes a reader, a
    // version reader and a registration reader — nothing that ranks.
    expect(InspectionService.length).toBe(3);
    const methods = Object.getOwnPropertyNames(InspectionService.prototype);
    expect(methods.filter((m) => /assembl|rank|search|retriev/i.test(m))).toEqual([]);
  });

  it("another workspace's package is absent, not forbidden (FR-002)", async () => {
    const store = new InMemoryContextStore();
    const id = await assembled(store);
    expect(await new InspectionService(store, null, null).inspect('ws_other', id)).toBeNull();
  });
});
