/**
 * `T1815` (EPIC-038 Convergence) — a package nothing consumed says so.
 *
 * Spec edge case *"A consequential session is registered but never ran.
 * Inspection shows the package that was prepared for it, and that nothing
 * consumed it."* `FR-CTX-060`, `FR-CTX-062`.
 *
 * Whether the execution ran is `EPIC-037`'s fact, not this Epic's judgement:
 * its projection holds `lifecycleState = 'registered'` until the first event.
 * Inspection reads that and reports it — and where it has no lifecycle to read,
 * it says *unknown* rather than guessing either way.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import {
  InspectionService,
  type ExecutionRegistrationReader,
} from '../../src/modules/context/inspection.service.js';
import { allow, candidates, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

async function packageFor(executionId: string): Promise<{ store: InMemoryContextStore; id: string }> {
  const store = new InMemoryContextStore();
  const result = await new AssemblyService(store, {
    retrieval: retrieval(candidates(['rq_1'])),
    access: allow(),
    sourceClasses: classes(['requirement']),
    authorisations: noAuthorisations(),
  }).assemble(input({ executionId }));
  return { store, id: result.packageId };
}

const registry = (lifecycleState: string | undefined): ExecutionRegistrationReader => ({
  async registrationOf() {
    return {
      consequential: 'undetermined',
      reason: 'EPIC-037 records no consequentiality',
      ...(lifecycleState === undefined ? {} : { lifecycleState }),
    };
  },
});

describe('T1815 · unconsumed packages', () => {
  it('an execution still `registered` has not run, and the package says nothing consumed it', async () => {
    const { store, id } = await packageFor('ex_waiting');
    const seen = await new InspectionService(store, null, registry('registered')).inspect('ws_1', id);
    expect(seen?.execution.ran).toBe(false);
    expect(seen?.execution.consumption).toMatch(/nothing consumed this package/i);
  });

  it.each(['started', 'progress-reported', 'completed', 'failed'])('an execution at %s has run', async (state) => {
    const { store, id } = await packageFor('ex_ran');
    const seen = await new InspectionService(store, null, registry(state)).inspect('ws_1', id);
    expect(seen?.execution.ran).toBe(true);
  });

  it('with no lifecycle to read, whether it ran is unknown — never assumed', async () => {
    const { store, id } = await packageFor('ex_quiet');
    const seen = await new InspectionService(store, null, registry(undefined)).inspect('ws_1', id);
    expect(seen?.execution.ran).toBe('unknown');
  });

  it('an unregistered execution is unknown too', async () => {
    const { store, id } = await packageFor('ex_ghost');
    const seen = await new InspectionService(store, null, {
      async registrationOf() {
        return null;
      },
    }).inspect('ws_1', id);
    expect(seen?.execution.ran).toBe('unknown');
  });
});
