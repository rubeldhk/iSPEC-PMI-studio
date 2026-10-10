/**
 * `T1813` (EPIC-038 Convergence) — when every candidate is stale, assembly
 * refuses.
 *
 * Spec edge case *"The whole corpus is stale"*, `SC-CTX-008`, `SC-CTX-009`.
 * Excluding each stale candidate is right one at a time, and wrong when it is
 * all of them: the result is an empty package that reads as *"nothing was
 * relevant"* about a corpus that was simply out of date — the silent version of
 * the failure the stale rule exists to prevent. So, like a budget that admits
 * nothing (`FR-CTX-037`), it is a refusal, recorded with what caused it.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import type { Candidate } from '../../src/modules/context/retrieval/outcome.types.js';
import { allow, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

const candidate = (sourceId: string, stale: boolean): Candidate => ({
  sourceType: 'requirement',
  sourceId,
  sourceVersion: 'v1',
  relevanceScore: 0.9,
  workspaceId: 'ws_1',
  ...(stale ? { stale: { currentVersion: 'v2' } } : {}),
});

function assembler(store: InMemoryContextStore, found: Candidate[]) {
  return new AssemblyService(store, {
    retrieval: retrieval(found),
    access: allow(),
    sourceClasses: classes(['requirement']),
    authorisations: noAuthorisations(),
  });
}

describe('T1813 · an all-stale corpus refuses', () => {
  it('refuses when every candidate retrieval returned is stale, naming why', async () => {
    const store = new InMemoryContextStore();
    await expect(
      assembler(store, [candidate('rq_1', true), candidate('rq_2', true)]).assemble(input()),
    ).rejects.toThrow(/every candidate[\s\S]*stale[\s\S]*SC-CTX-009/);
  });

  it('and the refusal is a stored row, with the stale exclusions that caused it', async () => {
    const store = new InMemoryContextStore();
    await expect(
      assembler(store, [candidate('rq_1', true), candidate('rq_2', true)]).assemble(input()),
    ).rejects.toThrow();
    const [refused] = await store.packagesForExecution('ws_1', 'ex_1');
    expect(refused?.state).toBe('refused');
    expect(refused?.refusalReason).toMatch(/stale/);
    const exclusions = await store.exclusionsFor('ws_1', refused!.id);
    expect(exclusions.map((e) => [e.sourceId, e.reason])).toEqual([
      ['rq_1', 'stale'],
      ['rq_2', 'stale'],
    ]);
  });

  it('the control: one current candidate among stale ones still assembles', async () => {
    const store = new InMemoryContextStore();
    const result = await assembler(store, [candidate('rq_1', true), candidate('rq_2', false)]).assemble(input());
    expect(result.itemCount).toBe(1);
    expect(result.exclusionCount).toBe(1);
  });

  it('and a mix of stale and permission exclusions is an all-stale refusal too (revised by T1840)', async () => {
    // First written as "assembles an empty package". T1840 found that rule let
    // an all-stale corpus through whenever anything else was excluded alongside:
    // of what the actor could have been given, all of it was stale, and an
    // empty package would read as "nothing was relevant".
    const store = new InMemoryContextStore();
    await expect(
      new AssemblyService(store, {
        retrieval: retrieval([candidate('rq_1', true), candidate('rq_2', false)]),
        access: { async mayRead(_a, source) { return source.sourceId !== 'rq_2'; } },
        sourceClasses: classes(['requirement']),
        authorisations: noAuthorisations(),
      }).assemble(input()),
    ).rejects.toThrow(/stale/);
  });
});
