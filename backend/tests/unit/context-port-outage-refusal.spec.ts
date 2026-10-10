/**
 * `T1876` (EPIC-038 Convergence) — an outage mid-assembly is a recorded
 * refusal.
 *
 * `FR-CTX-065`, `SC-CTX-005`. A retrieval failure was already recorded as a
 * refused package before it was rethrown (`T1820`). A failure in the
 * per-candidate ports — the access policy, the source classes, the
 * authorisation lookup — reached the caller correctly but wrote nothing, so
 * the execution had no refusal to inspect: indistinguishable from an assembly
 * nobody attempted.
 */
import { describe, expect, it } from 'vitest';
import { PlatformError, ProviderUnavailableError } from '../../src/core/errors.js';
import { AssemblyService, type AssemblyPorts } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import type { Candidate } from '../../src/modules/context/retrieval/outcome.types.js';
import { allow, candidates, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

async function refusalOf(attempt: Promise<unknown>): Promise<unknown> {
  try {
    await attempt;
  } catch (error) {
    return error;
  }
  throw new Error('expected a refusal');
}

const outage = (): never => {
  throw new ProviderUnavailableError('the port could not be reached');
};

const crossing: Candidate = {
  sourceType: 'specification',
  sourceId: 'sp_s',
  sourceVersion: 'v1',
  relevanceScore: 0.9,
  workspaceId: 'ws_owner',
};

const cases: { name: string; ports: (store: InMemoryContextStore) => AssemblyPorts }[] = [
  {
    name: 'mayRead',
    ports: () => ({
      retrieval: retrieval(candidates(['rq_1'])),
      access: { mayRead: async () => outage() },
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
    }),
  },
  {
    name: 'classify',
    ports: () => ({
      retrieval: retrieval(candidates(['rq_1'])),
      access: allow(),
      sourceClasses: { classify: async () => outage() },
      authorisations: noAuthorisations(),
    }),
  },
  {
    name: 'the authorisation lookup',
    ports: () => ({
      retrieval: retrieval([crossing]),
      access: allow(),
      sourceClasses: classes(['specification']),
      authorisations: { find: async () => outage() },
    }),
  },
];

describe('T1876 · a per-candidate port outage is recorded, then rethrown', () => {
  for (const c of cases) {
    it(`an outage in ${c.name} keeps its class and names a refused package recording it`, async () => {
      const store = new InMemoryContextStore();
      const error = await refusalOf(new AssemblyService(store, c.ports(store)).assemble(input()));
      expect(error).toBeInstanceOf(ProviderUnavailableError);
      const id = ((error as PlatformError).details as { packageId?: string } | undefined)?.packageId;
      expect(id).toBeTruthy();
      const pkg = await store.findPackage('ws_1', id!);
      expect(pkg?.state).toBe('refused');
      expect(pkg?.refusalReason).toMatch(/could not be reached/);
    });
  }

  it('the execution the package was for has the refusal to inspect, even for a fault that is not a platform error', async () => {
    const store = new InMemoryContextStore();
    await expect(
      new AssemblyService(store, {
        retrieval: retrieval(candidates(['rq_1'])),
        access: {
          async mayRead() {
            throw new Error('socket hang up');
          },
        },
        sourceClasses: classes(['requirement']),
        authorisations: noAuthorisations(),
      }).assemble(input()),
    ).rejects.toThrow(/socket hang up/);
    const listed = await store.packagesForExecution('ws_1', 'ex_1');
    expect(listed.map((p) => [p.state, p.refusalReason])).toEqual([['refused', 'socket hang up']]);
  });
});
