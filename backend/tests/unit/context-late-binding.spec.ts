/**
 * `T1829` (EPIC-038 Convergence) — a package assembled ahead of its execution
 * can be bound to it, once.
 *
 * `FR-CTX-062`, `FR-CTX-066`, data-model §1: `executionId` is null *only while
 * assembly is in flight*. A package assembled before the execution was
 * registered had no way ever to be bound — so it inherited no retention and
 * could not be listed under anything. The bind is one-way and one-time: a
 * package that fed one execution did not feed another.
 */
import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../src/core/errors.js';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { allow, candidates, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

async function unbound(registered: readonly string[]) {
  const store = new InMemoryContextStore();
  const service = new AssemblyService(store, {
    retrieval: retrieval(candidates(['rq_1'])),
    access: allow(),
    sourceClasses: classes(['requirement']),
    authorisations: noAuthorisations(),
    executions: {
      async projectedVersion(_ws, executionId) {
        return registered.includes(executionId) ? '1' : null;
      },
    },
  });
  const { packageId } = await service.assemble(input({ executionId: undefined }));
  return { store, service, packageId };
}

describe('T1829 · binding a package to its execution', () => {
  it('binds an unbound package to a registered execution', async () => {
    const { store, service, packageId } = await unbound(['ex_5']);
    await service.bindExecution('ws_1', packageId, 'ex_5');
    expect((await store.findPackage('ws_1', packageId))?.executionId).toBe('ex_5');
    expect((await store.packagesForExecution('ws_1', 'ex_5')).map((p) => p.id)).toEqual([packageId]);
  });

  it('refuses to rebind a bound package — it fed one execution, not two', async () => {
    const { service, packageId } = await unbound(['ex_5', 'ex_6']);
    await service.bindExecution('ws_1', packageId, 'ex_5');
    await expect(service.bindExecution('ws_1', packageId, 'ex_6')).rejects.toBeInstanceOf(ConflictError);
  });

  it('refuses an execution EPIC-037 has not registered', async () => {
    const { service, packageId } = await unbound([]);
    await expect(service.bindExecution('ws_1', packageId, 'ex_ghost')).rejects.toBeInstanceOf(ValidationFailedError);
  });

  it("another workspace's package is absent, not forbidden", async () => {
    const { service, packageId } = await unbound(['ex_5']);
    await expect(service.bindExecution('ws_2', packageId, 'ex_5')).rejects.toBeInstanceOf(NotFoundError);
  });
});
