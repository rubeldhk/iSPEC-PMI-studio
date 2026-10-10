/**
 * `T1836` (EPIC-038 Convergence) — an unanswerable index is a `503`.
 *
 * `FR-CTX-012` and the contract: *"Index unavailable or never built — 503"*, and
 * *"503 for a capability that exists and is not currently answerable"*. Search
 * raised `ProviderUnavailableError`, which this platform maps to `502` — a
 * statement that an upstream answered badly, which is not what happened. Hidden
 * only because the unbound embedding seam refuses with `503` first.
 */
import { describe, expect, it } from 'vitest';
import { toHttpStatus } from '../../src/core/errors.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { IndexService } from '../../src/modules/context/retrieval/index.service.js';
import { SearchService } from '../../src/modules/context/retrieval/search.service.js';
import { InMemoryVectorIndex, type NearestRow, type VectorIndex } from '../../src/modules/context/retrieval/vector.index.js';
import { artifacts, fixtureEmbedding } from '../helpers/context-retrieval-fixtures.js';

async function statusOf(attempt: Promise<unknown>): Promise<number> {
  try {
    await attempt;
  } catch (error) {
    return toHttpStatus(error);
  }
  throw new Error('expected a refusal');
}

async function indexed(model = 'model-a'): Promise<InMemoryVectorIndex> {
  const store = new InMemoryContextStore();
  await store.addSourceClass({
    id: 'sc', workspaceId: 'ws_1', sourceType: 'requirement', securityClassification: 'internal', indexable: true,
  });
  const vectors = new InMemoryVectorIndex();
  await new IndexService(store, vectors, fixtureEmbedding(model), artifacts({ 'requirement:rq_1@v1': 'booking' })).reindex({
    workspaceId: 'ws_1', sourceType: 'requirement', sourceId: 'rq_1', sourceVersion: 'v1',
  });
  return vectors;
}

const ask = { workspaceId: 'ws_1', objective: 'booking' };

describe('T1836 · index refusals are 503', () => {
  it('never built', async () => {
    const search = new SearchService(new InMemoryVectorIndex(), fixtureEmbedding(), null, { limit: 10 });
    expect(await statusOf(search.search(ask))).toBe(503);
  });

  it('mixed models', async () => {
    const search = new SearchService(await indexed('model-a'), fixtureEmbedding('model-b'), null, { limit: 10 });
    expect(await statusOf(search.search(ask))).toBe(503);
  });

  it('a neighbour with no distance', async () => {
    const real = await indexed();
    const broken: VectorIndex = {
      prepare: (w, d) => real.prepare(w, d),
      attach: (e, v) => real.attach(e, v),
      isEmbedded: (w, t, id) => real.isEmbedded(w, t, id),
      modelsIn: (w) => real.modelsIn(w),
      async nearest(q): Promise<NearestRow[]> {
        return (await real.nearest(q)).map((r) => ({ ...r, distance: null }));
      },
    };
    expect(await statusOf(new SearchService(broken, fixtureEmbedding(), null, { limit: 10 }).search(ask))).toBe(503);
  });

  it('a version-reader outage', async () => {
    const search = new SearchService(await indexed(), fixtureEmbedding(), {
      async currentVersion() {
        throw new Error('register unreachable');
      },
    }, { limit: 10 });
    expect(await statusOf(search.search(ask))).toBe(503);
  });
});
