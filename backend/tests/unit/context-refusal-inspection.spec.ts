/**
 * `T1263` (EPIC-038) — a refusal is inspectable with its reason.
 *
 * `FR-CTX-065`, `SC-CTX-005`, `US4/AC3`. A session that ran without context is
 * a fact, not a blank: the refused package is a row, and inspecting it shows
 * the refusal, the reason and the exclusions that caused it.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { InspectionService } from '../../src/modules/context/inspection.service.js';
import {
  candidates,
  classes,
  denyFor,
  input,
  noAuthorisations,
  retrieval,
} from '../helpers/context-fixtures.js';

async function refusedPackageId(store: InMemoryContextStore): Promise<string> {
  await expect(
    new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1'])),
      access: denyFor('rq_1'),
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
    }).assemble(input({ essentialSources: [{ sourceType: 'requirement', sourceId: 'rq_1' }] })),
  ).rejects.toThrow(/essential/i);
  const [refused] = await new InspectionService(store, null, null).forExecution('ws_1', 'ex_1');
  return refused!.package.id;
}

describe('T1263 · refused packages are inspectable', () => {
  it('shows the refused state and its reason', async () => {
    const store = new InMemoryContextStore();
    const id = await refusedPackageId(store);
    const seen = await new InspectionService(store, null, null).inspect('ws_1', id);
    expect(seen?.package.state).toBe('refused');
    expect(seen?.package.refusalReason).toMatch(/essential source was excluded/);
  });

  it('and the exclusion that caused it, marked essential', async () => {
    const store = new InMemoryContextStore();
    const id = await refusedPackageId(store);
    const seen = await new InspectionService(store, null, null).inspect('ws_1', id);
    expect(seen?.items).toEqual([]);
    expect(seen?.exclusions.map((e) => [e.sourceId, e.reason, e.wasEssential])).toEqual([
      ['rq_1', 'permission', true],
    ]);
  });
});
