/**
 * `T1275` (EPIC-038) — staleness is a version comparison, never a timestamp.
 *
 * `FR-CTX-017`, `R-038-5`, `SC-CTX-009`. A re-save moves a timestamp without
 * changing meaning; a corrected document restored from history changes meaning
 * without moving one forward. So `stale` is `entry.sourceVersion ≠
 * source.currentVersion`, and a stale entry is **marked** — at retrieval it is
 * excluded as `stale`, never ranked as though it were current.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { IndexService } from '../../src/modules/context/retrieval/index.service.js';
import { SearchService } from '../../src/modules/context/retrieval/search.service.js';
import { InMemoryVectorIndex } from '../../src/modules/context/retrieval/vector.index.js';
import { allow, classes, input, noAuthorisations } from '../helpers/context-fixtures.js';
import { artifacts, currentVersions, fixtureEmbedding } from '../helpers/context-retrieval-fixtures.js';

const TEXTS = {
  'requirement:rq_1@v1': 'booking notification is sent twice',
  'requirement:rq_2@v1': 'booking confirmation email',
};

async function indexed() {
  const store = new InMemoryContextStore();
  await store.addSourceClass({
    id: 'sc_1', workspaceId: 'ws_1', sourceType: 'requirement', securityClassification: 'internal', indexable: true,
  });
  const vectors = new InMemoryVectorIndex();
  const index = new IndexService(store, vectors, fixtureEmbedding(), artifacts(TEXTS));
  for (const sourceId of ['rq_1', 'rq_2']) {
    await index.reindex({ workspaceId: 'ws_1', sourceType: 'requirement', sourceId, sourceVersion: 'v1' });
  }
  return { store, vectors, index };
}

describe('T1275 · staleness is a version comparison', () => {
  it('an entry whose source moved is stale, whatever the clocks say', async () => {
    const { index } = await indexed();
    const health = await index.health('ws_1', currentVersions({ 'requirement:rq_1': 'v2', 'requirement:rq_2': 'v1' }));
    expect(health.staleCount).toBe(1);
  });

  it('an entry at the current version is not stale, though it is old', async () => {
    const { index } = await indexed();
    const health = await index.health('ws_1', currentVersions({ 'requirement:rq_1': 'v1', 'requirement:rq_2': 'v1' }));
    expect(health.staleCount).toBe(0);
  });

  it('with no version reader the stale count is unknown, not zero', async () => {
    const { index } = await indexed();
    const health = await index.health('ws_1', null);
    expect(health.staleCount).toBeNull();
    expect(health.staleness).toMatch(/unknown/);
  });

  it('the service never compares timestamps', async () => {
    const source = IndexService.toString() + SearchService.toString();
    expect(source).not.toMatch(/indexedAt\s*[<>]|getTime\(\)\s*[<>]/);
  });
});

describe('T1275 · a stale entry is never ranked as current (SC-CTX-009)', () => {
  it('search marks it stale', async () => {
    const { vectors } = await indexed();
    const out = await new SearchService(
      vectors,
      fixtureEmbedding(),
      currentVersions({ 'requirement:rq_1': 'v2', 'requirement:rq_2': 'v1' }),
      { limit: 10 },
    ).search({ workspaceId: 'ws_1', objective: 'booking notification' });
    expect(out.candidates.find((c) => c.sourceId === 'rq_1')?.stale).toEqual({ currentVersion: 'v2' });
    expect(out.candidates.find((c) => c.sourceId === 'rq_2')?.stale).toBeUndefined();
  });

  it('and assembly excludes it as stale, naming both versions', async () => {
    const { vectors } = await indexed();
    const search = new SearchService(
      vectors,
      fixtureEmbedding(),
      currentVersions({ 'requirement:rq_1': 'v2', 'requirement:rq_2': 'v1' }),
      { limit: 10 },
    );
    const store = new InMemoryContextStore();
    const result = await new AssemblyService(store, {
      retrieval: search,
      access: allow(),
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
    }).assemble(input({ objective: 'booking notification' }));

    expect((await store.itemsFor('ws_1', result.packageId)).map((i) => i.sourceId)).toEqual(['rq_2']);
    const [exclusion] = await store.exclusionsFor('ws_1', result.packageId);
    expect(exclusion?.reason).toBe('stale');
    expect(exclusion?.detail).toMatch(/v1[\s\S]*v2/);
  });
});
