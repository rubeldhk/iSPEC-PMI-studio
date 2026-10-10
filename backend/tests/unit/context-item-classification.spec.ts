/**
 * `T1862` (EPIC-038 Convergence) — each item records the classification it was
 * admitted under.
 *
 * `FR-CTX-031`, and `US1`'s test: the inputs are *consulted and recorded*. The
 * security classification was consulted — it decided admission — and then
 * forgotten. Operators reclassify sources by SQL (`DEF-038-007`), so after any
 * change a reviewer could not tell what classification governed an item that
 * was already given to a session.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { InspectionService } from '../../src/modules/context/inspection.service.js';
import { allow, candidates, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

describe('T1862 · the classification an item was admitted under is recorded', () => {
  it('records it at assembly, and inspection still shows it after the class changes', async () => {
    const store = new InMemoryContextStore();
    let classification = 'confidential';
    const result = await new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1'])),
      access: allow(),
      sourceClasses: {
        async classify() {
          return { securityClassification: classification, indexable: true };
        },
      },
      authorisations: noAuthorisations(),
    }).assemble(input());

    classification = 'public';

    const seen = await new InspectionService(store, null, null).inspect('ws_1', result.packageId);
    expect(seen?.items[0]?.securityClassification).toBe('confidential');
  });
});
