/**
 * `T1840` (EPIC-038 Convergence) — an all-stale eligible set refuses, whatever
 * else was excluded.
 *
 * Spec edge case *"the whole corpus is stale"*, `SC-CTX-009`. The rule first
 * written required every exclusion to be `stale`, so one unclassified or
 * unreadable candidate alongside an all-stale remainder let assembly return an
 * empty package that read as "nothing was relevant". The same rule the budget
 * refusal follows (`T1824`): what matters is what reached the check. Of what
 * the actor could have been given, all of it was stale.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import type { Candidate } from '../../src/modules/context/retrieval/outcome.types.js';
import { classes, denyFor, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

const candidate = (sourceId: string, stale: boolean, sourceType = 'requirement'): Candidate => ({
  sourceType,
  sourceId,
  sourceVersion: 'v1',
  relevanceScore: 0.9,
  workspaceId: 'ws_1',
  ...(stale ? { stale: { currentVersion: 'v2' } } : {}),
});

describe('T1840 · all-stale among what was eligible', () => {
  it('stale and permission-excluded: refused', async () => {
    const store = new InMemoryContextStore();
    await expect(
      new AssemblyService(store, {
        retrieval: retrieval([candidate('rq_1', true), candidate('rq_2', false)]),
        access: denyFor('rq_2'),
        sourceClasses: classes(['requirement']),
        authorisations: noAuthorisations(),
      }).assemble(input()),
    ).rejects.toThrow(/stale[\s\S]*SC-CTX-009/);
  });

  it('stale and unclassified: refused', async () => {
    const store = new InMemoryContextStore();
    await expect(
      new AssemblyService(store, {
        retrieval: retrieval([candidate('rq_1', true), candidate('sp_9', false, 'specification')]),
        access: { async mayRead() { return true; } },
        sourceClasses: classes(['requirement']),
        authorisations: noAuthorisations(),
      }).assemble(input()),
    ).rejects.toThrow(/stale/);
  });

  it('the control: nothing reached the staleness check (all excluded by permission) — an empty package, not a refusal', async () => {
    const store = new InMemoryContextStore();
    const result = await new AssemblyService(store, {
      retrieval: retrieval([candidate('rq_1', true), candidate('rq_2', true)]),
      access: denyFor('rq_1', 'rq_2'),
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
    }).assemble(input());
    expect([result.itemCount, result.exclusionCount]).toEqual([0, 2]);
  });
});
