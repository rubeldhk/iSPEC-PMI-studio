/**
 * `T1273` (EPIC-038) — one embedding model per index.
 *
 * `R-038-4`, `FR-CTX-016`. Two models of the same dimension produce
 * incomparable spaces, and the database computes distances across them without
 * erroring: mixed entries do not fail, they rank nonsense. So every entry
 * records the model and dimension that produced it, and a query **refuses** to
 * rank across models rather than quietly comparing them.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { IndexService } from '../../src/modules/context/retrieval/index.service.js';
import { SearchService } from '../../src/modules/context/retrieval/search.service.js';
import { InMemoryVectorIndex } from '../../src/modules/context/retrieval/vector.index.js';
import { artifacts, fixtureEmbedding } from '../helpers/context-retrieval-fixtures.js';

const TEXTS = {
  'requirement:rq_1@v1': 'booking notification is sent twice',
  'requirement:rq_2@v1': 'invoice totals round incorrectly',
};

async function world() {
  const store = new InMemoryContextStore();
  await store.addSourceClass({
    id: 'sc_1',
    workspaceId: 'ws_1',
    sourceType: 'requirement',
    securityClassification: 'internal',
    indexable: true,
  });
  return { store, vectors: new InMemoryVectorIndex() };
}

describe('T1273 · entries record their model', () => {
  it('records embeddingModelId and dimension on every entry', async () => {
    const { store, vectors } = await world();
    const index = new IndexService(store, vectors, fixtureEmbedding('model-a'), artifacts(TEXTS));
    await index.reindex({ workspaceId: 'ws_1', sourceType: 'requirement', sourceId: 'rq_1', sourceVersion: 'v1' });
    const [entry] = await store.indexEntriesFor('ws_1');
    expect([entry?.embeddingModelId, entry?.dimension]).toEqual(['model-a', 27]);
  });
});

describe('T1273 · a query refuses to rank across models', () => {
  it('refuses when the index holds entries from a model other than the active one', async () => {
    const { store, vectors } = await world();
    await new IndexService(store, vectors, fixtureEmbedding('model-a'), artifacts(TEXTS)).reindex({
      workspaceId: 'ws_1',
      sourceType: 'requirement',
      sourceId: 'rq_1',
      sourceVersion: 'v1',
    });
    // Same dimension, different model: the dangerous case.
    const search = new SearchService(vectors, fixtureEmbedding('model-b'), null, { limit: 10 });
    await expect(search.search({ workspaceId: 'ws_1', objective: 'notification' })).rejects.toThrow(
      /model-a[\s\S]*model-b|model-b[\s\S]*model-a/,
    );
  });

  it('and refuses a mixed index even when some entries match', async () => {
    const { store, vectors } = await world();
    await new IndexService(store, vectors, fixtureEmbedding('model-a'), artifacts(TEXTS)).reindex({
      workspaceId: 'ws_1', sourceType: 'requirement', sourceId: 'rq_1', sourceVersion: 'v1',
    });
    await new IndexService(store, vectors, fixtureEmbedding('model-b'), artifacts(TEXTS)).reindex({
      workspaceId: 'ws_1', sourceType: 'requirement', sourceId: 'rq_2', sourceVersion: 'v1',
    });
    const search = new SearchService(vectors, fixtureEmbedding('model-b'), null, { limit: 10 });
    await expect(search.search({ workspaceId: 'ws_1', objective: 'invoice' })).rejects.toThrow(/R-038-4/);
  });

  it('the control: a single-model index ranks, and reports the model', async () => {
    const { store, vectors } = await world();
    const index = new IndexService(store, vectors, fixtureEmbedding('model-a'), artifacts(TEXTS));
    for (const sourceId of ['rq_1', 'rq_2']) {
      await index.reindex({ workspaceId: 'ws_1', sourceType: 'requirement', sourceId, sourceVersion: 'v1' });
    }
    const out = await new SearchService(vectors, fixtureEmbedding('model-a'), null, { limit: 10 }).search({
      workspaceId: 'ws_1',
      objective: 'booking notification',
    });
    expect(out.modelId).toBe('model-a');
    expect(out.candidates[0]?.sourceId).toBe('rq_1');
  });

  it('an index never built refuses rather than returning nothing (FR-CTX-012)', async () => {
    const { vectors } = await world();
    await expect(
      new SearchService(vectors, fixtureEmbedding('model-a'), null, { limit: 10 }).search({
        workspaceId: 'ws_1',
        objective: 'anything',
      }),
    ).rejects.toThrow(/never been built|FR-CTX-012/);
  });
});
