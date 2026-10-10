/**
 * `T1284` (EPIC-038) — *unavailable with a reason* is not *read and empty*.
 *
 * `FR-CTX-022`, `US6/AC2`. This is the degrade case, and the two states looking
 * alike is the whole reason the port degrades rather than refuses: a package
 * without live state is smaller, not wrong — **provided it says so**. A reader
 * who sees no failing build must be able to tell "there was none" from
 * "nobody could look".
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import type { LiveStateReader } from '../../src/modules/context/live-state.js';
import { allow, candidates, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

async function packageWith(liveState: LiveStateReader | null) {
  const store = new InMemoryContextStore();
  const result = await new AssemblyService(store, {
    retrieval: retrieval(candidates(['rq_1'])),
    access: allow(),
    sourceClasses: classes(['requirement']),
    authorisations: noAuthorisations(),
    liveState,
  }).assemble(input({ includeLiveState: true }));
  return { store, result, pkg: await store.findPackage('ws_1', result.packageId) };
}

describe('T1284 · live state absent', () => {
  it('an unbound reader degrades: the package assembles and records unavailable with a reason', async () => {
    const { pkg, result } = await packageWith(null);
    expect(result.itemCount).toBe(1);
    expect(pkg?.liveState).toBe('unavailable');
    expect(pkg?.liveStateReason).toMatch(/LiveStateReader/);
  });

  it('a failing reader degrades the same way, naming the failure', async () => {
    const { pkg } = await packageWith({
      async read() {
        throw new Error('CI API timed out');
      },
    });
    expect(pkg?.liveState).toBe('unavailable');
    expect(pkg?.liveStateReason).toMatch(/CI API timed out/);
  });

  it('a reader that answered with nothing is read-and-empty — a different record', async () => {
    const { store, result, pkg } = await packageWith({
      async read() {
        return [];
      },
    });
    expect(pkg?.liveState).toBe('read');
    expect(pkg?.liveStateReason).toBeNull();
    expect(await store.liveStateFor('ws_1', result.packageId)).toEqual([]);
  });
});
