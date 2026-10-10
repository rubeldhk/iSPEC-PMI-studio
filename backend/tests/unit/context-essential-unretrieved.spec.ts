/**
 * `T1817` (EPIC-038 Convergence) — an essential source retrieval never returned.
 *
 * `FR-CTX-039`, `SC-CTX-004`: *zero* packages are assembled with an essential
 * item missing. The check that existed read only the exclusions, so a source
 * that was never a candidate at all — ranked too low, cut by the limit, never
 * indexed — was neither kept nor excluded, and the package assembled without it
 * looking complete. Absence from the candidates is still absence.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { allow, candidates, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

function assembler(store: InMemoryContextStore) {
  return new AssemblyService(store, {
    retrieval: retrieval(candidates(['rq_1', 'rq_2'])),
    access: allow(),
    sourceClasses: classes(['requirement']),
    authorisations: noAuthorisations(),
  });
}

describe('T1817 · an essential source that was never retrieved refuses', () => {
  it('refuses, naming the source and that retrieval did not return it', async () => {
    const store = new InMemoryContextStore();
    await expect(
      assembler(store).assemble(input({ essentialSources: [{ sourceType: 'requirement', sourceId: 'rq_9' }] })),
    ).rejects.toThrow(/rq_9[\s\S]*not among the candidates[\s\S]*FR-CTX-039/);
  });

  it('and the refusal is a stored row', async () => {
    const store = new InMemoryContextStore();
    await expect(
      assembler(store).assemble(input({ essentialSources: [{ sourceType: 'requirement', sourceId: 'rq_9' }] })),
    ).rejects.toThrow();
    const [refused] = await store.packagesForExecution('ws_1', 'ex_1');
    expect(refused?.state).toBe('refused');
    expect(refused?.refusalReason).toMatch(/rq_9/);
  });

  it('the control: an essential source that was retrieved and kept assembles', async () => {
    const store = new InMemoryContextStore();
    const result = await assembler(store).assemble(
      input({ essentialSources: [{ sourceType: 'requirement', sourceId: 'rq_2' }] }),
    );
    expect(result.itemCount).toBe(2);
  });
});
