/**
 * `T1854` (EPIC-038 Convergence) — an entry with no vector is not current.
 *
 * `FR-CTX-018`. Re-indexing writes the entry and then attaches its vector, as
 * two steps. If the second failed, the entry existed with no embedding — and a
 * later re-index of the same version answered `current` without embedding it,
 * so the source could never be ranked again and nothing would ever say so.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { IndexService } from '../../src/modules/context/retrieval/index.service.js';
import { InMemoryVectorIndex, type VectorIndex } from '../../src/modules/context/retrieval/vector.index.js';
import { artifacts, fixtureEmbedding } from '../helpers/context-retrieval-fixtures.js';

describe('T1854 · a partly written entry is re-embedded', () => {
  it('re-indexing the same version after a failed attach embeds it again', async () => {
    const store = new InMemoryContextStore();
    await store.addSourceClass({
      id: 'sc', workspaceId: 'ws_1', sourceType: 'requirement', securityClassification: 'internal', indexable: true,
    });
    const real = new InMemoryVectorIndex();
    let failNext = true;
    const flaky: VectorIndex = {
      prepare: (w, d) => real.prepare(w, d),
      async attach(entry, vector) {
        if (failNext) {
          failNext = false;
          throw new Error('connection reset during attach');
        }
        return real.attach(entry, vector);
      },
      isEmbedded: (w, t, id) => real.isEmbedded(w, t, id),
      modelsIn: (w) => real.modelsIn(w),
      nearest: (q) => real.nearest(q),
    };
    const embedding = fixtureEmbedding();
    const index = new IndexService(store, flaky, embedding, artifacts({ 'requirement:rq_1@v1': 'booking' }));
    const ref = { workspaceId: 'ws_1', sourceType: 'requirement', sourceId: 'rq_1', sourceVersion: 'v1' };

    await expect(index.reindex(ref)).rejects.toThrow(/attach/);
    const calls = embedding.calls;
    const second = await index.reindex(ref);

    expect(second.status).toBe('indexed');
    expect(embedding.calls).toBe(calls + 1);
    expect(await real.isEmbedded('ws_1', 'requirement', 'rq_1')).toBe(true);
  });

  it('the control: a fully written entry at the same version is current and not re-embedded', async () => {
    const store = new InMemoryContextStore();
    await store.addSourceClass({
      id: 'sc', workspaceId: 'ws_1', sourceType: 'requirement', securityClassification: 'internal', indexable: true,
    });
    const embedding = fixtureEmbedding();
    const index = new IndexService(store, new InMemoryVectorIndex(), embedding, artifacts({ 'requirement:rq_1@v1': 'booking' }));
    const ref = { workspaceId: 'ws_1', sourceType: 'requirement', sourceId: 'rq_1', sourceVersion: 'v1' };
    await index.reindex(ref);
    const calls = embedding.calls;
    expect((await index.reindex(ref)).status).toBe('current');
    expect(embedding.calls).toBe(calls);
  });
});
