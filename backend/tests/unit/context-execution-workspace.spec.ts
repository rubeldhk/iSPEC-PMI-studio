/**
 * `T1846` (EPIC-038 Convergence) — an execution id is checked in the
 * requester's workspace before anything is assembled for it.
 *
 * `FR-CTX-050`, `FR-CTX-062`, `FR-CTX-066`. The binding's only guard was the
 * foreign key to `executions(id)`, which knows nothing of workspaces. So a
 * package could be bound to another workspace's execution — inheriting its
 * retention, and answering "does this id exist over there?" by whether the
 * write failed. `bindExecution` already asked `EPIC-037` in the requester's
 * workspace; assembly now asks the same question first, and an id it does not
 * hold is refused before any row exists to be bound.
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { allow, candidates, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

/** EPIC-037 as each workspace sees it: ex_mine is ws_1's, ex_theirs is ws_2's. */
function assembler(store: InMemoryContextStore, searched: { count: number }) {
  return new AssemblyService(store, {
    retrieval: {
      async search(q) {
        searched.count += 1;
        return retrieval(candidates(['rq_1'])).search(q);
      },
    },
    access: allow(),
    sourceClasses: classes(['requirement']),
    authorisations: noAuthorisations(),
    executions: {
      async projectedVersion(workspaceId, executionId) {
        if (workspaceId === 'ws_1' && executionId === 'ex_mine') return '1';
        if (workspaceId === 'ws_2' && executionId === 'ex_theirs') return '1';
        return null;
      },
    },
  });
}

describe('T1846 · the execution is the requester’s, or the assembly is refused', () => {
  it("another workspace's execution is refused with 400, before ranking, writing no row", async () => {
    const store = new InMemoryContextStore();
    const searched = { count: 0 };
    await expect(assembler(store, searched).assemble(input({ executionId: 'ex_theirs' }))).rejects.toBeInstanceOf(
      ValidationFailedError,
    );
    expect(searched.count).toBe(0);
    expect(await store.packagesForExecution('ws_1', 'ex_theirs')).toEqual([]);
  });

  it('and the refusal reads the same as for an id that exists nowhere — no disclosure', async () => {
    const theirs = await assembler(new InMemoryContextStore(), { count: 0 })
      .assemble(input({ executionId: 'ex_theirs' }))
      .catch((e: Error) => e.message.replace('ex_theirs', '<id>'));
    const nowhere = await assembler(new InMemoryContextStore(), { count: 0 })
      .assemble(input({ executionId: 'ex_nowhere' }))
      .catch((e: Error) => e.message.replace('ex_nowhere', '<id>'));
    expect(theirs).toBe(nowhere);
  });

  it('the control: the requester’s own registered execution assembles and binds', async () => {
    const store = new InMemoryContextStore();
    const result = await assembler(store, { count: 0 }).assemble(input({ executionId: 'ex_mine' }));
    expect((await store.findPackage('ws_1', result.packageId))?.executionId).toBe('ex_mine');
  });
});
