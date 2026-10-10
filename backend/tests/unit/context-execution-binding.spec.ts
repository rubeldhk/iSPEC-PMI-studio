/**
 * `T1266` (EPIC-038) — a package binds to the execution it fed, and
 * *consequential* is read, not decided.
 *
 * `FR-CTX-061`, `FR-CTX-062`, Constitution XII. Defining "consequential" here
 * would make this Epic a second registry of what matters, and the two would
 * disagree the first time `EPIC-037` refined its rule.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import {
  InspectionService,
  type ExecutionRegistrationReader,
} from '../../src/modules/context/inspection.service.js';
import {
  allow,
  candidates,
  classes,
  input,
  noAuthorisations,
  retrieval,
} from '../helpers/context-fixtures.js';

function assembler(store: InMemoryContextStore): AssemblyService {
  return new AssemblyService(store, {
    retrieval: retrieval(candidates(['rq_1'])),
    access: allow(),
    sourceClasses: classes(['requirement']),
    authorisations: noAuthorisations(),
  });
}

describe('T1266 · execution binding', () => {
  it('records the execution the package fed (FR-CTX-062)', async () => {
    const store = new InMemoryContextStore();
    const result = await assembler(store).assemble(input({ executionId: 'ex_42' }));
    expect((await store.findPackage('ws_1', result.packageId))?.executionId).toBe('ex_42');
    expect((await store.packagesForExecution('ws_1', 'ex_42')).map((p) => p.id)).toEqual([
      result.packageId,
    ]);
  });

  it('and an assembly not yet bound records null, never a placeholder id', async () => {
    const store = new InMemoryContextStore();
    const result = await assembler(store).assemble(input({ executionId: undefined }));
    expect((await store.findPackage('ws_1', result.packageId))?.executionId).toBeNull();
  });

  it('consequential is what the registration says', async () => {
    const store = new InMemoryContextStore();
    const result = await assembler(store).assemble(input({ executionId: 'ex_42' }));
    const registry: ExecutionRegistrationReader = {
      async registrationOf(_ws, executionId) {
        return executionId === 'ex_42' ? { consequential: true } : null;
      },
    };
    const seen = await new InspectionService(store, null, registry).inspect('ws_1', result.packageId);
    // `T1816` — this registry reports no lifecycle, so whether it ran is unknown.
    expect(seen?.execution).toEqual({
      executionId: 'ex_42',
      registered: true,
      consequential: true,
      ran: 'unknown',
    });
  });

  it('with no registration reader, consequential is undetermined with a reason — never assumed', async () => {
    const store = new InMemoryContextStore();
    const result = await assembler(store).assemble(input({ executionId: 'ex_42' }));
    const seen = await new InspectionService(store, null, null).inspect('ws_1', result.packageId);
    expect(seen?.execution).toMatchObject({ executionId: 'ex_42', consequential: 'undetermined' });
    expect(seen?.execution.reason).toMatch(/EPIC-037/);
  });

  it('an execution the registry does not know is reported unregistered', async () => {
    const store = new InMemoryContextStore();
    const result = await assembler(store).assemble(input({ executionId: 'ex_ghost' }));
    const registry: ExecutionRegistrationReader = {
      async registrationOf() {
        return null;
      },
    };
    const seen = await new InspectionService(store, null, registry).inspect('ws_1', result.packageId);
    expect(seen?.execution).toMatchObject({ registered: false, consequential: 'undetermined' });
  });

  it('listing requires an execution id — there is no workspace-wide listing', async () => {
    const store = new InMemoryContextStore();
    await expect(
      new InspectionService(store, null, null).forExecution('ws_1', '  '),
    ).rejects.toThrow(/executionId/);
  });
});
